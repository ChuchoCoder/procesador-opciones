/* eslint-env node */
import { describe, it, expect, beforeEach } from 'vitest';

import {
  formatCantidad,
  formatDecimal,
  formatPrecio,
  formatMoneda,
  formatMonedaConSigno,
  formatMonedaConSimbolo,
  formatMonedaConDecimales,
  formatPorcentaje,
  formatFraccionComoPorcentaje,
} from '../../src/services/formato.js';

const setLocale = (locale) => localStorage.setItem('user_preferred_locale', locale);

describe('formato', () => {
  beforeEach(() => {
    localStorage.clear();
    setLocale('en-US');
  });

  describe('respects the regional-format preference', () => {
    it('formats with a dot decimal separator under en-US', () => {
      setLocale('en-US');
      expect(formatPrecio(1234.5)).toBe('1,234.50');
    });

    it('formats with a comma decimal separator under es-AR', () => {
      setLocale('es-AR');
      expect(formatPrecio(1234.5)).toBe('1.234,50');
    });

    it('picks up a preference change without a reload', () => {
      setLocale('en-US');
      expect(formatCantidad(1000)).toBe('1,000');
      setLocale('es-AR');
      expect(formatCantidad(1000)).toBe('1.000');
    });
  });

  describe('formatCantidad', () => {
    it('groups and drops fraction digits', () => {
      expect(formatCantidad(184658)).toBe('184,658');
      expect(formatCantidad(1234.9)).toBe('1,235');
    });

    it('returns a blank placeholder for non-finite values', () => {
      expect(formatCantidad(null)).toBe('');
      expect(formatCantidad(undefined)).toBe('');
      expect(formatCantidad(NaN)).toBe('');
      expect(formatCantidad(Infinity)).toBe('');
    });

    it('accepts a caller-chosen placeholder', () => {
      expect(formatCantidad(NaN, { placeholder: '—' })).toBe('—');
    });
  });

  describe('formatDecimal', () => {
    it('keeps up to 4 fraction digits and drops trailing zeros', () => {
      expect(formatDecimal(1.5)).toBe('1.5');
      expect(formatDecimal(1.23456)).toBe('1.2346');
      expect(formatDecimal(2)).toBe('2');
    });
  });

  describe('money', () => {
    it('formatMoneda always shows two fraction digits', () => {
      expect(formatMoneda(10)).toBe('10.00');
      expect(formatMoneda(0.5)).toBe('0.50');
    });

    it('formatMoneda falls back to an em dash', () => {
      expect(formatMoneda(null)).toBe('—');
    });

    it('formatMonedaConSigno prefixes credits and debits, but not zero', () => {
      expect(formatMonedaConSigno(1500.25)).toBe('+1,500.25');
      expect(formatMonedaConSigno(-1500.25)).toBe('-1,500.25');
      expect(formatMonedaConSigno(0)).toBe('0.00');
    });

    it('formatMonedaConSimbolo renders the currency symbol', () => {
      expect(formatMonedaConSimbolo(1234.5)).toContain('1,234.50');
      expect(formatMonedaConSimbolo(1234.5)).toMatch(/\$|ARS/);
    });

    it('formatMonedaConDecimales honours the requested precision', () => {
      expect(formatMonedaConDecimales(1.5, 0)).toBe('2');
      expect(formatMonedaConDecimales(1.5, 4)).toBe('1.5000');
    });
  });

  describe('percentages', () => {
    it('formatPorcentaje takes percent units', () => {
      expect(formatPorcentaje(34.41344)).toBe('34.41%');
      expect(formatPorcentaje(0.06, { decimals: 4 })).toBe('0.0600%');
    });

    it('formatFraccionComoPorcentaje takes a fraction', () => {
      expect(formatFraccionComoPorcentaje(0.21)).toBe('21.00%');
      expect(formatFraccionComoPorcentaje(0.0006, { decimals: 4 })).toBe('0.0600%');
    });

    it('falls back for non-finite values', () => {
      expect(formatPorcentaje(null)).toBe('—');
      expect(formatFraccionComoPorcentaje(undefined)).toBe('—');
    });
  });

  describe('negative zero', () => {
    it('renders -0 as 0, so tables do not show "-0"', () => {
      expect(formatCantidad(-0)).toBe('0');
      expect(formatMoneda(-0)).toBe('0.00');
      expect(formatMonedaConSigno(-0)).toBe('0.00');
    });
  });
});
