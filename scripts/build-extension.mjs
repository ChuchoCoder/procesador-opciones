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
    // 1. Build SPA
    run('npm run build', frontendDir);

    // 2. Limpiar salida previa
    await fs.remove(outDir);
    await fs.mkdirp(outDir);

    // 3. Copiar manifest e iconos raíz
    const manifestSrc = path.join(root, 'manifest.json');
    const icons = ['icon16.png', 'icon48.png', 'icon128.png'];
    await fs.copy(manifestSrc, path.join(outDir, 'manifest.json'));
    for (const icon of icons) {
      const iconPath = path.join(root, icon);
      if (await fs.pathExists(iconPath)) {
        await fs.copy(iconPath, path.join(outDir, icon));
      }
    }

    // 4. Copiar dist de Vite
    await fs.copy(distDir, outDir, { overwrite: true, errorOnExist: false });

    // 5. Renombrar index.html -> popup.html si corresponde
    const indexHtml = path.join(outDir, 'index.html');
    const popupHtml = path.join(outDir, 'popup.html');
    if (await fs.pathExists(indexHtml)) {
      await fs.move(indexHtml, popupHtml, { overwrite: true });
      console.log('[build-extension] Renombrado index.html -> popup.html');
    }

    // 6. Ajustar manifest si fuera necesario (default_popup ya es popup.html)
    const manifestPath = path.join(outDir, 'manifest.json');
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    if (manifest?.action?.default_popup !== 'popup.html') {
      manifest.action = manifest.action || {};
      manifest.action.default_popup = 'popup.html';
      await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
      console.log('[build-extension] Manifest actualizado con default_popup=popup.html');
    }

    console.log('\n✅ Build de extensión listo en extension-dist/.');
    console.log('Cargá esa carpeta en chrome://extensions (Modo desarrollador)');
  } catch (err) {
    console.error('❌ Error en build-extension:', err);
    process.exit(1);
  }
})();
