import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import App from '../../src/app/App.jsx';
import { ConfigProvider } from '../../src/state/config-context.jsx';
import { storageKeys } from '../../src/services/storage/local-storage.js';
import * as exportService from '../../src/services/csv/export-service.js';
import * as bootstrapDefaults from '../../src/services/bootstrap-defaults.js';
import ggalPutsCsv from './data/GGAL-PUTS.csv?raw';

const TEST_TIMEOUT = 15000;

const renderProcessorApp = () =>
  render(
    <MemoryRouter initialEntries={["/processor"]}>
      <ConfigProvider>
        <App />
      </ConfigProvider>
    </MemoryRouter>,
  );

describe('Processor flow integration - GGAL PUTs fixture', () => {
  beforeEach(async () => {
    window.localStorage.clear();
    
    // Initialize fee services before tests
    await bootstrapDefaults.bootstrapFeeServices();

    // Use new settings format (po:settings:GGAL)
    window.localStorage.setItem(
      'po:settings:GGAL',
      JSON.stringify({
        symbol: 'GGAL',
        prefix: 'GFG',
        defaultDecimals: 0,
        strikeDefaultDecimals: 0,
        expirations: {
          OCT: {
            suffixes: ['O', 'OC'],
            decimals: 1,
            overrides: [],
          },
        },
        updatedAt: Date.now(),
      }),
    );
    
    window.localStorage.setItem(
      storageKeys.expirations,
      JSON.stringify({
        Octubre: { suffixes: ['O'] },
      }),
    );
    window.localStorage.setItem(storageKeys.activeExpiration, JSON.stringify('Octubre'));
    window.localStorage.setItem(storageKeys.useAveraging, JSON.stringify(false));

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
    if (URL.createObjectURL && URL.createObjectURL.mock) {
      delete URL.createObjectURL;
    }
  });

  it(
    'detects PUT operations listed in the GGAL fixture',
    async () => {
      const exportSpy = vi
        .spyOn(exportService, 'exportReportToCsv')
        .mockResolvedValue('GGAL_O_PUTS.csv');

      const user = userEvent.setup();
      renderProcessorApp();

      let fileInput = screen.queryByTestId('file-menu-input');
      if (!fileInput) {
        await waitFor(() => {
          expect(document.querySelector('input[type="file"]')).not.toBeNull();
        });
        fileInput = document.querySelector('input[type="file"]');
      }
      const csvFile = new File([ggalPutsCsv], 'GGAL-PUTS.csv', { type: 'text/csv' });
      await user.upload(fileInput, csvFile);

      const putsTable = await screen.findByTestId('processor-puts-table');
      const callsTable = screen.getByTestId('processor-calls-table');

      const getDataRows = (table) => within(table)
        .getAllByRole('row')
        .filter((row) => row.closest('tbody'));

      const putsRows = getDataRows(putsTable);
      expect(putsRows.length).toBeGreaterThan(0);

      ['-12', '-6', '-17', '-15'].forEach((quantity) => {
        expect(within(putsTable).getByText(quantity)).toBeInTheDocument();
      });

      ['330', '350', '337'].forEach((price) => {
        expect(within(putsTable).getByText(new RegExp(price))).toBeInTheDocument();
      });

      expect(within(callsTable).getByText('Sin datos para mostrar.')).toBeInTheDocument();

      const groupFilter = await screen.findByTestId('group-filter');
      // System displays symbol (GGAL) from configuration
      expect(within(groupFilter).getByText('GGAL Octubre')).toBeInTheDocument();

      // Scope to GGAL O group to ensure download uses filtered data
      const ggalButton = within(groupFilter).getByRole('button', { name: /GGAL O/i });
      await user.click(ggalButton);
      await waitFor(() => {
        expect(ggalButton).toHaveAttribute('aria-pressed', 'true');
      });

      const downloadButton = screen.getByTestId('processor-puts-table-download-button');
      expect(downloadButton).toBeEnabled();
      await user.click(downloadButton);

      await waitFor(() => {
        expect(exportSpy).toHaveBeenCalledTimes(1);
      });
    const [[payload]] = exportSpy.mock.calls;
    expect(payload.scope).toBe(exportService.EXPORT_SCOPES.PUTS);

    const exportedPuts = payload.report?.puts?.operations ?? [];
    expect(exportedPuts.length).toBeGreaterThan(0);
    expect(exportedPuts.every((operation) => operation.matchedSymbol === 'GGAL')).toBe(true);
    },
    TEST_TIMEOUT,
  );
});
