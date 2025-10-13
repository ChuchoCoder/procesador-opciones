import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import App from '../../src/app/App.jsx';
import { ConfigProvider } from '../../src/state/config-context.jsx';
import { storageKeys } from '../../src/services/storage/local-storage.js';
import * as clipboardService from '../../src/services/csv/clipboard-service.js';
import * as exportService from '../../src/services/csv/export-service.js';

const multiGroupCsv = `order_id,symbol,side,option_type,strike,quantity,price,status,event_type\n${[
  '101,GGAL - ENE,BUY,CALL,120,2,10,fully_executed,execution_report',
  '102,GGAL - ENE,BUY,PUT,110,1,8,fully_executed,execution_report',
  '201,GGAL - FEB,BUY,CALL,95,3,7,fully_executed,execution_report',
  '201,GGAL - FEB,SELL,CALL,95,1,7,fully_executed,execution_report',
].join('\n')}\n`;

const singleGroupCsv = `order_id,symbol,side,option_type,strike,quantity,price,status,event_type\n${[
  '301,ALUA - MAR,BUY,CALL,40,5,12,fully_executed,execution_report',
  '302,ALUA - MAR,SELL,PUT,38,2,9,fully_executed,execution_report',
].join('\n')}\n`;

const renderProcessorApp = () =>
  render(
    <MemoryRouter initialEntries={["/processor"]}>
      <ConfigProvider>
        <App />
      </ConfigProvider>
    </MemoryRouter>,
  );

const uploadAndProcess = async (user, csvContent) => {
  let fileInput = screen.queryByTestId('file-menu-input');
  if (!fileInput) {
    await waitFor(() => {
      expect(document.querySelector('input[type="file"]')).not.toBeNull();
    });
    fileInput = document.querySelector('input[type="file"]');
  }
  const csvFile = new File([csvContent], 'operaciones.csv', { type: 'text/csv' });
  await user.upload(fileInput, csvFile);
  // Auto-processing now happens after file selection
  await screen.findByTestId('processor-calls-table');
};

describe('Processor group filter integration', () => {
  let clipboardWriteMock;
  let exportSpy;

  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem(storageKeys.prefixRules, JSON.stringify({}));
    window.localStorage.setItem(
      storageKeys.expirations,
      JSON.stringify({
        Enero: { suffixes: ['ENE'] },
        Febrero: { suffixes: ['FEB'] },
        Marzo: { suffixes: ['MAR'] },
      }),
    );
    window.localStorage.setItem(storageKeys.activeExpiration, JSON.stringify('Enero'));
    window.localStorage.setItem(storageKeys.useAveraging, JSON.stringify(false));

    clipboardWriteMock = vi.fn().mockResolvedValue();
    vi.spyOn(clipboardService, 'copyReportToClipboard').mockResolvedValue();
    exportSpy = vi.spyOn(exportService, 'exportReportToCsv').mockResolvedValue('mock.csv');
    Object.defineProperty(window.navigator, 'clipboard', {
      value: { writeText: clipboardWriteMock },
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

  const createUser = () => userEvent.setup({ delay: null });

  it('renders detected groups with Todos option when multiple groups exist', async () => {
    const user = createUser();
    renderProcessorApp();

    await uploadAndProcess(user, multiGroupCsv);

    const filterContainer = await screen.findByTestId('group-filter');
    expect(filterContainer).toBeInTheDocument();

    const allOption = screen.getByRole('button', { name: /todos/i });
    expect(allOption).toHaveAttribute('aria-pressed', 'true');

    // Chips display base symbol + expiration (dash removed by formatter)
    const eneOption = screen.getByRole('button', { name: /GGAL ENE/i });
    const febOption = screen.getByRole('button', { name: /GGAL FEB/i });

    expect(eneOption).toBeInTheDocument();
    expect(febOption).toBeInTheDocument();
  }, 10000);

  it('scopes table rows and copy actions to the selected group', async () => {
    const user = createUser();
    renderProcessorApp();

    await uploadAndProcess(user, multiGroupCsv);

    const groupFilter = await screen.findByTestId('group-filter');
    const callsTable = screen.getByTestId('processor-calls-table');
    const putsTable = screen.getByTestId('processor-puts-table');
    const getDataRows = (table) => within(table)
      .getAllByRole('row')
      .filter((row) => row.closest('tbody'));

    const febOption = within(groupFilter).getByRole('button', { name: /GGAL FEB/i });
    await user.click(febOption);
    await waitFor(() => {
      expect(febOption).toHaveAttribute('aria-pressed', 'true');
    });

    await waitFor(() => {
      const rows = getDataRows(callsTable);
      return rows.length === 1;
    });

    const callsRows = getDataRows(callsTable);
    expect(callsRows.length).toBe(1);
    expect(callsRows[0].textContent).toMatch(/95/);
    expect(callsRows[0].textContent).not.toMatch(/110|120/);

    expect(within(putsTable).getByText('Sin datos para mostrar.')).toBeInTheDocument();

    const copyButton = screen.getByTestId('processor-calls-table-copy-button');
    await user.click(copyButton);
    await waitFor(() => {
      expect(clipboardService.copyReportToClipboard).toHaveBeenCalledTimes(1);
    });

    const [[copyPayload]] = clipboardService.copyReportToClipboard.mock.calls;
    expect(copyPayload.scope).toBe(clipboardService.CLIPBOARD_SCOPES.CALLS);
    expect(copyPayload.report.summary.activeExpiration).toBe('FEB');
  }, 15000);

  it('uses filtered dataset for scoped exports', async () => {
    const user = createUser();
    renderProcessorApp();

    await uploadAndProcess(user, multiGroupCsv);

    const groupFilter = await screen.findByTestId('group-filter');
    const febOption = within(groupFilter).getByRole('button', { name: /GGAL FEB/i });
    await user.click(febOption);
    await waitFor(() => {
      expect(febOption).toHaveAttribute('aria-pressed', 'true');
    });

    const downloadButton = screen.getByTestId('processor-calls-table-download-button');
    await user.click(downloadButton);

    await waitFor(() => {
      expect(exportSpy).toHaveBeenCalledTimes(1);
    });

    const scopedCall = exportSpy.mock.calls.at(-1)[0];
    expect(scopedCall.scope).toBe(exportService.EXPORT_SCOPES.CALLS);
    expect(scopedCall.report.summary.totalRows).toBe(1);
    expect(scopedCall.report.summary.activeExpiration).toBe('FEB');

    const allOption = within(groupFilter).getByRole('button', { name: /todos/i });
    await user.click(allOption);
    await waitFor(() => {
      expect(allOption).toHaveAttribute('aria-pressed', 'true');
    });

    await user.click(downloadButton);
    await waitFor(() => {
      expect(exportSpy).toHaveBeenCalledTimes(2);
    });

    const allCall = exportSpy.mock.calls.at(-1)[0];
    expect(allCall.scope).toBe(exportService.EXPORT_SCOPES.CALLS);
    expect(allCall.report.summary.totalRows).toBeGreaterThan(scopedCall.report.summary.totalRows);
  }, 15000);

  it('auto-selects single detected group while keeping Todos available', async () => {
    const user = createUser();
    renderProcessorApp();

    await uploadAndProcess(user, singleGroupCsv);

    const filterContainer = await screen.findByTestId('group-filter');
    expect(filterContainer).toBeInTheDocument();
    const allOption = within(filterContainer).getByRole('button', { name: /todos/i });
    await waitFor(() => {
      expect(allOption).not.toHaveAttribute('aria-pressed', 'true');
    });

    const singleOption = await screen.findByRole('button', { name: /ALUA MAR/i });
    await waitFor(() => {
      expect(singleOption).toHaveAttribute('aria-pressed', 'true');
    });

    const callsTable = screen.getByTestId('processor-calls-table');
    const putsTable = screen.getByTestId('processor-puts-table');
    const getDataRows = (table) => within(table)
      .getAllByRole('row')
      .filter((row) => row.closest('tbody'));

    await waitFor(() => {
      expect(getDataRows(callsTable)).toHaveLength(1);
      expect(getDataRows(putsTable)).toHaveLength(1);
    });
  }, 10000);
});
