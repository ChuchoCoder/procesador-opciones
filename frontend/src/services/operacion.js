/**
 * El registro Operación: un solo vocabulario de campos.
 *
 * Una fila cruda puede llegar con tres vocabularios distintos para el mismo
 * concepto —el canónico en español (`cantidad`), el canónico en inglés
 * (`quantity`) y los alias FIX del broker (`last_qty`, `lastQty`)— según por
 * qué etapa del pipeline pasó. Antes cada junction resolvía esos alias por su
 * cuenta, con **cuatro precedencias distintas** para la misma cantidad
 * (`data-aggregation` tenía dos, incompatibles entre sí, y `dedupe-utils` una
 * tercera), y seis respuestas a "cuál símbolo es el autoritativo".
 *
 * Este módulo es el dueño de esa resolución. La precedencia es una sola y está
 * declarada acá:
 *
 *   1. el campo canónico en español, si la fila ya pasó por `parseOperations`
 *   2. el campo canónico en inglés, que es lo que emite el pipeline
 *   3. los alias FIX del reporte del broker
 *
 * Ver CONTEXT.md para los términos del dominio y `arbitrage-types.js` para la
 * definición de `Operacion`.
 */

/** Primer valor de la lista que sea utilizable (no null/undefined/''). */
const primero = (...candidatos) => {
  for (const candidato of candidatos) {
    if (candidato !== null && candidato !== undefined && candidato !== '') {
      return candidato;
    }
  }
  return undefined;
};

const aNumero = (valor) => {
  const numero = typeof valor === 'number' ? valor : parseFloat(valor);
  return Number.isFinite(numero) ? numero : 0;
};

/**
 * El símbolo autoritativo de la fila.
 *
 * `originalSymbol` va primero porque es el símbolo completo del reporte
 * (`MERV - XMEV - PFE - CI`), que es el formato con el que hay que consultar
 * `InstrumentsWithDetails.json`. `symbol` puede venir ya normalizado a la
 * especie, y perdería el venue.
 *
 * @param {object} raw
 * @returns {string}
 */
export const resolveSymbol = (raw = {}) =>
  String(
    primero(
      raw.originalSymbol,
      raw.symbol,
      raw.instrumento,
      raw.instrumentId?.symbol,
      raw.instrument,
    ) ?? '',
  );

/**
 * Cantidad ejecutada.
 * @param {object} raw
 * @returns {number}
 */
export const resolveCantidad = (raw = {}) =>
  aNumero(primero(raw.cantidad, raw.quantity, raw.last_qty, raw.lastQty) ?? 0);

/**
 * Precio tal como viene en el reporte, **sin** aplicar factores de conversión.
 * @param {object} raw
 * @returns {number}
 */
export const resolvePrecio = (raw = {}) =>
  aNumero(primero(raw.precio, raw.price, raw.last_price, raw.lastPx) ?? 0);

/**
 * Lado de la operación, sin normalizar a `C`/`V` — eso lo hace el llamador con
 * su propio mapa de LADOS.
 * @param {object} raw
 * @returns {string|undefined}
 */
export const resolveLado = (raw = {}) => primero(raw.lado, raw.side, raw.action);

/**
 * Comisiones ya calculadas por el pipeline (`fees/fee-enrichment`).
 *
 * Ojo: `parseOperations` emite este valor bajo el nombre `comisiones` y no
 * emite `feeAmount`. Esa diferencia de nombre ya silenció un término de P&L
 * una vez (ver #13), así que se lee por acá y no a mano.
 *
 * @param {object} raw
 * @returns {number}
 */
export const resolveComisiones = (raw = {}) =>
  aNumero(primero(raw.comisiones, raw.feeAmount) ?? 0);

/**
 * Identificador de la orden. Varias ejecuciones de una misma orden lo comparten.
 * @param {object} raw
 * @returns {string|undefined}
 */
export const resolveOrderId = (raw = {}) =>
  primero(raw.order_id, raw.orderId, raw.clOrdId, raw.id);

/**
 * El campo de fecha/hora, buscando también en el objeto `raw` anidado que
 * arrastran las filas ya procesadas.
 * @param {object} raw
 * @returns {*}
 */
export const resolveFechaHora = (raw = {}) => {
  const anidado = raw.raw || raw;
  return primero(
    raw.transact_time,
    raw.fechaHora,
    raw.date,
    raw.transactTime,
    anidado.transact_time,
    anidado.fechaHora,
    anidado.date,
    anidado.transactTime,
  );
};

/**
 * Los factores por instrumento que convierten el precio del reporte a valor
 * monetario. Se resuelven una sola vez y el llamador los aplica una sola vez:
 * ningún consumidor aguas abajo debe deshacerlos (ADR 0001).
 *
 * @param {object} raw
 * @param {(symbol: string) => object|null} lookupInstrumento
 * @returns {{instrumentDetails: object|null, priceConversionFactor: number, contractMultiplier: number}}
 */
export const resolveFactores = (raw = {}, lookupInstrumento = () => null) => {
  const symbol = resolveSymbol(raw);
  const instrumentDetails = raw.instrumentDetails || lookupInstrumento(symbol) || null;

  return {
    instrumentDetails,
    priceConversionFactor: instrumentDetails?.priceConversionFactor ?? 1,
    contractMultiplier: instrumentDetails?.contractMultiplier ?? 1,
  };
};
