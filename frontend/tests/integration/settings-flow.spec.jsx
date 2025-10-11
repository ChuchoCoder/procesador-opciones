import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import App from '../../src/app/App.jsx';
import { ConfigProvider } from '../../src/state/config-context.jsx';
import { storageKeys } from '../../src/services/storage/local-storage.js';

const TEST_TIMEOUT = 15000;

const renderSettingsApp = () =>
  render(
    <MemoryRouter initialEntries={["/settings"]}>
      <ConfigProvider>
        <App />
      </ConfigProvider>
    </MemoryRouter>,
  );

describe('Settings flow integration', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it(
    'allows managing symbols and expirations with persistence and restore defaults',
    async () => {
      const user = userEvent.setup();
      const { unmount } = renderSettingsApp();

      const addSymbolInput = await screen.findByTestId('settings-symbol-input');
      const addSymbolButton = screen.getByTestId('settings-add-symbol');

      await user.type(addSymbolInput, 'ALUA');
      await user.click(addSymbolButton);

      const symbolsList = screen.getByTestId('settings-symbols-list');
      expect(within(symbolsList).getByText('ALUA')).toBeInTheDocument();

      const activeSymbolSelect = screen.getByTestId('settings-active-symbol');
      await user.selectOptions(activeSymbolSelect, 'ALUA');

      const expirationNameInput = screen.getByTestId('settings-expiration-name');
      const expirationSuffixInput = screen.getByTestId('settings-expiration-suffix');
      const addExpirationButton = screen.getByTestId('settings-add-expiration');

      await user.type(expirationNameInput, 'Marzo');
      await user.type(expirationSuffixInput, 'MAR');
      await user.click(addExpirationButton);

      const expirationsList = screen.getByTestId('settings-expirations-list');
      expect(within(expirationsList).getByText('Marzo')).toBeInTheDocument();
      expect(within(expirationsList).getByText('MAR')).toBeInTheDocument();

      const activeExpirationSelect = screen.getByTestId('settings-active-expiration');
      await user.selectOptions(activeExpirationSelect, 'Marzo');

      expect(window.localStorage.getItem(storageKeys.symbols)).toContain('ALUA');
      expect(window.localStorage.getItem(storageKeys.expirations)).toContain('Marzo');

      unmount();
      renderSettingsApp();

      const persistedSymbolsList = await screen.findByTestId('settings-symbols-list');
      expect(within(persistedSymbolsList).getByText('ALUA')).toBeInTheDocument();

      const persistedActiveSymbol = screen.getByTestId('settings-active-symbol');
      expect(persistedActiveSymbol).toHaveValue('ALUA');

      const persistedExpirationsList = screen.getByTestId('settings-expirations-list');
      expect(within(persistedExpirationsList).getByText('Marzo')).toBeInTheDocument();
      expect(within(persistedExpirationsList).getByText('MAR')).toBeInTheDocument();

      const persistedActiveExpiration = screen.getByTestId('settings-active-expiration');
      expect(persistedActiveExpiration).toHaveValue('Marzo');

      const restoreDefaultsButton = screen.getByTestId('settings-restore-defaults');
      await user.click(restoreDefaultsButton);

      expect(window.localStorage.getItem(storageKeys.symbols)).toContain('GGAL');
      expect(window.localStorage.getItem(storageKeys.symbols)).not.toContain('ALUA');
      expect(window.localStorage.getItem(storageKeys.expirations)).not.toContain('Marzo');

      const defaultsSymbolsList = await screen.findByTestId('settings-symbols-list');
      expect(within(defaultsSymbolsList).queryByText('ALUA')).not.toBeInTheDocument();
      expect(within(defaultsSymbolsList).getByText('GGAL')).toBeInTheDocument();
    },
    TEST_TIMEOUT,
  );
});
