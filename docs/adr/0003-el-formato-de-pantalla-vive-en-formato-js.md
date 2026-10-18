# ADR 0003 — El formato numérico de pantalla vive en `formato.js`

- **Fecha**: 2026-10-18
- **Estado**: aceptada
- **PRs**: #18

## Contexto

`locale.js` exponía `getDotDecimalLocale()`, que devuelve un *string* de
locale. La parte difícil —cuántos decimales lleva cada tipo de número, el
signo, el agrupamiento— quedaba en cada llamador: 11 archivos armando su
propio `Intl.NumberFormat`, ~15 helpers duplicados y 38 objetos de opciones de
decimales, con tres formateadores idénticos byte a byte dentro de una misma
función.

Seis commits consecutivos persiguieron el mismo problema, cada uno revisitando
N call sites. Además convivían cuatro políticas de locale: la preferencia del
usuario, `'en-US'` hardcodeado, `'es-AR'` hardcodeado y `.toFixed()` a mano —
de modo que en una misma tabla la columna de cantidad y la de precio usaban
separadores distintos.

## Decisión

**`services/formato.js` es el único dueño del formato numérico de pantalla.**
Los llamadores nombran el *tipo de número* (`formatCantidad`, `formatPrecio`,
`formatMoneda`, `formatPorcentaje`, …) y el módulo decide locale, decimales,
signo y el guard de `-0`.

El locale se resuelve por llamada, con los formateadores memoizados por
locale, así que cambiar la preferencia de formato regional toma efecto sin
recargar la página.

### Queda explícitamente afuera

- **CSV y portapapeles**: el separador decimal de un archivo exportado es una
  decisión de formato de datos (import a planilla), no de presentación.
- **Etiquetas de tokens** (p. ej. los presets de strike en
  `AddStrikeExceptionButton`): son identificadores, no números de pantalla.
  Agruparlos los corrompe.
- **Fechas y horas**: otro tipo de formato.

## Consecuencias

- Un solo lugar donde cambiar una regla de formato.
- El módulo es testeable por su interfaz sin montar componentes
  (`tests/unit/formato.spec.js`), que era imposible cuando el formato vivía
  dentro de los componentes.

## No volver a proponer

Definir un `formatQuantity` / `formatPrice` local en un componente. Si falta
un tipo de número, se agrega a `formato.js`; si un caso necesita opciones
propias de verdad, existe `crearFormateador`.
