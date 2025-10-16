import { describe, it, expect, beforeEach, vi } from 'vitest';

const SAMPLE_INSTRUMENTS = [
  {
    InstrumentId: { symbol: 'TEST CALL' },
    CfiCode: 'OCAFXS',
  },
  {
    InstrumentId: { symbol: 'TEST PUT' },
    CfiCode: 'OPAFXS',
  },
];

describe('instrument-mapping option CFI patterns', () => {
  let resolveCfiCategory;
  let loadInstrumentMapping;

  beforeEach(async () => {
    vi.resetModules();
    const module = await import('../../src/services/fees/instrument-mapping.js');
    resolveCfiCategory = module.resolveCfiCategory;
    loadInstrumentMapping = module.loadInstrumentMapping;
    loadInstrumentMapping(SAMPLE_INSTRUMENTS);
  });

  it('treats OC-prefixed CFI codes (calls) as options', () => {
    expect(resolveCfiCategory('OCAFXS')).toBe('option');
  });

  it('treats OP-prefixed CFI codes (puts) as options', () => {
    expect(resolveCfiCategory('OPAFXS')).toBe('option');
  });
});
