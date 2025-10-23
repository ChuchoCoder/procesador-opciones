/**
 * Fee Calculator - Pure fee calculation functions for unified pipeline
 * 
 * This module re-exports the existing fee calculation logic from fees/fee-enrichment.js
 * but provides it in a format compatible with the unified pipeline's needs.
 * 
 * The actual fee calculation logic remains in the existing fee-enrichment module
 * to maintain backward compatibility and avoid duplication.
 * 
 * @module pipeline/fee-calculator
 */

import {
  enrichOperationWithFee as enrichOp,
  enrichOperationsWithFees as enrichOps
} from '../fees/fee-enrichment.js';

// Re-export existing fee enrichment functions
export {
  enrichOperationWithFee,
  enrichOperationsWithFees
} from '../fees/fee-enrichment.js';

/**
 * Calculate fees for a single operation (convenience wrapper)
 * 
 * This is a thin wrapper around the existing fee enrichment logic
 * that provides a cleaner API for the unified pipeline.
 * 
 * @param {Object} operation - Operation to calculate fees for
 * @param {Object} effectiveRates - Fee rates by category
 * @param {Object} options - Fee calculation options
 * @param {Object} options.repoFeeConfig - Repo fee configuration (if applicable)
 * @returns {Object} - Operation with fee fields added
 */
export function calculateOperationFees(operation, effectiveRates, options = {}) {
  // Use re-exported function
  return enrichOp(operation, effectiveRates, options);
}

/**
 * Calculate fees for multiple operations (convenience wrapper)
 * 
 * @param {Array<Object>} operations - Operations to calculate fees for
 * @returns {Promise<Array<Object>>} - Operations with fee fields added
 */
export async function calculateBatchFees(operations) {
  // Use re-exported function
  return enrichOps(operations);
}
