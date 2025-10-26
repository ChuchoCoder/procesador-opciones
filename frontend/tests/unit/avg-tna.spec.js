/* eslint-env node, jest */
import { describe, it, expect } from 'vitest';
import { calculateAvgTNAByCurrency } from '../../src/services/data-aggregation.js';

describe('calculateAvgTNAByCurrency', () => {
  it('returns empty object for null/undefined or empty list', () => {
    expect(calculateAvgTNAByCurrency(null)).toEqual({});
    expect(calculateAvgTNAByCurrency(undefined)).toEqual({});
    expect(calculateAvgTNAByCurrency([])).toEqual({});
  });

  it('computes weighted average for single currency', () => {
    const cauciones = [
      { currency: 'ARS', monto: 1000, tasa: 80 },
      { currency: 'ARS', monto: 500, tasa: 100 },
    ];
    const avg = calculateAvgTNAByCurrency(cauciones);
    // Weighted average = (1000*80 + 500*100) / 1500 = (80000 + 50000) / 1500 = 130000/1500 = 86.666...
    expect(avg.ARS).toBeCloseTo(86.6666666, 6);
  });

  it('handles multiple currencies and normalizes codes', () => {
    const cauciones = [
      { currency: 'ars', monto: 1000, tasa: 80 },
      { currency: 'USD', monto: 200, tasa: 10 },
      { currency: 'Usd', monto: 300, tasa: 12 },
      { currency: null, monto: 0, tasa: 0 },
    ];
    const avg = calculateAvgTNAByCurrency(cauciones);
    expect(avg.ARS).toBeCloseTo(80, 6);
    // USD weighted average = (200*10 + 300*12) / 500 = (2000 + 3600) / 500 = 5600/500 = 11.2
    expect(avg.USD).toBeCloseTo(11.2, 6);
    // Null currency fallback to 'ARS' is not applied here because null converted to 'ARS' in implementation
    // (implementation uses (c.currency || 'ARS').toUpperCase()) so there's an implicit mapping; ensure key exists
    expect(typeof avg.ARS).toBe('number');
  });

  it('returns 0 for currencies with totalMonto 0', () => {
    const cauciones = [
      { currency: 'ARS', monto: 0, tasa: 100 },
      { currency: 'USD', monto: 0, tasa: 50 },
    ];
    const avg = calculateAvgTNAByCurrency(cauciones);
    expect(avg.ARS).toBe(0);
    expect(avg.USD).toBe(0);
  });
});
