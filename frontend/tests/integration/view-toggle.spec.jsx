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
    window.localStorage.setItem(storageKeys.symbols, JSON.stringify(['GGAL']));
    window.localStorage.setItem(
      storageKeys.expirations,
      JSON.stringify({
        NOV24: { suffixes: ['NOV24'] },
      }),
    );
    window.localStorage.setItem(storageKeys.activeSymbol, JSON.stringify('GGAL'));
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
    'switches between CALLS and PUTS views, toggles averaging, and scopes copy/download actions',
    async () => {
    const user = userEvent.setup();
    renderApp();

    const fileInput = await screen.findByTestId('processor-file-input');
    const csvFile = new File([csvFixture], 'operaciones.csv', { type: 'text/csv' });
    await user.upload(fileInput, csvFile);

    const processButton = screen.getByTestId('processor-process-button');
    await user.click(processButton);

    await waitFor(() => {
      expect(screen.getByTestId('summary-total-count')).toHaveTextContent('4');
    });

    const callsTab = screen.getByRole('tab', { name: /calls/i });
    const putsTab = screen.getByRole('tab', { name: /puts/i });
    expect(callsTab).toHaveAttribute('aria-selected', 'true');

    const resultsTable = await screen.findByTestId('processor-results-table');
    await waitFor(() => {
      const callRows = within(resultsTable).getAllByRole('row');
      expect(callRows.length).toBeGreaterThan(1);
    });

    const copyActiveButton = screen.getByTestId('copy-active-button');
    await user.click(copyActiveButton);
    await waitFor(() => {
      expect(clipboardSpy).toHaveBeenCalledTimes(1);
    });
    expect(clipboardSpy.mock.calls[0][0].scope).toBe(clipboardService.CLIPBOARD_SCOPES.CALLS);

    await user.click(putsTab);
    expect(putsTab).toHaveAttribute('aria-selected', 'true');

    const updatedTable = await screen.findByTestId('processor-results-table');
    await waitFor(() => {
      const putRows = within(updatedTable).getAllByRole('row');
      expect(putRows.length).toBeGreaterThan(1);
    });

    await user.click(copyActiveButton);
    await waitFor(() => {
      expect(clipboardSpy).toHaveBeenCalledTimes(2);
    });
    expect(clipboardSpy.mock.calls[1][0].scope).toBe(clipboardService.CLIPBOARD_SCOPES.PUTS);

    const downloadActiveButton = screen.getByTestId('download-active-button');
    await user.click(downloadActiveButton);
    await waitFor(() => {
      expect(exportSpy).toHaveBeenCalledTimes(1);
    });
    expect(exportSpy.mock.calls[0][0].scope).toBe(exportService.EXPORT_SCOPES.PUTS);

    const averagingSwitch = screen.getByTestId('processor-averaging-switch');
    await user.click(averagingSwitch);

    await waitFor(() => {
      expect(screen.getByTestId('summary-total-count')).toHaveTextContent('2');
    });

    await user.click(copyActiveButton);
    await waitFor(() => {
      expect(clipboardSpy).toHaveBeenCalledTimes(3);
    });
    expect(clipboardSpy.mock.calls[2][0].scope).toBe(clipboardService.CLIPBOARD_SCOPES.PUTS);
    expect(clipboardSpy.mock.calls[2][0].view).toBe('averaged');
    },
    15000,
  );
});
