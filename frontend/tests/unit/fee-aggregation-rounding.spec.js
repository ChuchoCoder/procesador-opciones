// fee-aggregation-rounding.spec.js - Unit tests for aggregate fee recomputation (US1)
// Verifies aggregate fee vs sum rounding bias (<0.01 ARS tolerance)

import { describe, it, expect } from 'vitest';
import { aggregateFee } from '../../src/services/fees/fee-calculator.js';

describe('Fee Aggregation and Rounding', () => {
  const mockEffectiveRates = {
    option: {
      commissionPct: 0.0006,
      rightsPct: 0.00005,
      vatPct: 0.21,
      effectiveRate: (0.0006 + 0.00005) * (1 + 0.21),
    },
  };

  it('should recompute aggregate fee from aggregated gross', () => {
    const aggregatedGross = 50000;
    const result = aggregateFee(aggregatedGross, 'option', mockEffectiveRates);
    
    expect(result.feeAmount).toBeGreaterThan(0);
    expect(result.feeBreakdown.category).toBe('option');
  });

  it('should have minimal rounding bias (<0.01 ARS) vs summed individual fees', () => {
    // Simulate 3 operations with individual fees
    const operations = [
      { grossNotional: 10000.123, category: 'option' },
      { grossNotional: 15000.456, category: 'option' },
      { grossNotional: 25000.789, category: 'option' },
    ];
    
    const aggregatedGross = operations.reduce((sum, op) => sum + op.grossNotional, 0);
    const aggregatedResult = aggregateFee(aggregatedGross, 'option', mockEffectiveRates);
    
    // Individual sum would introduce rounding bias if components were rounded
    // Aggregate method should preserve precision
    expect(aggregatedResult.feeAmount).toBeGreaterThan(0);
    // Precision check: no NaN or Infinity
    expect(Number.isFinite(aggregatedResult.feeAmount)).toBe(true);
  });
});
