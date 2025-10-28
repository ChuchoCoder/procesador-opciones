import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * T019 - Integration test for alarm handler
 * 
 * This test simulates the background alarm firing scenario and verifies that
 * the sync service is properly invoked and storage is updated. Since we can't
 * directly test the actual service worker in Vitest, we test the integration
 * between the sync service methods that the alarm handler calls.
 */

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

describe('alarm handler integration - T019', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('alarm trigger flow - shouldRunDailySync checks then syncNow executes when needed', async () => {
    // Simulate no previous sync (first run)
    storage.readRecord.mockResolvedValue(null);
    
    // Check if sync should run (alarm handler does this first)
    const shouldRun = await syncService.shouldRunDailySync();
    expect(shouldRun).toBe(true);

    // If shouldRun is true, alarm handler calls syncNow
    brokerSession.isAuthenticated.mockReturnValue(true);
    brokerClient.fetchInstruments.mockResolvedValue([
      { marketId: 'BYMA', symbol: 'ALARM_TEST', maturityDate: '20250601', cficode: 'AT01' }
    ]);
    storage.saveRecord.mockResolvedValue({ parts: 1, versionHash: 'alarm-v1', sizeBytes: 128 });

    const result = await syncService.syncNow();

    expect(result.ok).toBe(true);
    expect(storage.saveRecord).toHaveBeenCalledTimes(1);
    
    const savedRecord = storage.saveRecord.mock.calls[0][0];
    expect(savedRecord.source).toBe('broker-api');
    expect(savedRecord.instruments).toHaveLength(1);
    expect(savedRecord.fetchedAt).toBeTruthy();
  });

  it('alarm trigger flow - shouldRunDailySync prevents duplicate run on same day', async () => {
    // Simulate sync already happened today
    const todayTimestamp = new Date().toISOString();
    storage.readRecord.mockResolvedValue({
      meta: { fetchedAt: todayTimestamp, parts: 1 },
      instruments: []
    });

    const shouldRun = await syncService.shouldRunDailySync();
    
    // Should not run again on same day
    expect(shouldRun).toBe(false);
    expect(storage.readRecord).toHaveBeenCalledTimes(1);
  });

  it('alarm trigger flow - shouldRunDailySync triggers sync when last run was yesterday', async () => {
    // Simulate sync happened yesterday
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    storage.readRecord.mockResolvedValue({
      meta: { fetchedAt: yesterday.toISOString(), parts: 1 },
      instruments: []
    });

    const shouldRun = await syncService.shouldRunDailySync();
    
    expect(shouldRun).toBe(true);
  });

  it('alarm trigger flow - memoization caching prevents redundant storage reads', async () => {
    brokerSession.isAuthenticated.mockReturnValue(true);
    brokerClient.fetchInstruments.mockResolvedValue([
      { marketId: 'BYMA', symbol: 'MEMO_TEST', maturityDate: '20250701' }
    ]);
    const expectedMeta = { parts: 1, versionHash: 'memo-v1', sizeBytes: 64 };
    storage.saveRecord.mockResolvedValue(expectedMeta);

    // First sync populates memoization
    await syncService.syncNow();
    
    // Get memoized record
    const memoized = syncService.getMemoized();
    
    expect(memoized).toBeTruthy();
    expect(memoized.meta).toEqual(expectedMeta);
    expect(memoized.record.instruments).toHaveLength(1);
  });

  it('alarm trigger flow - handles sync failure gracefully', async () => {
    storage.readRecord.mockResolvedValue(null);
    
    const shouldRun = await syncService.shouldRunDailySync();
    expect(shouldRun).toBe(true);

    // Simulate authenticated but API fails
    brokerSession.isAuthenticated.mockReturnValue(true);
    brokerClient.fetchInstruments.mockRejectedValue(new Error('Service unavailable'));

    const result = await syncService.syncNow();

    expect(result.ok).toBe(false);
    expect(result.reason).toBeTruthy();
    expect(storage.saveRecord).not.toHaveBeenCalled();
  }, 20000); // Increase timeout to 20s to accommodate full retry backoff with jitter variance

  it('alarm trigger flow - complete authenticated success path', async () => {
    // Simulate the full flow an alarm handler would execute:
    // 1. Check shouldRunDailySync
    // 2. If true, call syncNow
    // 3. Verify storage updated correctly

    storage.readRecord.mockResolvedValue(null);
    brokerSession.isAuthenticated.mockReturnValue(true);
    
    const mockInstruments = [
      { marketId: 'BYMA', symbol: 'INS1', maturityDate: '20250801', cficode: 'C1' },
      { marketId: 'BYMA', symbol: 'INS2', maturityDate: '20250802', cficode: 'C2' },
      { marketId: 'ROFX', symbol: 'INS3', maturityDate: '20250803', cficode: 'C3' },
    ];
    brokerClient.fetchInstruments.mockResolvedValue(mockInstruments);
    storage.saveRecord.mockResolvedValue({ parts: 1, versionHash: 'full-v1', sizeBytes: 512 });

    // Step 1: Check if sync should run
    const shouldRun = await syncService.shouldRunDailySync();
    expect(shouldRun).toBe(true);

    // Step 2: Execute sync
    const syncResult = await syncService.syncNow();
    expect(syncResult.ok).toBe(true);

    // Step 3: Verify storage was called with proper normalized data
    expect(storage.saveRecord).toHaveBeenCalledTimes(1);
    const saved = storage.saveRecord.mock.calls[0][0];
    expect(saved.instruments).toHaveLength(3);
    expect(saved.source).toBe('broker-api');
    expect(saved.instruments[0].maturityDate).toBe('2025-08-01');
  });

  it('alarm trigger flow - handles shouldRunDailySync errors by defaulting to run', async () => {
    // Simulate storage read error
    storage.readRecord.mockRejectedValue(new Error('Storage corrupted'));

    // shouldRunDailySync should catch error and return true (conservative default)
    const shouldRun = await syncService.shouldRunDailySync();
    expect(shouldRun).toBe(true);
  });
});
