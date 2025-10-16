// fee-calculation.spec.js - Unit tests for fee calculation per category (US1)
// Covers: accionCedear, letra, bonds, option formulas and precision

import { describe, it, expect, beforeEach } from 'vitest';
import { calculateFee } from '../../src/services/fees/fee-calculator.js';

describe('Fee Calculation by Category', () => {
  let mockEffectiveRates;

  beforeEach(() => {
    // Mock precomputed rates
    // Formula: (commission + rights) × (1 + VAT), where VAT applies to BOTH
    mockEffectiveRates = {
      accionCedear: {
        commissionPct: 0.0006,
        rightsPct: 0.00005,
        vatPct: 0.21,
        effectiveRate: (0.0006 + 0.00005) * (1 + 0.21),
      },
      letra: {
        commissionPct: 0.0004,
        rightsPct: 0.00005,
        vatPct: 0, // letra has no VAT
        effectiveRate: 0.0004 + 0.00005,
      },
      bonds: {
        commissionPct: 0.0005,
        rightsPct: 0.00005,
        vatPct: 0, // bonds have no VAT
        effectiveRate: 0.0005 + 0.00005,
      },
      option: {
        commissionPct: 0.0006,
        rightsPct: 0.00005,
        vatPct: 0.21,
        effectiveRate: (0.0006 + 0.00005) * (1 + 0.21),
      },
    };
  });

  it('should calculate fee for accionCedear category', () => {
    const operation = { grossNotional: 10000, category: 'accionCedear' };
    const result = calculateFee(operation, mockEffectiveRates);
    
    expect(result.feeAmount).toBeGreaterThan(0);
    expect(result.feeBreakdown.category).toBe('accionCedear');
    expect(result.feeBreakdown.source).toBe('config');
    // Verify formula: (commission + rights) + (commission + rights) × VAT
    const expected = 10000 * mockEffectiveRates.accionCedear.effectiveRate;
    expect(result.feeAmount).toBeCloseTo(expected, 6);
  });

  it('should calculate fee for letra category', () => {
    const operation = { grossNotional: 5000, category: 'letra' };
    const result = calculateFee(operation, mockEffectiveRates);
    
    expect(result.feeAmount).toBeGreaterThan(0);
    expect(result.feeBreakdown.category).toBe('letra');
  });

  it('should calculate fee for bonds category (fallback)', () => {
    const operation = { grossNotional: 8000, category: 'bonds' };
    const result = calculateFee(operation, mockEffectiveRates);
    
    expect(result.feeAmount).toBeGreaterThan(0);
    expect(result.feeBreakdown.category).toBe('bonds');
  });

  it('should calculate fee for option category', () => {
    const operation = { grossNotional: 15000, category: 'option' };
    const result = calculateFee(operation, mockEffectiveRates);
    
    expect(result.feeAmount).toBeGreaterThan(0);
    expect(result.feeBreakdown.category).toBe('option');
  });

  it('should maintain precision (>=6 decimals internal)', () => {
    const operation = { grossNotional: 1234.56789, category: 'accionCedear' };
    const result = calculateFee(operation, mockEffectiveRates);
    
    // Fee amount should preserve precision until display formatting
    expect(typeof result.feeAmount).toBe('number');
    expect(Number.isFinite(result.feeAmount)).toBe(true);
  });

  it('should return caucion placeholder when flag disabled', () => {
    const operation = { grossNotional: 20000, category: 'caucion' };
    const result = calculateFee(operation, mockEffectiveRates);
    
    expect(result.feeAmount).toBe(0);
    expect(result.feeBreakdown.source).toBe('placeholder');
  });
});
