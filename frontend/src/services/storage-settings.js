/**
 * Storage abstraction for settings persistence
 * Works with both localStorage (web) and chrome.storage.local (extension)
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
  try {
    // Prefer synchronous localStorage when available (tests mock localStorage)
    if (typeof window !== 'undefined' && window.localStorage) {
      const symbols = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith(STORAGE_PREFIX)) {
          symbols.push(key.substring(STORAGE_PREFIX.length));
        }
      }
      return Promise.resolve(symbols.sort());
    }

    // Fallback to adapter (async) - return a Promise in that case
    return storageAdapter.getAllKeys(STORAGE_PREFIX).then((keys) => keys.map(k => k.substring(STORAGE_PREFIX.length)).sort());
  } catch (error) {
    console.error('PO: Failed to get all symbols:', error);
    return Promise.resolve([]);
  }
}

/**
 * Load a symbol configuration from storage
 * @param {string} symbol - Symbol identifier
 * @returns {Promise<Object|null>} SymbolConfiguration or null if not found
 */
export function loadSymbolConfig(symbol) {
  const key = STORAGE_PREFIX + symbol.toUpperCase();
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const json = window.localStorage.getItem(key);
      if (!json) return Promise.resolve(null);
      return Promise.resolve(JSON.parse(json));
    }

    // Fallback to adapter (async)
    return storageAdapter.getItem(key).then((json) => {
      if (!json) return null;
      try {
        return JSON.parse(json);
      } catch (e) {
        console.error(`PO: Failed to parse config for ${symbol}:`, e);
        return null;
      }
    }).catch((error) => {
      console.error(`PO: Failed to load symbol config for ${symbol}:`, error);
      return null;
    });
  } catch (error) {
    console.error(`PO: Failed to load symbol config for ${symbol}:`, error);
    return Promise.resolve(null);
  }
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

    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, JSON.stringify(config));
      return Promise.resolve(true);
    }

    // Fallback to adapter (async) - return a Promise
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
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
      return Promise.resolve(true);
    }

    return storageAdapter.removeItem(key).catch((error) => {
      console.error(`PO: Failed to delete symbol config for ${symbol}:`, error);
      return false;
    });
  } catch (error) {
    console.error(`PO: Failed to delete symbol config for ${symbol}:`, error);
    return Promise.resolve(false);
  }
}

/**
 * Check if a symbol exists in storage
 * @param {string} symbol - Symbol identifier
 * @returns {Promise<boolean>}
 */
export function symbolExists(symbol) {
  const key = STORAGE_PREFIX + symbol.toUpperCase();
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return Promise.resolve(window.localStorage.getItem(key) !== null);
    }

    return storageAdapter.getItem(key).then((value) => value !== null);
  } catch (error) {
    console.error(`PO: Failed to check symbol existence for ${symbol}:`, error);
    return Promise.resolve(false);
  }
}

/**
 * Clear all symbol configurations from storage
 * @returns {Promise<boolean>} Success status
 */
export async function clearAllSymbols() {
  try {
    const symbols = await getAllSymbols();
    
    if (typeof window !== 'undefined' && window.localStorage) {
      // Clear all po:settings:* keys from localStorage
      for (const symbol of symbols) {
        const key = STORAGE_PREFIX + symbol.toUpperCase();
        window.localStorage.removeItem(key);
      }
      return true;
    }

    // Fallback to adapter (async)
    const promises = symbols.map(symbol => {
      const key = STORAGE_PREFIX + symbol.toUpperCase();
      return storageAdapter.removeItem(key);
    });
    await Promise.all(promises);
    return true;
  } catch (error) {
    console.error('PO: Failed to clear all symbols:', error);
    return false;
  }
}
