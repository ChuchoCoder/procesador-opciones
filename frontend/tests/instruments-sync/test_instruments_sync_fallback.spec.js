import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mocks
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

describe('instrumentsSyncService - T013 fallback scenarios', () => {
  let originalFetch;

  beforeEach(() => {
    vi.resetAllMocks();
    originalFetch = global.fetch;
  });

  afterEach(() => {
    if (originalFetch !== undefined) {
      global.fetch = originalFetch;
    } else {
      delete global.fetch;
    }
  });

  it('syncNow - unauthenticated uses fallback file when available', async () => {
    brokerSession.isAuthenticated.mockReturnValue(false);
    
    // Mock fetch to return fallback JSON
    const fallbackData = {
      instruments: [
        { marketId: 'BYMA', symbol: 'FALLBACK1', maturityDate: '20251201', cficode: 'FB01' },
        { marketId: 'BYMA', symbol: 'FALLBACK2', maturityDate: '20251215', cficode: 'FB02' },
      ]
    };
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve(fallbackData)
    }));
    
    storage.saveRecord.mockResolvedValue({ parts: 1, versionHash: 'fallback-hash', sizeBytes: 256 });

    const res = await syncService.syncNow();

    expect(res.ok).toBe(true);
    expect(res.fallback).toBe(true);
    expect(storage.saveRecord).toHaveBeenCalledTimes(1);
    
    const savedRecord = storage.saveRecord.mock.calls[0][0];
    expect(savedRecord.source).toBe('fallback-file');
    expect(savedRecord.instruments).toHaveLength(2);
    expect(savedRecord.instruments[0].maturityDate).toBe('2025-12-01'); // normalized
    expect(savedRecord.instruments[1].maturityDate).toBe('2025-12-15');
  });

  it('syncNow - unauthenticated returns error when fallback file unavailable', async () => {
    brokerSession.isAuthenticated.mockReturnValue(false);
    
    // Mock fetch to fail
    global.fetch = vi.fn(() => Promise.resolve({
      ok: false,
      status: 404
    }));

    const res = await syncService.syncNow();

    expect(res.ok).toBe(false);
    expect(res.reason).toBe('not-authenticated');
    expect(storage.saveRecord).not.toHaveBeenCalled();
  });

  it('syncNow - unauthenticated handles fallback fetch error gracefully', async () => {
    brokerSession.isAuthenticated.mockReturnValue(false);
    
    // Mock fetch to throw error
    global.fetch = vi.fn(() => Promise.reject(new Error('Network error')));

    const res = await syncService.syncNow();

    expect(res.ok).toBe(false);
    expect(res.reason).toBe('not-authenticated');
    expect(storage.saveRecord).not.toHaveBeenCalled();
  });

  it('syncNow - fallback normalizes and dedups instruments correctly', async () => {
    brokerSession.isAuthenticated.mockReturnValue(false);
    
    // Mock fallback with duplicates
    const fallbackData = {
      instruments: [
        { marketId: 'BYMA', symbol: 'DUP', maturityDate: '20250101', cficode: 'OLD' },
        { marketId: 'BYMA', symbol: 'DUP', maturityDate: '20250101', cficode: 'NEW' },
        { marketId: 'ROFX', symbol: 'UNIQUE', maturityDate: '20250202', cficode: 'UNQ' },
      ]
    };
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve(fallbackData)
    }));
    
    storage.saveRecord.mockResolvedValue({ parts: 1, versionHash: 'dedup-hash', sizeBytes: 128 });

    const res = await syncService.syncNow();

    expect(res.ok).toBe(true);
    const savedRecord = storage.saveRecord.mock.calls[0][0];
    expect(savedRecord.instruments).toHaveLength(2); // deduped
    const dupInstrument = savedRecord.instruments.find(i => i.instrumentId.symbol === 'DUP');
    expect(dupInstrument.cficode).toBe('NEW'); // last wins
  });

  it('syncNow - fallback handles instruments array directly (no wrapper object)', async () => {
    brokerSession.isAuthenticated.mockReturnValue(false);
    
    // Mock fallback as direct array (alternative format)
    const fallbackData = [
      { marketId: 'BYMA', symbol: 'DIRECT1', maturityDate: '20250301', cficode: 'D1' },
    ];
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve(fallbackData)
    }));
    
    storage.saveRecord.mockResolvedValue({ parts: 1, versionHash: 'direct-hash', sizeBytes: 64 });

    const res = await syncService.syncNow();

    expect(res.ok).toBe(true);
    const savedRecord = storage.saveRecord.mock.calls[0][0];
    expect(savedRecord.instruments).toHaveLength(1);
    expect(savedRecord.instruments[0].instrumentId.symbol).toBe('DIRECT1');
  });

  it('syncNow - authenticated broker fetch failure returns error', async () => {
    brokerSession.isAuthenticated.mockReturnValue(true);
    brokerClient.fetchInstruments.mockRejectedValue(new Error('API timeout'));

    const res = await syncService.syncNow();

    expect(res.ok).toBe(false);
    expect(res.reason).toBeTruthy();
    expect(storage.saveRecord).not.toHaveBeenCalled();
  }, 20000); // Increase timeout to 20s to accommodate full retry backoff with jitter variance

  it('fetchInstruments - returns empty array when not authenticated', async () => {
    brokerSession.isAuthenticated.mockReturnValue(false);

    const result = await syncService.fetchInstruments();

    expect(result).toEqual([]);
    expect(brokerClient.fetchInstruments).not.toHaveBeenCalled();
  });
});
