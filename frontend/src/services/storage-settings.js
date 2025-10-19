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

const createEmptyRepoFeeConfig = () => ({
  arancelCaucionColocadora: { ARS: 0, USD: 0 },
  arancelCaucionTomadora: { ARS: 0, USD: 0 },
  derechosDeMercadoDailyRate: { ARS: 0, USD: 0 },
  gastosGarantiaDailyRate: { ARS: 0, USD: 0 },
  ivaRepoRate: 0,
  overridesMetadata: [],
});

const ensureNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const normalizeCurrencyMap = (candidate = {}, fallback = { ARS: 0, USD: 0 }) => ({
  ARS: ensureNumber(candidate.ARS, fallback.ARS ?? 0),
  USD: ensureNumber(candidate.USD, fallback.USD ?? 0),
});

const sanitizeRepoFeeConfig = (candidate = {}, fallbackConfig = createEmptyRepoFeeConfig()) => ({
  arancelCaucionColocadora: normalizeCurrencyMap(
    candidate.arancelCaucionColocadora,
    fallbackConfig.arancelCaucionColocadora,
  ),
  arancelCaucionTomadora: normalizeCurrencyMap(
    candidate.arancelCaucionTomadora,
    fallbackConfig.arancelCaucionTomadora,
  ),
  derechosDeMercadoDailyRate: normalizeCurrencyMap(
    candidate.derechosDeMercadoDailyRate,
    fallbackConfig.derechosDeMercadoDailyRate,
  ),
  gastosGarantiaDailyRate: normalizeCurrencyMap(
    candidate.gastosGarantiaDailyRate,
    fallbackConfig.gastosGarantiaDailyRate,
  ),
  ivaRepoRate: ensureNumber(candidate.ivaRepoRate, fallbackConfig.ivaRepoRate ?? 0),
  overridesMetadata: Array.isArray(candidate.overridesMetadata)
    ? [...candidate.overridesMetadata]
    : Array.isArray(fallbackConfig.overridesMetadata)
      ? [...fallbackConfig.overridesMetadata]
      : [],
});

let repoFeeDefaultsCache = null;
let repoFeeDefaultsPromise = null;
let repoFeeConfigCache = null;

const buildPublicAssetUrl = (assetName) => {
  if (typeof assetName !== 'string' || assetName.length === 0) {
    return '/';
  }

  const baseUrl = (typeof import.meta !== 'undefined' && import.meta.env && typeof import.meta.env.BASE_URL === 'string')
    ? import.meta.env.BASE_URL
    : '/';

  if (baseUrl.endsWith('/')) {
    return `${baseUrl}${assetName.replace(/^\//, '')}`;
  }
  return `${baseUrl}/${assetName.replace(/^\//, '')}`;
};

const fetchRepoFeeDefaults = async () => {
  if (typeof fetch !== 'function') {
    console.warn('PO: Repo fee defaults cannot be loaded - fetch unavailable.');
    return createEmptyRepoFeeConfig();
  }

  const url = buildPublicAssetUrl('byma-defaults.json');

  try {
    const response = await fetch(url, { cache: 'no-cache' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const json = await response.json();
    return sanitizeRepoFeeConfig(json, createEmptyRepoFeeConfig());
  } catch (error) {
    console.warn('PO: Failed to load repo fee defaults. Falling back to zeros.', { error, url });
    return createEmptyRepoFeeConfig();
  }
};

const readRepoFeeConfigFromStorage = async () => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem(REPO_FEE_CONFIG_STORAGE_KEY);
      if (!stored) return null;
      return JSON.parse(stored);
    }

    const value = await storageAdapter.getItem(REPO_FEE_CONFIG_STORAGE_KEY);
    if (!value) return null;
    return JSON.parse(value);
  } catch (error) {
    console.warn('PO: Failed to read repo fee config from storage.', error);
    return null;
  }
};

const persistRepoFeeConfig = async (config) => {
  try {
    const payload = JSON.stringify(config);
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(REPO_FEE_CONFIG_STORAGE_KEY, payload);
      return true;
    }

    const success = await storageAdapter.setItem(REPO_FEE_CONFIG_STORAGE_KEY, payload);
    return success !== false;
  } catch (error) {
    console.warn('PO: Failed to persist repo fee config.', error);
    return false;
  }
};

const mergeRepoFeeOverrides = (baseConfig, override = {}) => ({
  arancelCaucionColocadora: {
    ...baseConfig.arancelCaucionColocadora,
    ...(override.arancelCaucionColocadora || {}),
  },
  arancelCaucionTomadora: {
    ...baseConfig.arancelCaucionTomadora,
    ...(override.arancelCaucionTomadora || {}),
  },
  derechosDeMercadoDailyRate: {
    ...baseConfig.derechosDeMercadoDailyRate,
    ...(override.derechosDeMercadoDailyRate || {}),
  },
  gastosGarantiaDailyRate: {
    ...baseConfig.gastosGarantiaDailyRate,
    ...(override.gastosGarantiaDailyRate || {}),
  },
  ivaRepoRate: override.ivaRepoRate ?? baseConfig.ivaRepoRate,
  overridesMetadata: Array.isArray(override.overridesMetadata)
    ? [...override.overridesMetadata]
    : baseConfig.overridesMetadata,
});

const resolveDefaults = async (forceReload = false) => {
  if (forceReload) {
    repoFeeDefaultsCache = null;
  }

  if (repoFeeDefaultsCache) {
    return repoFeeDefaultsCache;
  }

  if (!repoFeeDefaultsPromise) {
    repoFeeDefaultsPromise = fetchRepoFeeDefaults().then((defaults) => {
      repoFeeDefaultsCache = defaults;
      repoFeeDefaultsPromise = null;
      return defaults;
    }).catch((error) => {
      console.warn('PO: Repo fee defaults load promise failed.', error);
      repoFeeDefaultsCache = createEmptyRepoFeeConfig();
      repoFeeDefaultsPromise = null;
      return repoFeeDefaultsCache;
    });
  }

  return repoFeeDefaultsPromise;
};

export const loadRepoFeeDefaults = async (options = {}) => {
  const { forceReload = false } = options ?? {};
  return resolveDefaults(forceReload);
};

const resolveStoredRepoConfig = async (forceReload = false) => {
  if (forceReload) {
    repoFeeConfigCache = null;
  }

  if (repoFeeConfigCache) {
    return repoFeeConfigCache;
  }

  const defaults = await resolveDefaults(false);
  const stored = await readRepoFeeConfigFromStorage();
  const sanitized = stored ? sanitizeRepoFeeConfig(stored, defaults) : defaults;
  repoFeeConfigCache = sanitized;
  return sanitized;
};

export const getRepoFeeConfig = async (options = {}) => {
  const { forceReload = false } = options ?? {};
  return resolveStoredRepoConfig(forceReload);
};

export const setRepoFeeConfig = async (candidate = {}, options = {}) => {
  const { metadata } = options ?? {};
  const defaults = await resolveDefaults(false);
  const base = await resolveStoredRepoConfig(false);

  const merged = mergeRepoFeeOverrides(base || defaults, candidate);
  if (metadata && Array.isArray(metadata.overridesMetadata)) {
    merged.overridesMetadata = [...metadata.overridesMetadata];
  }

  const sanitized = sanitizeRepoFeeConfig(merged, defaults);
  sanitized.updatedAt = Date.now();

  const persisted = await persistRepoFeeConfig(sanitized);
  if (persisted) {
    repoFeeConfigCache = sanitized;
  }

  return sanitized;
};

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
