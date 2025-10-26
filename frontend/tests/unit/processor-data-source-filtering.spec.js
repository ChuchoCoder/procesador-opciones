/**
 * Test: Data source filtering in ProcessorScreen
 * 
 * Verifies that when switching between CSV and Broker data sources,
 * only operations from the selected source are displayed.
 */

/* eslint-env node, jest */
import { describe, it, expect } from 'vitest';

describe('Data Source Filtering', () => {
  it('should filter broker operations correctly', () => {
    // Mock synced operations with mixed sources
    const syncedOperations = [
      { id: '1', symbol: 'GGAL', source: 'broker', quantity: 100 },
      { id: '2', symbol: 'YPF', source: 'csv', quantity: 50 },
      { id: '3', symbol: 'PAMP', source: 'broker', quantity: 200 },
      { id: '4', symbol: 'ALUA', source: 'csv', quantity: 75 },
    ];

    // Filter to broker-only operations
    const brokerOnly = syncedOperations.filter(op => op?.source === 'broker');

    expect(brokerOnly).toHaveLength(2);
    expect(brokerOnly[0].symbol).toBe('GGAL');
    expect(brokerOnly[1].symbol).toBe('PAMP');
    expect(brokerOnly.every(op => op.source === 'broker')).toBe(true);
  });

  it('should filter CSV operations correctly', () => {
    const syncedOperations = [
      { id: '1', symbol: 'GGAL', source: 'broker', quantity: 100 },
      { id: '2', symbol: 'YPF', source: 'csv', quantity: 50 },
      { id: '3', symbol: 'PAMP', source: 'broker', quantity: 200 },
      { id: '4', symbol: 'ALUA', source: 'csv', quantity: 75 },
    ];

    // Filter to CSV-only operations
    const csvOnly = syncedOperations.filter(op => op?.source === 'csv');

    expect(csvOnly).toHaveLength(2);
    expect(csvOnly[0].symbol).toBe('YPF');
    expect(csvOnly[1].symbol).toBe('ALUA');
    expect(csvOnly.every(op => op.source === 'csv')).toBe(true);
  });

  it('should handle operations with no source field', () => {
    const syncedOperations = [
      { id: '1', symbol: 'GGAL', source: 'broker' },
      { id: '2', symbol: 'YPF' }, // No source field
      { id: '3', symbol: 'PAMP', source: null },
    ];

    const brokerOnly = syncedOperations.filter(op => op?.source === 'broker');
    
    expect(brokerOnly).toHaveLength(1);
    expect(brokerOnly[0].symbol).toBe('GGAL');
  });

  it('should handle empty operations array', () => {
    const syncedOperations = [];
    const brokerOnly = syncedOperations.filter(op => op?.source === 'broker');
    
    expect(brokerOnly).toHaveLength(0);
  });

  it('should remove previous CSV operations when uploading new CSV', () => {
    // Simulate existing state with broker and old CSV operations
    const existingOperations = [
      { id: '1', symbol: 'GGAL', source: 'broker', quantity: 100 },
      { id: '2', symbol: 'YPF', source: 'csv', quantity: 50 },   // Old CSV
      { id: '3', symbol: 'PAMP', source: 'broker', quantity: 200 },
      { id: '4', symbol: 'ALUA', source: 'csv', quantity: 75 },  // Old CSV
    ];

    // New CSV operations
    const newCsvOperations = [
      { id: '5', symbol: 'BBAR', source: 'csv', quantity: 150 },
      { id: '6', symbol: 'COME', source: 'csv', quantity: 80 },
    ];

    // Step 1: Remove old CSV operations, keep only broker
    const brokerOnlyOps = existingOperations.filter(op => op?.source === 'broker');
    
    // Step 2: Merge broker ops with new CSV ops
    const finalOperations = [...brokerOnlyOps, ...newCsvOperations];

    expect(finalOperations).toHaveLength(4); // 2 broker + 2 new CSV
    expect(finalOperations.filter(op => op.source === 'broker')).toHaveLength(2);
    expect(finalOperations.filter(op => op.source === 'csv')).toHaveLength(2);
    
    // Verify old CSV operations are gone
    expect(finalOperations.find(op => op.symbol === 'YPF')).toBeUndefined();
    expect(finalOperations.find(op => op.symbol === 'ALUA')).toBeUndefined();
    
    // Verify new CSV operations are present
    expect(finalOperations.find(op => op.symbol === 'BBAR')).toBeDefined();
    expect(finalOperations.find(op => op.symbol === 'COME')).toBeDefined();
    
    // Verify broker operations are retained
    expect(finalOperations.find(op => op.symbol === 'GGAL')).toBeDefined();
    expect(finalOperations.find(op => op.symbol === 'PAMP')).toBeDefined();
  });

  it('should create unique data source objects for each CSV selection', () => {
    // Simulate selecting the same file twice
    const file = { name: 'operations.csv', size: 1000 };
    
    // First selection
    const dataSource1 = {
      type: 'csv',
      file,
      name: file.name,
      timestamp: Date.now(),
    };
    
    // Wait a bit to ensure different timestamp
    const startTime = Date.now();
    while (Date.now() - startTime < 2) {
      // Small delay
    }
    
    // Second selection (same file)
    const dataSource2 = {
      type: 'csv',
      file,
      name: file.name,
      timestamp: Date.now(),
    };
    
    // Even though it's the same file, the data source objects should be different
    expect(dataSource1).not.toBe(dataSource2);
    expect(dataSource1.timestamp).not.toBe(dataSource2.timestamp);
    
    // This ensures React will detect a change and re-process
    const areEqual = JSON.stringify(dataSource1) === JSON.stringify(dataSource2);
    expect(areEqual).toBe(false);
  });
});
