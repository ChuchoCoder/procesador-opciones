import { describe, it, expect } from 'vitest';
import { validateEntries, trimMarketData } from '../parsers.js';

describe('parsers - validateEntries', () => {
  it('filters and canonicalizes entries', () => {
    const out = validateEntries(['bi', 'of', 'unknown', 'BI', null]);
    expect(out).toEqual(['BI', 'OF']);
  });
});

describe('parsers - trimMarketData', () => {
  it('trims marketData to requested entries and depth', () => {
    const md = {
      BI: [{ price: '100', size: '10', sequenceId: 's1' }, { price: '101', size: '5' }],
      OF: [{ price: '200', size: '1' }],
      LA: [{ price: '300', size: '2' }],
    };

    const { marketData, unsupported } = trimMarketData(md, ['bi', 'la'], 1);
    expect(Object.keys(marketData).sort()).toEqual(['BI', 'LA']);
    expect(marketData.BI.length).toBe(1);
    expect(marketData.BI[0].price).toBe('100' || 100);
    expect(unsupported).toEqual([]);
  });

  it('reports unsupported entries and ignores them', () => {
    const md = { BI: [{ price: 1, size: 1 }] };
    const { marketData, unsupported } = trimMarketData(md, ['tp', 'xx'], 2);
    expect(Object.keys(marketData)).toEqual(['TP']);
    expect(unsupported).toEqual(['XX']);
  });
});
