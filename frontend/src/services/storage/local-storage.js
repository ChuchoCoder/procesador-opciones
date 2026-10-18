/**
 * Application data storage over the browser's localStorage.
 *
 * This is the single seam to persistence. It replaced a three-module stack
 * (config-service -> local-storage -> storage-adapter) whose middle layer was
 * a Promise-based pass-through: every method was a 3-line try/catch around one
 * localStorage call. That interface existed for the Chrome extension's async
 * storage, which was removed in 38bff03 / fef30f4 — leaving one adapter, i.e.
 * a hypothetical seam rather than a real one.
 *
 * Reads and writes are synchronous. Callers that still `await` these functions
 * keep working, since awaiting a plain value is a no-op.
 */

export const storageKeys = {
  expirations: 'po.expirations',
  activeExpiration: 'po.activeExpiration',
  useAveraging: 'po.useAveraging',
  lastReport: 'po.lastReport.v1',
  brokerApiUrl: 'po.brokerApiUrl',
  brokerAuth: 'po.brokerAuth',
  operations: 'po.operations',
  brokerFees: 'po.brokerFees.v1',
  repoFeeConfig: 'po.repoFeeConfig.v1',
  prefixRules: 'po.prefixRules.v1',
};

/**
 * Resolve the backing store. Read on every call rather than captured once, so
 * tests can substitute `globalThis.localStorage` and so a browser that throws
 * on access (private mode, blocked site data) degrades instead of crashing.
 *
 * @returns {Storage|null}
 */
const getStore = () => {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
      return globalThis.localStorage;
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // Access itself can throw; treat as unavailable.
  }
  return null;
};

/**
 * Read and parse an item.
 * @param {string} key
 * @returns {any|null} Parsed value, or null when absent or unparseable
 */
export const readItem = (key) => {
  const store = getStore();
  if (!store) return null;

  let value;
  try {
    value = store.getItem(key);
  } catch (error) {
    console.warn('PO: Storage read operation failed', { key, error });
    return null;
  }

  if (value === null || value === undefined) return null;

  try {
    return JSON.parse(value);
  } catch (parseError) {
    console.warn('PO: Failed to parse stored value', { key, parseError });
    return null;
  }
};

/**
 * Serialize and write an item.
 * @param {string} key
 * @param {any} value
 * @returns {boolean} Success status
 */
export const writeItem = (key, value) => {
  const store = getStore();
  if (!store) return false;

  try {
    store.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn('PO: Storage write operation failed', { key, error });
    return false;
  }
};

/**
 * Remove an item.
 * @param {string} key
 * @returns {boolean} Success status
 */
export const removeItem = (key) => {
  const store = getStore();
  if (!store) return false;

  try {
    store.removeItem(key);
    return true;
  } catch (error) {
    console.warn('PO: Storage remove operation failed', { key, error });
    return false;
  }
};

/**
 * List keys, optionally restricted to a prefix.
 * @param {string} [prefix]
 * @returns {string[]}
 */
export const getKeys = (prefix = '') => {
  const store = getStore();
  if (!store) return [];

  try {
    const keys = [];
    for (let index = 0; index < store.length; index += 1) {
      const key = store.key(index);
      if (key && (!prefix || key.startsWith(prefix))) {
        keys.push(key);
      }
    }
    return keys;
  } catch (error) {
    console.warn('PO: Storage key enumeration failed', { prefix, error });
    return [];
  }
};

/**
 * Remove every application storage key.
 * @returns {boolean} Success status
 */
export const clearAll = () => {
  const store = getStore();
  if (!store) return false;

  try {
    Object.values(storageKeys).forEach((key) => store.removeItem(key));
    return true;
  } catch (error) {
    console.warn('PO: Storage clearAll operation failed', error);
    return false;
  }
};

/**
 * Whether persistence is usable in this environment.
 * @returns {boolean}
 */
export const storageAvailable = () => {
  const store = getStore();
  if (!store) return false;

  try {
    const probe = '__storage_test__';
    store.setItem(probe, probe);
    store.removeItem(probe);
    return true;
  } catch {
    return false;
  }
};
