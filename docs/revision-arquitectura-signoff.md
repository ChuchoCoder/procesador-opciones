# Revisión de arquitectura — cierre

Registro de qué se hizo con cada hallazgo de la revisión de arquitectura de
2026-10-18, con el PR que lo cerró y cómo verificarlo.

**Estado de `main` al cierre** (verificado, no declarado):

| | |
|---|---|
| `npm run lint` | 0 problemas |
| `npx vitest run` | 577 pasan, 0 fallan, 16 skipped |
| `npm run build` | compila |
| archivos de test de componente | 4 |
| specs sin aserciones | 0 |

## Defectos verificados durante la revisión

| # | Hallazgo | Cierre |
|---|---|---|
| 1 | `ArbitrageTable`: `breakdown` leído fuera de su bloque, 12 errores `no-undef`. Habría tirado `ReferenceError` al renderizar el tooltip de caución | #13 lo arregló; #27 borró la rama entera, que era inalcanzable |
| 2 | `pnl-calculations`: `totalOperationFeeAmount` sumaba `op.feeAmount`, campo que `parseOperations` renombra a `comisiones`. Siempre valía 0 | #13. **No** se repuntó el nombre: `comisiones` ya *es* `feeAmount`, así que habría descontado dos veces |
| 3 | Cinco specs leían un CSV desde una carpeta personal | #13 |

## Los ocho candidatos

| # | Candidato | Cierre |
|---|---|---|
| 1 | Cerrar el seam de enriquecimiento de Arbitraje | #14 — `arbitrage-fee-enrichment.js` eliminado |
| 2 | Un solo vocabulario para el registro Operación | #20 — `services/operacion.js` |
| 3 | Un seam bajo la orquestación del Procesador | #22, #23, #24, #26 — `ProcessorScreen` 1757 → ~1240 líneas |
| 4 | Profundizar el seam de formato numérico | #18 — `services/formato.js` |
| 5 | Colapsar el stack de storage | #16 — `storage-adapter.js` eliminado |
| 6 | Eliminar subsistemas inalcanzables | #15 (−1958 líneas), #27 |
| 7 | Plegar `business-days` en el módulo que posee el plazo | #17 |
| 8 | Que guardar una excepción de strike no re-procese la jornada | #25 (cadena de props), #30 (`filasYaParseadas`) |

## El hallazgo transversal: tests que no cruzaban ningún seam

| Spec | Cierre |
|---|---|
| `processor-data-source-filtering` | #22 — ejercita `filtrarPorFuente` |
| `instrument-roundlot` | #21 — su fixture se ignoraba por un no-op |
| `broker-sync-daily-mode` | #31 — afirmaba lo **contrario** a producción |
| `arbitrage-v-ticker-enrich2` / `enrich3` | #32, #34 — eran traces de debug con 0 aserciones |
| `bond-option-misclassification`, `instrument-mapping` | sin cambios: **sí** importan de `src/`, con `await import()` dinámico |

## Bugs encontrados *durante* el trabajo

No estaban en la revisión; salieron de hacerla.

- **#28** — `TooltipRepoFees` y `FeeTooltip` recibían la slice equivocada de
  `strings` y leían rutas inexistentes: las etiquetas configuradas estaban
  muertas y la UI mostraba los literales de fallback.
- **#32** — el ticker V a 24hs (`MERVXMEVV24HS`) matchea el regex de opciones;
  el gate de CfiCode rechazaba el tipo pero el **strike 24 sobrevivía** hasta
  la operación final.
- **#39, #40** — dos de mis propios tests de componente daban falsa cobertura:
  les pasaba a las vistas una forma de fila distinta de la que consumen, así
  que renderizaban el estado vacío y el test sólo comprobaba que el `<table>`
  existiera.

## Infraestructura

- **#13** — lint en CI. Antes reportaba 17 problemas y 12 eran el crash del
  defecto 1: el linter ya lo detectaba y nadie lo corría.
- **#21** — tests en CI, tras poner la suite en verde (tenía 9 fallas).
- **#19** — `CONTEXT.md` y `docs/adr/0001-0003`; **#21** agregó el 0004.

## Verificación manual

Dos corridas en la app real (#37), con `Arbitraje-Plazos.csv` (522
operaciones) y `GGAL-PUTS.csv` (76), recorriendo las cuatro pestañas. Cero
errores de consola.

Lo que confirmó: los números de S31O5 en Arbitrajes coinciden **exactamente**
con las constantes corregidas en #14 (`ARS 51.834.010,97` y
`ARS 11.900.168,05`), y las filas de PUTS con las que afirma el test de #39.

## El camino HTTP del broker

Ejercitado de punta a punta contra un **servidor stub local**
(`tools/broker-stub.mjs`), con el cliente real haciendo `fetch` reales desde
la UI real — sin credenciales ni acceso al servidor del broker.

La secuencia observada en el log del stub, incluidos los preflight de CORS:

    OPTIONS/POST /auth/getToken
    OPTIONS/GET  /rest/accounts
    OPTIONS/GET  /rest/order/all?accountId=17825

El `accountId` sale de la respuesta de cuentas y se usa en la consulta de
órdenes: la cadena entera. Las tres órdenes del stub llegaron normalizadas,
enriquecidas con fees y renderizadas en Compra y Venta:

| símbolo | plazo | cantidad | precio | neto |
|---|---|---|---|---|
| GGAL | CI | 1.500 | 4.860 | −7.296.174,63 |
| PFE | 24HS | −9 | 9.500 | +85.427,58 |
| S31O5 | CI | −400 | 130,76 | +52.298,77 |

La tercera es una orden **parcialmente ejecutada** (`cumQty` 400 de 1000), así
que también queda verificado ese camino. Los signos siguen la convención de
#22 y el formato el de #18, ahora sobre datos que llegaron por HTTP.

Lo único que el stub no cubre es el servidor del broker respondiendo de formas
que no anticipamos; para eso hace falta una sesión manual con una cuenta real.

Cubierto además, sin credenciales:

- `startDailySync` de punta a punta con el cliente mockeado (#39): camino
  feliz, paginación por `nextPageToken`, descarte de operaciones previas en
  modo daily, progreso, cancelación y fallo — verificando en los dos últimos
  casos que **no** se commitee.
- La UI de login (#38) y la reconciliación con dos fuentes (#40).

Para cerrarlo hace falta una sesión manual con una cuenta: levantar la app,
conectar el broker y confirmar que sincroniza.

**Otros ítems que se dejaron a propósito**, con su razón en el PR: la rama
`refresh` de `dedupe-utils` conserva su semántica propia (#20); el formato de
CSV, portapapeles, fechas y etiquetas de token queda fuera de `formato.js`
(ADR 0003); `GroupFilter` y `ProcessorTabs` siguen recibiendo una sub-slice
angosta por prop, que no es drilling (#36).
