import { describe, it, expect } from 'vitest';
import { mapBrokerOperationToCsvRow } from '../../src/services/broker/convert-to-csv-model.js';
import { parseTenorDays } from '../../src/services/fees/repo-fees.js';

describe('Plazo and Repo Tenor Fix Verification', () => {
  it('should extract settlement/plazo from broker operations', () => {
    const operations = [
      {
        orderId: 'TEST-001',
        instrumentId: { symbol: 'MERV - XMEV - GFGC61558D - 24HS' },
        side: 'BUY',
        orderQty: 100,
        price: 50.5,
        transactTime: '20251021-10:00:00.000-0300',
        status: 'FILLED',
      },
      {
        orderId: 'TEST-002',
        instrumentId: { symbol: 'MERV - XMEV - GFGV35777D - CI' },
        side: 'SELL',
        orderQty: 50,
        price: 70.5,
        transactTime: '20251021-11:00:00.000-0300',
        status: 'FILLED',
      },
      {
        orderId: 'TEST-003',
        instrumentId: { symbol: 'MERV - XMEV - PESOS - 1D' },
        side: 'BUY',
        orderQty: 1000000,
        price: 25.5,
        transactTime: '20251021-12:00:00.000-0300',
        status: 'FILLED',
      },
      {
        orderId: 'TEST-004',
        instrumentId: { symbol: 'MERV - XMEV - DOLAR - 2D' },
        side: 'SELL',
        orderQty: 100000,
        price: 30.0,
        transactTime: '20251021-13:00:00.000-0300',
        status: 'FILLED',
      },
    ];

    const csvRows = operations.map(mapBrokerOperationToCsvRow);

    // Verify Options plazo extraction
    expect(csvRows[0].symbol).toBe('GFGC61558D');
    expect(csvRows[0].expiration).toBe('24HS');
    expect(csvRows[0].instrumentDisplayName).toBe('MERV - XMEV - GFGC61558D - 24HS');

    expect(csvRows[1].symbol).toBe('GFGV35777D');
    expect(csvRows[1].expiration).toBe('CI');
    expect(csvRows[1].instrumentDisplayName).toBe('MERV - XMEV - GFGV35777D - CI');

    // Verify Repo tenor preservation
    expect(csvRows[2].symbol).toBe('PESOS');
    expect(csvRows[2].expiration).toBe('1D');
    expect(csvRows[2].instrumentDisplayName).toBe('MERV - XMEV - PESOS - 1D');

    expect(csvRows[3].symbol).toBe('DOLAR');
    expect(csvRows[3].expiration).toBe('2D');
    expect(csvRows[3].instrumentDisplayName).toBe('MERV - XMEV - DOLAR - 2D');
  });

  it('should allow tenor extraction from instrumentDisplayName', () => {
    const repoDisplayNames = [
      'MERV - XMEV - PESOS - 1D',
      'MERV - XMEV - DOLAR - 2D',
      'MERV - XMEV - PESOS - 3D',
      'PESOS - 1D',
      'DOLAR - 7D',
    ];

    const tenors = repoDisplayNames.map(parseTenorDays);

    expect(tenors[0]).toBe(1);
    expect(tenors[1]).toBe(2);
    expect(tenors[2]).toBe(3);
    expect(tenors[3]).toBe(1);
    expect(tenors[4]).toBe(7);
  });

  it('should show that repos no longer have invalid tenor', () => {
    const repoOperation = {
      orderId: 'REPO-TEST',
      instrumentId: { symbol: 'MERV - XMEV - PESOS - 1D' },
      side: 'BUY',
      orderQty: 1000000,
      price: 25.5,
      transactTime: '20251021-12:00:00.000-0300',
      status: 'FILLED',
    };

    const csvRow = mapBrokerOperationToCsvRow(repoOperation);
    
    // The displayName should preserve full symbol for tenor extraction
    expect(csvRow.instrumentDisplayName).toContain('1D');
    
    // Tenor should be extractable
    const tenor = parseTenorDays(csvRow.instrumentDisplayName);
    expect(tenor).toBe(1);
    expect(tenor).toBeGreaterThan(0); // NOT INVALID!
  });
});
