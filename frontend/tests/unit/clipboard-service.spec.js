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
} = {}) => ({
  strike,
  totalQuantity,
  averagePrice,
  optionType,
  originalSymbol: `SYM${strike}`,
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
    it('formats CALLS scope into tab-delimited rows without header', () => {
      const report = createReport({
        calls: [
          createOperation({ strike: 120, totalQuantity: 3, averagePrice: 10.5 }),
          createOperation({ strike: 125.5, totalQuantity: -2, averagePrice: 9.75 }),
        ],
      });

      const payload = buildClipboardPayload({
        report,
        scope: CLIPBOARD_SCOPES.CALLS,
      });

      expect(payload).toBe([
        '3\t120\t10.5',
        '-2\t125.5\t9.75',
      ].join('\n'));
    });

    it('formats COMBINED scope including section titles and blank separator without headers', () => {
      const report = createReport({
        calls: [createOperation({ strike: 110, totalQuantity: -2, averagePrice: 9.75 })],
        puts: [createOperation({ strike: 95.5, totalQuantity: 5, averagePrice: 1.2345, optionType: 'PUT' })],
        averagingEnabled: true,
      });

      const payload = buildClipboardPayload({ report, scope: CLIPBOARD_SCOPES.COMBINED });

      expect(payload).toBe([
        'OPERACIONES CALLS (CON PROMEDIOS)',
        '-2\t110\t9.75',
        '',
        'OPERACIONES PUTS (CON PROMEDIOS)',
        '5\t95.5\t1.2345',
      ].join('\n'));
    });

    it('throws Spanish error when there is no data for the requested scope', () => {
      const report = createReport();

      expect(() =>
        buildClipboardPayload({ report, scope: CLIPBOARD_SCOPES.PUTS }),
      ).toThrowError(CLIPBOARD_ERROR_MESSAGES.emptyScope);
    });
  });

  describe('copyReportToClipboard', () => {
    it('writes payload to navigator clipboard and resolves', async () => {
      const report = createReport({
        calls: [createOperation({ strike: 100, totalQuantity: 1, averagePrice: 12.3456 })],
      });

      const writeText = vi.fn().mockResolvedValue();

      await expect(
        copyReportToClipboard({
          report,
          scope: CLIPBOARD_SCOPES.CALLS,
          clipboard: { writeText },
        }),
      ).resolves.toBeUndefined();

      expect(writeText).toHaveBeenCalledWith([
        '1\t100\t12.3456',
      ].join('\n'));
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
