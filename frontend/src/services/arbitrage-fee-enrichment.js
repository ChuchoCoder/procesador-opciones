/**
 * Arbitrage Fee Enrichment Service
 * Enriches arbitrage operations and cauciones with calculated fees
 * Uses the same fee calculation infrastructure as COMPRA y VENTA
 */

import { enrichOperationWithFee } from './fees/fee-enrichment.js';
import { getEffectiveRates } from './bootstrap-defaults.js';
import { getRepoFeeConfig } from './storage-settings.js';
import { getInstrumentDetails } from './fees/instrument-mapping.js';

/**
 * Enrich a single arbitrage operation with fee calculation
 * @param {Object} operation - Raw operation from CSV
 * @param {Object} effectiveRates - Fee rates configuration
 * @returns {Object} Operation with feeAmount, feeBreakdown, category
 */
function enrichArbitrageOperation(operation, effectiveRates) {
  try {
    // Get instrument details for categorization (synchronous)
    const instrumentDetails = getInstrumentDetails(operation.symbol || operation.instrumento);
    
    // Build operation object in expected format for fee calculator
    // Note: Arbitrage operations are CI/24h trades, NOT repos, so we don't pass repoFeeConfig
    const feeOperation = {
      symbol: operation.symbol || operation.instrumento,
      side: operation.side || operation.lado,
      quantity: operation.last_qty || operation.cantidad,
      price: operation.last_price || operation.precio,
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
  
  console.log('Enriching arbitrage operations with fees', { count: operations.length });
  
  // Get fee configurations (same as process-operations.js)
  const effectiveRates = getEffectiveRates();
  const repoFeeConfig = await getRepoFeeConfig();
  
  console.log('PO: arbitrage-fee-rates', {
    hasEffectiveRates: Boolean(effectiveRates),
    hasRepoFeeConfig: Boolean(repoFeeConfig),
  });
  
  const enriched = operations.map(op => 
    enrichArbitrageOperation(op, effectiveRates)
  );
  
  console.log('Arbitrage operations enriched with fees', {
    count: enriched.length,
    sampleFee: enriched[0]?.feeAmount,
  });
  
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
  
  console.log('Enriching cauciones with fees', { count: cauciones.length });
  
  const enriched = await Promise.all(
    cauciones.map(c => enrichCaucion(c))
  );
  
  console.log('Cauciones enriched with fees', {
    count: enriched.length,
    sampleFee: enriched[0]?.feeAmount,
  });
  
  return enriched;
}
