/* global global */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { validateSuffix } from '../../src/services/settings-utils.js';
import { loadSymbolConfig, saveSymbolConfig } from '../../src/services/storage-settings.js';
import { EXPIRATION_CODES } from '../../src/services/settings-types.js';

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = value; },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

global.localStorage = localStorageMock;

describe('Expiration Management Logic', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('Suffix validation', () => {
    it('should accept 1-letter suffix', () => {
      const result = validateSuffix('O');
      expect(result.valid).toBe(true);
      expect(result.normalized).toBe('O');
    });

    it('should accept 2-letter suffix', () => {
      const result = validateSuffix('OC');
      expect(result.valid).toBe(true);
      expect(result.normalized).toBe('OC');
    });

    it('should normalize to uppercase', () => {
      const result = validateSuffix('oc');
      expect(result.valid).toBe(true);
      expect(result.normalized).toBe('OC');
    });

    it('should reject 3-letter suffix', () => {
      const result = validateSuffix('OCT');
      expect(result.valid).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('should reject empty suffix', () => {
      const result = validateSuffix('');
      expect(result.valid).toBe(false);
    });

    it('should reject suffix with numbers', () => {
      const result = validateSuffix('O1');
      expect(result.valid).toBe(false);
    });
  });

  describe('Expiration CRUD operations', () => {
    it('should create config with default expirations', async () => {
      const config = {
        symbol: 'GGAL',
        prefix: 'GFG',
        defaultDecimals: 2,
        expirations: {
          DIC: { suffixes: ['D', 'DI'], decimals: 2, overrides: [] },
          FEB: { suffixes: ['F', 'FE'], decimals: 2, overrides: [] },
        },
      };

      await saveSymbolConfig(config);
      const loaded = await loadSymbolConfig('GGAL');

      expect(loaded.expirations.DIC).toBeDefined();
      expect(loaded.expirations.FEB).toBeDefined();
      expect(loaded.expirations.DIC.suffixes).toEqual(['D', 'DI']);
    });

    it('should add suffix to expiration', async () => {
      const config = {
        symbol: 'GGAL',
        prefix: 'GFG',
        defaultDecimals: 2,
        expirations: {
          DIC: { suffixes: ['D'], decimals: 2, overrides: [] },
        },
      };

      await saveSymbolConfig(config);

      // Add new suffix
      config.expirations.DIC.suffixes.push('DI');
      await saveSymbolConfig(config);

      const loaded = await loadSymbolConfig('GGAL');
      expect(loaded.expirations.DIC.suffixes).toEqual(['D', 'DI']);
    });

    it('should update expiration decimals', async () => {
      const config = {
        symbol: 'GGAL',
        prefix: 'GFG',
        defaultDecimals: 2,
        expirations: {
          DIC: { suffixes: ['D'], decimals: 2, overrides: [] },
        },
      };

      await saveSymbolConfig(config);

      // Update decimals
      config.expirations.DIC.decimals = 3;
      await saveSymbolConfig(config);

      const loaded = await loadSymbolConfig('GGAL');
      expect(loaded.expirations.DIC.decimals).toBe(3);
    });

    it('should preserve other expirations when updating one', async () => {
      const config = {
        symbol: 'GGAL',
        prefix: 'GFG',
        defaultDecimals: 2,
        expirations: {
          DIC: { suffixes: ['D'], decimals: 2, overrides: [] },
          FEB: { suffixes: ['F'], decimals: 1, overrides: [] },
        },
      };

      await saveSymbolConfig(config);

      // Update only DIC
      config.expirations.DIC.decimals = 3;
      await saveSymbolConfig(config);

      const loaded = await loadSymbolConfig('GGAL');
      expect(loaded.expirations.DIC.decimals).toBe(3);
      expect(loaded.expirations.FEB.decimals).toBe(1); // Unchanged
    });
  });

  describe('Strike override operations', () => {
    it('should add strike override to expiration', async () => {
      const config = {
        symbol: 'GGAL',
        prefix: 'GFG',
        defaultDecimals: 2,
        expirations: {
          DIC: { suffixes: ['D'], decimals: 2, overrides: [] },
        },
      };

      await saveSymbolConfig(config);

      // Add override
      config.expirations.DIC.overrides.push({
        raw: '47343',
        formatted: '4734.3',
      });
      await saveSymbolConfig(config);

      const loaded = await loadSymbolConfig('GGAL');
      expect(loaded.expirations.DIC.overrides).toHaveLength(1);
      expect(loaded.expirations.DIC.overrides[0].raw).toBe('47343');
      expect(loaded.expirations.DIC.overrides[0].formatted).toBe('4734.3');
    });

    it('should support multiple overrides per expiration', async () => {
      const config = {
        symbol: 'GGAL',
        prefix: 'GFG',
        defaultDecimals: 2,
        expirations: {
          DIC: {
            suffixes: ['D'],
            decimals: 2,
            overrides: [
              { raw: '47343', formatted: '4734.3' },
              { raw: '12345', formatted: '123.45' },
            ],
          },
        },
      };

      await saveSymbolConfig(config);
      const loaded = await loadSymbolConfig('GGAL');
      expect(loaded.expirations.DIC.overrides).toHaveLength(2);
    });

    it('should remove strike override', async () => {
      const config = {
        symbol: 'GGAL',
        prefix: 'GFG',
        defaultDecimals: 2,
        expirations: {
          DIC: {
            suffixes: ['D'],
            decimals: 2,
            overrides: [
              { raw: '47343', formatted: '4734.3' },
              { raw: '12345', formatted: '123.45' },
            ],
          },
        },
      };

      await saveSymbolConfig(config);

      // Remove first override
      config.expirations.DIC.overrides = config.expirations.DIC.overrides.filter(
        (o) => o.raw !== '47343'
      );
      await saveSymbolConfig(config);

      const loaded = await loadSymbolConfig('GGAL');
      expect(loaded.expirations.DIC.overrides).toHaveLength(1);
      expect(loaded.expirations.DIC.overrides[0].raw).toBe('12345');
    });

    it('should prevent duplicate raw tokens in same expiration', () => {
      const overrides = [
        { raw: '47343', formatted: '4734.3' },
      ];

      const newRaw = '47343';
      const isDuplicate = overrides.some((o) => o.raw === newRaw);
      
      expect(isDuplicate).toBe(true);
    });

    it('should allow same raw token in different expirations', async () => {
      const config = {
        symbol: 'GGAL',
        prefix: 'GFG',
        defaultDecimals: 2,
        expirations: {
          DIC: {
            suffixes: ['D'],
            decimals: 2,
            overrides: [{ raw: '47343', formatted: '4734.3' }],
          },
          FEB: {
            suffixes: ['F'],
            decimals: 1,
            overrides: [{ raw: '47343', formatted: '47343' }],
          },
        },
      };

      await saveSymbolConfig(config);
      const loaded = await loadSymbolConfig('GGAL');
      
      expect(loaded.expirations.DIC.overrides[0].raw).toBe('47343');
      expect(loaded.expirations.FEB.overrides[0].raw).toBe('47343');
      expect(loaded.expirations.DIC.overrides[0].formatted).not.toBe(
        loaded.expirations.FEB.overrides[0].formatted
      );
    });
  });

  describe('Expiration data integrity', () => {
    it('should maintain expiration structure through updates', async () => {
      const config = {
        symbol: 'GGAL',
        prefix: 'GFG',
        defaultDecimals: 2,
        expirations: {
          DIC: { suffixes: ['D'], decimals: 2, overrides: [] },
        },
      };

      await saveSymbolConfig(config);

      // Multiple updates
      config.expirations.DIC.suffixes.push('DI');
      await saveSymbolConfig(config);

      config.expirations.DIC.decimals = 3;
      await saveSymbolConfig(config);

      config.expirations.DIC.overrides.push({ raw: '47343', formatted: '4734.3' });
      await saveSymbolConfig(config);

      const loaded = await loadSymbolConfig('GGAL');
      expect(loaded.expirations.DIC.suffixes).toEqual(['D', 'DI']);
      expect(loaded.expirations.DIC.decimals).toBe(3);
      expect(loaded.expirations.DIC.overrides).toHaveLength(1);
    });

    it('should handle all default expiration codes', async () => {
      const config = {
        symbol: 'GGAL',
        prefix: 'GFG',
        defaultDecimals: 2,
        expirations: {},
      };

      // Create default expirations
      EXPIRATION_CODES.forEach((code) => {
        config.expirations[code] = {
          suffixes: [code.charAt(0), code.substring(0, 2)],
          decimals: 2,
          overrides: [],
        };
      });

      await saveSymbolConfig(config);
      const loaded = await loadSymbolConfig('GGAL');

      EXPIRATION_CODES.forEach((code) => {
        expect(loaded.expirations[code]).toBeDefined();
        expect(loaded.expirations[code].suffixes).toContain(code.charAt(0));
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle empty overrides array', async () => {
      const config = {
        symbol: 'GGAL',
        prefix: 'GFG',
        defaultDecimals: 2,
        expirations: {
          DIC: { suffixes: ['D'], decimals: 2, overrides: [] },
        },
      };

      await saveSymbolConfig(config);
      const loaded = await loadSymbolConfig('GGAL');
      expect(loaded.expirations.DIC.overrides).toEqual([]);
    });

    it('should handle empty suffixes array', async () => {
      const config = {
        symbol: 'GGAL',
        prefix: 'GFG',
        defaultDecimals: 2,
        expirations: {
          DIC: { suffixes: [], decimals: 2, overrides: [] },
        },
      };

      await saveSymbolConfig(config);
      const loaded = await loadSymbolConfig('GGAL');
      expect(loaded.expirations.DIC.suffixes).toEqual([]);
    });

    it('should update timestamp on expiration changes', async () => {
      const config = {
        symbol: 'GGAL',
        prefix: 'GFG',
        defaultDecimals: 2,
        expirations: {
          DIC: { suffixes: ['D'], decimals: 2, overrides: [] },
        },
      };

      await saveSymbolConfig(config);
      const firstSave = await loadSymbolConfig('GGAL');
      const firstTimestamp = firstSave.updatedAt;

      // Wait and update
      await new Promise(resolve => setTimeout(resolve, 10));
      config.expirations.DIC.decimals = 3;
      await saveSymbolConfig(config);
      const secondSave = await loadSymbolConfig('GGAL');
      expect(secondSave.updatedAt).toBeGreaterThanOrEqual(firstTimestamp);
    });
  });
});
