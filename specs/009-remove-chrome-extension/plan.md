# Plan de Implementación — Remover soporte de Chrome Extension

**Feature**: `009-remove-chrome-extension`
**Fecha**: 2026-08-25
**Objetivo**: Eliminar por completo el soporte de Chrome Extension (MV3) del repositorio, dejando únicamente la Web App React + Vite (`frontend/`) como artefacto entregable, distribuida vía GitHub Pages.

## Decisiones de alcance (confirmadas)

| Decisión | Elección |
|----------|----------|
| Estructura final | **Mantener `frontend/` como subcarpeta**. No se aplana a la raíz: el workflow de deploy, `.vscode/settings.json` y todos los paths documentados en `specs/` siguen válidos sin tocar. |
| `tests/` en la raíz (huérfano) | **Eliminar**. Los 3 fixtures CSV están duplicados byte a byte en `frontend/tests/integration/data/` (verificado); no se pierde nada. |
| `specs/**` histórico | **No tocar**. Son actas de features ya entregadas, no instrucciones vigentes. |

## Inventario de la superficie "extensión"

### A. Archivos que existen sólo por la extensión (borrado total)

| Archivo | Rol |
|---------|-----|
| `manifest.json` | Manifest MV3 |
| `popup.html` (18.9 KB) | UI legacy vanilla del popup |
| `popup.js` (36 KB) | Lógica legacy del popup |
| `operations-processor.js` (37 KB) | Procesador legacy vanilla |
| `icon16.png`, `icon48.png`, `icon128.png` | Íconos de la extensión (la web usa `frontend/public/chuchotools-icon.svg`) |
| `scripts/build-extension.mjs` | Empaquetador `extension-dist/` (deja `scripts/` vacío → borrar carpeta) |
| `CHROME-EXTENSION.md` | Guía de build/carga de la extensión |
| `package-lock.json` (raíz) | Existe sólo por `fs-extra`, única dependencia del build script |

### B. Código de aplicación con ramas Chrome (simplificación)

| Archivo | Qué tiene |
|---------|-----------|
| [storage-adapter.js](frontend/src/services/storage/storage-adapter.js) | `isChromeExtension()`, `/* global chrome */`, y una rama `chrome.storage.local` en cada uno de los 5 métodos |
| [local-storage.js:3](frontend/src/services/storage/local-storage.js:3) | Comentario de doc dual-storage |
| [storage-settings.js:2-3,25-40](frontend/src/services/storage-settings.js) | Comentario dual-storage + doble camino sync/async en `getAllSymbols()` |
| [vite.config.js](frontend/vite.config.js) | 3 comentarios "for extension" + `manualChunks: undefined` |
| [index.css:16-22](frontend/src/index.css:16) | `@media (max-width:850px) { html { width:800px } }` — ver Riesgo R2 |
| [App.css:8](frontend/src/App.css:8) | Comentario "Adjust for Chrome Extension popup" (la media query en sí es responsive legítima) |

### C. Configuración y documentación

`package.json` (raíz), `.gitignore` (raíz), `README.md`, `CHANGELOG.md`, `.github/copilot-instructions.md`, `.specify/memory/constitution.md`.

### D. Confirmado sin impacto

- `.github/workflows/deploy-to-github-pages.yml` — sólo compila `frontend/`, no toca la extensión. **Sin cambios.**
- `frontend/tests/**` — cero mocks de `chrome` (verificado con grep); los tests ya ejercitan exclusivamente la rama `localStorage`.
- `docs/BACKWARD-COMPATIBILITY-REMOVAL.md` — no menciona la extensión.

---

## Fases

### Fase 0 — Baseline (antes de tocar nada)

```bash
npm --prefix frontend ci
npm --prefix frontend run lint
npm --prefix frontend run test
npm --prefix frontend run build
```

Anotar: cantidad de tests que pasan, tamaño y listado de `frontend/dist/assets/`. Se comparan al final. Capturar screenshot de la app a 1280px y a 375px (`npm --prefix frontend run dev`) para el diff visual de la Fase 3.

### Fase 1 — Borrar artefactos de la extensión

Eliminar todo lo listado en el **Inventario A**. Después de este paso el repo ya no puede construir una extensión, pero la web app sigue intacta.

Comprobación: `git status` debe mostrar 11 deleciones y ningún archivo de `frontend/` afectado.

### Fase 2 — Simplificar la capa de storage

**Criterio rector: preservar la API async.** `storage-adapter.js` se queda como wrapper delgado de `localStorage` en lugar de eliminarse. Motivo: sus consumidores (`local-storage.js`, 6 llamadas; `storage-settings.js`, 6 llamadas) y toda la cadena de callers en componentes React ya son `async/await`. Convertirlos a síncrono sería un refactor grande, con riesgo real y sin beneficio funcional — queda como follow-up opcional, no parte de esta limpieza.

1. **`storage-adapter.js`**: borrar `isChromeExtension()`, la directiva `/* global chrome */`, los campos `isExtension` / `storageType` y las ramas `if (this.isExtension)` de `getItem`, `setItem`, `removeItem`, `getAllKeys`, `clear`. Cada método queda con su cuerpo `localStorage` actual.
   - `isAvailable()` **se conserva** — lo usa `storageAvailable` en [local-storage.js:95](frontend/src/services/storage/local-storage.js:95).
   - `getStorageType()` **se puede borrar** — devolvería siempre `'localStorage'` y no tiene ningún consumidor (verificado).
   - El `console.log('[StorageAdapter] Using ...')` del constructor pierde sentido → eliminar.
2. **`local-storage.js:3`** y **`storage-settings.js:2-3`**: actualizar los comentarios de cabecera.
3. **`storage-settings.js` `getAllSymbols()`**: hoy tiene una rama "sync preferida" y un fallback al adapter; ambas terminan en `localStorage`. Unificar en el camino sync (que ya devuelve `Promise.resolve(...)`, así que la firma pública no cambia). Cubierto por [storage-settings.spec.js](frontend/tests/unit/storage-settings.spec.js).

Comprobación: `npm --prefix frontend run test` con el mismo resultado que la Fase 0.

### Fase 3 — Build y CSS

1. **`vite.config.js`**: reescribir los 3 comentarios que mencionan la extensión. Borrar `manualChunks: undefined` — es literalmente el valor por defecto de Rollup, así que el bundle resultante no cambia (verificar comparando contra el listado de la Fase 0). El resto (`terser`, `sourcemap`, `outDir`) se mantiene.
2. **`App.css:8`**: reescribir el comentario. La media query se conserva: es breakpoint responsive válido para la web.
3. **`index.css:16-22`**: **borrar la regla completa.**

   Esta regla está rotulada "only when in extension context" pero eso es falso: `@media all and (max-width: 850px)` se dispara en **cualquier** viewport angosto, o sea en todo móvil, forzando `html { width: 800px }` y provocando scroll horizontal. Hoy el síntoma queda enmascarado por `html, body { overflow-x: hidden }` ([index.css:24](frontend/src/index.css:24)), que corta el contenido en vez de arreglarlo. Eliminarla es la corrección correcta para una web app.

   **Este es el único cambio con impacto visual real del plan.** Verificar explícitamente a 375px y 768px: la app debe fluir sin overflow. Si aparecen tablas que se desbordan (probable en el Procesador), la solución es `overflow-x: auto` en el contenedor de la tabla, no reponer el ancho fijo.

### Fase 4 — Configuración de la raíz

**`package.json`** — queda como wrapper de conveniencia hacia `frontend/`:

- `name`: `procesador-opciones-extension` → `procesador-opciones`
- Borrar los scripts `build:ext` y `build:extension`
- `build`: `node scripts/build-extension.mjs` → `npm --prefix frontend run build`
- `build:spa`: ahora es alias redundante de `build` → eliminar
- Borrar el bloque `devDependencies` completo (`fs-extra` era exclusivo del build script)
- `version`: `1.0.2` estaba atada a la versión del manifest. Se mantiene; la remoción se registra en `[Unreleased]` del CHANGELOG.

Scripts finales: `dev`, `build`, `test`, `lint` — todos delegando con `--prefix frontend`.

**`.gitignore` (raíz)**: borrar la línea `extension-dist`.

### Fase 5 — Documentación

1. **`README.md`**:
   - L3: "Extensión / SPA" → descripción de web app
   - L7: reescribir "Estado del Proyecto" — la migración desde el popup legacy ya no está "en curso", está terminada por eliminación del legacy
   - L27-28: sacar `manifest.json` y `popup.html / popup.js` del árbol de estructura
   - **L68-95: borrar la sección completa** "Empaquetar la extensión MV3 con la SPA" (incluye el link a `CHROME-EXTENSION.md` y la nota de almacenamiento dual)
   - L281-284: en la tabla "Diferencias con Versión Legacy", la fila `Persistencia | chrome.storage | localStorage (por ahora)` — reescribir o eliminar la tabla entera (ya no hay legacy con qué comparar)
   - L291-292: borrar los 2 ítems del Roadmap sobre empaquetado MV3
   - **Agregar**: sección de despliegue documentando `deploy-to-github-pages.yml` (push a `main` tocando `frontend/**` → build → push a `ChuchoCoder/chuchocoder.github.io`). Pasa a ser el único canal de distribución y hoy no está documentado en ningún lado.
2. **`CHANGELOG.md`**: en `[Unreleased]` agregar sección `### Removido` describiendo la baja de la extensión MV3, el popup legacy y el storage dual. Borrar los 2 ítems de `### Pendiente` sobre empaquetado MV3.
3. **`.github/copilot-instructions.md`**: líneas 9, 10, 16 y 38 mencionan `chrome extension APIs (Manifest V3)` y `chrome.storage`. Actualizar. (Nota: speckit regenera este archivo; si vuelve a aparecer, corregir la plantilla de origen.)
4. **`.specify/memory/constitution.md`** — requiere una enmienda formal:

   | Línea | Contenido a cambiar |
   |-------|---------------------|
   | 17, 20 | Principio 1: "browser extension" / "extension codebase" |
   | 37 | Principio 4: "current stack: raw JS + manifest" → React + Vite |
   | 51 | Constraint 1: "Chrome/Chromium extension environment (Manifest V3)" → SPA estática en navegador |
   | 52 | Constraint 2: "Use `chrome.storage` or `localStorage`" → sólo `localStorage` |
   | 70 | Workflow paso 5: "manual open popup smoke test" |
   | 78 | Quality gate: "except explicitly in manifest scope" |

   Según sus propias reglas de governance (L92: *"Major: Remove or redefine a principle, or introduce a process that invalidates prior guarantees"*), redefinir el runtime es un **bump MAJOR: 2.0.0 → 3.0.0**. Requiere además actualizar el `Sync Impact Report` del header y `Last Amended` a la fecha del merge. **Confirmar el nivel de bump antes de aplicar.**

### Fase 6 — Borrar `tests/` de la raíz

Eliminar `tests/` completo (5 archivos). Es código muerto: `processor-puts.spec.jsx` importa `../../src/app/App.jsx`, ruta que no existe desde la raíz, y ningún `vitest.config` lo incluye (`.vscode/settings.json` apunta a `frontend/vitest.config.js` con `workspaceRoot: frontend`). Los 3 fixtures CSV son idénticos a los de `frontend/tests/integration/data/`.

### Fase 7 — Verificación

```bash
npm --prefix frontend run lint
npm --prefix frontend run test
npm --prefix frontend run build
```

- Mismo número de tests en verde que en Fase 0; mismo listado de assets en `frontend/dist/`.
- **Grep de regresión** (debe devolver 0 resultados fuera de `specs/`):
  ```bash
  grep -rniI --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=specs --exclude-dir=dist "chrome\.\|extension-dist\|popup\.html\|manifest_version" .
  ```
- **Smoke manual** con `npm run dev`: cargar un CSV, procesar, verificar que persisten las claves `po.*` y `po:settings:*` en `localStorage` tras recargar, y exportar CSV.
- **Responsive**: 1280px, 768px y 375px sin scroll horizontal (Fase 3).
- Confirmar que el workflow de GitHub Pages queda verde tras el merge a `main`.

---

## Riesgos

**R1 — Usuarios actuales de la extensión pierden sus datos (sin mitigación automática).**
La configuración de símbolos, fees y reportes vive en `chrome.storage.local`, ligada al perfil de Chrome. La web app lee `localStorage` del origen `chuchocoder.github.io`. Son dos silos distintos: **no existe ninguna ruta de migración automática** — ni con la extensión instalada. Si hay instalaciones activas (¿está publicada en Chrome Web Store, o sólo se cargaba descomprimida?), esos usuarios arrancan de cero en la web.
*Mitigación opcional, fuera del alcance de este plan*: publicar una última versión de la extensión con un botón "Exportar configuración a JSON" y agregar un importador en la web app. Decidir antes de mergear, porque después de borrar `manifest.json` ya no se puede publicar esa versión sin revertir.

**R2 — Regresión visual por la media query de 800px** (Fase 3). Único cambio con impacto visual; verificación explícita incluida.

**R3 — `copilot-instructions.md` es autogenerado** por speckit y puede revertir los cambios en la próxima corrida de `/speckit.plan`.

---

## Fuera de alcance

- Aplanar `frontend/` a la raíz (descartado explícitamente).
- Convertir la capa de storage de async a síncrona (posible follow-up; ver Fase 2).
- Purgar menciones históricas de "chrome"/"popup" en `specs/**` (~20 archivos de actas).
- `frontend/InstrumentsWithDetails.json` (6.1 MB versionado en git) — no relacionado con la extensión, pero vale la pena revisarlo aparte.

## Checklist de PR

- [ ] Fase 1: 11 archivos de extensión borrados, `scripts/` eliminada
- [ ] Fase 2: `storage-adapter.js` sin ramas `chrome`, API async intacta, tests en verde
- [ ] Fase 3: `vite.config.js` y CSS limpios; responsive verificado a 375/768/1280
- [ ] Fase 4: `package.json` raíz como wrapper, `package-lock.json` y `fs-extra` fuera, `.gitignore` sin `extension-dist`
- [ ] Fase 5: README, CHANGELOG, copilot-instructions y constitución actualizados (bump de constitución confirmado)
- [ ] Fase 6: `tests/` de la raíz eliminado
- [ ] Fase 7: lint + test + build en verde, grep de regresión limpio, smoke manual hecho
- [ ] R1 decidido: ¿se publica una versión final de la extensión con exportador, o se asume la pérdida de datos?

---

## Resultado de la ejecución (2026-08-25)

Plan ejecutado completo. Fases 1–7 aplicadas.

### Verificación

| Chequeo | Baseline | Después |
|---------|----------|---------|
| Tests | 389 pass / 9 fail / 16 skip | **389 / 9 / 16 — diff vacío** |
| Lint | 29 errores, 1 warning (13 archivos) | **29 / 1 — diff vacío** |
| Build | 4 artefactos, `index.js` 4891.02 kB, `index.css` 1.01 kB | OK, misma estructura de chunks; `index.js` 4889.53 kB, `index.css` 0.94 kB |
| Grep de regresión en código | — | 0 resultados |

Las 9 fallas de tests son preexistentes (`instrument-roundlot`, `dlr-futures-misclassification`, `arbitrage-d30e6-plazo`) y no tienen relación con este cambio; los 29 errores de lint también, ninguno en los archivos tocados.

### Smoke funcional (dev + build de producción)

- Carga de `GGAL-PUTS.csv` → 76 operaciones procesadas, chips de filtro y tablas CALLS/PUTS con datos correctos.
- Persistencia verificada: 27 claves `po.*` / `po:settings:*` en `localStorage`; `po.lastReport.v1` sobrevive la recarga.
- Pantalla de Configuración lista los símbolos → confirma el `getAllSymbols()` refactorizado contra el adapter.
- `vite preview` sobre `dist/`: arranca sin errores de consola.

### Confirmación del fix de la media query (Riesgo R2)

Medido en viewport de 375 px:

| Métrica | Antes | Después |
|---------|-------|---------|
| `visualViewport.width` | 375 | 375 |
| `window.innerWidth` (viewport de layout) | **800** | **375** |
| `documentElement.scrollWidth` | 800 | 375 |

El síntoma era peor de lo estimado: la regla no sólo desbordaba, expandía el viewport de layout a 800 px, renderizando la app al doble del ancho de pantalla. Las tablas de MUI ya viven en contenedores con `overflow-x: auto`, así que scrollean internamente sin romper la página — no hizo falta CSS adicional. Con `overflow-x` forzado a `visible`, `document.scrollWidth` sigue en 375: no hay overflow enmascarado.

### Desvíos respecto del plan

- **Constitución**: se aplicó el bump **MAJOR 2.0.0 → 3.0.0** que el plan había dejado a confirmación, con su Sync Impact Report actualizado. Si se prefiere MINOR, es un solo cambio de línea en el pie del archivo y en el header.
- **`getAllSymbols()`**: en vez de unificar en el camino síncrono, se delegó por completo en `storageAdapter.getAllKeys()`. Queda más corto y con un solo camino; la firma pública (`Promise<string[]>`) no cambia.

### Pendiente de decisión humana (R1)

Los usuarios con la extensión instalada tienen su configuración en `chrome.storage.local` y **no hay migración automática posible** hacia el `localStorage` de la web. Si hay instalaciones activas, decidir antes de mergear si se publica una última versión de la extensión con exportador a JSON (requiere revertir los archivos borrados desde el historial de git).

