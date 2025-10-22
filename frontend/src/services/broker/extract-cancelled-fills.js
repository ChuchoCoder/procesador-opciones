/**
 * extract-cancelled-fills.js
 * 
 * Extracts filled quantities from CANCELLED broker operations.
 * 
 * When orders are cancelled after partial fills, the broker API sends:
 * - status = CANCELLED
 * - cumQty > 0 (the quantity that was actually filled)
 * - avgPx (the average execution price)
 * 
 * This module converts those into FILLED operations so they're not lost
 * during validation.
 * 
 * Also handles replacement chains:
 * - Orders cancelled due to price changes (text="REPLACED")
 * - Linked via origClOrdId field
 * - Only extract fills from the final state
 */

import { createDevLogger } from '../logging/dev-logger.js';

/**
 * Generates a simple UUID for new operations
 */
function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for non-crypto environments
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Build a map of replacement chains using origClOrdId
 * @param {Array} operations - All operations
 * @returns {Map} Map of clOrdId -> operation that replaces it
 */
function buildReplacementChains(operations) {
  const replacementMap = new Map();
  
  operations.forEach(op => {
    if (op.origClOrdId) {
      // This operation replaces the one with clOrdId = op.origClOrdId
      replacementMap.set(op.origClOrdId, op);
    }
  });
  
  return replacementMap;
}

/**
 * Check if an operation was replaced by another operation
 * @param {Object} operation - Operation to check
 * @param {Map} replacementMap - Map of replacements
 * @returns {boolean} True if this operation was replaced
 */
function wasReplaced(operation, replacementMap) {
  return replacementMap.has(operation.clOrdId);
}

/**
 * Check if a cancelled operation should have its fills extracted
 * @param {Object} operation - Operation to check
 * @param {Map} replacementMap - Map of replacements
 * @returns {boolean} True if fills should be extracted
 */
function shouldExtractFills(operation, replacementMap) {
  // Must be cancelled
  if (operation.status !== 'CANCELLED') {
    return false;
  }
  
  // Must have cumulative quantity > 0 (actual fills occurred)
  const cumQty = operation.cumQty || 0;
  if (cumQty <= 0) {
    return false;
  }
  
  // Skip orders marked as "REPLACED" in the text field, even if replacement not found in chain
  // This handles cases where the replacement order is not in the current dataset
  const text = (operation.text || '').toUpperCase();
  if (text.includes('REPLACED') || text.includes('REEMPLAZADA')) {
    return false;
  }
  
  // If this was replaced, only extract if the replacement ALSO has fills
  // This prevents double-counting: the replacement might have re-filled the same qty
  if (wasReplaced(operation, replacementMap)) {
    const replacement = replacementMap.get(operation.clOrdId);
    
    // If replacement is also cancelled with fills, those will be extracted separately
    // So skip this one to avoid duplication
    if (replacement && replacement.status === 'CANCELLED' && (replacement.cumQty || 0) > 0) {
      return false;
    }
    
    // If replacement is FILLED, it already represents the execution, skip original
    if (replacement && replacement.status === 'FILLED') {
      return false;
    }
  }
  
  return true;
}

/**
 * Extract filled quantities from cancelled operations
 * @param {Array} operations - Normalized broker operations
 * @returns {Object} Result with processed operations and metadata
 */
export function extractFilledQuantityFromCancelled(operations) {
  const logger = createDevLogger('CancelledFillExtraction');
  
  if (!Array.isArray(operations) || operations.length === 0) {
    return {
      operations: operations || [],
      extracted: 0,
      skipped: 0,
      metadata: []
    };
  }
  
  // Build replacement chain map
  const replacementMap = buildReplacementChains(operations);
  
  const processed = [];
  const extractionMetadata = [];
  let extractedCount = 0;
  let skippedCount = 0;
  
  operations.forEach(op => {
    // Check if we should extract fills from this operation
    if (shouldExtractFills(op, replacementMap)) {
      const cumQty = op.cumQty || 0;
      const avgPx = op.avgPx || op.price || 0;
      
      // Create a new FILLED operation representing the actual fills
      const filledOp = {
        ...op,
        id: generateUUID(),
        operation_id: `${op.operation_id || op.execId || 'EXTRACTED'}_FILLED`,
        status: 'FILLED',
        quantity: cumQty,
        price: avgPx,
        lastQty: cumQty,
        lastPx: avgPx,
        cumQty: cumQty,
        leavesQty: 0,
        text: `Extracted ${cumQty} filled units from cancelled order`,
        extractedFromCancelled: true, // Flag for audit trail
        originalStatus: op.status,
        originalText: op.text
      };
      
      processed.push(filledOp);
      extractedCount++;
      
      const metadata = {
        orderId: op.order_id || op.orderId,
        clOrdId: op.clOrdId,
        symbol: op.symbol,
        side: op.action || op.side,
        extractedQty: cumQty,
        avgPrice: avgPx,
        estimatedValue: (cumQty * avgPx).toFixed(2),
        wasReplaced: wasReplaced(op, replacementMap),
        originalText: op.text
      };
      
      extractionMetadata.push(metadata);
      
      logger.log('Extracted fills from cancelled order', metadata);
      
    } else if (op.status === 'CANCELLED' && (op.cumQty || 0) > 0) {
      // Cancelled with fills but skipped (likely replaced and handled elsewhere)
      skippedCount++;
      logger.log('Skipped cancelled order with fills (replacement chain)', {
        orderId: op.order_id || op.orderId,
        clOrdId: op.clOrdId,
        cumQty: op.cumQty,
        wasReplaced: wasReplaced(op, replacementMap),
        replacementExists: replacementMap.has(op.clOrdId)
      });
      
      // Don't include the original cancelled operation
      // It's been handled through the replacement chain
    } else {
      // Keep all other operations as-is
      processed.push(op);
    }
  });
  
  if (extractedCount > 0) {
    logger.log(`Extraction complete: ${extractedCount} fills extracted, ${skippedCount} skipped (replacements)`);
  }
  
  return {
    operations: processed,
    extracted: extractedCount,
    skipped: skippedCount,
    metadata: extractionMetadata
  };
}

/**
 * Validate extraction results for testing
 * @param {Object} result - Result from extractFilledQuantityFromCancelled
 * @returns {Object} Validation summary
 */
export function validateExtraction(result) {
  const errors = [];
  const warnings = [];
  
  // Check each extracted operation has required fields
  result.metadata.forEach((meta, index) => {
    if (!meta.extractedQty || meta.extractedQty <= 0) {
      errors.push(`Extraction ${index}: Invalid quantity ${meta.extractedQty}`);
    }
    
    if (!meta.avgPrice || meta.avgPrice <= 0) {
      errors.push(`Extraction ${index}: Invalid price ${meta.avgPrice}`);
    }
    
    if (!meta.symbol) {
      warnings.push(`Extraction ${index}: Missing symbol`);
    }
    
    if (!meta.side) {
      warnings.push(`Extraction ${index}: Missing side`);
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    summary: {
      totalExtracted: result.extracted,
      totalSkipped: result.skipped,
      totalValue: result.metadata.reduce((sum, m) => sum + parseFloat(m.estimatedValue), 0).toFixed(2)
    }
  };
}
