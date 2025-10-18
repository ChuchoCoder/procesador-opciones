/**
 * T072: Test for audit logging stub - verify SyncSession recorded post-sync
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recordSyncSession, getSyncSessions, exportToCSV } from '../../src/services/broker/audit-log.js';

describe('Audit Logging Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  describe('recordSyncSession', () => {
    it('should log sync session metadata with PO: prefix', () => {
      const session = {
        sessionId: 'test-session-123',
        status: 'success',
        startTime: 1697462400000,
        endTime: 1697462460000,
        operationsImportedCount: 150,
        source: 'broker',
        retryAttempts: 0,
        message: null,
      };

      recordSyncSession(session);

      expect(console.log).toHaveBeenCalledWith(
        'PO: SyncSession recorded:',
        expect.objectContaining({
          sessionId: 'test-session-123',
          status: 'success',
          operationsImportedCount: 150,
          source: 'broker',
          retryAttempts: 0,
        })
      );
    });

    it('should handle failed sync session with error message', () => {
      const session = {
        sessionId: 'failed-session-456',
        status: 'failed',
        startTime: 1697462400000,
        endTime: 1697462410000,
        operationsImportedCount: 0,
        source: 'broker',
        retryAttempts: 3,
        message: 'Network timeout after retries',
      };

      recordSyncSession(session);

      expect(console.log).toHaveBeenCalledWith(
        'PO: SyncSession recorded:',
        expect.objectContaining({
          sessionId: 'failed-session-456',
          status: 'failed',
          message: 'Network timeout after retries',
          retryAttempts: 3,
        })
      );
    });

    it('should handle canceled sync session', () => {
      const session = {
        sessionId: 'canceled-session-789',
        status: 'canceled',
        startTime: 1697462400000,
        endTime: 1697462405000,
        operationsImportedCount: 0,
        source: 'broker',
        retryAttempts: 0,
        message: 'User canceled sync',
      };

      recordSyncSession(session);

      expect(console.log).toHaveBeenCalledWith(
        'PO: SyncSession recorded:',
        expect.objectContaining({
          status: 'canceled',
          message: 'User canceled sync',
        })
      );
    });
  });

  describe('getSyncSessions', () => {
    it('should format sync sessions with localized timestamps', () => {
      const sessions = [
        {
          sessionId: 'session-1',
          status: 'success',
          startTime: 1697462400000,
          endTime: 1697462460000,
          operationsImportedCount: 100,
          source: 'broker',
          retryAttempts: 0,
          message: null,
        },
        {
          sessionId: 'session-2',
          status: 'failed',
          startTime: 1697462500000,
          endTime: 1697462510000,
          operationsImportedCount: 0,
          source: 'broker',
          retryAttempts: 2,
          message: 'Auth error',
        },
      ];

      const formatted = getSyncSessions(sessions);

      expect(formatted).toHaveLength(2);
      expect(formatted[0]).toMatchObject({
        sessionId: 'session-1',
        status: 'success',
        operationsImportedCount: 100,
        duration: 60000, // 60 seconds
      });
      expect(formatted[0].startTimeFormatted).toBeDefined();
      expect(formatted[0].endTimeFormatted).toBeDefined();
      expect(formatted[1].duration).toBe(10000); // 10 seconds
    });

    it('should handle empty sessions array', () => {
      const formatted = getSyncSessions([]);
      expect(formatted).toEqual([]);
    });

    it('should handle sessions without endTime (in-progress)', () => {
      const sessions = [
        {
          sessionId: 'session-in-progress',
          status: 'in-progress',
          startTime: 1697462400000,
          endTime: null,
          operationsImportedCount: 0,
          source: 'broker',
          retryAttempts: 0,
          message: null,
        },
      ];

      const formatted = getSyncSessions(sessions);

      expect(formatted[0].endTimeFormatted).toBeNull();
      expect(formatted[0].duration).toBeNull();
    });
  });

  describe('exportToCSV', () => {
    it('should export sync sessions to CSV format', () => {
      const sessions = [
        {
          sessionId: 'session-1',
          status: 'success',
          startTime: 1697462400000,
          endTime: 1697462460000,
          operationsImportedCount: 100,
          source: 'broker',
          retryAttempts: 0,
          message: null,
        },
        {
          sessionId: 'session-2',
          status: 'failed',
          startTime: 1697462500000,
          endTime: 1697462510000,
          operationsImportedCount: 0,
          source: 'broker',
          retryAttempts: 2,
          message: 'Network timeout',
        },
      ];

      const csv = exportToCSV(sessions);

      expect(csv).toContain('SessionID,Status,Start Time,End Time,Operations Count,Source,Retry Attempts,Message');
      expect(csv).toContain('session-1,success');
      expect(csv).toContain('session-2,failed');
      expect(csv).toContain('Network timeout');
      expect(csv).toContain(',100,broker,0,');
      expect(csv).toContain(',0,broker,2,');
    });

    it('should handle empty sessions array', () => {
      const csv = exportToCSV([]);
      expect(csv).toBe('SessionID,Status,Start Time,End Time,Operations Count,Source,Retry Attempts,Message\n');
    });

    it('should escape messages with commas and quotes', () => {
      const sessions = [
        {
          sessionId: 'session-1',
          status: 'failed',
          startTime: 1697462400000,
          endTime: 1697462460000,
          operationsImportedCount: 0,
          source: 'broker',
          retryAttempts: 1,
          message: 'Error: Invalid response, check connection',
        },
      ];

      const csv = exportToCSV(sessions);

      expect(csv).toContain('"Error: Invalid response, check connection"');
    });
  });
});
