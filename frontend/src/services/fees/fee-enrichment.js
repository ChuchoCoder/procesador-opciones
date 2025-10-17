// fee-enrichment.js - Attaches fee calculations to operation rows
// Integrates with process-operations pipeline to add fee fields.

import { calculateFee } from './fee-calculator.js';
import { resolveCfiCategory, getInstrumentDetails, getUnknownCfiCodes } from './instrument-mapping.js';
import { getEffectiveRates } from '../bootstrap-defaults.js';
import { logFeeProcessingSummary } from '../logging/fee-logging.js';

/**
 * Enriches a single operation with fee calculation fields.
 * @param {object} operation - enriched operation from process-operations
 * @param {object} effectiveRates - precomputed rates by category
 * @returns {object} operation with added fee fields (feeAmount, feeBreakdown, category)
 */
export function enrichOperationWithFee(operation, effectiveRates) {
  if (!operation) return operation;

  const quantity = operation.quantity ?? 0;
  const price = operation.price ?? 0;
  // Use originalSymbol first (full CSV symbol like "MERV - XMEV - PFE - CI")
  // This matches the symbol format in InstrumentsWithDetails.json
  const symbol = operation.originalSymbol || operation.symbol || '';
  
  // Get instrument details (PriceConversionFactor, ContractMultiplier, CfiCode)
  const instrumentDetails = getInstrumentDetails(symbol);
  
  // Resolve category from CfiCode
  let cfiCode = instrumentDetails?.cfiCode || operation.raw?.cfiCode || operation.raw?.CfiCode || operation.meta?.cfiCode;
  let category = 'bonds'; // default fallback

  if (cfiCode) {
    category = resolveCfiCategory(cfiCode);
  } else if (operation.optionType === 'CALL' || operation.optionType === 'PUT') {
    category = 'option';
  }

  // Use instrument-specific values with fallbacks
  const priceConversionFactor = instrumentDetails?.priceConversionFactor ?? 1;
  const contractMultiplier = instrumentDetails?.contractMultiplier ?? (category === 'option' ? 100 : 1);
  
  // Calculate gross notional: quantity × contractMultiplier × (price × priceConversionFactor)
  const adjustedPrice = price * priceConversionFactor;
  const grossNotional = Math.abs(quantity) * contractMultiplier * adjustedPrice;

  // Calculate fee using pure calculator
  const feeResult = calculateFee({ grossNotional, category }, effectiveRates);

  // Debug logging
  // eslint-disable-next-line no-console
  console.log('PO: fee-enrichment', {
    symbol,
    quantity,
    price,
    priceConversionFactor,
    adjustedPrice,
    contractMultiplier,
    grossNotional,
    category,
    cfiCode,
    feeAmount: feeResult.feeAmount,
  });

  return {
    ...operation,
    grossNotional,
    category,
    cfiCode: cfiCode || null,
    feeAmount: feeResult.feeAmount,
    feeBreakdown: feeResult.feeBreakdown,
  };
}

/**
 * Enriches an array of operations with fee calculations.
 * Logs summary of processed rows and unknown CfiCodes.
 * @param {Array<object>} operations - enriched operations from process-operations
 * @returns {Array<object>} operations with fee fields
 */
export function enrichOperationsWithFees(operations) {
  if (!Array.isArray(operations) || operations.length === 0) {
    return operations;
  }

  const effectiveRates = getEffectiveRates();
  
  // Debug: log effective rates
  // eslint-disable-next-line no-console
  console.log('PO: effective-rates', effectiveRates);

  const enriched = operations.map((op) => enrichOperationWithFee(op, effectiveRates));

  // Log summary
  const unknownCfiCodes = getUnknownCfiCodes();
  logFeeProcessingSummary({
    totalRows: enriched.length,
    unknownCfiCodes,
  });

  return enriched;
}
