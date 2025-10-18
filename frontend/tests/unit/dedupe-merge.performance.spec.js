import { describe, it, expect } from 'vitest';
import { normalizeOperation, dedupeOperations, mergeBrokerBatch } from '../../src/services/broker/dedupe-utils.js';

describe('Dedupe & Merge Performance (T013)', () => {
  const generateSyntheticOps = (count) => {
    const ops = [];
    for (let i = 0; i < count; i++) {
      ops.push({
        order_id: `ORD-${i}`,
        operation_id: `OP-${i}`,
        symbol: i % 2 === 0 ? 'GGAL' : 'YPFD',
        optionType: 'call',
        action: 'buy',
        quantity: 10 + (i % 10),
        price: 100 + i * 0.1,
        tradeTimestamp: 1697000000000 + i * 1000,
        strike: 4500 + (i % 100),
        expirationDate: '2025-12-15',
      });
    }
    return ops;
  };

  it('should normalize 20k operations in <2s', () => {
    const raw = generateSyntheticOps(20000);
    const start = performance.now();
    
    const normalized = raw.map((op) => normalizeOperation(op, 'broker'));
    
    const duration = performance.now() - start;
    
    expect(normalized.length).toBe(20000);
    expect(duration).toBeLessThan(2000); // <2s
  });

  it('should dedupe 20k operations against 10k existing in <2s', () => {
    const existing = generateSyntheticOps(10000).map((op) => normalizeOperation(op, 'broker'));
    const incoming = generateSyntheticOps(20000).map((op) => normalizeOperation(op, 'broker'));
    
    const start = performance.now();
    
    const deduped = dedupeOperations(existing, incoming);
    
    const duration = performance.now() - start;
    
    expect(deduped.length).toBeGreaterThan(0); // 10k unique (last 10k of incoming)
    expect(duration).toBeLessThan(2000); // <2s
  });

  it('should merge 20k operations in <500ms', () => {
    const existing = generateSyntheticOps(5000).map((op) => normalizeOperation(op, 'broker'));
    const incoming = generateSyntheticOps(20000).slice(5000).map((op) => normalizeOperation(op, 'broker'));
    
    const start = performance.now();
    
    const result = mergeBrokerBatch(existing, incoming);
    
    const duration = performance.now() - start;
    
    expect(result.mergedOps.length).toBeGreaterThan(5000);
    expect(duration).toBeLessThan(500); // <500ms
  });
});
