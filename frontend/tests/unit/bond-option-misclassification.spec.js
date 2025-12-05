/* eslint-env node, jest */
/**
 * Tests for bond/non-option misclassification prevention.
 * 
 * Issue: Instruments like AL30C are bonds (CFI: DBXXXX) but could be misclassified
 * as options because their symbol pattern superficially matches the option regex
 * (e.g., AL30 + C might look like [PREFIX][CALL][STRIKE]).
 * 
 * Solution: Use CFI Code from InstrumentsWithDetails.json as the authoritative source.
 * If an instrument is found with a non-option CFI code, reject the regex-based detection.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Sample instruments including bonds that could be misclassified
const SAMPLE_INSTRUMENTS = [
  // AL30C is a bond (CFI: DBXXXX), NOT an option
  {
    InstrumentId: { symbol: 'MERV - XMEV - AL30C - 24hs' },
    CfiCode: 'DBXXXX',
    ContractMultiplier: 1.0,
  },
  {
    InstrumentId: { symbol: 'MERV - XMEV - AL30C - CI' },
    CfiCode: 'DBXXXX',
    ContractMultiplier: 1.0,
  },
  // AL30D is also a bond
  {
    InstrumentId: { symbol: 'MERV - XMEV - AL30D - 24hs' },
    CfiCode: 'DBXXXX',
    ContractMultiplier: 1.0,
  },
  // GD30C is another bond that could be misclassified
  {
    InstrumentId: { symbol: 'MERV - XMEV - GD30C - 24hs' },
    CfiCode: 'DBXXXX',
    ContractMultiplier: 1.0,
  },
  // Actual option for comparison
  {
    InstrumentId: { symbol: 'MERV - XMEV - GFGC50131O - 24hs' },
    CfiCode: 'OCASPS',
    ContractMultiplier: 100.0,
  },
  // GGAL stock (equity, not option)
  {
    InstrumentId: { symbol: 'MERV - XMEV - GGAL - CI' },
    CfiCode: 'ESXXXX',
    ContractMultiplier: 1.0,
  },
];

describe('Bond misclassification prevention', () => {
  let enrichOperationRow;
  let loadInstrumentMapping;
  let getInstrumentDetails;
  let resolveCfiCategory;

  beforeEach(async () => {
    vi.resetModules();
    
    // Load instrument mapping module
    const mappingModule = await import('../../src/services/fees/instrument-mapping.js');
    loadInstrumentMapping = mappingModule.loadInstrumentMapping;
    getInstrumentDetails = mappingModule.getInstrumentDetails;
    resolveCfiCategory = mappingModule.resolveCfiCategory;
    
    // Initialize mapping with test instruments
    loadInstrumentMapping(SAMPLE_INSTRUMENTS);
    
    // Load process-operations (must be after mapping is loaded)
    const processModule = await import('../../src/services/csv/process-operations.js');
    enrichOperationRow = processModule.enrichOperationRow;
  });

  describe('AL30C bond detection', () => {
    it('should NOT classify AL30C as an option (it is a bond with CFI DBXXXX)', async () => {
      // Verify instrument mapping recognizes AL30C as a bond
      const details = getInstrumentDetails('MERV - XMEV - AL30C - 24hs');
      expect(details).not.toBeNull();
      expect(details.cfiCode).toBe('DBXXXX');
      // DBXXXX is classified as bonds (D-prefix instruments that aren't DT/DY/DB are bonds)
      // The important thing is it's NOT classified as 'option'
      expect(resolveCfiCategory('DBXXXX')).not.toBe('option');
    });

    it('should NOT detect option type from AL30C symbol pattern', async () => {
      const row = {
        order_id: 'TEST-001',
        symbol: 'MERV - XMEV - AL30C - 24hs',
        side: 'BUY',
        quantity: 1000,
        price: 58.35,
      };

      const result = await enrichOperationRow(row, { prefixMap: {} });

      // Should NOT be classified as CALL even though symbol contains 'C'
      expect(result.type).toBe('UNKNOWN');
      // Should preserve the symbol properly
      expect(result.symbol).toContain('AL30');
    });

    it('should NOT detect option type from AL30D symbol pattern', async () => {
      const row = {
        order_id: 'TEST-002',
        symbol: 'MERV - XMEV - AL30D - CI',
        side: 'SELL',
        quantity: 500,
        price: 60.44,
      };

      const result = await enrichOperationRow(row, { prefixMap: {} });

      // Should NOT be classified as an option
      expect(result.type).toBe('UNKNOWN');
    });
  });

  describe('GD30C bond detection', () => {
    it('should NOT classify GD30C as an option (it is a bond)', async () => {
      const row = {
        order_id: 'TEST-003',
        symbol: 'MERV - XMEV - GD30C - 24hs',
        side: 'BUY',
        quantity: 100,
        price: 45.50,
      };

      const result = await enrichOperationRow(row, { prefixMap: {} });

      // Should NOT be classified as CALL
      expect(result.type).toBe('UNKNOWN');
    });
  });

  describe('Actual options should still be detected', () => {
    it('should correctly classify actual options with valid CFI codes', async () => {
      const details = getInstrumentDetails('MERV - XMEV - GFGC50131O - 24hs');
      expect(details).not.toBeNull();
      expect(details.cfiCode).toBe('OCASPS');
      expect(resolveCfiCategory('OCASPS')).toBe('option');
    });
  });

  describe('Equities should NOT be classified as options', () => {
    it('should NOT classify GGAL stock as an option', async () => {
      const row = {
        order_id: 'TEST-004',
        symbol: 'MERV - XMEV - GGAL - CI',
        side: 'BUY',
        quantity: 100,
        price: 450.00,
      };

      const result = await enrichOperationRow(row, { prefixMap: {} });

      // Should NOT be classified as an option
      expect(result.type).toBe('UNKNOWN');
    });
  });
});

describe('CFI-based option detection edge cases', () => {
  let enrichOperationRow;
  let loadInstrumentMapping;

  beforeEach(async () => {
    vi.resetModules();
    
    const mappingModule = await import('../../src/services/fees/instrument-mapping.js');
    loadInstrumentMapping = mappingModule.loadInstrumentMapping;
    loadInstrumentMapping(SAMPLE_INSTRUMENTS);
    
    const processModule = await import('../../src/services/csv/process-operations.js');
    enrichOperationRow = processModule.enrichOperationRow;
  });

  it('should NOT classify unknown instruments as options (no CFI available)', async () => {
    // Instrument not in the mapping
    const row = {
      order_id: 'TEST-005',
      symbol: 'UNKNOWN_INSTRUMENT',
      security_id: 'UNKC100.DIC',  // Pattern could match option regex
      side: 'BUY',
      quantity: 10,
      price: 100,
    };

    const result = await enrichOperationRow(row, { prefixMap: {} });

    // Should NOT be classified as an option when CFI is unavailable
    // This is the strict behavior - require CFI confirmation
    expect(result.type).toBe('UNKNOWN');
  });
});
