// instrument-mapping-lifecycle.spec.js - the load/reset/read contract
/* eslint-env node, jest */
import { describe, it, expect, afterEach } from 'vitest';
import instrumentsData from '../../InstrumentsWithDetails.json';
import {
  loadInstrumentMapping,
  resetInstrumentMapping,
  isInstrumentMappingLoaded,
  getInstrumentDetails,
  resolveCfiCategory,
} from '../../src/services/fees/instrument-mapping.js';

const FIRST = [
  {
    InstrumentId: { symbol: 'FIRST SNAPSHOT ONLY' },
    CfiCode: 'ESXXXX',
    ContractMultiplier: 1,
    RoundLot: 1,
    PriceConvertionFactor: 1,
  },
];

const SECOND = [
  {
    InstrumentId: { symbol: 'SECOND SNAPSHOT ONLY' },
    CfiCode: 'DBXXXX',
    ContractMultiplier: 1,
    RoundLot: 1,
    PriceConvertionFactor: 0.01,
  },
];

describe('instrument mapping lifecycle', () => {
  afterEach(() => {
    // Restore the snapshot the suite bootstrap loads, for any spec after this one.
    loadInstrumentMapping(instrumentsData);
  });

  it('replaces the snapshot on every load, instead of keeping the first one', () => {
    loadInstrumentMapping(FIRST);
    expect(getInstrumentDetails('FIRST SNAPSHOT ONLY')).not.toBeNull();

    loadInstrumentMapping(SECOND);

    // The old silent no-op made the second load invisible, so a test handing
    // the module a fixture kept reading whatever had been loaded first.
    expect(getInstrumentDetails('SECOND SNAPSHOT ONLY')).not.toBeNull();
    expect(getInstrumentDetails('FIRST SNAPSHOT ONLY')).toBeNull();
  });

  it('reports whether a snapshot is loaded', () => {
    loadInstrumentMapping(FIRST);
    expect(isInstrumentMappingLoaded()).toBe(true);

    resetInstrumentMapping();
    expect(isInstrumentMappingLoaded()).toBe(false);
  });

  it('throws on reads before any load, rather than answering plausibly', () => {
    resetInstrumentMapping();

    // The previous behaviour was `null` / 'bonds' behind a console.warn, which
    // turned a bootstrap failure into silently wrong fees.
    expect(() => getInstrumentDetails('MERV - XMEV - GGAL - CI')).toThrow(/not loaded/);
    expect(() => resolveCfiCategory('ESXXXX')).toThrow(/not loaded/);
  });

  it('still answers null for a symbol the loaded snapshot does not carry', () => {
    loadInstrumentMapping(FIRST);

    // "Not in this snapshot" is a real answer and stays distinct from
    // "nothing is loaded".
    expect(getInstrumentDetails('NOT IN ANY SNAPSHOT 123')).toBeNull();
  });
});
