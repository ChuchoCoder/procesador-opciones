/* global global */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getAllSymbols,
  loadSymbolConfig,
  saveSymbolConfig,
  deleteSymbolConfig,
  symbolExists,
  loadRepoFeeDefaults,
  getRepoFeeConfig,
  setRepoFeeConfig,
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
if (typeof window !== 'undefined') {
  window.localStorage = localStorageMock;
}

describe('storage-settings', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('saveSymbolConfig', () => {
    it('should save a valid config to localStorage', async () => {
      const config = {
        symbol: 'GGAL',
        prefix: 'GFG',
        defaultDecimals: 2,
        expirations: {},
        updatedAt: Date.now(),
      };

      const result = await saveSymbolConfig(config);
      expect(result).toBe(true);

      const saved = localStorage.getItem('po:settings:GGAL');
      expect(saved).toBeTruthy();
      const parsed = JSON.parse(saved);
      expect(parsed.symbol).toBe('GGAL');
      expect(parsed.prefix).toBe('GFG');
    });

    it('should reject config without symbol', async () => {
      const config = { prefix: 'ABC', defaultDecimals: 1 };
      const result = await saveSymbolConfig(config);
      expect(result).toBe(false);
    });

    it('should update timestamp on save', async () => {
      const before = Date.now();
      const config = { symbol: 'TEST', prefix: 'TST', defaultDecimals: 2 };
      await saveSymbolConfig(config);

      const saved = JSON.parse(localStorage.getItem('po:settings:TEST'));
      expect(saved.updatedAt).toBeGreaterThanOrEqual(before);
    });
  });

  describe('loadSymbolConfig', () => {
    it('should load an existing config', async () => {
      const config = { symbol: 'GGAL', prefix: 'GFG', defaultDecimals: 2, updatedAt: Date.now() };
      localStorage.setItem('po:settings:GGAL', JSON.stringify(config));

      const loaded = await loadSymbolConfig('GGAL');
      expect(loaded).toEqual(config);
    });

    it('should return null for non-existent symbol', async () => {
      const loaded = await loadSymbolConfig('MISSING');
      expect(loaded).toBeNull();
    });

    it('should handle malformed JSON gracefully', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      localStorage.setItem('po:settings:BAD', '{invalid json}');

      const loaded = await loadSymbolConfig('BAD');
      expect(loaded).toBeNull();
      expect(consoleError).toHaveBeenCalled();

      consoleError.mockRestore();
    });
  });

  describe('getAllSymbols', () => {
    it('should return empty array when no symbols exist', async () => {
      const symbols = await getAllSymbols();
      expect(symbols).toEqual([]);
    });

    it('should return all symbol keys sorted', async () => {
      await saveSymbolConfig({ symbol: 'GGAL', prefix: 'GFG', defaultDecimals: 2 });
      await saveSymbolConfig({ symbol: 'YPFD', prefix: 'YPF', defaultDecimals: 2 });
      await saveSymbolConfig({ symbol: 'ALUA', prefix: 'ALU', defaultDecimals: 1 });

      const symbols = await getAllSymbols();
      expect(symbols).toEqual(['ALUA', 'GGAL', 'YPFD']);
    });

    it('should ignore non-settings keys', async () => {
      localStorage.setItem('other:key', 'value');
      await saveSymbolConfig({ symbol: 'GGAL', prefix: 'GFG', defaultDecimals: 2 });

      const symbols = await getAllSymbols();
      expect(symbols).toEqual(['GGAL']);
    });
  });

  describe('symbolExists', () => {
    it('should return true for existing symbol', async () => {
      await saveSymbolConfig({ symbol: 'GGAL', prefix: 'GFG', defaultDecimals: 2 });
      expect(await symbolExists('GGAL')).toBe(true);
    });

    it('should return false for non-existent symbol', async () => {
      expect(await symbolExists('MISSING')).toBe(false);
    });

    it('should be case-insensitive', async () => {
      await saveSymbolConfig({ symbol: 'GGAL', prefix: 'GFG', defaultDecimals: 2 });
      expect(await symbolExists('ggal')).toBe(true);
      expect(await symbolExists('Ggal')).toBe(true);
    });
  });

  describe('deleteSymbolConfig', () => {
    it('should remove a symbol config', async () => {
      await saveSymbolConfig({ symbol: 'GGAL', prefix: 'GFG', defaultDecimals: 2 });
      expect(await symbolExists('GGAL')).toBe(true);

      const result = await deleteSymbolConfig('GGAL');
      expect(result).toBe(true);
      expect(await symbolExists('GGAL')).toBe(false);
    });
  });

  describe('repo fee configuration helpers', () => {
    const defaultsPayload = {
      arancelCaucionColocadora: { ARS: 0.2, USD: 0.2 },
      arancelCaucionTomadora: { ARS: 0.25, USD: 0.25 },
      derechosDeMercadoDailyRate: { ARS: 0.0005, USD: 0.0005 },
      gastosGarantiaDailyRate: { ARS: 0.00035, USD: 0.00035 },
      ivaRepoRate: 0.21,
      overridesMetadata: [],
    };

    const originalFetch = global.fetch;

    const setupFetchMock = () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => defaultsPayload,
      });
    };

    const restoreFetch = () => {
      if (originalFetch) {
        global.fetch = originalFetch;
      } else {
        delete global.fetch;
      }
    };

    beforeEach(() => {
      localStorage.clear();
      setupFetchMock();
    });

    afterEach(async () => {
      await loadRepoFeeDefaults({ forceReload: true });
      await getRepoFeeConfig({ forceReload: true });
      restoreFetch();
    });

    it('loads and caches repo fee defaults', async () => {
      const defaults = await loadRepoFeeDefaults({ forceReload: true });
      expect(defaults).toMatchObject(defaultsPayload);
      expect(global.fetch).toHaveBeenCalledTimes(1);

      const cached = await loadRepoFeeDefaults();
      expect(cached).toMatchObject(defaultsPayload);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('returns defaults when no overrides stored', async () => {
      const config = await getRepoFeeConfig({ forceReload: true });
      expect(config).toMatchObject(defaultsPayload);
    });

    it('persists overrides and merges with defaults', async () => {
      await setRepoFeeConfig({
        arancelCaucionColocadora: { USD: 0.45 },
        overridesMetadata: [{ currency: 'USD', role: 'colocadora', effectiveDate: '2025-10-18T00:00:00Z' }],
      });

      const storedRaw = JSON.parse(localStorage.getItem('po.repoFeeConfig.v1'));
      expect(storedRaw.arancelCaucionColocadora.USD).toBe(0.45);

      const merged = await getRepoFeeConfig({ forceReload: true });
      expect(merged.arancelCaucionColocadora.USD).toBe(0.45);
      expect(merged.arancelCaucionColocadora.ARS).toBe(defaultsPayload.arancelCaucionColocadora.ARS);
      expect(Array.isArray(merged.overridesMetadata)).toBe(true);
      expect(merged.overridesMetadata[0]).toMatchObject({ currency: 'USD', role: 'colocadora' });
    });
  });
});
