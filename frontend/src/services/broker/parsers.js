/**
 * Parsers and validators for Market Data messages.
 * Pure functions suitable for unit tests.
 */

const SUPPORTED_ENTRIES = ['OF', 'BI', 'LA', 'TP', 'FT'];

/**
 * Parse a subscription request from a raw object.
 * @param {object} raw
 * @returns {{type:string, products:array, entries:array, depth:number}}
 */
export function parseSubscriptionMessage(raw) {
  if (!raw || typeof raw !== 'object') throw new TypeError('raw must be an object');
  return {
    type: raw.type || 'smd',
    products: Array.isArray(raw.products) ? raw.products : [],
    entries: Array.isArray(raw.entries) ? validateEntries(raw.entries) : [],
    depth: Number.isInteger(raw.depth) && raw.depth >= 1 ? raw.depth : 1,
  };
}

/**
 * Parse an incoming Market Data (Md) raw message and normalize shape.
 * This is intentionally lightweight; deeper validation happens in callers.
 * @param {object} raw
 * @returns {object} normalized MarketDataMessage
 */
export function parseMarketDataMessage(raw) {
  if (!raw || raw.type !== 'Md') return null;
  const instrumentId = raw.instrumentId || null;
  const marketData = raw.marketData || {};

  // Normalize marketData: ensure entries map to arrays of levels with numeric price/size
  const normalized = {};
  for (const [entry, levels] of Object.entries(marketData)) {
    if (!Array.isArray(levels)) continue;
    normalized[entry] = levels.map(l => ({
      price: typeof l.price === 'string' || typeof l.price === 'number' ? Number(l.price) : NaN,
      size: typeof l.size === 'string' || typeof l.size === 'number' ? Number(l.size) : NaN,
      sequenceId: l.sequenceId || null,
      timestamp: l.timestamp || null,
    }));
  }

  return {
    type: 'Md',
    instrumentId,
    marketData: normalized,
    raw,
  };
}

/**
 * Compute a simple snapshot hash for marketData for deduplication.
 * It serializes the requested entries trimmed to depth. This is intentionally
 * simple and deterministic for client-side dedupe.
 * @param {object} marketData
 * @param {string[]} entries
 * @param {number} depth
 * @returns {string}
 */
export function computeSnapshotHash(marketData = {}, entries = [], depth = Infinity) {
  const pick = {};
  const useEntries = Array.isArray(entries) && entries.length ? entries : Object.keys(marketData);
  for (const e of useEntries) {
    const arr = Array.isArray(marketData[e]) ? marketData[e].slice(0, depth) : [];
    pick[e] = arr.map(l => ({ price: l.price, size: l.size, sequenceId: l.sequenceId || null }));
  }
  // deterministic stringify
  return JSON.stringify(pick);
}

/**
 * Validate and canonicalize entries list returning only supported entries.
 * @param {array} entries
 * @returns {array}
 */
export function validateEntries(entries) {
  if (!Array.isArray(entries)) return [];
  const result = [];
  for (const e of entries) {
    if (typeof e !== 'string') continue;
    const up = e.trim().toUpperCase();
    if (SUPPORTED_ENTRIES.includes(up) && !result.includes(up)) result.push(up);
  }
  return result;
}

/**
 * Trim and filter a marketData object to only include requested entries and depth.
 * Returns an object with `marketData` trimmed and `unsupported` array for entries
 * that were requested but not present or unsupported.
 * @param {object} marketData
 * @param {array} entries - requested entries (strings)
 * @param {number} depth - max depth per entry
 * @returns {{marketData: object, unsupported: array}}
 */
export function trimMarketData(marketData = {}, entries = [], depth = Infinity) {
  const result = {};
  const unsupported = [];

  const canonical = Array.isArray(entries) && entries.length ? validateEntries(entries) : Object.keys(marketData || {});

  for (const entry of canonical) {
    if (!SUPPORTED_ENTRIES.includes(entry)) {
      // requested but not supported
      unsupported.push(entry);
      continue;
    }
    const levels = Array.isArray(marketData[entry]) ? marketData[entry].slice(0, depth) : [];
    result[entry] = levels.map(l => ({ price: l.price, size: l.size, sequenceId: l.sequenceId || null, timestamp: l.timestamp || null }));
  }

  return { marketData: result, unsupported };
}

export const __TESTS__ = {
  SUPPORTED_ENTRIES,
};
