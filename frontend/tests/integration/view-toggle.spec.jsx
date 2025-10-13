import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import App from '../../src/app/App.jsx';
import { ConfigProvider } from '../../src/state/config-context.jsx';
import { storageKeys } from '../../src/services/storage/local-storage.js';
import * as clipboardService from '../../src/services/csv/clipboard-service.js';
import * as exportService from '../../src/services/csv/export-service.js';

const csvFixture = `order_id,symbol,side,option_type,strike,quantity,price,status,event_type\n${[
  '1,GGALNOV24C120,BUY,CALL,120,2,10,fully_executed,execution_report',
  '2,GGALNOV24C120,BUY,CALL,120,1,12,fully_executed,execution_report',
  '3,GGALNOV24C120,SELL,CALL,120,1,12,fully_executed,execution_report',
  '4,GGALNOV24P110,BUY,PUT,110,3,8,partially_executed,execution_report',
].join('\n')}\n`;

const renderApp = () =>
  render(
    <MemoryRouter initialEntries={["/processor"]}>
      <ConfigProvider>
        <App />
      </ConfigProvider>
    </MemoryRouter>,
  );

describe('Processor view toggles', () => {
  let clipboardSpy;
  let exportSpy;

  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem(
      storageKeys.prefixRules,
      JSON.stringify({
        GGAL: {
          symbol: 'GGAL',
          defaultDecimals: 0,
          strikeOverrides: {},
          expirationOverrides: {},
        },
      }),
    );
    window.localStorage.setItem(
      storageKeys.expirations,
      JSON.stringify({
        NOV24: { suffixes: ['NOV24'] },
      }),
    );
    window.localStorage.setItem(storageKeys.activeExpiration, JSON.stringify('NOV24'));
    window.localStorage.setItem(storageKeys.useAveraging, JSON.stringify(false));

    clipboardSpy = vi.spyOn(clipboardService, 'copyReportToClipboard').mockResolvedValue();
    exportSpy = vi.spyOn(exportService, 'exportReportToCsv').mockResolvedValue('GGAL_NOV24_CALLS.csv');

    Object.defineProperty(window.navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue() },
      configurable: true,
    });

    if (typeof URL.createObjectURL === 'function') {
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    } else {
      Object.defineProperty(URL, 'createObjectURL', {
        value: vi.fn(() => 'blob:mock-url'),
        configurable: true,
      });
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete window.navigator.clipboard;
    if (URL.createObjectURL && URL.createObjectURL.mock) {
      delete URL.createObjectURL;
    }
  });

  it(
    'supports per-table copy/download actions and toggling averaging',
    async () => {
      const user = userEvent.setup();
      renderApp();

      let fileInput = screen.queryByTestId('file-menu-input');
      if (!fileInput) {
        await waitFor(() => {
          expect(document.querySelector('input[type="file"]')).not.toBeNull();
        });
        fileInput = document.querySelector('input[type="file"]');
      }
      const csvFile = new File([csvFixture], 'operaciones.csv', { type: 'text/csv' });
      await user.upload(fileInput, csvFile);

      const callsTable = await screen.findByTestId('processor-calls-table');
      const putsTable = screen.getByTestId('processor-puts-table');
      const getDataRows = (table) => within(table)
        .getAllByRole('row')
        .filter((row) => row.closest('tbody'));

      const initialCallRows = getDataRows(callsTable);
      expect(initialCallRows.length).toBeGreaterThan(1);
      expect(initialCallRows.some((row) => row.textContent?.includes('2'))).toBe(true);
      expect(initialCallRows.some((row) => row.textContent?.includes('-1'))).toBe(true);

      const initialPutRows = getDataRows(putsTable);
      expect(initialPutRows.length).toBeGreaterThan(0);
      expect(initialPutRows[0].textContent).toMatch(/110/);

      const copyCallsButton = screen.getByTestId('processor-calls-table-copy-button');
      await user.click(copyCallsButton);
      await waitFor(() => {
        expect(clipboardSpy).toHaveBeenCalledTimes(1);
      });
      expect(clipboardSpy.mock.calls[0][0].scope).toBe(clipboardService.CLIPBOARD_SCOPES.CALLS);

      const copyPutsButton = screen.getByTestId('processor-puts-table-copy-button');
      await user.click(copyPutsButton);
      await waitFor(() => {
        expect(clipboardSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
      }, { timeout: 5000 });
      expect(clipboardSpy.mock.calls[1][0].scope).toBe(clipboardService.CLIPBOARD_SCOPES.PUTS);

      const downloadPutsButton = screen.getByTestId('processor-puts-table-download-button');
      await user.click(downloadPutsButton);
      await waitFor(() => {
        expect(exportSpy).toHaveBeenCalledTimes(1);
      }, { timeout: 5000 });
      expect(exportSpy.mock.calls[0][0].scope).toBe(exportService.EXPORT_SCOPES.PUTS);

      const averagingSwitch = screen.getByTestId('processor-calls-table-averaging-switch');
      await user.click(averagingSwitch);

      await waitFor(() => {
        expect(getDataRows(callsTable).length).toBeLessThan(initialCallRows.length);
      });
      const averagedRows = getDataRows(callsTable);
      expect(averagedRows.length).toBe(1);
      expect(averagedRows[0].textContent).toMatch(/2/);
    },
    25000,
  );
});
