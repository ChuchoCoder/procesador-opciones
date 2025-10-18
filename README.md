# Procesador de Opciones

Extensión / SPA para procesar operaciones de opciones desde archivos CSV con vistas separadas CALLS / PUTS y modo de promedios por strike.

## ⚠️ Estado del Proyecto

Migración en curso desde un popup HTML (Vanilla JS) a una Single Page Application React + Vite + Material UI. El código legacy (archivos `popup.html`, `popup.js`, `operations-processor.js`) convive temporalmente mientras se completa la transición. La funcionalidad principal nueva vive bajo `frontend/`.

## ✨ Características Clave

- Procesamiento de archivos CSV (Papaparse) con filtros por símbolo y vencimiento
- Vista dividida: pestañas CALLS / PUTS + indicador de vista actual
- **Cálculo de gastos (fees) por operación**: comisión, derechos de mercado e IVA con tooltip detallado
- Filtro de grupos derivado automáticamente y persistencia de selección reciente
- Modo de promedios (opcional): consolida operaciones por strike sumando cantidades y recalculando precio promedio ponderado
- Acciones de exportación: copiar o descargar CSV (vista actual, CALLS, PUTS o combinado)
- Persistencia local (localStorage) de configuración (símbolos, vencimientos, selección actual, preferencia de promedios)
- Advertencias para archivos grandes (>25.000 filas) y corte duro a 50.000 filas
- Mensajes de error y estado en español (locale `es-AR`)
- Pruebas unitarias + integración (Vitest + Testing Library)
- Linter (ESLint) + formateo consistente (Prettier)

## 🗂 Estructura (parcial)

```text
procesador-opciones/
├── manifest.json                 # Manifest MV3 base (versión legacy 1.0.x)
├── popup.html / popup.js         # UI legacy (en proceso de migración)
├── operations-processor.js       # Lógica legacy de procesamiento
├── frontend/                     # Nueva SPA React
│   ├── src/
│   │   ├── main.jsx             # Entrada React
│   │   ├── state/               # Contexto y hooks de configuración
│   │   ├── components/          # Componentes UI
│   │   ├── services/            # Servicios (parsing, export, clipboard)
│   │   ├── processors/          # Lógica de consolidación / promedios
│   │   └── strings/es-AR.js     # Textos
│   ├── tests/                   # Unit + integration tests
│   ├── vite.config.js
│   └── vitest.config.js
└── README.md
```

> Nota: Algunas carpetas pueden no existir aún si la migración está en progreso; ajustar según evolucione el repositorio.

## 🚀 Instalación (Modo Desarrollo SPA)

Requisitos: Node.js 18+ (recomendado LTS), npm.

```bash
git clone https://github.com/ChuchoCoder/procesador-opciones.git
cd procesador-opciones/frontend
npm install
npm run dev
```

Abrí el navegador en la URL que imprima Vite (por defecto `http://localhost:5173`).

### Construir para producción (bundle SPA)

```bash
cd frontend
npm run build
```

Los artefactos quedarán en `frontend/dist/`.

### Empaquetar la extensión MV3 con la SPA

Se provee un script que genera `extension-dist/` lista para cargar en `chrome://extensions`.

Paso a paso:

```bash
npm run build:ext
```

Esto realiza:

1. `npm run build` dentro de `frontend/`.
2. Copia `manifest.json` e íconos a `extension-dist/`.
3. Copia el contenido de `frontend/dist/`.
4. Renombra `index.html` a `popup.html` y asegura que `manifest.json` apunte a ese archivo.

Luego:

1. Abrí `chrome://extensions`.
2. Activá Modo desarrollador.
3. Clic en "Cargar descomprimida" y seleccioná `extension-dist/`.

📖 **Para más información sobre la extensión Chrome y el sistema de almacenamiento dual, consultá [CHROME-EXTENSION.md](./CHROME-EXTENSION.md)**

> Si necesitás mantener el popup legacy por transición, podés conservarlo separado; este flujo lo reemplaza por la SPA.

**Nota sobre almacenamiento:** La aplicación ahora usa un sistema dual que detecta automáticamente si está ejecutándose como extensión (`chrome.storage.local`) o como web app (`localStorage`). Todas las operaciones de almacenamiento son ahora asíncronas.

## 🧪 Pruebas

Ejecutar todo el suite:

```bash
cd frontend
npm test
```

Modo watch:

```bash
npm run test:watch
```

Cobertura (si se añade configuración): ejecutar Vitest con `--coverage` (no configurado por defecto en este commit).

## 💸 Configuración de Gastos (Fees) (Feature 004)

La funcionalidad de gastos por operación usa un archivo de configuración JSON en `frontend/src/services/fees/fees-config.json` con el siguiente esquema:

```json
{
  "byma": {
    "derechosMercadoPct": 0.00005,
    "caucionesPct": 0.00002,
    "vatPct": 0.21
  },
  "broker": {
    "commissionAccionCedearPct": 0.0006,
    "commissionLetraPct": 0.0004,
    "commissionBondPct": 0.0005,
    "commissionOptionPct": 0.0006,
    "commissionCaucionPct": 0.0003
  }
}
```

Notas:

- Todos los valores son porcentajes expresados como fracciones (0.0006 = 0.06%).
- `vatPct` representa IVA aplicado sobre (comisión + derechos).
- Si algún valor es inválido o falta, la validación futura lo sanitiza a 0 (o 0.21 para IVA por defecto).
- El flag para habilitar cauciones (`ENABLE_CAUCION_FEES`) vive en `fees-flags.js` y está desactivado inicialmente.

Uso básico (fase inicial): el bootstrap carga el JSON de forma síncrona y lo expone para el cálculo de gastos en módulos posteriores.

### Visualización de Gastos en la Tabla

Cada fila de operación muestra una columna "Gastos" con el monto total calculado en pesos argentinos (ARS). Al pasar el cursor sobre el monto, aparece un tooltip detallado con:

- **Categoría**: Tipo de instrumento (Opción, Acción/CEDAR, Letra, Bono)
- **Bruto**: Importe bruto de la operación (cantidad × precio)
- **Comisión**: Monto y porcentaje aplicado
- **Derechos**: Derechos de mercado (BYMA) y porcentaje
- **IVA**: Impuesto al valor agregado sobre la suma de comisión + derechos
- **Total**: Suma de todos los componentes (coincide con el valor mostrado en la celda)
- **Fuente**: Indica si proviene de configuración o es un placeholder

Para operaciones de caución (cuando la funcionalidad esté habilitada), se muestra "—" con tooltip "Próximamente".

### Modificar Tasas de Gastos

Editá `frontend/src/services/fees/fees-config.json` ajustando los porcentajes deseados. Tras guardar el archivo, recargá la aplicación para aplicar los cambios. Los valores se validan automáticamente al inicio: números inválidos o negativos se reemplazan por 0 (excepto IVA que tiene un fallback de 0.21).



## 🧰 Linter & Formato

```bash
npm run lint       # Revisa reglas
npm run lint:fix   # Aplica autofix
```

Prettier se usa vía configuración `.prettierrc` (singleQuote, trailing commas, ancho 100).

## 🔧 Configuración y Persistencia

La configuración se guarda en `localStorage` del navegador:


Si el almacenamiento falla (modo privado estricto, etc.) se muestra un aviso y la sesión trabaja en memoria.

## 📄 Formato CSV Esperado

## 🔄 Sincronización Automática (Broker) (Preview)

La rama `004-integrate-jsrofex-to` agrega soporte para iniciar sesión contra un broker (jsRofex) y sincronizar automáticamente las operaciones del día sin necesidad de subir el CSV manualmente. El flujo CSV se mantiene como alternativa.

Placeholders creados (Fase 1 Setup):

- `frontend/src/services/broker/jsrofex-client.js`
- `frontend/src/services/broker/sync-service.js`
- `frontend/src/services/broker/dedupe-utils.js`
- Slices nuevas en el reducer (`brokerAuth`, `sync`, `stagingOps`)
- Instrumentación de performance (`performance-instrumentation.js`)
- Utilidad de logging (`broker-sync-log-util.js`)

Próximas fases implementarán:

- Autenticación y almacenamiento seguro de token (sin credenciales en estado persistido).
- Detección de duplicados y merge atómico.
- Progreso por página, cancelación y reintentos con backoff.

Ver guía rápida: `specs/004-integrate-jsrofex-to/quickstart.md`.

> Estado actual: sólo scaffolding. Lógica se añadirá en fases Foundational y US1.

Columnas mínimas utilizadas por el procesador React:

| Columna        | Uso / Validación                                                     |
|----------------|-----------------------------------------------------------------------|
| event_subtype  | Se filtra a `execution_report`                                        |
| ord_status     | Se aceptan estados ejecutados / parcialmente ejecutados               |
| text           | Se excluyen filas con `Order Updated`                                 |
| order_id       | Identificador único (evita duplicados)                                |
| symbol         | Símbolo completo de la opción (usado para separar CALLS / PUTS)       |
| side           | BUY / SELL                                                            |
| last_price     | Precio numérico                                                       |
| last_qty       | Cantidad numérica                                                     |

Reglas adicionales:

- Se ignoran filas corruptas (se informan mediante advertencia general)
- Límite suave: aviso >25.000 filas; límite duro: procesa solo hasta 50.000
- Precios se mantienen con hasta 4 decimales internos; salida formateada acorde

## 📊 Modo de Promedios

Cuando está activado “Promediar por strike”:

1. Agrupa operaciones por strike dentro de cada tipo (CALLS / PUTS).
2. Suma cantidades netas (BUY positivo, SELL negativo si aplica lógica interna—ver implementación).
3. Calcula un precio promedio ponderado por cantidad absoluta acumulada.
4. Genera una tabla compacta reduciendo ruido de múltiples fills.

Desactivar el modo muestra las operaciones originales (raw) sin consolidar.

## 🖥 Interfaz (SPA)

- Barra de navegación: pestañas “Procesador” y “Configuración”.
- Sección Procesar: selector de archivo, símbolo, vencimiento, switch de promedios, botón Procesar.
- Resumen: totales CALLS / PUTS y estado de promedios.
- Acciones: copiar / descargar según alcance (vista actual, llamadas, puts, combinado).
- Tablas: una por tipo, con columnas Cantidad, Strike, Precio.

## 🧭 Flujo Simplificado (Post-Migración)

1. Abrí la pestaña “Procesador” (la aplicación recuerda el último símbolo y vencimiento exitosos).
2. Arrastrá o seleccioná el archivo CSV con operaciones.
3. Presioná “Procesar” para generar resumen y grupos detectados automáticamente.
4. Elegí el grupo relevante desde los chips del encabezado (ej.: `GFG O`), verificá los totales en el panel de resumen.
5. Utilizá “Descargar PUTs” / “Descargar CALLs” / “Descargar todo” para obtener el CSV ya filtrado.

> Con esta secuencia el flujo se redujo de ~8 interacciones manuales (popup legacy) a 5 pasos guiados, con confirmación visual inmediata antes de exportar.

## 📁 Exportación

Opciones disponibles (según selección actual):

- Copiar vista actual (portapapeles)
- Descargar vista actual (CSV)
- Copiar / descargar CALLS
- Copiar / descargar PUTS
- Copiar / descargar combinados

Los CSV generados incluyen encabezados estándar y formateo consistente.

## 🧪 Pruebas (detalle)

- Unit: parsing, consolidación (promedios), servicios de exportación y clipboard, configuración.
- Integración: flujo de procesamiento, persistencia, toggle de vistas, settings.

## 🐛 Troubleshooting

| Problema | Posibles causas | Acciones |
|----------|-----------------|----------|
| Archivo no procesa | Formato inválido, columnas faltantes | Verificar encabezados y encoding UTF-8 |
| Lento / congelado | Archivo muy grande >25k filas | Esperar, dividir archivo o limpiar filas innecesarias |
| No persiste config | Almacenamiento bloqueado | Revisar modo incógnito / permisos browser |
| Copiar falla | Permisos del portapapeles | Reintentar foco en ventana activa |

## 🔄 Diferencias con Versión Legacy

| Aspecto | Legacy Popup | Nueva SPA |
|---------|--------------|----------|
| UI | HTML + JS plano | React + MUI |
| Persistencia | chrome.storage | localStorage (por ahora) |
| Promedios | Básico / limitado | Agrupación por strike con precio ponderado |
| Testing | Manual | Unit + Integración automatizada |
| Linter | No | Sí (ESLint + Prettier) |

## 📦 Roadmap Breve

- [ ] Integrar build SPA al paquete de extensión final
- [ ] Documentar estrategia de empaquetado MV3 + React
- [ ] Mejorar manejo de errores de parseo con listado detallado
- [ ] Agregar métricas de performance (tiempos de parse y consolidación)

## 📝 Changelog

Ver `CHANGELOG.md` para detalles de versiones (1.0.x) y desarrollo en curso (1.0.2 / migración React).

## 🤝 Contribuciones

Abrí un issue con propuestas o problemas. PRs bienvenidos una vez alineado el objetivo.

## 📄 Licencia

Uso abierto orientado a análisis de operaciones de opciones. Evaluar requisitos regulatorios y privacidad antes de usar con datos sensibles.

---

_Documento generado y actualizado durante la migración a la arquitectura React (locale es-AR)._
