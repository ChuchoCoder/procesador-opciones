# ADR 0004 — El mapping de instrumentos se reemplaza, y falla fuerte

- **Fecha**: 2026-10-18
- **Estado**: aceptada
- **PRs**: #21

## Contexto

`services/fees/instrument-mapping.js` es el único lugar donde se resuelve un
símbolo a su `CfiCode`, su categoría de fees, su `priceConversionFactor` y su
`contractMultiplier`. Lo consultan cinco call sites de producción
(`process-operations`, `fees/fee-enrichment`, `data-aggregation`), y de su
respuesta depende el valor monetario de cada operación.

Tenía tres singletons mutables a nivel de módulo y esta carga:

```js
export function loadInstrumentMapping(instrumentsData) {
  if (!_cfiCodeMap) { /* … */ }
}
```

Lo que un llamador tenía que saber para usarlo bien era, en conjunto,
demasiado:

1. hay que llamar `loadInstrumentMapping` antes de cualquier lectura, en todo
   el proceso;
2. volver a llamarlo **no hace nada**, en silencio; y
3. si no se cargó, las lecturas no fallan: devuelven `null` y la categoría
   `'bonds'` —valores plausibles— detrás de un `console.warn`.

El punto 2 rompía la suite. `tests/setup/vitest.setup.js` corre
`bootstrapFeeServices()` por archivo de test, que carga el snapshot de
producción; cualquier spec que después le pasara su propio fixture era
ignorado sin aviso. Ocho tests consultaban datos de producción creyendo
consultar su fixture, y uno
(`instrument-roundlot.spec.js`) declaraba `CfiCode: 'ESVUFR'` y asserteaba
`'ESXXXX'`: pasaba en verde contra el JSON real.

El punto 3 es peor, porque no se limita a los tests. `InstrumentsWithDetails.json`
es un snapshot de la lista **viva** de instrumentos del broker: cada contrato
que vence desaparece de él. Los CSV de los specs, en cambio, son reportes de
jornadas fijas de 2025. Cuando el snapshot se refrescó, D30E6 —un
dollar-linked que venció en enero de 2026— dejó de estar, `getInstrumentDetails`
devolvió `null`, y el pipeline cayó a su default: `priceConversionFactor = 1`
en lugar del `0.01` que usa todo bono de MERV, y la categoría `'bonds'` en
lugar de `letra` (`DYXTXR`). El P&L de esa jornada quedó ~100x inflado
(`48.783.517` contra `535.716`) sin una sola excepción.

## Decisión

**La carga reemplaza, y leer sin cargar es un error.**

- `loadInstrumentMapping(data)` construye y **reemplaza** el mapping. Gana la
  última llamada. Producción llama una sola vez, desde `bootstrapFeeServices()`;
  los tests llaman con su propio snapshot.
- `resetInstrumentMapping()` lo limpia, para teardown de tests.
- `isInstrumentMappingLoaded()` responde si hay algo cargado.
- `resolveCfiCategory` y `getInstrumentDetails` **lanzan** si no hay snapshot
  cargado.
- `initializeInstrumentMapping()` dejó de tragarse su error: si el bootstrap
  falla, falla ahí y no en la primera consulta, lejos de la causa.

Queda explícitamente **afuera** de la decisión el caso "cargado, pero el
símbolo no está en el snapshot": eso sigue devolviendo `null`, porque es una
respuesta real y distinta de "no hay nada cargado".

### Por qué no inyectar el mapping como parámetro

Era la otra opción razonable: pasar el mapping a cada función en vez de leer
un singleton. Habría que atravesarlo por los cinco call sites y por sus
llamadores hasta `ProcessorScreen`, sobre el código que calcula plata, en el
mismo PR que arregla la suite que usaríamos para verificarlo. El seam que
falta hoy es el de la orquestación de `ProcessorScreen`, y ahí es donde esa
inyección tiene sentido; cuando exista, este módulo ya tiene la forma
(`load` + `reset`) para colgarse de él.

### Los instrumentos vencidos de los fixtures viven en el repo

`tests/fixtures/expired-instruments.js` declara los instrumentos que las
jornadas históricas operaron y que el snapshot vivo ya no trae (D30E6, D16E6,
los futuros DLR de noviembre y diciembre de 2025 y sus opciones). Los valores
se copian de los miembros vivos de la misma familia, no se inventan.

Un spec pegado a una jornada histórica declara los instrumentos de esa
jornada; no espera que el snapshot vivo todavía los tenga.

## Consecuencias

- La suite quedó en verde (414 pasan) y CI corre `npx vitest run`, no sólo
  lint.
- Una constante esperada que parecía inflada no lo estaba: los `535.255,70`
  del test de D30E6 eran correctos desde el principio. Lo que estaba mal era
  el dato de referencia, no la expectativa. Con el instrumento presente da
  `535.716,32`, dentro del 1% de tolerancia que el test ya declaraba.
- Un bootstrap fallido ahora rompe de entrada en vez de producir fees y P&L
  silenciosamente equivocados.

## Pendiente, y conocido

Un símbolo ausente del snapshot sigue cayendo a `priceConversionFactor = 1` en
`process-operations` y `fee-enrichment`, sin aviso al usuario. Para una
jornada vieja, o para un instrumento recién listado, eso es un P&L 100x
equivocado en pantalla. Esta ADR no lo resuelve: deja el modo de falla
acotado al lugar donde se puede ver.

## No volver a proponer

Volver a hacer `loadInstrumentMapping` idempotente "para no recargar de más",
o devolver un default plausible cuando el mapping no está cargado. Lo primero
hace invisible el segundo snapshot; lo segundo convierte un error de arranque
en plata mal calculada.
