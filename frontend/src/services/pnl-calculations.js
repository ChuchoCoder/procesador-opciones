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
import { getRepoFeeConfig } from './fees/broker-fees-storage.js';

/**
 * Calculate P&L for a given grupo (instrument + plazo)
 * @param {import('./arbitrage-types.js').GrupoInstrumentoPlazo} grupo
 * @returns {import('./arbitrage-types.js').ResultadoPatron[]}
 */
export async function calculatePnL(grupo) {
  const startTime = performance.now();
  const resultados = [];

  // Pattern 1: VentaCI → Compra24h
  const patron1 = await calculatePatronVentaCICompra24h(grupo);
  if (patron1) {
    resultados.push(patron1);
  }

  // Pattern 2: CompraCI → Venta24h
  const patron2 = await calculatePatronCompraCIVenta24h(grupo);
  if (patron2) {
    resultados.push(patron2);
  }

  const endTime = performance.now();
  const duration = endTime - startTime;
  
  // Only log if it takes more than 10ms (potential performance issue)
  if (duration > 10) {
    console.warn(`[PnL] Slow calculation for ${grupo.instrumento}-${grupo.plazo}: ${duration.toFixed(2)}ms`);
  }

  return resultados;
}

/**
 * Calculate P&L for pattern: VentaCI → Compra24h
 * @param {import('./arbitrage-types.js').GrupoInstrumentoPlazo} grupo
 * @returns {import('./arbitrage-types.js').ResultadoPatron|null}
 */
async function calculatePatronVentaCICompra24h(grupo) {
  const { ventasCI, compras24h, plazo } = grupo;

  if (ventasCI.length === 0 && compras24h.length === 0) {
    return null;
  }

  const resultado = createResultadoPatron(PATTERNS.VENTA_CI_COMPRA_24H);

  // Calculate total quantities and values for each side
  const totalVentasCI = sumQuantity(ventasCI);
  const totalCompras24h = sumQuantity(compras24h);
  
  // Calculate weighted average prices (normalized)
  const avgPrecioVentasCI = calculateWeightedAverage(ventasCI);
  const avgPrecioCompras24h = calculateWeightedAverage(compras24h);
  // For Sell CI - Buy 24 we should use the weighted average price of Sell CI
  const avgPrice = avgPrecioVentasCI;
  
  // Calculate matched quantity - use the minimum of sell/buy quantities
  // This represents the maximum nominals that can be matched between both sides
  const matchedQty = Math.min(totalVentasCI, totalCompras24h);

  resultado.matchedQty = matchedQty;
  resultado.operations = [...ventasCI, ...compras24h];

  // No matched operations
  if (matchedQty === 0) {
    resultado.estado = ESTADOS.SIN_CONTRAPARTE;
    return resultado;
  }

  // Calculate trade P&L
  // When quantities are unbalanced, only use proportional fees/commissions for matched quantity
  const avgComisionesVentas = calculateWeightedAverageCommissions(ventasCI);
  const avgComisionesCompras = calculateWeightedAverageCommissions(compras24h);

  // conservative references: values computed for potential future display but
  // currently unused by lint rules — mark them as used to avoid warnings
  void avgComisionesVentas;
  void avgComisionesCompras;

  resultado.precioPromedio = avgPrice;

  // P&L Trade = (Venta CI - Compra 24h) * matchedQty - comisiones
  // Commissions are calculated per unit, then multiplied by matched quantity
  const pnlTradeGross = (avgPrecioVentasCI - avgPrecioCompras24h) * matchedQty;
  
  // Calculate proportional commissions based on matched quantity
  // If unbalanced, use only the proportion that was actually matched
  const proportionVentas = totalVentasCI > 0 ? matchedQty / totalVentasCI : 0;
  const proportionCompras = totalCompras24h > 0 ? matchedQty / totalCompras24h : 0;
  
  const totalComisionesVentas = sumCommissions(ventasCI) * proportionVentas;
  const totalComisionesCompras = sumCommissions(compras24h) * proportionCompras;
  const comisionesTotales = totalComisionesVentas + totalComisionesCompras;
  
  resultado.pnl_trade = pnlTradeGross - comisionesTotales;

  // Add breakdown information for UI display
  // Use raw prices for display (original values from CSV)
  const avgRawPriceVentasCI = calculateWeightedAverageRawPrice(ventasCI);
  const avgRawPriceCompras24h = calculateWeightedAverageRawPrice(compras24h);
  
  resultado.ventaCI_breakdown = {
    totalValue: Math.round(avgPrecioVentasCI * matchedQty * 100) / 100,
    avgPrice: Math.round(avgRawPriceVentasCI * 100) / 100, // Display original price from CSV
    totalFees: Math.round(totalComisionesVentas * 100) / 100,
    quantity: totalVentasCI,
  };
  resultado.compra24h_breakdown = {
    totalValue: Math.round(avgPrecioCompras24h * matchedQty * 100) / 100,
    avgPrice: Math.round(avgRawPriceCompras24h * 100) / 100, // Display original price from CSV
    totalFees: Math.round(totalComisionesCompras * 100) / 100,
    quantity: totalCompras24h,
  };

  // Calculate caución P&L always using grupo.avgTNA and repo-fees breakdown
  // NOTE: attached cauciones are ignored here per new requirement; we
  // always use avgTNA and estimate ByMA/repo fees via the repo-fees calculator.
  const avgTNA = grupo.avgTNA || 0;
  resultado.cauciones = []; // attached cauciones are not used anymore
  resultado.avgTNA = avgTNA; // Store avgTNA for display

  if (plazo > 0) {
    // Financing INCOME (positive - lending / colocadora)
    const operationTotal = resultado.precioPromedio * matchedQty;
    const proportionalBrokerCommissions = totalComisionesVentas;
    const totalOperationFeeAmount = ventasCI.reduce((sum, op) => sum + (op.feeAmount || 0), 0) * (matchedQty / (totalVentasCI || matchedQty));

    // Principal (net cash received when selling CI and lending)
    const principal = operationTotal - proportionalBrokerCommissions - totalOperationFeeAmount;
    const accruedInterest = principal * (avgTNA / 100) * (plazo / 365);
    const baseAmount = principal + accruedInterest;

    // Default caucion fees to 0 and attempt to compute a full repo (ByMA) breakdown
    let caucionFees = 0;
    try {
      const repoFeeConfig = await getRepoFeeConfig();
      if (repoFeeConfig) {
        const { calculateRepoExpenseBreakdown } = await import('./fees/repo-fees.js');
        const tenorDays = plazo;
        const priceTNA = avgTNA;
        const repoOperationInput = {
          id: `${resultado.patron}-${grupo.instrumento}-${plazo}`,
          instrument: { cfiCode: 'RP', displayName: `${grupo.instrumento} ${tenorDays}D` },
          currency: 'ARS',
          role: CAUCION_TIPOS.COLOCADORA,
          principalAmount: principal,
          baseAmount,
          priceTNA,
          tenorDays,
        };

        const raw = calculateRepoExpenseBreakdown(repoOperationInput, repoFeeConfig);
        if (raw) {
          const normalized = {
            _raw: raw,
            principalAmount: raw.principalAmount,
            tenorDays: raw.tenorDays,
            baseAmount: raw.baseAmount,
            accruedInterest: raw.accruedInterest,
            arancel: raw.arancelAmount ?? raw.arancel ?? 0,
            derechos: raw.derechosMercadoAmount ?? raw.derechos ?? 0,
            gastos: raw.gastosGarantiaAmount ?? raw.gastos ?? 0,
            iva: raw.ivaAmount ?? raw.iva ?? 0,
            totalExpenses: raw.totalExpenses ?? 0,
            netSettlement: raw.netSettlement ?? raw.baseAmount ?? baseAmount,
            warnings: raw.warnings ?? [],
            status: raw.status ?? null,
          };

          resultado.caucionFeesBreakdown = normalized;
          caucionFees = normalized.totalExpenses || 0;
          resultado.caucionFeesTotal = Math.round(caucionFees * 100) / 100;
        }
      }
    } catch (_e) {
      void _e; // non-fatal — keep caucionFees as computed (likely 0)
    }

    resultado.principal = Math.round(principal * 100) / 100;
    resultado.accruedInterest = Math.round(accruedInterest * 100) / 100;
    resultado.baseAmount = Math.round(baseAmount * 100) / 100;

    // caucion P&L = accruedInterest (earnings) - fees
    resultado.pnl_caucion = Math.round((accruedInterest - caucionFees) * 100) / 100;
    resultado.estado = totalVentasCI === totalCompras24h ? ESTADOS.COMPLETO : ESTADOS.CANTIDADES_DESBALANCEADAS;
  } else {
    resultado.pnl_caucion = 0;
    resultado.estado = ESTADOS.MATCHED_SIN_CAUCION;
  }

  // Total P&L
  resultado.pnl_total = resultado.pnl_trade + resultado.pnl_caucion;
  resultado.isCaucionColocadora = true;

  return resultado;
}

/**
 * Calculate P&L for pattern: CompraCI → Venta24h
 * @param {import('./arbitrage-types.js').GrupoInstrumentoPlazo} grupo
 * @returns {import('./arbitrage-types.js').ResultadoPatron|null}
 */
async function calculatePatronCompraCIVenta24h(grupo) {
  const { comprasCI, ventas24h, plazo } = grupo;

  if (comprasCI.length === 0 && ventas24h.length === 0) {
    return null;
  }

  const resultado = createResultadoPatron(PATTERNS.COMPRA_CI_VENTA_24H);

  // Calculate total quantities and values for each side
  const totalComprasCI = sumQuantity(comprasCI);
  const totalVentas24h = sumQuantity(ventas24h);
  
  // Calculate weighted average prices (normalized)
  const avgPrecioComprasCI = calculateWeightedAverage(comprasCI);
  const avgPrecioVentas24h = calculateWeightedAverage(ventas24h);
  // For Buy CI - Sell 24 we should use the weighted average price of Buy CI
  const avgPrice = avgPrecioComprasCI;
  
  // Calculate matched quantity - use the minimum of buy/sell quantities
  const matchedQty = Math.min(totalComprasCI, totalVentas24h);

  resultado.matchedQty = matchedQty;
  resultado.operations = [...comprasCI, ...ventas24h];

  // No matched operations
  if (matchedQty === 0) {
    resultado.estado = ESTADOS.SIN_CONTRAPARTE;
    return resultado;
  }

  // Calculate trade P&L
  // When quantities are unbalanced, only use proportional fees/commissions for matched quantity
  const avgComisionesCompras = calculateWeightedAverageCommissions(comprasCI);
  const avgComisionesVentas = calculateWeightedAverageCommissions(ventas24h);

  // conservative references to satisfy linter (kept for parity with other branch)
  void avgComisionesCompras;
  void avgComisionesVentas;

  resultado.precioPromedio = avgPrice;

  // P&L Trade = (Venta 24h - Compra CI) * matchedQty - comisiones
  const pnlTradeGross = (avgPrecioVentas24h - avgPrecioComprasCI) * matchedQty;
  
  // Calculate proportional commissions based on matched quantity

  // If unbalanced, use only the proportion that was actually matched
  const proportionCompras = totalComprasCI > 0 ? matchedQty / totalComprasCI : 0;
  const proportionVentas = totalVentas24h > 0 ? matchedQty / totalVentas24h : 0;
  
  const totalComisionesCompras = sumCommissions(comprasCI) * proportionCompras;
  const totalComisionesVentas = sumCommissions(ventas24h) * proportionVentas;
  const comisionesTotales = totalComisionesCompras + totalComisionesVentas;
  
  resultado.pnl_trade = pnlTradeGross - comisionesTotales;

  // Add breakdown information for UI display
  // Use raw prices for display (original values from CSV)
  const avgRawPriceComprasCI = calculateWeightedAverageRawPrice(comprasCI);
  const avgRawPriceVentas24h = calculateWeightedAverageRawPrice(ventas24h);
  
  resultado.compraCI_breakdown = {
    totalValue: Math.round(avgPrecioComprasCI * matchedQty * 100) / 100,
    avgPrice: Math.round(avgRawPriceComprasCI * 100) / 100, // Display original price from CSV
    totalFees: Math.round(totalComisionesCompras * 100) / 100,
    quantity: totalComprasCI,
  };
  resultado.venta24h_breakdown = {
    totalValue: Math.round(avgPrecioVentas24h * matchedQty * 100) / 100,
    avgPrice: Math.round(avgRawPriceVentas24h * 100) / 100, // Display original price from CSV
    totalFees: Math.round(totalComisionesVentas * 100) / 100,
    quantity: totalVentas24h,
  };

  // Calculate caución P&L always using grupo.avgTNA and repo-fees breakdown
  // NOTE: attached cauciones are ignored here per new requirement; we
  // always use avgTNA and estimate ByMA/repo fees via the repo-fees calculator.
  const avgTNA = grupo.avgTNA || 0;
  resultado.cauciones = []; // attached cauciones are not used anymore
  resultado.avgTNA = avgTNA; // Store avgTNA for display

  if (plazo > 0) {
    // Financing COST (negative - borrowing / tomadora)
    const operationTotal = resultado.precioPromedio * matchedQty;
    const proportionalBrokerCommissions = totalComisionesCompras;
    const totalOperationFeeAmount = comprasCI.reduce((sum, op) => sum + (op.feeAmount || 0), 0) * (matchedQty / (totalComprasCI || matchedQty));

    // Principal (cash paid when buying CI and borrowing)
    const principal = operationTotal + proportionalBrokerCommissions + totalOperationFeeAmount;
    const accruedInterest = principal * (avgTNA / 100) * (plazo / 365);
    const baseAmount = principal + accruedInterest;

    // Default caucion fees to 0 and attempt to compute a full repo (ByMA) breakdown
    let caucionFees = 0;
    try {
      const repoFeeConfig = await getRepoFeeConfig();
      if (repoFeeConfig) {
        const { calculateRepoExpenseBreakdown } = await import('./fees/repo-fees.js');
        const tenorDays = plazo;
        const priceTNA = avgTNA;
        const repoOperationInput = {
          id: `${resultado.patron}-${grupo.instrumento}-${plazo}`,
          instrument: { cfiCode: 'RP', displayName: `${grupo.instrumento} ${tenorDays}D` },
          currency: 'ARS',
          role: CAUCION_TIPOS.TOMADORA,
          principalAmount: principal,
          baseAmount,
          priceTNA,
          tenorDays,
        };

        const raw = calculateRepoExpenseBreakdown(repoOperationInput, repoFeeConfig);
        if (raw) {
          const normalized = {
            _raw: raw,
            principalAmount: raw.principalAmount,
            tenorDays: raw.tenorDays,
            baseAmount: raw.baseAmount,
            accruedInterest: raw.accruedInterest,
            arancel: raw.arancelAmount ?? raw.arancel ?? 0,
            derechos: raw.derechosMercadoAmount ?? raw.derechos ?? 0,
            gastos: raw.gastosGarantiaAmount ?? raw.gastos ?? 0,
            iva: raw.ivaAmount ?? raw.iva ?? 0,
            totalExpenses: raw.totalExpenses ?? 0,
            netSettlement: raw.netSettlement ?? raw.baseAmount ?? baseAmount,
            warnings: raw.warnings ?? [],
            status: raw.status ?? null,
          };

          resultado.caucionFeesBreakdown = normalized;
          caucionFees = normalized.totalExpenses || 0;
          resultado.caucionFeesTotal = Math.round(caucionFees * 100) / 100;
        }
      }
    } catch (_e) {
      void _e; // non-fatal — keep caucionFees as computed (likely 0)
    }

    resultado.principal = Math.round(principal * 100) / 100;
    resultado.accruedInterest = Math.round(accruedInterest * 100) / 100;
    resultado.baseAmount = Math.round(baseAmount * 100) / 100;

    resultado.pnl_caucion = Math.round((-(accruedInterest + caucionFees)) * 100) / 100;
    resultado.estado = totalComprasCI === totalVentas24h ? ESTADOS.COMPLETO : ESTADOS.CANTIDADES_DESBALANCEADAS;
  } else {
    resultado.pnl_caucion = 0;
    resultado.estado = ESTADOS.MATCHED_SIN_CAUCION;
  }

  // Total P&L
  resultado.pnl_total = resultado.pnl_trade + resultado.pnl_caucion;
  resultado.isCaucionColocadora = false;

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
 * Sum total commissions from operations
 * @param {import('./arbitrage-types.js').Operacion[]} operations
 * @returns {number}
 */
function sumCommissions(operations) {
  return operations.reduce((sum, op) => sum + op.comisiones, 0);
}

/**
 * Calculate weighted average price (normalized)
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
 * Calculate weighted average raw price (original price from CSV)
 * @param {import('./arbitrage-types.js').Operacion[]} operations
 * @returns {number}
 */
function calculateWeightedAverageRawPrice(operations) {
  if (operations.length === 0) return 0;

  const totalQuantity = operations.reduce((sum, op) => sum + (op.rawCantidad || op.cantidad), 0);
  if (totalQuantity === 0) return 0;

  const weightedSum = operations.reduce((sum, op) => {
    const qty = op.rawCantidad || op.cantidad;
    const price = op.rawPrecio || op.precio;
    return sum + (price * qty);
  }, 0);
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
// eslint-disable-next-line no-unused-vars
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
// eslint-disable-next-line no-unused-vars
function calculateCaucionPnL(cauciones, matchedQty, plazo) {
  if (cauciones.length === 0) return 0;

  // Support multiple tramos by computing a TNA ponderada por monto.
  // This mirrors the avgTNA-based calculation used elsewhere but kept
  // compatible with the existing normalization approach: callers pass
  // `cauciones` already filtradas por tipo (colocadora|tomadora).

  // Sum total monto and compute weighted TNA
  let totalMonto = 0;
  let weightedTnaSum = 0;
  let totalInterest = 0;

  cauciones.forEach((c) => {
    const monto = c.monto || 0;
    const tasa = c.tasa || 0; // tasa expected as % (e.g. 75 means 75%)
    const interes = c.interes || 0; // existing precomputed interest for the tranche
    totalMonto += monto;
    weightedTnaSum += tasa * monto;
    totalInterest += interes;
  });

  if (totalMonto === 0) {
    return 0;
  }

  const weightedTNA = weightedTnaSum / totalMonto;

  // conservative reference for totalInterest (preserved for compatibility)
  void totalInterest;

  // Estimate total interest for the (combined) principal using weightedTNA
  // Note: keep same day-base as other code (plazo/365)
  const estimatedTotalInterest = totalMonto * (weightedTNA / 100) * (plazo / 365);

  // Normalize to matchedQty using the same mapping used previously:
  // normalizedInterest = (estimatedTotalInterest * matchedQty) / totalMonto
  // This simplifies to matchedQty * (weightedTNA/100) * (plazo/365)
  const normalizedInterest = (estimatedTotalInterest * matchedQty) / totalMonto;

  // Preserve sign depending on caución tipo (colocadora = earn, tomadora = pay)
  const tipo = cauciones[0]?.tipo || cauciones[0]?.role || 'colocadora';
  return tipo === CAUCION_TIPOS.COLOCADORA ? normalizedInterest : -normalizedInterest;
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
