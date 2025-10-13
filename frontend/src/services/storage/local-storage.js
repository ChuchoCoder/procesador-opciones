const isLocalStorageAvailable = () => {
  try {
    const testKey = '__po_test__';
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return true;
  } catch (error) {
    console.warn('PO: localStorage unavailable', error);
    return false;
  }
};

const storageEnabled = typeof window !== 'undefined' && isLocalStorageAvailable();

const safeAccess = (operation) => {
  if (!storageEnabled) {
    return null;
  }

  try {
    return operation(window.localStorage);
  } catch (error) {
    console.warn('PO: localStorage operation failed', error);
    return null;
  }
};

export const storageKeys = {
  prefixRules: 'po.prefixRules',
  expirations: 'po.expirations',
  activeExpiration: 'po.activeExpiration',
  useAveraging: 'po.useAveraging',
  lastReport: 'po.lastReport.v1',
};

export const readItem = (key) =>
  safeAccess((storage) => {
    const value = storage.getItem(key);

    if (value === null || value === undefined) {
      return null;
    }

    try {
      return JSON.parse(value);
    } catch (parseError) {
      console.warn('PO: Failed to parse stored value', { key, parseError });
      return null;
    }
  });

export const writeItem = (key, value) =>
  safeAccess((storage) => {
    storage.setItem(key, JSON.stringify(value));
    return true;
  });

export const removeItem = (key) =>
  safeAccess((storage) => {
    storage.removeItem(key);
    return true;
  });

export const clearAll = () =>
  safeAccess((storage) => {
    Object.values(storageKeys).forEach((key) => storage.removeItem(key));
    return true;
  });

export const storageAvailable = () => storageEnabled;
