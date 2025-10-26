/* eslint-env node, jest */
import { describe, it, expect, vi } from 'vitest';
import {
  CLIPBOARD_SCOPES,
  CLIPBOARD_ERROR_MESSAGES,
  buildClipboardPayload,
  copyReportToClipboard,
} from '../../src/services/csv/clipboard-service.js';

const createOperation = ({
  strike = 100,
  totalQuantity = 1,
  averagePrice = 10,
  optionType = 'CALL',
  transactTime = '2025-10-08T13:58:51.454Z',
} = {}) => ({
  strike,
  totalQuantity,
  averagePrice,
  optionType,
  originalSymbol: `SYM${strike}`,
  raw: transactTime ? { transact_time: transactTime } : undefined,
});

const createReport = ({
  calls = [],
  puts = [],
  averagingEnabled = false,
} = {}) => ({
  summary: {
    averagingEnabled,
    callsRows: calls.length,
    putsRows: puts.length,
    totalRows: calls.length + puts.length,
    activeSymbol: 'GGAL',
    activeExpiration: 'NOV24',
    processedAt: '2025-10-10T10:30:00',
  },
  calls: {
    operations: calls,
    stats: {},
  },
  puts: {
    operations: puts,
    stats: {},
  },
});

describe('clipboard-service', () => {
  describe('buildClipboardPayload', () => {
    it('formats CALLS scope into tab-delimited rows with date as first column', () => {
      const report = createReport({
        calls: [
          createOperation({ strike: 120, totalQuantity: 3, averagePrice: 10.5, transactTime: '2025-10-08T13:58:51.454Z' }),
          createOperation({ strike: 125.5, totalQuantity: -2, averagePrice: 9.75, transactTime: '2025-10-09T14:30:00.000Z' }),
        ],
      });

      const payload = buildClipboardPayload({
        report,
        scope: CLIPBOARD_SCOPES.CALLS,
      });

      // Date format will vary by locale, but should have date, then quantity, strike, price
      const lines = payload.split('\n');
      expect(lines).toHaveLength(2);
      
      // Each line should start with a date, followed by quantity, strike, price
      lines.forEach((line) => {
        const parts = line.split('\t');
        expect(parts.length).toBe(4); // date, quantity, strike, price
      });
      
      // Check the numeric parts (skipping date as format varies)
      expect(lines[0]).toMatch(/\t3\t120\t10.5$/);
      expect(lines[1]).toMatch(/\t-2\t125.5\t9.75$/);
    });

    it('formats COMBINED scope including section titles and blank separator', () => {
      const report = createReport({
        calls: [createOperation({ strike: 110, totalQuantity: -2, averagePrice: 9.75, transactTime: '2025-10-08T13:58:51.454Z' })],
        puts: [createOperation({ strike: 95.5, totalQuantity: 5, averagePrice: 1.2345, optionType: 'PUT', transactTime: '2025-10-08T14:00:00.000Z' })],
        averagingEnabled: true,
      });

      const payload = buildClipboardPayload({ report, scope: CLIPBOARD_SCOPES.COMBINED });

      const lines = payload.split('\n');
      expect(lines[0]).toBe('OPERACIONES CALLS (CON PROMEDIOS)');
      expect(lines[1]).toMatch(/\t-2\t110\t9.75$/);
      expect(lines[2]).toBe('');
      expect(lines[3]).toBe('OPERACIONES PUTS (CON PROMEDIOS)');
      expect(lines[4]).toMatch(/\t5\t95.5\t1.2345$/);
    });

    it('throws Spanish error when there is no data for the requested scope', () => {
      const report = createReport();

      expect(() =>
        buildClipboardPayload({ report, scope: CLIPBOARD_SCOPES.PUTS }),
      ).toThrowError(CLIPBOARD_ERROR_MESSAGES.emptyScope);
    });

    it('handles operations without date gracefully', () => {
      const report = createReport({
        calls: [
          createOperation({ strike: 120, totalQuantity: 3, averagePrice: 10.5, transactTime: null }),
        ],
      });

      const payload = buildClipboardPayload({
        report,
        scope: CLIPBOARD_SCOPES.CALLS,
      });

      // Should still have 4 columns, with empty date
      const lines = payload.split('\n');
      expect(lines).toHaveLength(1);
      expect(lines[0]).toMatch(/^\t3\t120\t10.5$/);
    });

    it('includes date from legs when operation is consolidated', () => {
      const report = createReport({
        calls: [
          {
            strike: 120,
            totalQuantity: 3,
            averagePrice: 10.5,
            optionType: 'CALL',
            originalSymbol: 'SYM120',
            legs: [
              { raw: { transact_time: '2025-10-08T13:58:51.454Z' } },
            ],
          },
        ],
      });

      const payload = buildClipboardPayload({
        report,
        scope: CLIPBOARD_SCOPES.CALLS,
      });

      const lines = payload.split('\n');
      expect(lines).toHaveLength(1);
      // Should have date from legs, followed by quantity, strike, price
      expect(lines[0]).toMatch(/\t3\t120\t10.5$/);
      expect(lines[0]).not.toMatch(/^\t/); // Should NOT start with tab (date should be present)
    });
  });

  describe('copyReportToClipboard', () => {
    it('writes payload to navigator clipboard and resolves', async () => {
      const report = createReport({
        calls: [createOperation({ strike: 100, totalQuantity: 1, averagePrice: 12.3456, transactTime: '2025-10-08T13:58:51.454Z' })],
      });

      const writeText = vi.fn().mockResolvedValue();

      await expect(
        copyReportToClipboard({
          report,
          scope: CLIPBOARD_SCOPES.CALLS,
          clipboard: { writeText },
        }),
      ).resolves.toBeUndefined();

      expect(writeText).toHaveBeenCalledTimes(1);
      const calledPayload = writeText.mock.calls[0][0];
      // Should have date followed by quantity, strike, price
      expect(calledPayload).toMatch(/\t1\t100\t12.3456$/);
    });

    it('throws Spanish error when clipboard API is unavailable', async () => {
      const report = createReport({
        calls: [createOperation()],
      });

      await expect(
        copyReportToClipboard({ report, scope: CLIPBOARD_SCOPES.CALLS, clipboard: null }),
      ).rejects.toThrowError(CLIPBOARD_ERROR_MESSAGES.unavailable);
    });

    it('wraps writeText errors with Spanish message', async () => {
      const report = createReport({ calls: [createOperation()] });

      const writeText = vi.fn().mockRejectedValue(new Error('Permission denied'));

      await expect(
        copyReportToClipboard({
          report,
          scope: CLIPBOARD_SCOPES.CALLS,
          clipboard: { writeText },
        }),
      ).rejects.toThrowError(CLIPBOARD_ERROR_MESSAGES.copyFailed);
    });
  });
});
