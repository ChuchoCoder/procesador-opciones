// fee-benchmark.spec.js - Performance harness for fee calculation (T013)
// Generates synthetic 10k rows, measures computation time (<8s target for 50k)

import { describe, it, expect } from 'vitest';
import { calculateFee } from '../../src/services/fees/fee-calculator.js';

describe('Fee Calculation Performance', () => {
  const mockEffectiveRates = {
    option: {
      commissionPct: 0.0006,
      rightsPct: 0.00005,
      vatPct: 0.21,
      effectiveRate: (0.0006 + 0.00005) * (1 + 0.21),
    },
    bonds: {
      commissionPct: 0.0005,
      rightsPct: 0.00005,
      vatPct: 0, // bonds have no VAT
      effectiveRate: 0.0005 + 0.00005,
    },
  };

  it('should process 10k operations in reasonable time', () => {
    const operations = [];
    for (let i = 0; i < 10000; i++) {
      operations.push({
        grossNotional: Math.random() * 50000 + 1000,
        category: i % 2 === 0 ? 'option' : 'bonds',
      });
    }

    const startTime = performance.now();
    for (const op of operations) {
      calculateFee(op, mockEffectiveRates);
    }
    const endTime = performance.now();
    const elapsed = endTime - startTime;

     
    console.info(`PO: fee-benchmark-10k elapsed: ${elapsed.toFixed(2)}ms`);
    
    // Target: <8s for 50k => ~1.6s for 10k as rough guideline
    expect(elapsed).toBeLessThan(2000); // 2 seconds for 10k operations
  });

  it.todo('should process 50k operations under 8s (full target)');
});
