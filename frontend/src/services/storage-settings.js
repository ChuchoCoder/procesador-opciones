/**
 * Storage for per-symbol settings persistence.
 * Namespace: po:settings:<symbol>
 * Per spec: write-on-blur strategy, last-write-wins concurrency
 *
 * Goes through the same seam as application config (`storage/local-storage.js`)
 * instead of reaching for localStorage on its own. The functions keep returning
 * Promises so existing `await` call sites are unaffected, but the work underneath
 * is synchronous.
 */

import { getKeys, readItem, removeItem, writeItem } from './storage/local-storage.js';

const STORAGE_PREFIX = 'po:settings:';

// NOTE: Repo fee config helpers were moved to
// `frontend/src/services/fees/broker-fees-storage.js` to consolidate all broker
// and repo fee configuration and persistence in the `fees/` module. Keeping a
// single source of truth avoids duplication and potential drift. If you need
// to access repo fee config, import from 'services/fees/broker-fees-storage.js'.

const keyFor = (symbol) => STORAGE_PREFIX + String(symbol).toUpperCase();

/**
 * Get all symbol keys from storage
 * @returns {Promise<string[]>} Array of symbol identifiers
 */
export async function getAllSymbols() {
  try {
    return getKeys(STORAGE_PREFIX)
      .map((key) => key.substring(STORAGE_PREFIX.length))
      .sort();
  } catch (error) {
    console.error('PO: Failed to get all symbols:', error);
    return [];
  }
}

/**
 * Load a symbol configuration from storage
 * @param {string} symbol - Symbol identifier
 * @returns {Promise<Object|null>} SymbolConfiguration or null if not found
 */
export async function loadSymbolConfig(symbol) {
  try {
    return readItem(keyFor(symbol));
  } catch (error) {
    console.error(`PO: Failed to load symbol config for ${symbol}:`, error);
    return null;
  }
}

/**
 * Save a symbol configuration to storage
 * @param {Object} config - SymbolConfiguration object
 * @returns {Promise<boolean>} Success status
 */
export async function saveSymbolConfig(config) {
  if (!config || !config.symbol) {
    console.error('PO: Cannot save config without symbol identifier');
    return false;
  }

  try {
    // Update timestamp for last-write-wins
    config.updatedAt = Date.now();
    return writeItem(keyFor(config.symbol), config);
  } catch (error) {
    console.error(`PO: Failed to save symbol config for ${config.symbol}:`, error);
    return false;
  }
}

/**
 * Delete a symbol configuration from storage
 * @param {string} symbol - Symbol identifier
 * @returns {Promise<boolean>} Success status
 */
export async function deleteSymbolConfig(symbol) {
  try {
    return removeItem(keyFor(symbol));
  } catch (error) {
    console.error(`PO: Failed to delete symbol config for ${symbol}:`, error);
    return false;
  }
}

/**
 * Check if a symbol exists in storage
 * @param {string} symbol - Symbol identifier
 * @returns {Promise<boolean>}
 */
export async function symbolExists(symbol) {
  try {
    return readItem(keyFor(symbol)) !== null;
  } catch (error) {
    console.error(`PO: Failed to check symbol existence for ${symbol}:`, error);
    return false;
  }
}

/**
 * Clear all symbol configurations from storage
 * @returns {Promise<boolean>} Success status
 */
export async function clearAllSymbols() {
  try {
    getKeys(STORAGE_PREFIX).forEach((key) => removeItem(key));
    return true;
  } catch (error) {
    console.error('PO: Failed to clear all symbols:', error);
    return false;
  }
}
