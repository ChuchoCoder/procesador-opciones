/**
 * Arbitrage data shape types and constants
 * Aligned with specs/006-arbitraje-de-plazos/data-model.md
 */

/**
 * @typedef {Object} Operacion
 * @property {string} id - Operation identifier
 * @property {string} instrumento - Instrument symbol
 * @property {'C'|'V'} lado - Side: Compra (C) or Venta (V)
 * @property {Date} fechaHora - Operation date and time
 * @property {number} cantidad - Quantity (must be > 0)
 * @property {number} precio - Price (must be > 0)
 * @property {number} comisiones - Commissions
 * @property {number} total - Total amount
 * @property {'CI'|'24h'} venue - Trading venue
 */

/**
 * @typedef {Object} Caucion
 * @property {string} id - Caución identifier
 * @property {string} instrumento - Instrument symbol
 * @property {'colocadora'|'tomadora'} tipo - Type: colocadora or tomadora
 * @property {Date} inicio - Start date
 * @property {Date} fin - End date
 * @property {number} monto - Amount (must be > 0)
 * @property {number} tasa - Annual rate (must be >= 0)
 * @property {number} interes - Accrued interest
 * @property {number} tenorDias - Tenor in days (must be > 0)
 * @property {string} [referencia] - Optional reference
 * @property {string} currency - Currency (must match instrument)
 */

/**
 * @typedef {Object} GrupoInstrumentoPlazo
 * @property {string} instrumento - Instrument symbol
 * @property {number} plazo - Settlement days
 * @property {Date} jornada - Trading day
 * @property {Operacion[]} ventasCI - Sales operations in CI venue
 * @property {Operacion[]} compras24h - Buy operations in 24h venue
 * @property {Operacion[]} comprasCI - Buy operations in CI venue
 * @property {Operacion[]} ventas24h - Sales operations in 24h venue
 * @property {Caucion[]} cauciones - Related cauciones
 */

/**
 * @typedef {Object} ResultadoPatron
 * @property {string} patron - Pattern identifier (e.g., 'VentaCI_Compra24h')
 * @property {number} matchedQty - Matched quantity
 * @property {number} precioPromedio - Average price
 * @property {number} pnl_trade - P&L from trade operations
 * @property {number} pnl_caucion - P&L from cauciones
 * @property {number} pnl_total - Total P&L (pnl_trade + pnl_caucion)
 * @property {'completo'|'sin_caucion'|'cantidades_desbalanceadas'|'sin_contraparte'|'matched_sin_caucion'} estado - Pattern status
 * @property {Operacion[]} operations - Operations involved in the pattern
 * @property {Caucion[]} cauciones - Cauciones involved in the pattern
 */

/**
 * Pattern identifiers
 */
export const PATTERNS = {
  VENTA_CI_COMPRA_24H: 'VentaCI_Compra24h',
  COMPRA_CI_VENTA_24H: 'CompraCI_Venta24h',
};

/**
 * Pattern statuses
 */
export const ESTADOS = {
  COMPLETO: 'completo',
  SIN_CAUCION: 'sin_caucion',
  CANTIDADES_DESBALANCEADAS: 'cantidades_desbalanceadas',
  SIN_CONTRAPARTE: 'sin_contraparte',
  MATCHED_SIN_CAUCION: 'matched_sin_caucion',
};

/**
 * Trading venues
 */
export const VENUES = {
  CI: 'CI',
  H24: '24h',
};

/**
 * Operation sides
 */
export const LADOS = {
  COMPRA: 'C',
  VENTA: 'V',
};

/**
 * Caución types
 */
export const CAUCION_TIPOS = {
  COLOCADORA: 'colocadora',
  TOMADORA: 'tomadora',
};

/**
 * Create a default GrupoInstrumentoPlazo
 * @param {string} instrumento - Instrument symbol
 * @param {number} plazo - Settlement days
 * @param {Date} jornada - Trading day
 * @returns {GrupoInstrumentoPlazo}
 */
export function createGrupoInstrumentoPlazo(instrumento, plazo, jornada) {
  return {
    instrumento,
    plazo,
    jornada,
    ventasCI: [],
    compras24h: [],
    comprasCI: [],
    ventas24h: [],
    cauciones: [],
  };
}

/**
 * Create a default ResultadoPatron
 * @param {string} patron - Pattern identifier
 * @returns {ResultadoPatron}
 */
export function createResultadoPatron(patron) {
  return {
    patron,
    matchedQty: 0,
    precioPromedio: 0,
    pnl_trade: 0,
    pnl_caucion: 0,
    pnl_total: 0,
    estado: ESTADOS.SIN_CONTRAPARTE,
    operations: [],
    cauciones: [],
  };
}
