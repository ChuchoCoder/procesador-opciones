/**
 * P&L Calculation Service for Arbitrage Operations
 * Aligned with specs/006-arbitraje-de-plazos/contracts/pnl-contract.yaml
 */

import {
  PATTERNS,
  ESTADOS,
  LADOS,
  CAUCION_TIPOS,
  createResultadoPatron,
} from './arbitrage-types.js';

/**
 * Calculate P&L for a given grupo (instrument + plazo)
 * @param {import('./arbitrage-types.js').GrupoInstrumentoPlazo} grupo
 * @returns {import('./arbitrage-types.js').ResultadoPatron[]}
 */
export function calculatePnL(grupo) {
  const resultados = [];

  // Pattern 1: VentaCI → Compra24h
  const patron1 = calculatePatronVentaCICompra24h(grupo);
  if (patron1) {
    resultados.push(patron1);
  }

  // Pattern 2: CompraCI → Venta24h
  const patron2 = calculatePatronCompraCIVenta24h(grupo);
  if (patron2) {
    resultados.push(patron2);
  }

  return resultados;
}

/**
 * Calculate P&L for pattern: VentaCI → Compra24h
 * @param {import('./arbitrage-types.js').GrupoInstrumentoPlazo} grupo
 * @returns {import('./arbitrage-types.js').ResultadoPatron|null}
 */
function calculatePatronVentaCICompra24h(grupo) {
  const { ventasCI, compras24h, cauciones, plazo } = grupo;

  if (ventasCI.length === 0 && compras24h.length === 0) {
    return null;
  }

  const resultado = createResultadoPatron(PATTERNS.VENTA_CI_COMPRA_24H);

  // Calculate total values (quantity * price) for each side
  const totalVentasCI = sumQuantity(ventasCI);
  const totalCompras24h = sumQuantity(compras24h);
  const totalValueVentasCI = ventasCI.reduce((sum, op) => sum + (op.cantidad * op.precio), 0);
  const totalValueCompras24h = compras24h.reduce((sum, op) => sum + (op.cantidad * op.precio), 0);

  // Use minimum total VALUE to calculate matched quantity
  // This prevents inflating P&L when user bought extra for future use
  const minTotalValue = Math.min(totalValueVentasCI, totalValueCompras24h);
  const avgPrecioVentasCI = calculateWeightedAverage(ventasCI);
  const avgPrecioCompras24h = calculateWeightedAverage(compras24h);
  const avgPrice = (avgPrecioVentasCI + avgPrecioCompras24h) / 2;
  const matchedQty = avgPrice > 0 ? minTotalValue / avgPrice : 0;

  resultado.matchedQty = matchedQty;
  resultado.operations = [...ventasCI, ...compras24h];

  // No matched operations
  if (matchedQty === 0) {
    resultado.estado = ESTADOS.SIN_CONTRAPARTE;
    return resultado;
  }

  // Calculate trade P&L
  const avgComisionesVentas = calculateWeightedAverageCommissions(ventasCI);
  const avgComisionesCompras = calculateWeightedAverageCommissions(compras24h);

  resultado.precioPromedio = avgPrice;

  // P&L Trade = (Venta CI - Compra 24h) * matchedQty - comisiones
  const pnlTradeGross = (avgPrecioVentasCI - avgPrecioCompras24h) * matchedQty;
  const comisionesTotales = (avgComisionesVentas + avgComisionesCompras) * matchedQty;
  resultado.pnl_trade = pnlTradeGross - comisionesTotales;

  // Calculate caución P&L using weighted average TNA from all cauciones
  // VentaCI_Compra24h: You sell CI (receive cash) and lend it (colocadora)
  // This means you EARN interest → Positive P&L
  const avgTNA = grupo.avgTNA || 0;
  const caucionesFiltradas = filterCaucionesByType(cauciones, CAUCION_TIPOS.COLOCADORA);
  resultado.cauciones = caucionesFiltradas;

  if (avgTNA > 0 && plazo > 0) {
    // Calculate financing INCOME (positive - you're lending and earning interest)
    // P&L Caución = +monto * (TNA / 100) * (plazo / 365) - fees
    const monto = resultado.precioPromedio * matchedQty;
    const interestIncome = monto * (avgTNA / 100) * (plazo / 365);
    
    // Subtract caución fees
    const caucionFees = caucionesFiltradas.reduce((sum, c) => sum + (c.feeAmount || 0), 0);
    resultado.pnl_caucion = interestIncome - caucionFees;
    resultado.estado = totalVentasCI === totalCompras24h ? ESTADOS.COMPLETO : ESTADOS.CANTIDADES_DESBALANCEADAS;
  } else if (caucionesFiltradas.length > 0) {
    // Fallback: use actual cauciones if avgTNA not available
    resultado.pnl_caucion = calculateCaucionPnL(caucionesFiltradas, matchedQty, plazo);
    resultado.estado = totalVentasCI === totalCompras24h ? ESTADOS.COMPLETO : ESTADOS.CANTIDADES_DESBALANCEADAS;
  } else {
    resultado.pnl_caucion = 0;
    resultado.estado = ESTADOS.MATCHED_SIN_CAUCION;
  }

  // Total P&L
  resultado.pnl_total = resultado.pnl_trade + resultado.pnl_caucion;

  return resultado;
}

/**
 * Calculate P&L for pattern: CompraCI → Venta24h
 * @param {import('./arbitrage-types.js').GrupoInstrumentoPlazo} grupo
 * @returns {import('./arbitrage-types.js').ResultadoPatron|null}
 */
function calculatePatronCompraCIVenta24h(grupo) {
  const { comprasCI, ventas24h, cauciones, plazo } = grupo;

  if (comprasCI.length === 0 && ventas24h.length === 0) {
    return null;
  }

  const resultado = createResultadoPatron(PATTERNS.COMPRA_CI_VENTA_24H);

  // Calculate total values (quantity * price) for each side
  const totalComprasCI = sumQuantity(comprasCI);
  const totalVentas24h = sumQuantity(ventas24h);
  const totalValueComprasCI = comprasCI.reduce((sum, op) => sum + (op.cantidad * op.precio), 0);
  const totalValueVentas24h = ventas24h.reduce((sum, op) => sum + (op.cantidad * op.precio), 0);

  // Use minimum total VALUE to calculate matched quantity
  // This prevents inflating P&L when user bought extra for future use
  const minTotalValue = Math.min(totalValueComprasCI, totalValueVentas24h);
  const avgPrecioComprasCI = calculateWeightedAverage(comprasCI);
  const avgPrecioVentas24h = calculateWeightedAverage(ventas24h);
  const avgPrice = (avgPrecioComprasCI + avgPrecioVentas24h) / 2;
  const matchedQty = avgPrice > 0 ? minTotalValue / avgPrice : 0;

  resultado.matchedQty = matchedQty;
  resultado.operations = [...comprasCI, ...ventas24h];

  // No matched operations
  if (matchedQty === 0) {
    resultado.estado = ESTADOS.SIN_CONTRAPARTE;
    return resultado;
  }

  // Calculate trade P&L
  const avgComisionesCompras = calculateWeightedAverageCommissions(comprasCI);
  const avgComisionesVentas = calculateWeightedAverageCommissions(ventas24h);

  resultado.precioPromedio = avgPrice;

  // P&L Trade = (Venta 24h - Compra CI) * matchedQty - comisiones
  const pnlTradeGross = (avgPrecioVentas24h - avgPrecioComprasCI) * matchedQty;
  const comisionesTotales = (avgComisionesCompras + avgComisionesVentas) * matchedQty;
  resultado.pnl_trade = pnlTradeGross - comisionesTotales;

  // Calculate caución P&L using weighted average TNA from all cauciones
  // CompraCIVenta24h: You buy CI (pay cash) and borrow it (tomadora)
  // This means you PAY interest → Negative P&L
  const avgTNA = grupo.avgTNA || 0;
  const caucionesFiltradas = filterCaucionesByType(cauciones, CAUCION_TIPOS.TOMADORA);
  resultado.cauciones = caucionesFiltradas;

  if (avgTNA > 0 && plazo > 0) {
    // Calculate financing COST (negative - you're borrowing and paying interest)
    // P&L Caución = -monto * (TNA / 100) * (plazo / 365) - fees
    const monto = resultado.precioPromedio * matchedQty;
    const interestCost = monto * (avgTNA / 100) * (plazo / 365);
    
    // Add caución fees (both interest cost and fees are negative)
    const caucionFees = caucionesFiltradas.reduce((sum, c) => sum + (c.feeAmount || 0), 0);
    resultado.pnl_caucion = -(interestCost + caucionFees);
    resultado.estado = totalComprasCI === totalVentas24h ? ESTADOS.COMPLETO : ESTADOS.CANTIDADES_DESBALANCEADAS;
  } else if (caucionesFiltradas.length > 0) {
    // Fallback: use actual cauciones if avgTNA not available
    resultado.pnl_caucion = calculateCaucionPnL(caucionesFiltradas, matchedQty, plazo);
    resultado.estado = totalComprasCI === totalVentas24h ? ESTADOS.COMPLETO : ESTADOS.CANTIDADES_DESBALANCEADAS;
  } else {
    resultado.pnl_caucion = 0;
    resultado.estado = ESTADOS.MATCHED_SIN_CAUCION;
  }

  // Total P&L
  resultado.pnl_total = resultado.pnl_trade + resultado.pnl_caucion;

  return resultado;
}

/**
 * Sum total quantity from operations
 * @param {import('./arbitrage-types.js').Operacion[]} operations
 * @returns {number}
 */
function sumQuantity(operations) {
  return operations.reduce((sum, op) => sum + op.cantidad, 0);
}

/**
 * Calculate weighted average price
 * @param {import('./arbitrage-types.js').Operacion[]} operations
 * @returns {number}
 */
function calculateWeightedAverage(operations) {
  if (operations.length === 0) return 0;

  const totalQuantity = sumQuantity(operations);
  if (totalQuantity === 0) return 0;

  const weightedSum = operations.reduce((sum, op) => sum + op.precio * op.cantidad, 0);
  return weightedSum / totalQuantity;
}

/**
 * Calculate weighted average commissions per unit
 * @param {import('./arbitrage-types.js').Operacion[]} operations
 * @returns {number}
 */
function calculateWeightedAverageCommissions(operations) {
  if (operations.length === 0) return 0;

  const totalQuantity = sumQuantity(operations);
  if (totalQuantity === 0) return 0;

  const totalCommissions = operations.reduce((sum, op) => sum + op.comisiones, 0);
  return totalCommissions / totalQuantity;
}

/**
 * Filter cauciones by type
 * @param {import('./arbitrage-types.js').Caucion[]} cauciones
 * @param {string} tipo - 'colocadora' or 'tomadora'
 * @returns {import('./arbitrage-types.js').Caucion[]}
 */
function filterCaucionesByType(cauciones, tipo) {
  return cauciones.filter((c) => c.tipo === tipo);
}

/**
 * Calculate P&L from cauciones
 * For colocadora (lending): P&L = +interest earned
 * For tomadora (borrowing): P&L = -interest paid
 * 
 * @param {import('./arbitrage-types.js').Caucion[]} cauciones
 * @param {number} matchedQty - Matched quantity
 * @param {number} plazo - Settlement days
 * @returns {number}
 */
function calculateCaucionPnL(cauciones, matchedQty, plazo) {
  if (cauciones.length === 0) return 0;

  // Use the first caución as representative (or could average)
  // In practice, there should typically be one matching caución per pattern
  const caucion = cauciones[0];

  // Interest is already calculated in the Caución object
  // For colocadora: positive (earning interest)
  // For tomadora: negative (paying interest)
  const interest = caucion.interes;

  // Normalize by matched quantity if caución monto differs
  const normalizedInterest = (interest * matchedQty) / caucion.monto;

  return caucion.tipo === CAUCION_TIPOS.COLOCADORA ? normalizedInterest : -normalizedInterest;
}

/**
 * Format currency for display
 * @param {number} value
 * @param {string} [currency='ARS']
 * @returns {string}
 */
export function formatCurrency(value, currency = 'ARS') {
  const locale = 'es-AR';
  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return formatter.format(value);
}

/**
 * Format percentage for display
 * @param {number} value
 * @returns {string}
 */
export function formatPercentage(value) {
  const locale = 'es-AR';
  const formatter = new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return formatter.format(value / 100);
}
