import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import App from '../../src/app/App.jsx';
import { ConfigProvider } from '../../src/state/config-context.jsx';
import { storageKeys } from '../../src/services/storage/local-storage.js';
import * as clipboardService from '../../src/services/csv/clipboard-service.js';

const csvFixture = `order_id,symbol,side,option_type,strike,quantity,price,status,event_type\n${['1,GGALENE,BUY,CALL,120,2,10,fully_executed,execution_report','2,GGALENE,SELL,CALL,120,1,12,fully_executed,execution_report','3,GGALENE,BUY,PUT,110,3,8,partially_executed,execution_report'].join('\n')}\n`;
const TEST_TIMEOUT = 15000;

const renderProcessorApp = () =>
  render(
    <MemoryRouter initialEntries={["/processor"]}>
      <ConfigProvider>
        <App />
      </ConfigProvider>
    </MemoryRouter>,
  );

describe('Processor flow integration', () => {
  let clipboardWriteMock;
  let copySpy;

  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem(storageKeys.symbols, JSON.stringify(['GGAL']));
    window.localStorage.setItem(
      storageKeys.expirations,
      JSON.stringify({
        Enero: { suffixes: ['ENE'] },
      }),
    );
    window.localStorage.setItem(storageKeys.activeSymbol, JSON.stringify('GGAL'));
    window.localStorage.setItem(storageKeys.activeExpiration, JSON.stringify('Enero'));
    window.localStorage.setItem(storageKeys.useAveraging, JSON.stringify(false));

    clipboardWriteMock = vi.fn().mockResolvedValue();
    copySpy = vi.spyOn(clipboardService, 'copyReportToClipboard').mockResolvedValue();
    Object.defineProperty(window.navigator, 'clipboard', {
      value: { writeText: clipboardWriteMock },
      configurable: true,
    });

    expect(typeof window.navigator.clipboard.writeText).toBe('function');

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
    'processes a valid CSV and enables copy and download actions',
    async () => {
      const user = userEvent.setup();
      renderProcessorApp();

      const fileInput = await screen.findByTestId('processor-file-input');
      const csvFile = new File([csvFixture], 'operaciones.csv', { type: 'text/csv' });
      await user.upload(fileInput, csvFile);

      const processButton = screen.getByTestId('processor-process-button');
      expect(processButton).toBeEnabled();
      await user.click(processButton);

      const callsMetric = await screen.findByTestId('summary-calls-count');
      expect(callsMetric).toHaveTextContent('2');

      const putsMetric = screen.getByTestId('summary-puts-count');
      expect(putsMetric).toHaveTextContent('1');

      const totalMetric = screen.getByTestId('summary-total-count');
      expect(totalMetric).toHaveTextContent('3');

  const resultsTable = screen.getByTestId('processor-results-table');
  const callRows = within(resultsTable).getAllByRole('row');
  expect(callRows.length).toBeGreaterThan(1);

  const putsTab = screen.getByRole('tab', { name: /puts/i });
  await user.click(putsTab);
  const putsRows = within(screen.getByTestId('processor-results-table')).getAllByRole('row');
  expect(putsRows.length).toBeGreaterThan(1);

      const copyCallsButton = screen.getByTestId('copy-calls-button');
      const downloadCombinedButton = screen.getByTestId('download-combined-button');

      expect(copyCallsButton).toBeEnabled();
      expect(downloadCombinedButton).toBeEnabled();

      await user.click(copyCallsButton);
      await waitFor(() => {
        expect(copySpy).toHaveBeenCalledTimes(1);
      });

      const [[copyArgs]] = copySpy.mock.calls;
      expect(copyArgs.scope).toBe(clipboardService.CLIPBOARD_SCOPES.CALLS);
      expect(copyArgs.clipboard).toBe(window.navigator.clipboard);

      await waitFor(() => {
        expect(screen.getByText('Datos copiados al portapapeles.')).toBeInTheDocument();
      });
    },
    TEST_TIMEOUT,
  );
});
