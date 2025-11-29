import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks for comprehensive testing
vi.mock('../../src/services/broker/client.js', () => ({
  default: { fetchInstruments: vi.fn() }
}));
vi.mock('../../src/services/brokerSession.js', () => ({
  default: { isAuthenticated: vi.fn(), tryRefresh: vi.fn() }
}));
vi.mock('../../src/services/instrumentsSyncStorage.js', () => ({
  default: { saveRecord: vi.fn(), readRecord: vi.fn() }
}));

import brokerClient from '../../src/services/broker/client.js';
import brokerSession from '../../src/services/brokerSession.js';
import storage from '../../src/services/instrumentsSyncStorage.js';
import syncService from '../../src/services/instrumentsSyncService.js';

describe('instrumentsSyncService - T012 comprehensive success scenarios', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('normalizes and dedups simple payload', () => {
    const raw = [
      { marketId: 'M1', symbol: 'AAA', maturityDate: '20250101' },
      { marketId: 'M1', symbol: 'AAA', maturityDate: '20250101' },
      { marketId: 'M2', symbol: 'BBB', maturityDate: '20250202' },
    ];
    const out = syncService.normalizeAndDedup(raw);
    expect(out.length).toBe(2);
    expect(out.find(i => i.instrumentId.symbol === 'AAA').maturityDate).toBe('2025-01-01');
  });

  it('deduplicates using marketId|symbol key (last wins)', () => {
    const raw = [
      { marketId: 'BYMA', symbol: 'GGAL', maturityDate: '20250301', cficode: 'OLD' },
      { marketId: 'BYMA', symbol: 'GGAL', maturityDate: '20250301', cficode: 'NEW' },
      { marketId: 'BYMA', symbol: 'PAMP', maturityDate: '20250401', cficode: 'XYZ' },
      { marketId: 'ROFX', symbol: 'GGAL', maturityDate: '20250301', cficode: 'ROFX_CODE' }, // different market, not a dup
    ];
    const out = syncService.normalizeAndDedup(raw);
    expect(out.length).toBe(3);
    const bymaGgal = out.find(i => i.instrumentId.marketId === 'BYMA' && i.instrumentId.symbol === 'GGAL');
    expect(bymaGgal.cficode).toBe('NEW'); // last entry wins
    const rofxGgal = out.find(i => i.instrumentId.marketId === 'ROFX' && i.instrumentId.symbol === 'GGAL');
    expect(rofxGgal.cficode).toBe('ROFX_CODE'); // different market key
  });

  it('normalizes maturityDate from YYYYMMDD to YYYY-MM-DD', () => {
    const raw = [{ marketId: 'M1', symbol: 'AAA', maturityDate: '20251225' }];
    const out = syncService.normalizeAndDedup(raw);
    expect(out[0].maturityDate).toBe('2025-12-25');
  });

  it('marks instrument incomplete when maturityDate is missing', () => {
    const raw = [{ marketId: 'M1', symbol: 'BBB', cficode: 'TEST' }];
    const out = syncService.normalizeAndDedup(raw);
    expect(out[0].incomplete).toBe(true);
    expect(out[0].issues).toContain('maturityDate: missing');
  });

  it('syncNow - authenticated flow saves normalized record with correct metadata', async () => {
    brokerSession.isAuthenticated.mockReturnValue(true);
    const remoteData = [
      { marketId: 'BYMA', symbol: 'GGAL', maturityDate: '20250630', cficode: 'ESXXXX' },
      { marketId: 'BYMA', symbol: 'PAMP', maturityDate: '20250731', cficode: 'OPXXXX' },
    ];
    brokerClient.fetchInstruments.mockResolvedValue(remoteData);
    storage.saveRecord.mockResolvedValue({ parts: 1, versionHash: 'abc123', sizeBytes: 512 });

    const res = await syncService.syncNow();
    
    expect(res.ok).toBe(true);
    expect(storage.saveRecord).toHaveBeenCalledTimes(1);
    
    const savedRecord = storage.saveRecord.mock.calls[0][0];
    expect(savedRecord.instruments).toHaveLength(2);
    expect(savedRecord.source).toBe('broker-api');
    expect(savedRecord.fetchedAt).toBeTruthy();
    // Validate ISO8601 timestamp format
    expect(new Date(savedRecord.fetchedAt).toISOString()).toBe(savedRecord.fetchedAt);
    
    // Verify normalized instruments
    expect(savedRecord.instruments[0].maturityDate).toBe('2025-06-30');
    expect(savedRecord.instruments[1].maturityDate).toBe('2025-07-31');
  });

  it('syncNow - returns proper metadata after save', async () => {
    brokerSession.isAuthenticated.mockReturnValue(true);
    brokerClient.fetchInstruments.mockResolvedValue([
      { marketId: 'M1', symbol: 'AAA', maturityDate: '20250101' },
    ]);
    const expectedMeta = { parts: 2, versionHash: 'hash456', sizeBytes: 1024 };
    storage.saveRecord.mockResolvedValue(expectedMeta);

    const res = await syncService.syncNow();
    
    expect(res.ok).toBe(true);
    expect(res.meta).toEqual(expectedMeta);
    expect(res.fallback).toBeUndefined();
  });

  it('syncNow - handles empty instruments list gracefully', async () => {
    brokerSession.isAuthenticated.mockReturnValue(true);
    brokerClient.fetchInstruments.mockResolvedValue([]);
    storage.saveRecord.mockResolvedValue({ parts: 0, versionHash: 'empty', sizeBytes: 0 });

    const res = await syncService.syncNow();
    
    expect(res.ok).toBe(true);
    const savedRecord = storage.saveRecord.mock.calls[0][0];
    expect(savedRecord.instruments).toHaveLength(0);
  });
});
