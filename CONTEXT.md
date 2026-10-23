# Modelo de dominio

Vocabulario del dominio de `procesador-opciones`. Los nombres de acá son los
que usa el código: si un término no está en esta lista, probablemente convenga
agregarlo antes de nombrar un módulo con él.

Las definiciones canónicas en código viven en
[`arbitrage-types.js`](frontend/src/services/arbitrage-types.js) y
[`settings-types.js`](frontend/src/services/settings-types.js).

## Operaciones

**Operación** — una ejecución (un fill) de una orden en el mercado. Campos:
`instrumento`, `lado`, `fechaHora`, `cantidad`, `precio`, `comisiones`,
`total`, `venue`.

Importante: una orden puede producir **varias** operaciones (ejecuciones
parciales), todas con el mismo `order_id`. Los registros con
`event_subtype: "replace"` **no** son ejecuciones: son el registro de
reemplazo de una orden y repiten al `execution_report` anterior. Contarlos
duplica fills.

En la API del broker pasa lo mismo con otra forma: en BYMA una orden
modificada cambia de `orderId` sólo en el sufijo (`O0TDmfe7JMnP-02501525` →
`O0TDmfe7JMnP-03475819`), y el `cumQty` de la sucesora ya incluye lo que
ejecutó la original. La cadena se cuenta una vez, por su eslabón con mayor
`cumQty`. En ROFX no: el reemplazo abre una orden nueva con su propio
`cumQty`, y se suman las dos.

**Lado** — `C` (compra) o `V` (venta). En las filas crudas del broker aparece
como `side` con valores `BUY` / `SELL`.

**Venue** — `CI` (contado inmediato, liquida hoy) o `24h` (liquida al día
hábil siguiente). El mismo instrumento cotiza distinto en cada uno, y de esa
diferencia vive el arbitraje de plazos.

**Jornada** — el día de trading que se está procesando. Es la unidad de
trabajo de la app: se carga un reporte de operaciones de una jornada y todo
se calcula sobre eso.

**Instrumento** — el símbolo operado. En los reportes viene como
`MERV - XMEV - GGAL - CI`: mercado, segmento, especie y venue. El código lo
normaliza a la especie (`GGAL`) y guarda el original en `originalSymbol`.

## Opciones

**Strike** — precio de ejercicio. Se deriva del token del símbolo
(`GFGC11000D` → 11000), con la cantidad de decimales que indique la regla de
prefijo del símbolo.

**Regla de prefijo (`prefix rule`)** — mapea un prefijo de token de opción a
su especie subyacente y a los decimales de strike. Por ejemplo `GFG` → `GGAL`
con 1 decimal. Es configuración del usuario.

**Excepción de strike (`strike exception`)** — un override manual para un
strike que la regla de prefijo deriva mal.

**Vencimiento (`expiration`)** — mes de vencimiento de la opción, derivado de
un sufijo del token (`O`, `OC`, `OCT` → Octubre).

## Cauciones y plazos

**Caución** — un préstamo de dinero con garantía de títulos, a plazo corto.
Campos: `tipo`, `monto`, `tasa` (TNA), `tenorDias`, `inicio`, `fin`,
`currency`. En los reportes aparece como un instrumento `PESOS - nD`.

**Colocadora / tomadora** — los dos lados de una caución: quien coloca el
dinero (presta y cobra interés) y quien lo toma (se financia y paga interés).
Los gastos de ByMA difieren según el rol.

**Plazo** — días de financiamiento de un grupo. Se deriva de las **cauciones
realmente operadas** en la jornada, no de días hábiles entre CI y 24hs: esa
fue la causa de un error del 163% en el P&L de caución (`c343bbc`). Lo posee
[`data-aggregation.js`](frontend/src/services/data-aggregation.js).

**TNA** — tasa nominal anual. La TNA de un grupo es el promedio **ponderado
por monto** de las cauciones de esa moneda.

## Arbitraje de plazos

**Arbitraje de plazos** — vender un instrumento en un venue y comprarlo en el
otro para capturar la diferencia de precio, financiando el desfasaje de
liquidación con cauciones.

**Grupo (`GrupoInstrumentoPlazo`)** — las operaciones de un instrumento y un
plazo dentro de una jornada, separadas en `ventasCI`, `compras24h`,
`comprasCI` y `ventas24h`, más las cauciones asociadas.

**Patrón** — la forma que toma el arbitraje en un grupo: `VentaCI_Compra24h`
(se vende CI y se compra 24hs, se **coloca** el dinero) o
`CompraCI_Venta24h` (lo inverso, se **toma**).

**Cantidad matcheada (`matchedQty`)** — el mínimo entre las puntas del
patrón; sólo esa porción es arbitraje cerrado, y las comisiones se prorratean
sobre ella.

**P&L trade / P&L caución / P&L total** — el resultado se parte en la
diferencia de precio entre venues, el resultado del financiamiento, y la
suma.

## Fees

**Comisión** — lo que cobra el broker, en porcentaje del bruto.

**Derechos de mercado** — lo que cobra el mercado.

**Arancel / gastos de garantía** — los cargos de ByMA sobre una caución,
diarios y dependientes del rol.

**`priceConversionFactor` / `contractMultiplier`** — factores por instrumento
que convierten el precio del reporte a valor monetario. Se aplican **una sola
vez**, en el pipeline; ningún consumidor debe deshacerlos.

**Bruto (`grossNotional`)** — `cantidad * precio` ya convertido, la base sobre
la que se calculan los fees.

## Términos de arquitectura

Para hablar de la estructura del código —módulo, interfaz, profundidad, seam,
adaptador, leverage, locality— ver el vocabulario de `/codebase-design`. Las
decisiones de arquitectura ya tomadas están en [`docs/adr/`](docs/adr/).
