/* Instruments sync storage helper
 * Responsibilities:
 * - Compose/decompose sharded storage for large payloads
 * - Write to chrome.storage.local and a compatibility localStorage copy
 * - Compute versionHash (SHA-1) for canonical JSON
 */

import logger from './logging';

const META_KEY = 'instrumentsWithDetails.meta';
const PART_KEY_PREFIX = 'instrumentsWithDetails.part.';
const DEFAULT_PART_SIZE = 256 * 1024; // 256KB

async function sha1Hex(input) {
  if (typeof crypto !== 'undefined' && crypto.subtle && crypto.subtle.digest) {
    const enc = new TextEncoder();
    const buf = await crypto.subtle.digest('SHA-1', enc.encode(input));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // fallback: simple hash (not secure) — used only when crypto.subtle unavailable
  let h = 0;
  for (let i = 0; i < input.length; i++) h = Math.imul(31, h) + input.charCodeAt(i) | 0;
  return (h >>> 0).toString(16);
}

function splitIntoParts(str, partSize = DEFAULT_PART_SIZE) {
  const parts = [];
  for (let i = 0; i < str.length; i += partSize) parts.push(str.slice(i, i + partSize));
  return parts;
}

async function saveRecord(record) {
  try {
    const canonical = JSON.stringify(record);
    const versionHash = await sha1Hex(canonical);
    const meta = { fetchedAt: record.fetchedAt, source: record.source || 'broker-api', versionHash, parts: 0 };

    // Write to chrome.storage.local as a single object (if possible)
    const parts = splitIntoParts(canonical);
    meta.parts = parts.length;

    const toSet = {};
    toSet[META_KEY] = meta;
    parts.forEach((p, idx) => {
      toSet[`${PART_KEY_PREFIX}${idx}`] = p;
    });

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local && chrome.storage.local.set) {
      chrome.storage.local.set(toSet, () => {
        if (chrome.runtime.lastError) {
          logger.warn('storage', 'saveRecord', 'chrome.storage.local.set failed', chrome.runtime.lastError);
        } else {
          logger.info('storage', 'saveRecord', 'saved to chrome.storage.local', { parts: meta.parts });
        }
      });
    }

    // Also write compatibility copy to localStorage (sharded)
    try {
      localStorage.setItem(META_KEY, JSON.stringify(meta));
      parts.forEach((p, idx) => localStorage.setItem(`${PART_KEY_PREFIX}${idx}`, p));
      logger.info('storage', 'saveRecord', 'saved compatibility localStorage', { parts: meta.parts });
    } catch (e) {
      logger.warn('storage', 'saveRecord', 'localStorage write failed', { error: e && e.message });
    }

    return meta;
  } catch (e) {
    logger.error('storage', 'saveRecord', 'failed to save record', { error: e && e.message });
    throw e;
  }
}

async function readRecord() {
  // Read meta then recompose
  try {
    let metaRaw = null;
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local && chrome.storage.local.get) {
      // synchronous wrapper via promise
      metaRaw = await new Promise((res) => chrome.storage.local.get([META_KEY], (items) => res(items[META_KEY] || null)));
    } else if (typeof localStorage !== 'undefined') {
      const v = localStorage.getItem(META_KEY);
      if (v) metaRaw = JSON.parse(v);
    }

    if (!metaRaw) return null;
    const parts = [];
    for (let i = 0; i < (metaRaw.parts || 0); i++) {
      let part = null;
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local && chrome.storage.local.get) {
        // fetch synchronously via promise helper
        // Note: chrome.storage.local.get accepts array; fetch single key
        // Using await inside loop is acceptable due to small number of parts
        // but be mindful of performance when many parts exist.
        // Implement a small helper instead of repeated API calls in production.
        // For now, try localStorage first for speed.
        part = localStorage.getItem(`${PART_KEY_PREFIX}${i}`);
      } else if (typeof localStorage !== 'undefined') {
        part = localStorage.getItem(`${PART_KEY_PREFIX}${i}`);
      }
      if (part == null) {
        logger.warn('storage', 'readRecord', 'missing part', { idx: i });
        return null;
      }
      parts.push(part);
    }
    const combined = parts.join('');
    const parsed = JSON.parse(combined);
    return { meta: metaRaw, record: parsed };
  } catch (e) {
    logger.error('storage', 'readRecord', 'failed to read record', { error: e && e.message });
    return null;
  }
}

export default {
  saveRecord,
  readRecord,
};
