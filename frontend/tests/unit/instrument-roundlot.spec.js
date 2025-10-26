// instrument-roundlot.spec.js - Test RoundLot usage for options
/* eslint-env node, jest */
import { describe, it, expect, beforeEach } from 'vitest';
import { loadInstrumentMapping, getInstrumentDetails } from '../../src/services/fees/instrument-mapping.js';

describe('instrument mapping with RoundLot', () => {
  beforeEach(() => {
    // Reset module state
    const instrumentsData = [
      {
        InstrumentId: { marketId: 'ROFX', symbol: 'MERV - XMEV - GFGC50131O - 24hs' },
        CfiCode: 'OCASPS',
        ContractMultiplier: 1.0,
        RoundLot: 100.0,
        PriceConvertionFactor: 1.0,
      },
      {
        InstrumentId: { marketId: 'ROFX', symbol: 'GGAL/OCT25' },
        CfiCode: 'FXXXSX',
        ContractMultiplier: 100.0,
        RoundLot: 1.0,
        PriceConvertionFactor: 1.0,
      },
      {
        InstrumentId: { marketId: 'ROFX', symbol: 'MERV - XMEV - GGAL - CI' },
        CfiCode: 'ESVUFR',
        ContractMultiplier: 1.0,
        RoundLot: 1.0,
        PriceConvertionFactor: 1.0,
      },
    ];
    
    loadInstrumentMapping(instrumentsData);
  });

  it('should use RoundLot as contractMultiplier when ContractMultiplier is 1', () => {
    const details = getInstrumentDetails('MERV - XMEV - GFGC50131O - 24hs');
    
    expect(details).not.toBeNull();
    expect(details.contractMultiplier).toBe(100.0); // Should use RoundLot (100) not ContractMultiplier (1)
    expect(details.cfiCode).toBe('OCASPS');
  });

  it('should use ContractMultiplier when it is not 1', () => {
    const details = getInstrumentDetails('GGAL/OCT25');
    
    expect(details).not.toBeNull();
    expect(details.contractMultiplier).toBe(100.0); // Should use ContractMultiplier (100)
    expect(details.cfiCode).toBe('FXXXSX');
  });

  it('should find instrument by partial symbol match (tokenized symbol)', () => {
    // CSV might have "GFGC50131O" but JSON has "MERV - XMEV - GFGC50131O - 24hs"
    const details = getInstrumentDetails('GFGC50131O');
    
    expect(details).not.toBeNull();
    expect(details.contractMultiplier).toBe(100.0);
    expect(details.cfiCode).toBe('OCASPS');
  });

  it('should prefer exact match over partial match', () => {
    const details = getInstrumentDetails('MERV - XMEV - GGAL - CI');
    
    expect(details).not.toBeNull();
    expect(details.contractMultiplier).toBe(1.0);
    expect(details.cfiCode).toBe('ESXXXX');
  });

  it('should return null when no match found', () => {
    const details = getInstrumentDetails('NONEXISTENT123');
    
    expect(details).toBeNull();
  });

  it('should handle empty or null symbol gracefully', () => {
    expect(getInstrumentDetails('')).toBeNull();
    expect(getInstrumentDetails(null)).toBeNull();
  });
});
