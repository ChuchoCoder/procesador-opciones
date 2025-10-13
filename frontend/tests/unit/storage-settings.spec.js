import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getAllSymbols,
  loadSymbolConfig,
  saveSymbolConfig,
  deleteSymbolConfig,
  symbolExists,
} from '../../src/services/storage-settings.js';

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => {
      store[key] = value.toString();
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    key: (index) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    },
    get length() {
      return Object.keys(store).length;
    },
  };
})();

global.localStorage = localStorageMock;

describe('storage-settings', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('saveSymbolConfig', () => {
    it('should save a valid config to localStorage', () => {
      const config = {
        symbol: 'GGAL',
        prefix: 'GFG',
        defaultDecimals: 2,
        expirations: {},
        updatedAt: Date.now(),
      };

      const result = saveSymbolConfig(config);
      expect(result).toBe(true);

      const saved = localStorage.getItem('po:settings:GGAL');
      expect(saved).toBeTruthy();
      const parsed = JSON.parse(saved);
      expect(parsed.symbol).toBe('GGAL');
      expect(parsed.prefix).toBe('GFG');
    });

    it('should reject config without symbol', () => {
      const config = { prefix: 'ABC', defaultDecimals: 1 };
      const result = saveSymbolConfig(config);
      expect(result).toBe(false);
    });

    it('should update timestamp on save', () => {
      const before = Date.now();
      const config = { symbol: 'TEST', prefix: 'TST', defaultDecimals: 2 };
      saveSymbolConfig(config);

      const saved = JSON.parse(localStorage.getItem('po:settings:TEST'));
      expect(saved.updatedAt).toBeGreaterThanOrEqual(before);
    });
  });

  describe('loadSymbolConfig', () => {
    it('should load an existing config', () => {
      const config = { symbol: 'GGAL', prefix: 'GFG', defaultDecimals: 2, updatedAt: Date.now() };
      localStorage.setItem('po:settings:GGAL', JSON.stringify(config));

      const loaded = loadSymbolConfig('GGAL');
      expect(loaded).toEqual(config);
    });

    it('should return null for non-existent symbol', () => {
      const loaded = loadSymbolConfig('MISSING');
      expect(loaded).toBeNull();
    });

    it('should handle malformed JSON gracefully', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      localStorage.setItem('po:settings:BAD', '{invalid json}');

      const loaded = loadSymbolConfig('BAD');
      expect(loaded).toBeNull();
      expect(consoleError).toHaveBeenCalled();

      consoleError.mockRestore();
    });
  });

  describe('getAllSymbols', () => {
    it('should return empty array when no symbols exist', () => {
      const symbols = getAllSymbols();
      expect(symbols).toEqual([]);
    });

    it('should return all symbol keys sorted', () => {
      saveSymbolConfig({ symbol: 'GGAL', prefix: 'GFG', defaultDecimals: 2 });
      saveSymbolConfig({ symbol: 'YPFD', prefix: 'YPF', defaultDecimals: 2 });
      saveSymbolConfig({ symbol: 'ALUA', prefix: 'ALU', defaultDecimals: 1 });

      const symbols = getAllSymbols();
      expect(symbols).toEqual(['ALUA', 'GGAL', 'YPFD']);
    });

    it('should ignore non-settings keys', () => {
      localStorage.setItem('other:key', 'value');
      saveSymbolConfig({ symbol: 'GGAL', prefix: 'GFG', defaultDecimals: 2 });

      const symbols = getAllSymbols();
      expect(symbols).toEqual(['GGAL']);
    });
  });

  describe('symbolExists', () => {
    it('should return true for existing symbol', () => {
      saveSymbolConfig({ symbol: 'GGAL', prefix: 'GFG', defaultDecimals: 2 });
      expect(symbolExists('GGAL')).toBe(true);
    });

    it('should return false for non-existent symbol', () => {
      expect(symbolExists('MISSING')).toBe(false);
    });

    it('should be case-insensitive', () => {
      saveSymbolConfig({ symbol: 'GGAL', prefix: 'GFG', defaultDecimals: 2 });
      expect(symbolExists('ggal')).toBe(true);
      expect(symbolExists('Ggal')).toBe(true);
    });
  });

  describe('deleteSymbolConfig', () => {
    it('should remove a symbol config', () => {
      saveSymbolConfig({ symbol: 'GGAL', prefix: 'GFG', defaultDecimals: 2 });
      expect(symbolExists('GGAL')).toBe(true);

      const result = deleteSymbolConfig('GGAL');
      expect(result).toBe(true);
      expect(symbolExists('GGAL')).toBe(false);
    });
  });
});
