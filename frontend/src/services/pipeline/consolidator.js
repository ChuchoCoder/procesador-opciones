/**
 * Consolidator - Pure consolidation logic for unified pipeline
 * 
 * This module reuses the existing consolidation logic from csv/consolidator.js
 * but exports it in a way that's compatible with the unified pipeline.
 * 
 * @module pipeline/consolidator
 */

import { 
  consolidateOperations as consolidateOps
} from '../csv/consolidator.js';

// Re-export existing consolidation functions
export { 
  consolidateOperations,
  buildConsolidatedViews 
} from '../csv/consolidator.js';

/**
 * Consolidate operations with unified pipeline options
 * 
 * This is a convenience wrapper that matches the unified pipeline's interface.
 * 
 * @param {Array<Object>} operations - Enriched operations to consolidate
 * @param {Object} options - Consolidation options
 * @param {boolean} options.useAveraging - Whether to use averaging mode
 * @returns {Object} - Consolidated result with calls, puts, and exclusions
 */
export function consolidate(operations, options = {}) {
  const { useAveraging = false } = options;
  
  // Use re-exported consolidation function
  return consolidateOps(operations, { useAveraging });
}
