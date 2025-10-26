// fee-calculator.js - Pure fee calculation logic (deterministic)
// Returns fee breakdown and total per operation; aggregated fee for consolidated rows.

import { isCaucionEnabled } from './fees-flags.js';

/**
 * Calculates fee breakdown for a single operation.
 * @param {object} operation - { grossNotional, category, ... }
 * @param {object} effectiveRates - precomputed category rates from config-validation
 * @returns {object} { feeAmount, feeBreakdown: { commissionPct, rightsPct, vatPct, commissionAmount, rightsAmount, vatAmount, category, source } }
 */
export function calculateFee(operation, effectiveRates) {
  const { grossNotional, category } = operation;

  // Caucion placeholder logic
  if (category === 'caucion' && !isCaucionEnabled()) {
    return {
      feeAmount: 0,
      feeBreakdown: {
        commissionPct: 0,
        rightsPct: 0,
        vatPct: 0,
        commissionAmount: 0,
        rightsAmount: 0,
        vatAmount: 0,
        category: 'caucion',
        source: 'placeholder',
      },
    };
  }

  // Resolve rates for category
  const rates = effectiveRates[category] || effectiveRates.bonds; // fallback to bonds
  const { commissionPct, rightsPct, vatPct, effectiveRate } = rates;
  // conservative reference to avoid unused-variable lint when configs include extra fields
  void effectiveRate;

  // Component amounts (high precision)
  const commissionAmount = grossNotional * commissionPct;
  const rightsAmount = grossNotional * rightsPct;
  // VAT applies to both commission and derechos (rights)
  const baseAmount = commissionAmount + rightsAmount;
  const vatAmount = baseAmount * vatPct;
  const feeAmount = baseAmount + vatAmount;

  return {
    feeAmount,
    feeBreakdown: {
      commissionPct,
      rightsPct,
      vatPct,
      commissionAmount,
      rightsAmount,
      vatAmount,
      category,
      source: 'config',
    },
  };
}

/**
 * Calculates aggregated fee for consolidated operations.
 * Uses aggregated gross notional; recomputes components (not sum of rounded).
 * @param {number} aggregatedGrossNotional
 * @param {string} category - dominant/homogeneous category
 * @param {object} effectiveRates
 * @returns {object} same structure as calculateFee
 */
export function aggregateFee(aggregatedGrossNotional, category, effectiveRates) {
  // Treat as single operation with aggregated notional
  const operation = { grossNotional: aggregatedGrossNotional, category };
  return calculateFee(operation, effectiveRates);
}
