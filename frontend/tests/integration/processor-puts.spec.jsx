import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import App from '../../src/app/App.jsx';
import { ConfigProvider } from '../../src/state/config-context.jsx';
import { storageKeys } from '../../src/services/storage/local-storage.js';
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
      const user = userEvent.setup();
      renderProcessorApp();

      const fileInput = await screen.findByTestId('processor-file-input');
      const csvFile = new File([ggalPutsCsv], 'GGAL-PUTS.csv', { type: 'text/csv' });
      await user.upload(fileInput, csvFile);

      const processButton = screen.getByTestId('processor-process-button');
      expect(processButton).toBeEnabled();
      await user.click(processButton);

      const putsCount = await screen.findByTestId('summary-puts-count');
      expect(putsCount).toHaveTextContent('4');

      const callsCount = screen.getByTestId('summary-calls-count');
      expect(callsCount).toHaveTextContent('0');

      const putsTable = await screen.findByTestId('puts-table');
      const rows = within(putsTable).getAllByRole('row');
      expect(rows.length).toBeGreaterThan(1);

      ['-12', '-6', '-17', '-15'].forEach((quantity) => {
        expect(within(putsTable).getByText(quantity)).toBeInTheDocument();
      });

      ['330', '350', '337', '354'].forEach((price) => {
        expect(within(putsTable).getByText(new RegExp(price))).toBeInTheDocument();
      });

      expect(within(putsTable).getAllByText(/4734/).length).toBeGreaterThan(0);
    },
    TEST_TIMEOUT,
  );
});
