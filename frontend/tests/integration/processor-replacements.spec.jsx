import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import App from '../../src/app/App.jsx';
import { ConfigProvider } from '../../src/state/config-context.jsx';
import { storageKeys } from '../../src/services/storage/local-storage.js';
import partialFilledCsv from './data/Partial-Filled-GGAL-PUTS.csv?raw';

const TEST_TIMEOUT = 20000;

const renderProcessorApp = () =>
  render(
    <MemoryRouter initialEntries={["/processor"]}>
      <ConfigProvider>
        <App />
      </ConfigProvider>
    </MemoryRouter>,
  );

describe('Processor flow integration - replacement order handling', () => {
  beforeEach(() => {
    window.localStorage.clear();

    window.localStorage.setItem(
      storageKeys.prefixRules,
      JSON.stringify({
        GFG: {
          symbol: 'GGAL',
          defaultDecimals: 0,
          strikeOverrides: {},
          expirationOverrides: {
            O: { defaultDecimals: 1, strikeOverrides: {} },
          },
        },
      }),
    );
    window.localStorage.setItem(
      storageKeys.expirations,
      JSON.stringify({
        Octubre: { suffixes: ['O'] },
      }),
    );
    window.localStorage.setItem(storageKeys.activeExpiration, JSON.stringify('Octubre'));
    window.localStorage.setItem(storageKeys.useAveraging, JSON.stringify(true));

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
    'ignores replacement acknowledgements when consolidating averaged quantities',
    async () => {
      const user = userEvent.setup();
      renderProcessorApp();

      let fileInput = screen.queryByTestId('file-menu-input');
      if (!fileInput) {
        await waitFor(() => {
          expect(document.querySelector('input[type="file"]')).not.toBeNull();
        });
        fileInput = document.querySelector('input[type="file"]');
      }
      const csvFile = new File([partialFilledCsv], 'Partial-Filled-GGAL-PUTS.csv', { type: 'text/csv' });
      await user.upload(fileInput, csvFile);

      await screen.findByTestId('group-filter');
      const ggalOption = await screen.findByTestId('group-filter-option-ggal--o');

      await user.click(ggalOption);
      await waitFor(() => {
        expect(ggalOption).toHaveAttribute('aria-pressed', 'true');
      });

      const putsTable = await screen.findByTestId('processor-puts-table');
      const averagingSwitch = within(putsTable).getByRole('switch', { name: /promediar/i });
      expect(averagingSwitch).toBeChecked();

      await waitFor(() => {
        expect(within(putsTable).getByText('-22')).toBeInTheDocument();
      });

      expect(within(putsTable).getByText(/21[,.]286/)).toBeInTheDocument();
      expect(within(putsTable).queryByText('-44')).toBeNull();
    },
    TEST_TIMEOUT,
  );
});
