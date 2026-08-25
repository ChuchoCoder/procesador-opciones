/**
 * Storage adapter over the browser's localStorage.
 * Exposes a Promise-based API so callers can await every operation.
 */

/**
 * Storage adapter class
 */
class StorageAdapter {
  /**
   * Get item from storage
   * @param {string} key - Storage key
   * @returns {Promise<any>} Stored value or null
   */
  async getItem(key) {
    try {
      const value = window.localStorage.getItem(key);
      return Promise.resolve(value);
    } catch (error) {
      console.error('[StorageAdapter] localStorage.getItem failed:', error);
      return Promise.resolve(null);
    }
  }

  /**
   * Set item in storage
   * @param {string} key - Storage key
   * @param {any} value - Value to store (will be stringified for localStorage)
   * @returns {Promise<boolean>} Success status
   */
  async setItem(key, value) {
    try {
      window.localStorage.setItem(key, value);
      return Promise.resolve(true);
    } catch (error) {
      console.error('[StorageAdapter] localStorage.setItem failed:', error);
      return Promise.resolve(false);
    }
  }

  /**
   * Remove item from storage
   * @param {string} key - Storage key
   * @returns {Promise<boolean>} Success status
   */
  async removeItem(key) {
    try {
      window.localStorage.removeItem(key);
      return Promise.resolve(true);
    } catch (error) {
      console.error('[StorageAdapter] localStorage.removeItem failed:', error);
      return Promise.resolve(false);
    }
  }

  /**
   * Get all keys from storage (filtered by prefix if provided)
   * @param {string} [prefix] - Optional prefix to filter keys
   * @returns {Promise<string[]>} Array of keys
   */
  async getAllKeys(prefix = '') {
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

  /**
   * Clear all items with given prefix
   * @param {string} [prefix] - Optional prefix to filter keys to clear
   * @returns {Promise<boolean>} Success status
   */
  async clear(prefix = '') {
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

  /**
   * Check if storage is available
   * @returns {boolean}
   */
  isAvailable() {
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

// Export singleton instance
export const storageAdapter = new StorageAdapter();

// Export for testing/advanced use
export { StorageAdapter };
