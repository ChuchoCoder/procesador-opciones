/**
 * Integration test for GGAL-PUTS.csv with October expiration decimal configuration
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { saveSymbolConfig } from '../../src/services/storage-settings.js';
import { syncSettingsToPrefixRules } from '../../src/services/settings-bridge.js';
import { processOperations } from '../../src/services/csv/process-operations.js';
import { readItem, storageKeys } from '../../src/services/storage/local-storage.js';
import ggalPutsCsv from '../integration/data/GGAL-PUTS.csv?raw';
import Papa from 'papaparse';

describe('GGAL October Expiration Decimal Configuration', () => {
  let csvRows;

  beforeEach(() => {
    localStorage.clear();
    
    // Parse CSV data
    const parsed = Papa.parse(ggalPutsCsv, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false, // Keep as strings for now
    });
    csvRows = parsed.data;
  });

  it('should apply 1 decimal place for GFGV47343O options in October', async () => {
    // Step 1: Configure GGAL with GFG prefix
    const ggalConfig = {
      symbol: 'GGAL',
      prefixes: ['GFG'],
      strikeDefaultDecimals: 0, // Symbol default: 0 decimals
      expirations: {
        OCT: {
          suffixes: ['O'],
          decimals: 1, // October override: 1 decimal
          overrides: [],
        },
      },
      updatedAt: Date.now(),
    };

    await saveSymbolConfig(ggalConfig);
    
    // Step 2: Sync to processor format
    syncSettingsToPrefixRules();

    // Step 3: Verify prefix rules were created
    const prefixRules = readItem(storageKeys.prefixRules);
    expect(prefixRules.GFG).toBeDefined();
    expect(prefixRules.GFG.expirationOverrides.OCT.defaultDecimals).toBe(1);

    // Step 4: Process the CSV rows
    const result = await processOperations({
      rows: csvRows,
      configuration: {
        symbols: ['GGAL'],
        activeSymbol: 'GGAL',
        activeExpiration: 'OCT',
        useAveraging: false,
      },
      fileName: 'GGAL-PUTS.csv',
    });

    // Step 5: Find GFGV47343O operations in puts
    const gfgOperations = result.puts.operations.filter(
      op => op.symbol && op.symbol.includes('GFGV47343O')
    );

    expect(gfgOperations.length).toBeGreaterThan(0);

    // Step 6: Verify strike formatting uses 1 decimal
    gfgOperations.forEach(op => {
      expect(op.symbol).toBe('GGAL');
      expect(op.strike).toBe('4734.3'); // Should be formatted with 1 decimal
      expect(op.expiration).toBe('O');
      expect(op.optionType).toBe('PUT');
    });

    console.log(`✓ Processed ${gfgOperations.length} GFGV47343O operations`);
    console.log(`✓ All strikes formatted as: ${gfgOperations[0].strike}`);
  });

  it('should use symbol default when expiration is not configured', async () => {
    // Configure GGAL without October expiration override
    const ggalConfig = {
      symbol: 'GGAL',
      prefixes: ['GFG'],
      strikeDefaultDecimals: 0,
      expirations: {},
      updatedAt: Date.now(),
    };

    await saveSymbolConfig(ggalConfig);
    syncSettingsToPrefixRules();

    const prefixRules = readItem(storageKeys.prefixRules);
    
    const result = await processOperations({
      rows: csvRows,
      configuration: {
        symbols: ['GGAL'],
        activeSymbol: 'GGAL',
        activeExpiration: 'OCT',
        useAveraging: false,
      },
      fileName: 'GGAL-PUTS.csv',
    });

    const gfgOperations = result.puts.operations.filter(
      op => op.symbol && op.symbol.includes('GFGV47343O')
    );

    // Without expiration override, should use symbol default (0 decimals)
    gfgOperations.forEach(op => {
      expect(op.strike).toBe('47343'); // No decimal places
    });
  });
});
