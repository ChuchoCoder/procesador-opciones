/* eslint-env node, jest */
import { describe, it, expect, beforeEach } from 'vitest';
import Papa from 'papaparse';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadInstrumentMapping, resolveCfiCategory, getInstrumentDetails } from '../../src/services/fees/instrument-mapping.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('DLR Futures Misclassification Issue', () => {
  let instrumentsData;
  let csvData;

  beforeEach(() => {
    // Load instruments data
    const instrumentsPath = join(__dirname, '../../InstrumentsWithDetails.json');
    instrumentsData = JSON.parse(readFileSync(instrumentsPath, 'utf-8'));
    loadInstrumentMapping(instrumentsData);

    // Load CSV with DLR futures operations
    const csvPath = join(__dirname, 'data/ReporteOperaciones_17825-2025-11-25.csv');
    const csvContent = readFileSync(csvPath, 'utf-8');
    const parseResult = Papa.parse(csvContent, { header: true });
    csvData = parseResult.data;
  });

  it('should correctly identify DLR/NOV25 as a future, not an option', () => {
    // Find DLR/NOV25 operations in CSV
    const dlrNov25Ops = csvData.filter(row => row.symbol === 'DLR/NOV25');
    
    expect(dlrNov25Ops.length).toBeGreaterThan(0);
    
    // Get instrument details from mapping
    const details = getInstrumentDetails('DLR/NOV25');
    
    expect(details).not.toBeNull();
    expect(details.cfiCode).toBe('FXXXSX'); // Futures CFI code
    
    // Verify it's categorized as a future/derivative, NOT an option
    const category = resolveCfiCategory('FXXXSX');
    expect(category).not.toBe('option');
    // Futures should be categorized as 'bonds' (default derivatives) or have their own 'future' category
  });

  it('should correctly identify DLR/DIC25 as a future, not an option', () => {
    // Find DLR/DIC25 operations in CSV
    const dlrDic25Ops = csvData.filter(row => row.symbol === 'DLR/DIC25');
    
    expect(dlrDic25Ops.length).toBeGreaterThan(0);
    
    // Get instrument details from mapping
    const details = getInstrumentDetails('DLR/DIC25');
    
    expect(details).not.toBeNull();
    expect(details.cfiCode).toBe('FXXXSX'); // Futures CFI code
    
    // Verify it's categorized correctly
    const category = resolveCfiCategory('FXXXSX');
    expect(category).not.toBe('option');
  });

  it('should distinguish DLR futures from DLR options', () => {
    // DLR/DIC25 is a future
    const futureDetails = getInstrumentDetails('DLR/DIC25');
    expect(futureDetails).not.toBeNull();
    expect(futureDetails.cfiCode).toBe('FXXXSX');
    
    // DLR/DIC25 1340 C is an option (call)
    const optionCallDetails = getInstrumentDetails('DLR/DIC25 1340 C');
    expect(optionCallDetails).not.toBeNull();
    expect(optionCallDetails.cfiCode).toBe('OCEFXS'); // Option call CFI code
    
    // DLR/DIC25 1340 P is an option (put)
    const optionPutDetails = getInstrumentDetails('DLR/DIC25 1340 P');
    expect(optionPutDetails).not.toBeNull();
    expect(optionPutDetails.cfiCode).toBe('OPEFXS'); // Option put CFI code
    
    // Verify categories are different
    const futureCategory = resolveCfiCategory(futureDetails.cfiCode);
    const optionCallCategory = resolveCfiCategory(optionCallDetails.cfiCode);
    const optionPutCategory = resolveCfiCategory(optionPutDetails.cfiCode);
    
    expect(futureCategory).not.toBe('option');
    expect(optionCallCategory).toBe('option');
    expect(optionPutCategory).toBe('option');
  });

  it('should load DLR futures with correct contract multipliers', () => {
    const dlrNov25 = getInstrumentDetails('DLR/NOV25');
    const dlrDic25 = getInstrumentDetails('DLR/DIC25');
    
    // Both should have ContractMultiplier of 1000 (from JSON)
    expect(dlrNov25.contractMultiplier).toBe(1000);
    expect(dlrDic25.contractMultiplier).toBe(1000);
  });

  it('should process CSV operations with correct instrument classification', () => {
    const operations = csvData.filter(row => 
      row.symbol === 'DLR/NOV25' || row.symbol === 'DLR/DIC25'
    );
    
    operations.forEach(op => {
      const details = getInstrumentDetails(op.symbol);
      expect(details).not.toBeNull();
      expect(details.cfiCode).toBe('FXXXSX');
      
      const category = resolveCfiCategory(details.cfiCode);
      expect(category).not.toBe('option');
    });
  });

  it('should verify FXXXSX CFI code pattern is recognized', () => {
    // FXXXSX is the CFI code for futures
    // It should NOT match the option pattern /^O[CP]/
    const category = resolveCfiCategory('FXXXSX');
    
    // Should not be classified as option
    expect(category).not.toBe('option');
    
    // Should be classified as bonds (default for derivatives) or ideally 'future'
    expect(['bonds', 'future']).toContain(category);
  });

  it('should not classify DLR futures as CALL or PUT when processing operations', async () => {
    // Import the enrichOperationRow function that determines operation type
    const { enrichOperationRow } = await import('../../src/services/csv/process-operations.js');
    
    // Test DLR/NOV25 row
    const dlrNov25Row = csvData.find(row => row.symbol === 'DLR/NOV25');
    expect(dlrNov25Row).toBeDefined();
    
    const enrichedNov25 = await enrichOperationRow(dlrNov25Row);
    
    // The type should NOT be CALL or PUT
    expect(enrichedNov25.type).not.toBe('CALL');
    expect(enrichedNov25.type).not.toBe('PUT');
    expect(enrichedNov25.type).toBe('UNKNOWN'); // Futures don't have a type
    
    // Test DLR/DIC25 row - this one is particularly problematic because "DIC25" contains "C25"
    const dlrDic25Row = csvData.find(row => row.symbol === 'DLR/DIC25');
    expect(dlrDic25Row).toBeDefined();
    
    const enrichedDic25 = await enrichOperationRow(dlrDic25Row);
    
    // The type should NOT be CALL (even though "DIC25" could be parsed as "DI" + "C" + "25")
    expect(enrichedDic25.type).not.toBe('CALL');
    expect(enrichedDic25.type).not.toBe('PUT');
    expect(enrichedDic25.type).toBe('UNKNOWN'); // Futures don't have a type
  });
});
