/**
 * Arbitrage Fee Enrichment Service
 * Enriches arbitrage operations and cauciones with calculated fees
 * Uses the same fee calculation infrastructure as COMPRA y VENTA
 */

import { enrichOperationWithFee } from './fees/fee-enrichment.js';
import { getEffectiveRates } from './bootstrap-defaults.js';
import { getRepoFeeConfig } from './fees/broker-fees-storage.js';
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
  // repoFeeConfig is intentionally unused for arbitrage operations flow; reference to satisfy linter
  void repoFeeConfig;
  
  const enriched = operations.map(op => 
    enrichArbitrageOperation(op, effectiveRates)
  );

  // Debug: summarize enriched operations to help locate PESOS/caucion rows missing feeBreakdown
  try {
    const sampleCount = Math.min(10, enriched.length);
    const sample = enriched.slice(0, sampleCount).map((o) => ({
      id: o?.id ?? null,
      symbol: o?.symbol ?? o?.instrumento ?? null,
      sourceFeeBreakdown: !!o?.feeBreakdown,
      feeAmount: o?.feeAmount ?? null,
    }));
    const pesosRows = enriched.filter((o) => (String(o?.symbol ?? o?.instrumento ?? '').toUpperCase().includes('PESOS'))).length;
    console.debug('[arbitrage-fee-enrichment] enrichArbitrageOperations: enriched count', { total: enriched.length, sample, pesosRows });
  } catch (_e) {
    // swallow debug errors
    void _e;
  }
  
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
      // Log helpful debug info when repo config is missing so UI can diagnose zeros
      // Keep message concise to avoid noise in normal runs
      console.warn('[arbitrage-fee-enrichment] enrichCaucion: missing repoFeeConfig, cannot compute repo fees for caucion', {
        caucionId: caucion?.id ?? null,
        instrumento: caucion?.instrumento ?? null,
        monto: caucion?.monto ?? null,
        tasa: caucion?.tasa ?? null,
        tenorDias: caucion?.tenorDias ?? null,
      });

      return {
        ...caucion,
        feeAmount: 0,
        feeBreakdown: null,
      };
    }
    
    // Import repo fee calculator
    const { calculateRepoExpenseBreakdown, calculateAccruedInterest } = await import('./fees/repo-fees.js');

    // Build a repoOperation object shaped the repo-fees calculator expects.
    // The calculator expects an object with `instrument`/`cfiCode`, `currency`,
    // `principalAmount`, `baseAmount`, `priceTNA` and `tenorDays` so we normalize
    // the caucion into that form. This prevents `calculateRepoExpenseBreakdown`
    // from returning null due to shape mismatches.
    const principal = caucion.monto ?? 0;
  const tenor = (caucion.tenorDias ?? caucion.tenor) || 0;
    const priceTNA = caucion.tasa ?? caucion.priceTNA ?? 0;

    const accrued = calculateAccruedInterest(principal, priceTNA, tenor);
    const baseAmount = (caucion.baseAmount ?? principal + accrued) || principal + accrued;

    const repoOperationInput = {
      id: caucion.id,
      instrument: {
        // Provide a synthetic cfiCode so `shouldProcessRepoOperation` accepts this
        // caucion as a repo-like operation. The repo fees resolver primarily
        // uses `currency` and `role` to look up rates.
        cfiCode: caucion.cfiCode ?? 'RP',
        displayName: `${caucion.instrumento || 'PESOS'} ${tenor}D`,
      },
      currency: caucion.currency || caucion.moneda || 'ARS',
      role: caucion.tipo || caucion.role || 'tomadora',
      principalAmount: principal,
      baseAmount,
      priceTNA,
      tenorDays: tenor,
    };

    // Calculate repo fees using the normalized input
    const rawBreakdown = calculateRepoExpenseBreakdown(repoOperationInput, repoFeeConfig);

    // Normalize field names so downstream code (and existing UI) can rely on
    // short keys: arancel, derechos, gastos, iva, totalExpenses, netSettlement
    const breakdown = rawBreakdown ? {
      // keep original breakdown for full details
      _raw: rawBreakdown,
      principalAmount: rawBreakdown.principalAmount,
      tenorDays: rawBreakdown.tenorDays,
      baseAmount: rawBreakdown.baseAmount,
      accruedInterest: rawBreakdown.accruedInterest,
      arancel: rawBreakdown.arancelAmount ?? rawBreakdown.arancel ?? 0,
      derechos: rawBreakdown.derechosMercadoAmount ?? rawBreakdown.derechos ?? 0,
      gastos: rawBreakdown.gastosGarantiaAmount ?? rawBreakdown.gastos ?? 0,
      iva: rawBreakdown.ivaAmount ?? rawBreakdown.iva ?? 0,
      totalExpenses: rawBreakdown.totalExpenses ?? 0,
      netSettlement: rawBreakdown.netSettlement ?? rawBreakdown.baseAmount ?? baseAmount,
      warnings: rawBreakdown.warnings ?? [],
      status: rawBreakdown.status ?? null,
    } : null;

    const totalFees = (breakdown?.arancel || 0) + (breakdown?.derechos || 0) + (breakdown?.gastos || 0) + (breakdown?.iva || 0);

    // Debug: log breakdown summary for the caucion so we can trace missing values
    // console.debug('[arbitrage-fee-enrichment] enrichCaucion: computed breakdown', {
    //   caucionId: caucion?.id ?? null,
    //   instrumento: caucion?.instrumento ?? null,
    //   principalAmount: breakdown?.principalAmount ?? caucion?.monto ?? null,
    //   arancel: breakdown?.arancel ?? null,
    //   derechos: breakdown?.derechos ?? null,
    //   gastos: breakdown?.gastos ?? null,
    //   iva: breakdown?.iva ?? null,
    //   totalFees,
    //   netSettlement: breakdown?.netSettlement ?? null,
    // });

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
