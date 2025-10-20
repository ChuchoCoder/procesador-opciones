/**
 * Arbitrage Fee Enrichment Service
 * Enriches arbitrage operations and cauciones with calculated fees
 * Uses the same fee calculation infrastructure as COMPRA y VENTA
 */

import { enrichOperationWithFee } from './fees/fee-enrichment.js';
import { getEffectiveRates } from './bootstrap-defaults.js';
import { getRepoFeeConfig } from './storage-settings.js';
import { getInstrumentDetails } from './fees/instrument-mapping.js';

function resolveInstrumentDetails(operation) {
  const symbolCandidates = [
    operation.symbol,
    operation.instrumento,
    operation.originalSymbol,
    operation?.raw?.symbol,
    operation?.raw?.instrument,
    operation?.raw?.instrumento,
  ];

  for (const candidate of symbolCandidates) {
    if (typeof candidate !== 'string' || candidate.trim().length === 0) {
      continue;
    }

    const details = getInstrumentDetails(candidate);
    if (details) {
      return details;
    }
  }

  if (!resolveInstrumentDetails._logged) {
    console.warn('PO: arbitrage-fee-enrichment missing instrument details', {
      availableKeys: Object.keys(operation || {}),
      symbolCandidates,
    });
    resolveInstrumentDetails._logged = true;
  }

  return null;
}

/**
 * Enrich a single arbitrage operation with fee calculation
 * @param {Object} operation - Raw operation from CSV
 * @param {Object} effectiveRates - Fee rates configuration
 * @returns {Object} Operation with feeAmount, feeBreakdown, category
 */
function enrichArbitrageOperation(operation, effectiveRates) {
  try {
    // Skip re-enrichment if operation already has feeAmount calculated
    if (operation.feeAmount !== undefined && operation.feeAmount !== null) {
      return operation;
    }
    
  // Get instrument details for categorization (synchronous)
  const instrumentDetails = resolveInstrumentDetails(operation);
    
    // Build operation object in expected format for fee calculator
    // Note: Arbitrage operations are CI/24h trades, NOT repos, so we don't pass repoFeeConfig
    // CRITICAL: enrichOperationWithFee expects RAW price and will normalize it
    // If rawPrecio exists, use it directly (it's the original CSV price)
    // If not, we need to un-normalize precio by dividing by priceConversionFactor
    let rawPrice;
    const priceConversionFactor = instrumentDetails?.priceConversionFactor ?? 1;
    
    if (operation.rawPrecio) {
      // Use raw price directly
      rawPrice = operation.rawPrecio;
    } else if (operation.precio && priceConversionFactor !== 1) {
      // precio is normalized, un-normalize it: precio / priceConversionFactor
      rawPrice = operation.precio / priceConversionFactor;
    } else {
      // Fallback to any available price field
      rawPrice = operation.last_price || operation.price || operation.precio || 0;
    }
    
    const feeOperation = {
      symbol: operation.symbol || operation.instrumento,
      side: operation.side || operation.lado,
      quantity: operation.last_qty || operation.quantity || operation.cantidad,
      price: rawPrice,
      originalSymbol: operation.symbol || operation.instrumento,
      instrument: instrumentDetails,
    };
    
    // Enrich with fees (no repoFeeConfig for regular trades)
    const enriched = enrichOperationWithFee(feeOperation, effectiveRates, { 
      instrumentDetails,
    });
    
    return {
      ...operation,
      feeAmount: enriched.feeAmount || 0,
      feeBreakdown: enriched.feeBreakdown || null,
      category: enriched.category || 'unknown',
      instrumentDetails,
    };
  } catch (error) {
    console.warn('Failed to enrich operation with fees:', operation, error);
    return {
      ...operation,
      feeAmount: 0,
      feeBreakdown: null,
      category: 'unknown',
    };
  }
}

/**
 * Enrich arbitrage operations with fee calculations
 * @param {Array} operations - Array of operations from CSV
 * @returns {Promise<Array>} Operations with fee data
 */
export async function enrichArbitrageOperations(operations) {
  if (!Array.isArray(operations) || operations.length === 0) {
    return [];
  }
  
  // Get fee configurations (same as process-operations.js)
  const effectiveRates = getEffectiveRates();
  const repoFeeConfig = await getRepoFeeConfig();
  
  const enriched = operations.map(op => 
    enrichArbitrageOperation(op, effectiveRates)
  );
  
  return enriched;
}

/**
 * Enrich a single caución with fee calculation
 * @param {Object} caucion - Caución object
 * @returns {Promise<Object>} Caución with fees
 */
async function enrichCaucion(caucion) {
  try {
    const repoFeeConfig = await getRepoFeeConfig();
    
    if (!repoFeeConfig) {
      return {
        ...caucion,
        feeAmount: 0,
        feeBreakdown: null,
      };
    }
    
    // Import repo fee calculator
    const { calculateRepoExpenseBreakdown } = await import('./fees/repo-fees.js');
    
    // Calculate repo fees
    const breakdown = calculateRepoExpenseBreakdown({
      principalAmount: caucion.monto,
      priceTNA: caucion.tasa,
      tenorDays: caucion.tenorDias,
      role: caucion.tipo, // 'colocadora' or 'tomadora'
      repoFeeConfig,
    });
    
    const totalFees = (breakdown?.arancel || 0) + 
                      (breakdown?.derechos || 0) + 
                      (breakdown?.gastos || 0) +
                      (breakdown?.iva || 0);
    
    return {
      ...caucion,
      feeAmount: totalFees,
      feeBreakdown: breakdown,
    };
  } catch (error) {
    console.warn('Failed to enrich caucion with fees:', caucion, error);
    return {
      ...caucion,
      feeAmount: 0,
      feeBreakdown: null,
    };
  }
}

/**
 * Enrich cauciones with fee calculations
 * @param {Array} cauciones - Array of cauciones
 * @returns {Promise<Array>} Cauciones with fee data
 */
export async function enrichCauciones(cauciones) {
  if (!Array.isArray(cauciones) || cauciones.length === 0) {
    return [];
  }
  
  const enriched = await Promise.all(
    cauciones.map(c => enrichCaucion(c))
  );
  
  return enriched;
}
