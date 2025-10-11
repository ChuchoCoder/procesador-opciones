<div align="center">

# Procesador de Opciones

Extensión / SPA para procesar operaciones de opciones desde archivos CSV con vistas separadas CALLS / PUTS y modo de promedios por strike.

</div>

## ⚠️ Estado del Proyecto

Migración en curso desde un popup HTML (Vanilla JS) a una Single Page Application React + Vite + Material UI. El código legacy (archivos `popup.html`, `popup.js`, `operations-processor.js`) convive temporalmente mientras se completa la transición. La funcionalidad principal nueva vive bajo `frontend/`.

## ✨ Características Clave

- Procesamiento de archivos CSV (Papaparse) con filtros por símbolo y vencimiento
- Vista dividida: pestañas CALLS / PUTS + indicador de vista actual
- Modo de promedios (opcional): consolida operaciones por strike sumando cantidades y recalculando precio promedio ponderado
- Acciones de exportación: copiar o descargar CSV (vista actual, CALLS, PUTS o combinado)
- Persistencia local (localStorage) de configuración (símbolos, vencimientos, selección actual, preferencia de promedios)
- Advertencias para archivos grandes (>25.000 filas) y corte duro a 50.000 filas
- Mensajes de error y estado en español (locale `es-AR`)
- Pruebas unitarias + integración (Vitest + Testing Library)
- Linter (ESLint) + formateo consistente (Prettier)

## 🗂 Estructura (parcial)

```
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

```
git clone https://github.com/ChuchoCoder/procesador-opciones.git
cd procesador-opciones/frontend
npm install
npm run dev
```

Abrí el navegador en la URL que imprima Vite (por defecto `http://localhost:5173`).

### Construir para producción (bundle SPA)

```
cd frontend
npm run build
```

Los artefactos quedarán en `frontend/dist/` (aun no integrados al empaquetado final de la extensión). Para usar la versión React dentro de Chrome como extensión se requiere un paso adicional de integración (pendiente de documentación futura).

## 🧪 Pruebas

Ejecutar todo el suite:

```
cd frontend
npm test
```

Modo watch:

```
npm run test:watch
```

Cobertura (si se añade configuración): ejecutar Vitest con `--coverage` (no configurado por defecto en este commit).

## 🧰 Linter & Formato

```
npm run lint       # Revisa reglas
npm run lint:fix   # Aplica autofix
```

Prettier se usa vía configuración `.prettierrc` (singleQuote, trailing commas, ancho 100).

## 🔧 Configuración y Persistencia

La configuración se guarda en `localStorage` del navegador:

- Lista de símbolos personalizados
- Lista de vencimientos (nombre + sufijos)
- Símbolo activo y vencimiento activo
- Preferencia de “promediar por strike”

Si el almacenamiento falla (modo privado estricto, etc.) se muestra un aviso y la sesión trabaja en memoria.

## 📄 Formato CSV Esperado

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
