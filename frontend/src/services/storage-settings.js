/**
 * localStorage abstraction for settings persistence
 * Namespace: po:settings:<symbol>
 * Per spec: write-on-blur strategy, last-write-wins concurrency
 */

const STORAGE_PREFIX = 'po:settings:';

/**
 * Get all symbol keys from localStorage
 * @returns {string[]} Array of symbol identifiers
 */
export function getAllSymbols() {
  const symbols = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(STORAGE_PREFIX)) {
      symbols.push(key.substring(STORAGE_PREFIX.length));
    }
  }
  return symbols.sort();
}

/**
 * Load a symbol configuration from localStorage
 * @param {string} symbol - Symbol identifier
 * @returns {Object|null} SymbolConfiguration or null if not found
 */
export function loadSymbolConfig(symbol) {
  const key = STORAGE_PREFIX + symbol.toUpperCase();
  try {
    const json = localStorage.getItem(key);
    if (!json) return null;
    return JSON.parse(json);
  } catch (error) {
    console.error(`PO: Failed to load symbol config for ${symbol}:`, error);
    return null;
  }
}

/**
 * Save a symbol configuration to localStorage
 * @param {Object} config - SymbolConfiguration object
 * @returns {boolean} Success status
 */
export function saveSymbolConfig(config) {
  if (!config || !config.symbol) {
    console.error('PO: Cannot save config without symbol identifier');
    return false;
  }

  const key = STORAGE_PREFIX + config.symbol.toUpperCase();
  try {
    // Update timestamp for last-write-wins
    config.updatedAt = Date.now();
    localStorage.setItem(key, JSON.stringify(config));
    return true;
  } catch (error) {
    console.error(`PO: Failed to save symbol config for ${config.symbol}:`, error);
    return false;
  }
}

/**
 * Delete a symbol configuration from localStorage
 * @param {string} symbol - Symbol identifier
 * @returns {boolean} Success status
 */
export function deleteSymbolConfig(symbol) {
  const key = STORAGE_PREFIX + symbol.toUpperCase();
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error(`PO: Failed to delete symbol config for ${symbol}:`, error);
    return false;
  }
}

/**
 * Check if a symbol exists in storage
 * @param {string} symbol - Symbol identifier
 * @returns {boolean}
 */
export function symbolExists(symbol) {
  const key = STORAGE_PREFIX + symbol.toUpperCase();
  return localStorage.getItem(key) !== null;
}
