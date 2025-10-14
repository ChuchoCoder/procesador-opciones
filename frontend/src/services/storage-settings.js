/**
 * Storage abstraction for settings persistence
 * Works with both localStorage (web) and chrome.storage.local (extension)
 * Namespace: po:settings:<symbol>
 * Per spec: write-on-blur strategy, last-write-wins concurrency
 */

import { storageAdapter } from './storage/storage-adapter.js';

const STORAGE_PREFIX = 'po:settings:';

/**
 * Get all symbol keys from storage
 * @returns {Promise<string[]>} Array of symbol identifiers
 */
export async function getAllSymbols() {
  try {
    const keys = await storageAdapter.getAllKeys(STORAGE_PREFIX);
    const symbols = keys.map(key => key.substring(STORAGE_PREFIX.length));
    return symbols.sort();
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
  const key = STORAGE_PREFIX + symbol.toUpperCase();
  try {
    const json = await storageAdapter.getItem(key);
    if (!json) return null;
    return JSON.parse(json);
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

  const key = STORAGE_PREFIX + config.symbol.toUpperCase();
  try {
    // Update timestamp for last-write-wins
    config.updatedAt = Date.now();
    const success = await storageAdapter.setItem(key, JSON.stringify(config));
    return success;
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
  const key = STORAGE_PREFIX + symbol.toUpperCase();
  try {
    const success = await storageAdapter.removeItem(key);
    return success;
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
  const key = STORAGE_PREFIX + symbol.toUpperCase();
  const value = await storageAdapter.getItem(key);
  return value !== null;
}
