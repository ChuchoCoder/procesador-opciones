import { describe, it, expect, beforeEach, vi } from 'vitest';
import { validatePrefix, validateDecimals } from '../../src/services/settings-utils.js';
import { loadSymbolConfig, saveSymbolConfig } from '../../src/services/storage-settings.js';

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

describe('SymbolSettings Component Logic', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('Prefix validation flow', () => {
    it('should accept empty prefix', () => {
      const result = validatePrefix('');
      expect(result.valid).toBe(true);
      expect(result.value).toBe('');
    });

    it('should accept valid prefix and normalize to uppercase', () => {
      const result = validatePrefix('gfg');
      expect(result.valid).toBe(true);
      expect(result.value).toBe('GFG');
    });

    it('should reject prefix with special characters', () => {
      const result = validatePrefix('GF@G');
      expect(result.valid).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('should trim whitespace from prefix', () => {
      const result = validatePrefix('  GFG  ');
      expect(result.valid).toBe(true);
      expect(result.value).toBe('GFG');
    });
  });

  describe('Decimals validation flow', () => {
    it('should accept valid decimals in range 0-4', () => {
      for (let i = 0; i <= 4; i++) {
        const result = validateDecimals(i);
        expect(result.valid).toBe(true);
        expect(result.value).toBe(i);
      }
    });

    it('should accept string representation of decimals', () => {
      const result = validateDecimals('2');
      expect(result.valid).toBe(true);
      expect(result.value).toBe(2);
    });

    it('should reject decimals below 0', () => {
      const result = validateDecimals(-1);
      expect(result.valid).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('should reject decimals above 4', () => {
      const result = validateDecimals(5);
      expect(result.valid).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('should reject non-integer decimals', () => {
      const result = validateDecimals(2.5);
      expect(result.valid).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });

  describe('Write-on-blur persistence', () => {
    it('should save updated prefix on blur', () => {
      // Setup: create initial config
      const initialConfig = {
        symbol: 'GGAL',
        prefix: 'GFG',
        defaultDecimals: 2,
        expirations: [],
      };
      saveSymbolConfig(initialConfig);

      // Simulate user edit: change prefix to 'GGAL'
      const updatedConfig = {
        ...initialConfig,
        prefix: 'GGAL',
      };
      saveSymbolConfig(updatedConfig);

      // Verify persistence
      const loaded = loadSymbolConfig('GGAL');
      expect(loaded.prefix).toBe('GGAL');
      expect(loaded.updatedAt).toBeTruthy();
    });

    it('should save updated decimals on blur', () => {
      // Setup: create initial config
      const initialConfig = {
        symbol: 'GGAL',
        prefix: 'GFG',
        defaultDecimals: 2,
        expirations: [],
      };
      saveSymbolConfig(initialConfig);

      // Simulate user edit: change decimals to 3
      const updatedConfig = {
        ...initialConfig,
        defaultDecimals: 3,
      };
      saveSymbolConfig(updatedConfig);

      // Verify persistence
      const loaded = loadSymbolConfig('GGAL');
      expect(loaded.defaultDecimals).toBe(3);
      expect(loaded.updatedAt).toBeTruthy();
    });

    it('should update timestamp on each save', () => {
      const config = {
        symbol: 'GGAL',
        prefix: 'GFG',
        defaultDecimals: 2,
        expirations: [],
      };

      saveSymbolConfig(config);
      const firstSave = loadSymbolConfig('GGAL');
      const firstTimestamp = firstSave.updatedAt;

      // Wait a bit and save again
      setTimeout(() => {
        config.prefix = 'GGAL';
        saveSymbolConfig(config);
        const secondSave = loadSymbolConfig('GGAL');
        expect(secondSave.updatedAt).toBeGreaterThanOrEqual(firstTimestamp);
      }, 10);
    });
  });

  describe('Reset to saved behavior', () => {
    it('should reload config from storage discarding local changes', () => {
      // Setup: save config
      const savedConfig = {
        symbol: 'GGAL',
        prefix: 'GFG',
        defaultDecimals: 2,
        expirations: [],
      };
      saveSymbolConfig(savedConfig);

      // Simulate: user makes local edits (not saved)
      // In component, this would be state only
      const localPrefix = 'CHANGED';
      const localDecimals = 4;

      // User clicks Reset: reload from storage
      const reloadedConfig = loadSymbolConfig('GGAL');
      
      // Verify: local changes discarded, saved values restored
      expect(reloadedConfig.prefix).toBe('GFG');
      expect(reloadedConfig.defaultDecimals).toBe(2);
      expect(reloadedConfig.prefix).not.toBe(localPrefix);
      expect(reloadedConfig.defaultDecimals).not.toBe(localDecimals);
    });
  });

  describe('Edge cases', () => {
    it('should handle missing config gracefully', () => {
      const loaded = loadSymbolConfig('NONEXISTENT');
      expect(loaded).toBeNull();
    });

    it('should preserve expirations array when updating defaults', () => {
      const config = {
        symbol: 'GGAL',
        prefix: 'GFG',
        defaultDecimals: 2,
        expirations: [
          { code: 'DIC', suffix: 'D', decimals: 1, overrides: [] },
        ],
      };
      saveSymbolConfig(config);

      // Update only prefix
      config.prefix = 'GGAL';
      saveSymbolConfig(config);

      const loaded = loadSymbolConfig('GGAL');
      expect(loaded.expirations).toHaveLength(1);
      expect(loaded.expirations[0].code).toBe('DIC');
    });

    it('should handle rapid consecutive saves', () => {
      const config = {
        symbol: 'GGAL',
        prefix: 'GFG',
        defaultDecimals: 2,
        expirations: [],
      };

      // Simulate rapid field changes
      saveSymbolConfig({ ...config, prefix: 'G1' });
      saveSymbolConfig({ ...config, prefix: 'G2' });
      saveSymbolConfig({ ...config, prefix: 'G3' });

      const loaded = loadSymbolConfig('GGAL');
      expect(loaded.prefix).toBe('G3'); // Last write wins
    });
  });
});
