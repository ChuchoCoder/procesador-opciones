/**
 * Storage abstraction for settings persistence (localStorage)
 * Namespace: po:settings:<symbol>
 * Per spec: write-on-blur strategy, last-write-wins concurrency
 */

import { storageAdapter } from './storage/storage-adapter.js';
import { storageKeys } from './storage/local-storage.js';

const STORAGE_PREFIX = 'po:settings:';
const REPO_FEE_CONFIG_STORAGE_KEY = storageKeys.repoFeeConfig;

// NOTE: Repo fee config helpers were moved to
// `frontend/src/services/fees/broker-fees-storage.js` to consolidate all broker
// and repo fee configuration and persistence in the `fees/` module. Keeping a
// single source of truth avoids duplication and potential drift. If you need
// to access repo fee config, import from 'services/fees/broker-fees-storage.js'.

/**
 * Get all symbol keys from storage
 * @returns {Promise<string[]>} Array of symbol identifiers
 */
export function getAllSymbols() {
  return storageAdapter
    .getAllKeys(STORAGE_PREFIX)
    .then((keys) => keys.map((k) => k.substring(STORAGE_PREFIX.length)).sort())
    .catch((error) => {
      console.error('PO: Failed to get all symbols:', error);
      return [];
    });
}

/**
 * Load a symbol configuration from storage
 * @param {string} symbol - Symbol identifier
 * @returns {Promise<Object|null>} SymbolConfiguration or null if not found
 */
export function loadSymbolConfig(symbol) {
  const key = STORAGE_PREFIX + symbol.toUpperCase();
  return storageAdapter
    .getItem(key)
    .then((json) => {
      if (!json) return null;
      try {
        return JSON.parse(json);
      } catch (e) {
        console.error(`PO: Failed to parse config for ${symbol}:`, e);
        return null;
      }
    })
    .catch((error) => {
      console.error(`PO: Failed to load symbol config for ${symbol}:`, error);
      return null;
    });
}

/**
 * Save a symbol configuration to storage
 * @param {Object} config - SymbolConfiguration object
 * @returns {Promise<boolean>} Success status
 */
export function saveSymbolConfig(config) {
  if (!config || !config.symbol) {
    console.error('PO: Cannot save config without symbol identifier');
    return Promise.resolve(false);
  }

  const key = STORAGE_PREFIX + config.symbol.toUpperCase();
  try {
    // Update timestamp for last-write-wins
    config.updatedAt = Date.now();

    return storageAdapter.setItem(key, JSON.stringify(config)).catch((error) => {
      console.error(`PO: Failed to save symbol config for ${config.symbol}:`, error);
      return false;
    });
  } catch (error) {
    console.error(`PO: Failed to save symbol config for ${config.symbol}:`, error);
    return Promise.resolve(false);
  }
}

/**
 * Delete a symbol configuration from storage
 * @param {string} symbol - Symbol identifier
 * @returns {Promise<boolean>} Success status
 */
export function deleteSymbolConfig(symbol) {
  const key = STORAGE_PREFIX + symbol.toUpperCase();
  return storageAdapter.removeItem(key).catch((error) => {
    console.error(`PO: Failed to delete symbol config for ${symbol}:`, error);
    return false;
  });
}

/**
 * Check if a symbol exists in storage
 * @param {string} symbol - Symbol identifier
 * @returns {Promise<boolean>}
 */
export function symbolExists(symbol) {
  const key = STORAGE_PREFIX + symbol.toUpperCase();
  return storageAdapter
    .getItem(key)
    .then((value) => value !== null)
    .catch((error) => {
      console.error(`PO: Failed to check symbol existence for ${symbol}:`, error);
      return false;
    });
}

/**
 * Clear all symbol configurations from storage
 * @returns {Promise<boolean>} Success status
 */
export async function clearAllSymbols() {
  try {
    const symbols = await getAllSymbols();

    await Promise.all(
      symbols.map((symbol) => storageAdapter.removeItem(STORAGE_PREFIX + symbol.toUpperCase()))
    );
    return true;
  } catch (error) {
    console.error('PO: Failed to clear all symbols:', error);
    return false;
  }
}
