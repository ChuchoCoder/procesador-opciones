import { describe, it, expect } from 'vitest';
import {
  validateSymbol,
  validatePrefix,
  validateSuffix,
  validateDecimals,
  formatStrikeToken,
  symbolExists,
} from '../../src/services/settings-utils.js';

describe('settings-utils', () => {
  describe('validateSymbol', () => {
    it('should accept valid uppercase symbols', () => {
      const result = validateSymbol('GGAL');
      expect(result.valid).toBe(true);
      expect(result.normalized).toBe('GGAL');
    });

    it('should normalize to uppercase', () => {
      const result = validateSymbol('ggal');
      expect(result.valid).toBe(true);
      expect(result.normalized).toBe('GGAL');
    });

    it('should accept alphanumeric symbols', () => {
      const result = validateSymbol('ABC123');
      expect(result.valid).toBe(true);
      expect(result.normalized).toBe('ABC123');
    });

    it('should reject empty symbol', () => {
      const result = validateSymbol('');
      expect(result.valid).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('should reject symbols with special characters', () => {
      const result = validateSymbol('GG-AL');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('letters and numbers');
    });

    it('should trim whitespace', () => {
      const result = validateSymbol('  GGAL  ');
      expect(result.valid).toBe(true);
      expect(result.normalized).toBe('GGAL');
    });
  });

  describe('validatePrefix', () => {
    it('should accept valid prefix', () => {
      const result = validatePrefix('GFG');
      expect(result.valid).toBe(true);
      expect(result.normalized).toBe('GFG');
    });

    it('should normalize to uppercase', () => {
      const result = validatePrefix('gfg');
      expect(result.valid).toBe(true);
      expect(result.normalized).toBe('GFG');
    });

    it('should reject empty prefix', () => {
      const result = validatePrefix('');
      expect(result.valid).toBe(false);
    });

    it('should reject special characters', () => {
      const result = validatePrefix('GF-G');
      expect(result.valid).toBe(false);
    });
  });

  describe('validateSuffix', () => {
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

    it('should reject 3+ letter suffix', () => {
      const result = validateSuffix('OCT');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('1-2 letters');
    });

    it('should reject empty suffix', () => {
      const result = validateSuffix('');
      expect(result.valid).toBe(false);
    });

    it('should reject numbers in suffix', () => {
      const result = validateSuffix('O1');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('only letters');
    });

    it('should normalize to uppercase', () => {
      const result = validateSuffix('oc');
      expect(result.valid).toBe(true);
      expect(result.normalized).toBe('OC');
    });
  });

  describe('validateDecimals', () => {
    it('should accept valid decimals in range', () => {
      [0, 1, 2, 3, 4].forEach((dec) => {
        const result = validateDecimals(dec);
        expect(result.valid).toBe(true);
        expect(result.normalized).toBe(dec);
      });
    });

    it('should accept string numbers', () => {
      const result = validateDecimals('2');
      expect(result.valid).toBe(true);
      expect(result.normalized).toBe(2);
    });

    it('should reject decimals out of range', () => {
      expect(validateDecimals(-1).valid).toBe(false);
      expect(validateDecimals(5).valid).toBe(false);
    });

    it('should reject non-integer values', () => {
      expect(validateDecimals(2.5).valid).toBe(false);
      expect(validateDecimals('abc').valid).toBe(false);
    });
  });

  describe('formatStrikeToken', () => {
    it('should format with 0 decimals', () => {
      expect(formatStrikeToken('47343', 0)).toBe('47343');
    });

    it('should format with 1 decimal', () => {
      expect(formatStrikeToken('47343', 1)).toBe('4734.3');
    });

    it('should format with 2 decimals', () => {
      expect(formatStrikeToken('47343', 2)).toBe('473.43');
    });

    it('should format with 3 decimals', () => {
      expect(formatStrikeToken('47343', 3)).toBe('47.343');
    });

    it('should format with 4 decimals', () => {
      expect(formatStrikeToken('47343', 4)).toBe('4.7343');
    });

    it('should handle short tokens with padding', () => {
      expect(formatStrikeToken('12', 3)).toBe('0.012');
      expect(formatStrikeToken('5', 2)).toBe('0.05');
    });

    it('should strip non-digits', () => {
      expect(formatStrikeToken('4,734.3', 1)).toBe('4734.3');
    });

    it('should handle empty input', () => {
      expect(formatStrikeToken('', 2)).toBe('');
    });
  });

  describe('symbolExists', () => {
    it('should detect existing symbol', () => {
      const getAllSymbols = () => ['GGAL', 'YPFD'];
      expect(symbolExists('GGAL', getAllSymbols)).toBe(true);
    });

    it('should detect non-existing symbol', () => {
      const getAllSymbols = () => ['GGAL', 'YPFD'];
      expect(symbolExists('ALUA', getAllSymbols)).toBe(false);
    });

    it('should be case-insensitive', () => {
      const getAllSymbols = () => ['GGAL', 'YPFD'];
      expect(symbolExists('ggal', getAllSymbols)).toBe(true);
      expect(symbolExists('Ggal', getAllSymbols)).toBe(true);
    });

    it('should trim whitespace', () => {
      const getAllSymbols = () => ['GGAL'];
      expect(symbolExists('  GGAL  ', getAllSymbols)).toBe(true);
    });
  });
});
