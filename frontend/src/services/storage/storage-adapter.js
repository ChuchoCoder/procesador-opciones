/**
 * Universal storage adapter that works with both localStorage (web) and chrome.storage.local (extension)
 * Provides a consistent async API for both storage backends
 */

/**
 * Detect if running as Chrome Extension
 * @returns {boolean}
 */
function isChromeExtension() {
  return typeof chrome !== 'undefined' && 
         chrome.storage && 
         chrome.storage.local;
}

/**
 * Storage adapter class
 */
class StorageAdapter {
  constructor() {
    this.isExtension = isChromeExtension();
    this.storageType = this.isExtension ? 'chrome.storage' : 'localStorage';
    console.log(`[StorageAdapter] Using ${this.storageType}`);
  }

  /**
   * Get item from storage
   * @param {string} key - Storage key
   * @returns {Promise<any>} Stored value or null
   */
  async getItem(key) {
    if (this.isExtension) {
      return new Promise((resolve) => {
        chrome.storage.local.get([key], (result) => {
          resolve(result[key] ?? null);
        });
      });
    } else {
      // localStorage - synchronous, wrap in Promise for consistent API
      try {
        const value = window.localStorage.getItem(key);
        return Promise.resolve(value);
      } catch (error) {
        console.error('[StorageAdapter] localStorage.getItem failed:', error);
        return Promise.resolve(null);
      }
    }
  }

  /**
   * Set item in storage
   * @param {string} key - Storage key
   * @param {any} value - Value to store (will be stringified for localStorage)
   * @returns {Promise<boolean>} Success status
   */
  async setItem(key, value) {
    if (this.isExtension) {
      return new Promise((resolve) => {
        chrome.storage.local.set({ [key]: value }, () => {
          if (chrome.runtime.lastError) {
            console.error('[StorageAdapter] chrome.storage.set failed:', chrome.runtime.lastError);
            resolve(false);
          } else {
            resolve(true);
          }
        });
      });
    } else {
      // localStorage
      try {
        window.localStorage.setItem(key, value);
        return Promise.resolve(true);
      } catch (error) {
        console.error('[StorageAdapter] localStorage.setItem failed:', error);
        return Promise.resolve(false);
      }
    }
  }

  /**
   * Remove item from storage
   * @param {string} key - Storage key
   * @returns {Promise<boolean>} Success status
   */
  async removeItem(key) {
    if (this.isExtension) {
      return new Promise((resolve) => {
        chrome.storage.local.remove([key], () => {
          if (chrome.runtime.lastError) {
            console.error('[StorageAdapter] chrome.storage.remove failed:', chrome.runtime.lastError);
            resolve(false);
          } else {
            resolve(true);
          }
        });
      });
    } else {
      // localStorage
      try {
        window.localStorage.removeItem(key);
        return Promise.resolve(true);
      } catch (error) {
        console.error('[StorageAdapter] localStorage.removeItem failed:', error);
        return Promise.resolve(false);
      }
    }
  }

  /**
   * Get all keys from storage (filtered by prefix if provided)
   * @param {string} [prefix] - Optional prefix to filter keys
   * @returns {Promise<string[]>} Array of keys
   */
  async getAllKeys(prefix = '') {
    if (this.isExtension) {
      return new Promise((resolve) => {
        chrome.storage.local.get(null, (items) => {
          const keys = Object.keys(items);
          resolve(prefix ? keys.filter(k => k.startsWith(prefix)) : keys);
        });
      });
    } else {
      // localStorage
      try {
        const keys = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key && (!prefix || key.startsWith(prefix))) {
            keys.push(key);
          }
        }
        return Promise.resolve(keys);
      } catch (error) {
        console.error('[StorageAdapter] localStorage.getAllKeys failed:', error);
        return Promise.resolve([]);
      }
    }
  }

  /**
   * Clear all items with given prefix
   * @param {string} [prefix] - Optional prefix to filter keys to clear
   * @returns {Promise<boolean>} Success status
   */
  async clear(prefix = '') {
    if (this.isExtension) {
      const keys = await this.getAllKeys(prefix);
      if (keys.length === 0) return Promise.resolve(true);
      
      return new Promise((resolve) => {
        chrome.storage.local.remove(keys, () => {
          if (chrome.runtime.lastError) {
            console.error('[StorageAdapter] chrome.storage.clear failed:', chrome.runtime.lastError);
            resolve(false);
          } else {
            resolve(true);
          }
        });
      });
    } else {
      // localStorage
      try {
        if (prefix) {
          const keys = await this.getAllKeys(prefix);
          keys.forEach(key => window.localStorage.removeItem(key));
        } else {
          window.localStorage.clear();
        }
        return Promise.resolve(true);
      } catch (error) {
        console.error('[StorageAdapter] localStorage.clear failed:', error);
        return Promise.resolve(false);
      }
    }
  }

  /**
   * Check if storage is available
   * @returns {boolean}
   */
  isAvailable() {
    if (this.isExtension) {
      return true; // If chrome.storage exists, it should work
    } else {
      try {
        const testKey = '__storage_test__';
        window.localStorage.setItem(testKey, testKey);
        window.localStorage.removeItem(testKey);
        return true;
      } catch {
        return false;
      }
    }
  }

  /**
   * Get the current storage backend type
   * @returns {string} 'chrome.storage' or 'localStorage'
   */
  getStorageType() {
    return this.storageType;
  }
}

// Export singleton instance
export const storageAdapter = new StorageAdapter();

// Export for testing/advanced use
export { StorageAdapter };
