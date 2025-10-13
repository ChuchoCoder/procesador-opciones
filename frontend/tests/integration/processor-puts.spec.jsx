import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import App from '../../src/app/App.jsx';
import { ConfigProvider } from '../../src/state/config-context.jsx';
import { storageKeys } from '../../src/services/storage/local-storage.js';
import * as exportService from '../../src/services/csv/export-service.js';
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
  beforeEach(() => {
    window.localStorage.clear();

    window.localStorage.setItem(storageKeys.symbols, JSON.stringify(['GFG']));
    window.localStorage.setItem(
      storageKeys.expirations,
      JSON.stringify({
        Octubre: { suffixes: ['O'] },
      }),
    );
    window.localStorage.setItem(storageKeys.activeSymbol, JSON.stringify('GFG'));
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

  const fileInput = await screen.findByTestId('file-menu-input');
  const csvFile = new File([ggalPutsCsv], 'GGAL-PUTS.csv', { type: 'text/csv' });
  await user.upload(fileInput, csvFile);

      const putsCount = await screen.findByTestId('summary-puts-count');
      expect(putsCount).toHaveTextContent('4');

      const callsCount = screen.getByTestId('summary-calls-count');
      expect(callsCount).toHaveTextContent('0');

  const putsTab = await screen.findByRole('tab', { name: /puts/i });
  expect(putsTab).toHaveAttribute('aria-selected', 'true');

  const putsTable = await screen.findByTestId('processor-results-table');
  const rows = within(putsTable).getAllByRole('row');
      expect(rows.length).toBeGreaterThan(1);

      ['-12', '-6', '-17', '-15'].forEach((quantity) => {
        expect(within(putsTable).getByText(quantity)).toBeInTheDocument();
      });

      ['330', '350', '337', '354'].forEach((price) => {
        expect(within(putsTable).getByText(new RegExp(price))).toBeInTheDocument();
      });

      expect(within(putsTable).getAllByText(/4734/).length).toBeGreaterThan(0);

      const groupFilter = await screen.findByTestId('group-filter');
      // Actual grouping logic derives base symbol + expiration (token splits GFGV47343O -> GFG + O)
      expect(within(groupFilter).getByText('GFG O')).toBeInTheDocument();
      expect(within(groupFilter).getByText('TZXM6 24hs')).toBeInTheDocument();

      // Scope to GFG O group to ensure download uses filtered data
      const gfgButton = within(groupFilter).getByRole('button', { name: /GFG O/i });
      await user.click(gfgButton);
      await waitFor(() => {
        expect(gfgButton).toHaveAttribute('aria-pressed', 'true');
      });

  const downloadMenuTrigger = await screen.findByTestId('toolbar-download-menu-button');
  await user.click(downloadMenuTrigger);
  const downloadPutsItem = await screen.findByTestId('download-puts-menu-item');
  await user.click(downloadPutsItem);

      await waitFor(() => {
        expect(exportSpy).toHaveBeenCalledTimes(1);
      });
      const [[payload]] = exportSpy.mock.calls;
      expect(payload.scope).toBe(exportService.EXPORT_SCOPES.PUTS);

      const exportedSummary = payload.report?.summary ?? {};
      const exportedPuts = payload.report?.puts?.operations ?? [];

      expect(exportedSummary.totalRows).toBe(exportedSummary.putsRows);
      expect(exportedPuts.length).toBe(exportedSummary.putsRows);
    },
    TEST_TIMEOUT,
  );
});
