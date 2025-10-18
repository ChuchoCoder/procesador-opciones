import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { useEffect, useRef } from 'react';

import App from '../../src/app/App.jsx';
import { ConfigProvider } from '../../src/state/config-context.jsx';
import { useConfig } from '../../src/state/config-hooks.js';
import { storageKeys } from '../../src/services/storage/local-storage.js';
import * as clipboardService from '../../src/services/csv/clipboard-service.js';
import * as exportService from '../../src/services/csv/export-service.js';

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
        Enero: { suffixes: ['ENE'] },
      }),
    );
    window.localStorage.setItem(storageKeys.activeExpiration, JSON.stringify('Enero'));
    window.localStorage.setItem(storageKeys.useAveraging, JSON.stringify(false));

  clipboardWriteMock = vi.fn().mockResolvedValue();
  copySpy = vi.spyOn(clipboardService, 'copyReportToClipboard').mockResolvedValue();
  exportSpy = vi.spyOn(exportService, 'exportReportToCsv').mockResolvedValue('GGAL_CALLS.csv');
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

      // Select file directly (auto-processes)
      let fileInput = screen.queryByTestId('file-menu-input');
      if (!fileInput) {
        await waitFor(() => {
          expect(document.querySelector('input[type="file"]')).not.toBeNull();
        });
        fileInput = document.querySelector('input[type="file"]');
      }
      const csvFile = new File([csvFixture], 'operaciones.csv', { type: 'text/csv' });
      await user.upload(fileInput, csvFile);

  const sourceIndicator = await screen.findByTestId('processor-source-indicator');
  expect(sourceIndicator.textContent).toContain('Broker: 0');
  expect(sourceIndicator.textContent).toContain('CSV: 3');
  expect(sourceIndicator.textContent).toContain('Total: 3');

      const callsTable = await screen.findByTestId('processor-calls-table');
      const putsTable = screen.getByTestId('processor-puts-table');

      const getDataRows = (table) => within(table)
        .getAllByRole('row')
        .filter((row) => row.closest('tbody'));

      // Raw view lists individual call legs (net 2 and -1) and a single put leg
      const initialCallRows = getDataRows(callsTable);
      expect(initialCallRows.length).toBeGreaterThanOrEqual(2);
      expect(initialCallRows.some((row) => row.textContent?.includes('2'))).toBe(true);
      expect(initialCallRows.some((row) => row.textContent?.includes('-1'))).toBe(true);

      const initialPutRows = getDataRows(putsTable);
      expect(initialPutRows.length).toBe(1);
      expect(initialPutRows[0].textContent).toMatch(/3/);

      // Copy calls data using per-table action button
      const copyCallsButton = screen.getByTestId('processor-calls-table-copy-button');
      expect(copyCallsButton).toBeEnabled();
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

      // Download calls CSV from the same table actions
      const downloadCallsButton = screen.getByTestId('processor-calls-table-download-button');
      expect(downloadCallsButton).toBeEnabled();
      await user.click(downloadCallsButton);

      await waitFor(() => {
        expect(exportSpy).toHaveBeenCalledTimes(1);
      });

      const [[downloadArgs]] = exportSpy.mock.calls;
      expect(downloadArgs.scope).toBe(exportService.EXPORT_SCOPES.CALLS);
    },
    TEST_TIMEOUT,
  );

  it('keeps total count unchanged when CSV duplicates broker operations', async () => {
    const baseTimestamp = Date.now();
    const brokerOperations = [
      {
        id: 'broker-1',
        order_id: 'ORD-1',
        operation_id: null,
        symbol: 'GGAL',
        optionType: 'CALL',
        action: 'buy',
        quantity: 5,
        price: 12,
        tradeTimestamp: baseTimestamp,
        strike: 120,
        expirationDate: 'NOV24',
        source: 'broker',
        sourceReferenceId: 'ORD-1',
        importTimestamp: baseTimestamp,
        status: 'executed',
      },
    ];

    const csvDuplicate = `order_id,symbol,side,option_type,strike,quantity,price,status,event_type,transact_time\nORD-1,GGALC120.NOV24,BUY,CALL,120,5,12,fully_executed,execution_report,${new Date(baseTimestamp).toISOString()}\n`;

    const SetupOperations = () => {
      const config = useConfig();
      const initializedRef = useRef(false);

      useEffect(() => {
        if (!config.hydrated || initializedRef.current) {
          return;
        }
        initializedRef.current = true;
        config.setOperations(brokerOperations);
      }, [config]);

      return null;
    };

    render(
      <MemoryRouter initialEntries={["/processor"]}>
        <ConfigProvider>
          <SetupOperations />
          <App />
        </ConfigProvider>
      </MemoryRouter>,
    );

    const indicatorBefore = await screen.findByTestId('processor-source-indicator');
    expect(indicatorBefore.textContent).toContain('Broker: 1');
    expect(indicatorBefore.textContent).toContain('CSV: 0');
    expect(indicatorBefore.textContent).toContain('Total: 1');

    const user = userEvent.setup();
    let fileInput = screen.queryByTestId('file-menu-input');
    if (!fileInput) {
      await waitFor(() => {
        expect(document.querySelector('input[type="file"]')).not.toBeNull();
      });
      fileInput = document.querySelector('input[type="file"]');
    }

    await user.upload(
      fileInput,
      new File([csvDuplicate], 'duplicado.csv', { type: 'text/csv' }),
    );

    await waitFor(() => {
      const indicatorAfter = screen.getByTestId('processor-source-indicator');
      expect(indicatorAfter.textContent).toContain('Broker: 1');
      expect(indicatorAfter.textContent).toContain('CSV: 0');
      expect(indicatorAfter.textContent).toContain('Total: 1');
    });
  });
});
