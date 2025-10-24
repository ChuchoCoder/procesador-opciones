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
  
  // Extract symbol from nested instrumentId structure for broker data
  const symbolValue = raw.symbol || raw.instrumentId?.symbol || '';
  
  // For broker operations, preserve the raw object so JsonDataSource can process it
  if (source === 'broker') {
    return {
      ...raw, // Preserve all raw fields
      id: generateUUID(),
      source,
      importTimestamp: now,
    };
  }
  
  // For CSV operations, perform full normalization
  return {
    id: generateUUID(),
    order_id: raw.order_id || raw.clOrdId || null,
    operation_id: raw.operation_id || raw.execId || raw.execID || raw.transactTime || null,
    symbol: symbolValue.toUpperCase().trim(),
    underlying: raw.underlying ? raw.underlying.toUpperCase().trim() : null,
    optionType: raw.optionType || raw.option_type || 'stock',
    action: (raw.action || raw.side || '').toLowerCase(),
    quantity: Number(raw.quantity || raw.last_qty || raw.lastQty || 0),
    price: Number(raw.price || raw.last_price || raw.lastPx || 0),
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
  // Extract clOrdId and execId for broker operations (raw format)
  const existingOrderId = existing.order_id || existing.clOrdId || null;
  const existingExecId = existing.operation_id || existing.execId || null;
  const candidateOrderId = candidate.order_id || candidate.clOrdId || null;
  const candidateExecId = candidate.operation_id || candidate.execId || null;
  
  // Primary key match: clOrdId + execId (both must be present and equal)
  if (existingOrderId && candidateOrderId && existingExecId && candidateExecId) {
    return existingOrderId === candidateOrderId && existingExecId === candidateExecId;
  }

  // Composite key with timestamp tolerance (1s bucket)
  const existingTimestamp = existing.tradeTimestamp || existing.importTimestamp || 0;
  const candidateTimestamp = candidate.tradeTimestamp || candidate.importTimestamp || 0;
  const timestampBucketExisting = Math.floor(existingTimestamp / 1000);
  const timestampBucketCandidate = Math.floor(candidateTimestamp / 1000);

  // Extract symbols (handle broker nested format)
  const existingSymbol = existing.symbol || existing.instrumentId?.symbol || '';
  const candidateSymbol = candidate.symbol || candidate.instrumentId?.symbol || '';
  
  // Extract sides (handle broker format)
  const existingAction = (existing.action || existing.side || '').toLowerCase();
  const candidateAction = (candidate.action || candidate.side || '').toLowerCase();
  
  // Extract quantities (handle broker format)
  const existingQty = existing.quantity || existing.lastQty || 0;
  const candidateQty = candidate.quantity || candidate.lastQty || 0;
  
  // Extract prices (handle broker format)
  const existingPrice = existing.price || existing.lastPx || 0;
  const candidatePrice = candidate.price || candidate.lastPx || 0;

  return (
    existingSymbol === candidateSymbol &&
    existing.optionType === candidate.optionType &&
    existingAction === candidateAction &&
    existing.strike === candidate.strike &&
    existing.expirationDate === candidate.expirationDate &&
    existingQty === candidateQty &&
    existingPrice === candidatePrice &&
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
