# ADR 0002 — Storage como un único seam sincrónico

- **Fecha**: 2026-10-18
- **Estado**: aceptada
- **PRs**: #16

## Contexto

La persistencia pasaba por tres módulos apilados —`config-service` →
`local-storage` → `storage-adapter`— sobre `window.localStorage`, más un
cuarto (`storage-settings`) con el prefijo `po:settings:` y la convención
inversa.

`storage-adapter` no pasaba el test de borrado: cada método era un `try/catch`
de 3 líneas alrededor de una sola llamada a `localStorage`, `getItem` estaba
declarado `async` y devolvía un valor sincrónico, y tenía 8 call sites, todos
dentro de la propia carpeta `storage/`.

La interfaz basada en `Promise` existía para el storage asíncrono de la
extensión de Chrome. Ese soporte se removió en `38bff03` / `fef30f4`, con lo
que quedó **un solo adaptador**: un seam hipotético, no uno real.

## Decisión

**Un único módulo sincrónico sobre `localStorage`**
(`services/storage/local-storage.js`), con todos los namespaces detrás.
`storage-adapter.js` se eliminó.

Las funciones de `storage-settings` conservan su firma `async` para no romper
los `await` existentes, pero el trabajo abajo es sincrónico.

El store se resuelve en cada llamada (`getStore()`) en lugar de capturarse al
cargar el módulo, así que:

- un navegador que tira excepción al acceder (modo privado, site data
  bloqueada) degrada en vez de romper, y
- los tests pueden sustituir `globalThis.localStorage` sin parchear dos
  objetos.

## Consecuencias

- Las lecturas y escrituras son sincrónicas. Esperar un valor común es un
  no-op, así que no hubo que tocar ningún consumidor.
- Hay un solo lugar donde agregar una clave persistida. Fue lo que destapó que
  `prefixRules` estaba en la forma de la configuración pero no se guardaba
  nunca: se perdía en cada recarga.

## No volver a proponer

Reintroducir una capa adaptadora sobre `localStorage` "para poder cambiar de
backend". Cuando exista un segundo backend real —IndexedDB, un servidor— ahí
sí hay dos adaptadores y el seam se justifica. Hasta entonces es una capa que
sólo agrega ceremonia asíncrona.
