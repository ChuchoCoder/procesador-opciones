// tooltip-breakdown.spec.js - Unit tests for tooltip breakdown data (US1)
// Verifies breakdown shape & formatting (2 decimals display)

import { describe, it, expect } from 'vitest';
import { calculateFee } from '../../src/services/fees/fee-calculator.js';

describe('Tooltip Breakdown Data', () => {
  const mockEffectiveRates = {
    option: {
      commissionPct: 0.0006,
      rightsPct: 0.00005,
      vatPct: 0.21,
      effectiveRate: (0.0006 + 0.00005) * (1 + 0.21),
    },
  };

  it('should return breakdown with all required fields', () => {
    const operation = { grossNotional: 12345.67, category: 'option' };
    const result = calculateFee(operation, mockEffectiveRates);
    
    const breakdown = result.feeBreakdown;
    expect(breakdown).toHaveProperty('commissionPct');
    expect(breakdown).toHaveProperty('rightsPct');
    expect(breakdown).toHaveProperty('vatPct');
    expect(breakdown).toHaveProperty('commissionAmount');
    expect(breakdown).toHaveProperty('rightsAmount');
    expect(breakdown).toHaveProperty('vatAmount');
    expect(breakdown).toHaveProperty('category');
    expect(breakdown).toHaveProperty('source');
  });

  it('should have numeric amounts ready for 2-decimal formatting', () => {
    const operation = { grossNotional: 10000, category: 'option' };
    const result = calculateFee(operation, mockEffectiveRates);
    
    const breakdown = result.feeBreakdown;
    expect(typeof breakdown.commissionAmount).toBe('number');
    expect(typeof breakdown.rightsAmount).toBe('number');
    expect(typeof breakdown.vatAmount).toBe('number');
    
    // Test display formatting (2 decimals)
    const commissionDisplay = breakdown.commissionAmount.toFixed(2);
    expect(commissionDisplay).toMatch(/^\d+\.\d{2}$/);
  });

  it('should preserve category and source metadata', () => {
    const operation = { grossNotional: 5000, category: 'accionCedear' };
    const rates = {
      accionCedear: {
        commissionPct: 0.0006,
        rightsPct: 0.00005,
        vatPct: 0.21,
        effectiveRate: 0.00065 * 1.21,
      },
    };
    
    const result = calculateFee(operation, rates);
    expect(result.feeBreakdown.category).toBe('accionCedear');
    expect(result.feeBreakdown.source).toBe('config');
  });
});
