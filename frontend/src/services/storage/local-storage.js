/**
 * Application data storage using the storage adapter
 * Works with both localStorage (web) and chrome.storage.local (extension)
 */

import { storageAdapter } from './storage-adapter.js';

export const storageKeys = {
  expirations: 'po.expirations',
  activeExpiration: 'po.activeExpiration',
  useAveraging: 'po.useAveraging',
  lastReport: 'po.lastReport.v1',
  brokerApiUrl: 'po.brokerApiUrl',
  brokerAuth: 'po.brokerAuth',
  operations: 'po.operations',
  brokerOperations: 'po.brokerOperations',
  brokerFees: 'po.brokerFees.v1',
  repoFeeConfig: 'po.repoFeeConfig.v1',
};

/**
 * Read an item from storage
 * @param {string} key - Storage key
 * @returns {Promise<any|null>} Parsed value or null
 */
export const readItem = async (key) => {
  try {
    const value = await storageAdapter.getItem(key);

    if (value === null || value === undefined) {
      return null;
    }

    try {
      return JSON.parse(value);
    } catch (parseError) {
      console.warn('PO: Failed to parse stored value', { key, parseError });
      return null;
    }
  } catch (error) {
    console.warn('PO: Storage read operation failed', { key, error });
    return null;
  }
};

/**
 * Write an item to storage
 * @param {string} key - Storage key
 * @param {any} value - Value to store
 * @returns {Promise<boolean>} Success status
 */
export const writeItem = async (key, value) => {
  try {
    const success = await storageAdapter.setItem(key, JSON.stringify(value));
    return success;
  } catch (error) {
    console.warn('PO: Storage write operation failed', { key, error });
    return false;
  }
};

/**
 * Remove an item from storage
 * @param {string} key - Storage key
 * @returns {Promise<boolean>} Success status
 */
export const removeItem = async (key) => {
  try {
    const success = await storageAdapter.removeItem(key);
    return success;
  } catch (error) {
    console.warn('PO: Storage remove operation failed', { key, error });
    return false;
  }
};

/**
 * Clear all application storage keys
 * @returns {Promise<boolean>} Success status
 */
export const clearAll = async () => {
  try {
    const promises = Object.values(storageKeys).map((key) => storageAdapter.removeItem(key));
    await Promise.all(promises);
    return true;
  } catch (error) {
    console.warn('PO: Storage clearAll operation failed', error);
    return false;
  }
};

/**
 * Check if storage is available
 * @returns {boolean}
 */
export const storageAvailable = () => storageAdapter.isAvailable();

