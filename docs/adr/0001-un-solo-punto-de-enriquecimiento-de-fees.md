# ADR 0001 — Un solo punto de enriquecimiento de fees

- **Fecha**: 2026-10-18
- **Estado**: aceptada
- **PRs**: #14

## Contexto

Las operaciones se enriquecían con fees en dos lugares:

1. el pipeline, en `processOperations` → `enrichOperationsWithFees`, y
2. `arbitrage-fee-enrichment.js`, que la vista de Arbitraje llamaba sobre el
   resultado del pipeline.

El segundo abría con una guarda que detectaba si la fila ya tenía `feeAmount`
y devolvía la operación sin tocarla. Como su entrada en producción era
`report.operations` —ya enriquecido—, **la guarda siempre disparaba y el
cuerpo del módulo nunca se ejecutaba**.

Los specs de arbitraje, en cambio, le pasaban filas crudas de Papa, sin
`feeAmount`, y por lo tanto ejercitaban *solamente* ese cuerpo. Producción y
los tests recorrían caminos distintos y los dos estaban verdes, en el área con
más commits de bugfix del repo.

Para las operaciones CI/24h de acciones, bonos y letras el camino muerto
producía `feeAmount`, `feeBreakdown` y `category` idénticos al pipeline, pero
descartaba `grossNotional`, `cfiCode` y `netSettlement`; en filas `PESOS - nD`
era directamente peor, porque calculaba una comisión plana en lugar del
breakdown de caución.

## Decisión

**El enriquecimiento de fees ocurre una sola vez, en el pipeline.** Los
consumidores —Arbitraje, Compra/Venta, Reconciliación— reciben operaciones ya
enriquecidas y no vuelven a calcular fees.

`arbitrage-fee-enrichment.js` se eliminó, junto con `enrichCauciones`, que sí
corría pero sobrescribía `feeAmount`/`feeBreakdown` con un cálculo peor sobre
campos que nadie leía.

## Consecuencias

- El `priceConversionFactor` se aplica una sola vez. Desaparece el round-trip
  en el que un módulo multiplicaba, otro dividía y un tercero volvía a
  multiplicar con su propio lookup del instrumento.
- Los specs de arbitraje cargan el CSV con `processOperations` a través de
  `tests/integration/helpers/arbitrage-pipeline.js`, así que cruzan el seam de
  producción y pueden detectar una regresión real.
- Si hace falta una semántica de fees distinta para un consumidor, va **dentro**
  del pipeline (por categoría de instrumento), no en un módulo paralelo
  aguas abajo.

## No volver a proponer

Agregar un paso de enriquecimiento propio en la vista de Arbitraje, o un
módulo "por si la fila no vino enriquecida". Si una fila llega sin `feeAmount`,
el bug está en el pipeline y hay que arreglarlo ahí.
