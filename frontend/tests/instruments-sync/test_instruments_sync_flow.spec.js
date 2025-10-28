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

describe('instruments sync flow', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('syncNow - authenticated flow saves normalized record', async () => {
  brokerSession.isAuthenticated.mockReturnValue(true);
  const remote = [ { marketId: 'M1', symbol: 'AAA', maturityDate: '20250101' } ];
  brokerClient.fetchInstruments.mockResolvedValue(remote);
  storage.saveRecord.mockResolvedValue({ parts: 1, versionHash: 'abc' });

    const res = await syncService.syncNow();
    expect(res.ok).toBe(true);
  expect(storage.saveRecord).toHaveBeenCalled();
  const saved = storage.saveRecord.mock.calls[0][0];
    expect(saved.instruments).toHaveLength(1);
    expect(saved.source).toBe('broker-api');
  });

  it('syncNow - unauthenticated uses fallback file when available', async () => {
  brokerSession.isAuthenticated.mockReturnValue(false);
    // mock global fetch to return a fallback payload
    const fallback = { instruments: [ { marketId: 'F1', symbol: 'FFF', maturityDate: '20251212' } ] };
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(fallback) }));
  storage.saveRecord.mockResolvedValue({ parts: 1, versionHash: 'fhash' });

    const res = await syncService.syncNow();
    expect(res.ok).toBe(true);
    expect(res.fallback).toBe(true);
  expect(storage.saveRecord).toHaveBeenCalled();
  const saved = storage.saveRecord.mock.calls[0][0];
    expect(saved.source).toBe('fallback-file');
    // cleanup
    delete global.fetch;
  });
});
