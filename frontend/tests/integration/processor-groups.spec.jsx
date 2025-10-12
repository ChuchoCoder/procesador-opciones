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
  const fileInput = await screen.findByTestId('processor-file-input');
  const csvFile = new File([csvContent], 'operaciones.csv', { type: 'text/csv' });
  await user.upload(fileInput, csvFile);

  const processButton = screen.getByTestId('processor-process-button');
  expect(processButton).toBeEnabled();
  await user.click(processButton);

  await screen.findByTestId('summary-total-count');
};

describe('Processor group filter integration', () => {
  let clipboardWriteMock;
  let copySpy;
  let exportSpy;

  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem(storageKeys.symbols, JSON.stringify(['GGAL', 'ALUA']));
    window.localStorage.setItem(
      storageKeys.expirations,
      JSON.stringify({
        Enero: { suffixes: ['ENE'] },
        Febrero: { suffixes: ['FEB'] },
        Marzo: { suffixes: ['MAR'] },
      }),
    );
    window.localStorage.setItem(storageKeys.activeSymbol, JSON.stringify('GGAL'));
    window.localStorage.setItem(storageKeys.activeExpiration, JSON.stringify('Enero'));
    window.localStorage.setItem(storageKeys.useAveraging, JSON.stringify(false));

    clipboardWriteMock = vi.fn().mockResolvedValue();
    copySpy = vi.spyOn(clipboardService, 'copyReportToClipboard').mockResolvedValue();
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

    const eneOption = screen.getByRole('button', { name: /GGAL · ENE/i });
    const febOption = screen.getByRole('button', { name: /GGAL · FEB/i });

    expect(eneOption).toBeInTheDocument();
    expect(febOption).toBeInTheDocument();
  }, 10000);

  it('scopes summary counts and table rows to the selected group', async () => {
    const user = createUser();
    renderProcessorApp();

    await uploadAndProcess(user, multiGroupCsv);

    const febOption = await screen.findByRole('button', { name: /GGAL · FEB/i });
    await user.click(febOption);

    await waitFor(() => {
      expect(febOption).toHaveAttribute('aria-pressed', 'true');
    });

    expect(screen.getByTestId('summary-calls-count')).toHaveTextContent('1');
    expect(screen.getByTestId('summary-puts-count')).toHaveTextContent('0');
    expect(screen.getByTestId('summary-total-count')).toHaveTextContent('1');

    const resultsTable = screen.getByTestId('processor-results-table');
    const bodyRows = within(resultsTable).getAllByRole('row');
    expect(bodyRows.some((row) => row.textContent?.includes('2'))).toBe(true);
    expect(bodyRows.some((row) => row.textContent?.includes('1') && row.textContent?.includes('110'))).toBe(false);
  });

  it('uses filtered dataset for scoped exports and provides download all action', async () => {
    const user = createUser();
    renderProcessorApp();

    await uploadAndProcess(user, multiGroupCsv);

    const febOption = await screen.findByRole('button', { name: /GGAL · FEB/i });
    await user.click(febOption);

    const downloadActive = screen.getByTestId('download-active-button');
    await user.click(downloadActive);

    await waitFor(() => {
      expect(exportSpy).toHaveBeenCalled();
    });

    const scopedCall = exportSpy.mock.calls.at(-1)[0];
    expect(scopedCall.scope).toBe(exportService.EXPORT_SCOPES.CALLS);
    expect(scopedCall.report.summary.totalRows).toBe(1);

    const downloadAll = screen.getByTestId('download-all-button');
    await user.click(downloadAll);

    const allCall = exportSpy.mock.calls.at(-1)[0];
    expect(allCall.scope).toBe(exportService.EXPORT_SCOPES.COMBINED);
    expect(allCall.report.summary.totalRows).toBe(3);
  }, 10000);

  it('auto-selects single detected group and hides Todos option', async () => {
    const user = createUser();
    renderProcessorApp();

    await uploadAndProcess(user, singleGroupCsv);

    const filterContainer = await screen.findByTestId('group-filter');
    expect(filterContainer).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /todos/i })).not.toBeInTheDocument();

    const singleOption = screen.getByRole('button', { name: /ALUA · MAR/i });
    expect(singleOption).toHaveAttribute('aria-pressed', 'true');
  });
});
