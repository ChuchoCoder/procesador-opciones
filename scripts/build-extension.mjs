#!/usr/bin/env node
import { execSync } from 'node:child_process';
import fs from 'fs-extra';
import path from 'node:path';

const root = process.cwd();
const frontendDir = path.join(root, 'frontend');
const distDir = path.join(frontendDir, 'dist');
const outDir = path.join(root, 'extension-dist');

function run(cmd, cwd = root) {
  console.log(`[build-extension] Ejecutando: ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd });
}

(async () => {
  try {
    console.log('[build-extension] Iniciando build de extensión Chrome...\n');

    // 1. Build SPA con Vite (minificado y optimizado)
    console.log('[build-extension] Paso 1/6: Compilando frontend con Vite...');
    run('npm run build', frontendDir);

    // 2. Limpiar salida previa
    console.log('[build-extension] Paso 2/6: Limpiando directorio de salida...');
    await fs.remove(outDir);
    await fs.mkdirp(outDir);

    // 3. Copiar manifest e iconos raíz
    console.log('[build-extension] Paso 3/6: Copiando manifest e iconos...');
    const manifestSrc = path.join(root, 'manifest.json');
    const icons = ['icon16.png', 'icon48.png', 'icon128.png'];
    await fs.copy(manifestSrc, path.join(outDir, 'manifest.json'));
    
    let iconsCopied = 0;
    for (const icon of icons) {
      const iconPath = path.join(root, icon);
      if (await fs.pathExists(iconPath)) {
        await fs.copy(iconPath, path.join(outDir, icon));
        iconsCopied++;
      }
    }
    console.log(`[build-extension] Copiados ${iconsCopied} iconos`);

    // 4. Copiar dist de Vite (archivos compilados y minificados)
    console.log('[build-extension] Paso 4/6: Copiando archivos compilados...');
    await fs.copy(distDir, outDir, { overwrite: true, errorOnExist: false });

    // 5. Renombrar index.html -> popup.html
    console.log('[build-extension] Paso 5/6: Configurando popup...');
    const indexHtml = path.join(outDir, 'index.html');
    const popupHtml = path.join(outDir, 'popup.html');
    if (await fs.pathExists(indexHtml)) {
      await fs.move(indexHtml, popupHtml, { overwrite: true });
      console.log('[build-extension] Renombrado index.html -> popup.html');
    }

    // 6. Verificar y ajustar manifest
    console.log('[build-extension] Paso 6/6: Verificando manifest...');
    const manifestPath = path.join(outDir, 'manifest.json');
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    
    let manifestUpdated = false;
    if (manifest?.action?.default_popup !== 'popup.html') {
      manifest.action = manifest.action || {};
      manifest.action.default_popup = 'popup.html';
      manifestUpdated = true;
    }
    
    // Ensure storage permission is present
    if (!manifest.permissions || !manifest.permissions.includes('storage')) {
      manifest.permissions = manifest.permissions || [];
      if (!manifest.permissions.includes('storage')) {
        manifest.permissions.push('storage');
        manifestUpdated = true;
      }
    }
    
    if (manifestUpdated) {
      await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
      console.log('[build-extension] Manifest actualizado');
    }

    // 7. Verificar tamaño del bundle
    const stats = await fs.stat(outDir);
    console.log(`\n[build-extension] Tamaño total del bundle: ~${Math.round(stats.size / 1024)} KB`);

    console.log('\n✅ Build de extensión completado exitosamente!');
    console.log('📦 Ubicación: extension-dist/');
    console.log('\n📋 Para cargar la extensión:');
    console.log('   1. Abrí chrome://extensions en Chrome');
    console.log('   2. Activá el "Modo de desarrollador" (arriba a la derecha)');
    console.log('   3. Hacé clic en "Cargar extensión sin empaquetar"');
    console.log('   4. Seleccioná la carpeta: extension-dist/\n');
  } catch (err) {
    console.error('\n❌ Error en build-extension:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
})();
