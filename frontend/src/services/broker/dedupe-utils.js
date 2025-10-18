// Pure dedupe & merge utilities (T008-T010)
// Implements duplicate detection, normalization, and batch merging per data-model.md

// Simple UUID generator (fallback if crypto.randomUUID unavailable)
function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback: simple random UUID v4-like format
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Normalize a raw operation from broker or CSV to internal Operation schema.
 * @param {Object} raw - Raw operation object
 * @param {'broker'|'csv'} source - Source type
 * @returns {Object} Normalized Operation
 */
export function normalizeOperation(raw, source) {
  const now = Date.now();
  
  return {
    id: generateUUID(),
    order_id: raw.order_id || null,
    operation_id: raw.operation_id || null,
    symbol: (raw.symbol || '').toUpperCase().trim(),
    underlying: raw.underlying ? raw.underlying.toUpperCase().trim() : null,
    optionType: raw.optionType || raw.option_type || 'stock',
    action: (raw.action || raw.side || '').toLowerCase(),
    quantity: Number(raw.quantity || raw.last_qty || 0),
    price: Number(raw.price || raw.last_price || 0),
    tradeTimestamp: raw.tradeTimestamp || raw.trade_timestamp || now,
    strike: raw.strike !== undefined && raw.strike !== null ? Number(raw.strike) : null,
    expirationDate: raw.expirationDate || raw.expiration_date || raw.expiration || null,
    source,
    sourceReferenceId: raw.sourceReferenceId || raw.source_reference_id || null,
    importTimestamp: now,
    revisionIndex: raw.revisionIndex !== undefined ? Number(raw.revisionIndex) : null,
    status: raw.status || null,
  };
}

/**
 * Check if two operations are duplicates using primary keys or composite tolerance matching.
 * @param {Object} existing - Existing operation
 * @param {Object} candidate - Candidate operation to check
 * @returns {boolean} True if duplicate
 */
export function isDuplicate(existing, candidate) {
  // Primary key match: order_id + operation_id (both must be present and equal)
  if (existing.order_id && candidate.order_id && existing.operation_id && candidate.operation_id) {
    return existing.order_id === candidate.order_id && existing.operation_id === candidate.operation_id;
  }

  // Composite key with timestamp tolerance (1s bucket)
  const timestampBucketExisting = Math.floor(existing.tradeTimestamp / 1000);
  const timestampBucketCandidate = Math.floor(candidate.tradeTimestamp / 1000);

  return (
    existing.symbol === candidate.symbol &&
    existing.optionType === candidate.optionType &&
    existing.action === candidate.action &&
    existing.strike === candidate.strike &&
    existing.expirationDate === candidate.expirationDate &&
    existing.quantity === candidate.quantity &&
    existing.price === candidate.price &&
    timestampBucketExisting === timestampBucketCandidate
  );
}

/**
 * Deduplicate incoming list against existing list.
 * @param {Array} existingList - Current operations
 * @param {Array} incomingList - New operations to merge
 * @returns {Array} Filtered incoming operations (only unique ones)
 */
export function dedupeOperations(existingList, incomingList) {
  return incomingList.filter((incoming) => {
    return !existingList.some((existing) => isDuplicate(existing, incoming));
  });
}

/**
 * Merge broker batch into existing operations.
 * Returns merged list + metadata about new orders.
 * @param {Array} existingOps - Current operations
 * @param {Array} incomingOps - New normalized operations (already deduped)
 * @returns {{mergedOps: Array, newOrdersCount: number, newOpsCount: number}}
 */
export function mergeBrokerBatch(existingOps, incomingOps) {
  const mergedOps = [...existingOps, ...incomingOps];
  
  // Count distinct new orders (by order_id if present)
  const newOrderIds = new Set(
    incomingOps.filter(op => op.order_id).map(op => op.order_id)
  );

  return {
    mergedOps,
    newOrdersCount: newOrderIds.size,
    newOpsCount: incomingOps.length,
  };
}
