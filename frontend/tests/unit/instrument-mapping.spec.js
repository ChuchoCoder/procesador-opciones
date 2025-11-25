/* eslint-env node, jest */
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
  {
    InstrumentId: { symbol: 'DLR/NOV25' },
    CfiCode: 'FXXXSX',
    ContractMultiplier: 1000,
  },
  {
    InstrumentId: { symbol: 'DLR/DIC25' },
    CfiCode: 'FXXXSX',
    ContractMultiplier: 1000,
  },
  {
    InstrumentId: { symbol: 'DLR/DIC25 1340 C' },
    CfiCode: 'OCEFXS', // Option call on futures
    ContractMultiplier: 1000,
  },
  {
    InstrumentId: { symbol: 'DLR/DIC25 1340 P' },
    CfiCode: 'OPEFXS', // Option put on futures
    ContractMultiplier: 1000,
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

  it('treats FXXXSX CFI codes as futures (not options)', () => {
    // FXXXSX is the CFI code for futures like DLR/NOV25, DLR/DIC25
    // They should NOT be classified as options
    const category = resolveCfiCategory('FXXXSX');
    expect(category).not.toBe('option');
    expect(category).toBe('bonds'); // Futures use default derivative fee structure
  });

  it('distinguishes between futures and options with similar symbols', () => {
    // DLR futures (no strike price)
    expect(resolveCfiCategory('FXXXSX')).toBe('bonds');
    
    // DLR options (with strike price: OCEFXS for calls, OPEFXS for puts)
    expect(resolveCfiCategory('OCEFXS')).toBe('option');
    expect(resolveCfiCategory('OPEFXS')).toBe('option');
  });
});
