import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import App from '../../src/app/App.jsx';
import { ROUTES } from '../../src/app/routes.jsx';
import { ConfigProvider } from '../../src/state/config-context.jsx';
import { storageKeys } from '../../src/services/storage/local-storage.js';

const TEST_TIMEOUT = 15000;

const renderSettingsApp = () =>
  render(
    <MemoryRouter initialEntries={[ROUTES.settings]}>
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
    'allows managing prefix rules and expirations with persistence and restore defaults',
    async () => {
      const user = userEvent.setup();
      const { unmount } = renderSettingsApp();

      const prefixInput = await screen.findByTestId('settings-prefix-input');
      const symbolInput = screen.getByTestId('settings-prefix-symbol-input');
      const decimalsInput = screen.getByTestId('settings-prefix-decimals-input');

      await user.type(prefixInput, 'gfg');
      await user.type(symbolInput, 'ggal');
      await user.clear(decimalsInput);
      await user.type(decimalsInput, '1');
      await user.click(screen.getByTestId('settings-add-prefix'));

      const prefixList = await screen.findByTestId('settings-prefix-list');
      expect(within(prefixList).getByText(/Prefijo GFG/i)).toBeInTheDocument();

      const expirationCodeInput = screen.getByTestId('prefix-expiration-code-GFG');
      const expirationDecimalsInput = screen.getByTestId('prefix-expiration-decimals-input-GFG');
      await user.type(expirationCodeInput, 'O');
      await user.clear(expirationDecimalsInput);
      await user.type(expirationDecimalsInput, '1');
      await user.click(screen.getByTestId('prefix-add-expiration-GFG'));

      const expirationOverrideDecimals = await screen.findByTestId('prefix-expiration-decimals-GFG-O');
      expect(expirationOverrideDecimals).toHaveValue(1);

      const strikeTokenInput = screen.getByTestId('prefix-strike-token-GFG-O');
      const strikeDecimalsInput = screen.getByTestId('prefix-strike-decimals-GFG-O');
      await user.type(strikeTokenInput, '47343');
      await user.clear(strikeDecimalsInput);
      await user.type(strikeDecimalsInput, '1');
      await user.click(screen.getByTestId('prefix-add-strike-GFG-O'));

      expect(within(prefixList).getByText('47343')).toBeInTheDocument();

  await user.click(screen.getByTestId('sidebar-nav-settings-expirations'));

      const expirationNameInput = await screen.findByTestId('settings-expiration-name');
      const expirationSuffixInput = screen.getByTestId('settings-expiration-suffix');
      const addExpirationButton = screen.getByTestId('settings-add-expiration');

      await user.type(expirationNameInput, 'Marzo');
      await user.type(expirationSuffixInput, 'MAR');
      await user.click(addExpirationButton);

      const expirationsList = await screen.findByTestId('settings-expirations-list');
      expect(within(expirationsList).getByText('Marzo')).toBeInTheDocument();
      expect(within(expirationsList).getByText('MAR')).toBeInTheDocument();

      const storedPrefixRules = window.localStorage.getItem(storageKeys.prefixRules);
      expect(storedPrefixRules).toContain('GFG');

      const storedExpirations = window.localStorage.getItem(storageKeys.expirations);
      expect(storedExpirations).toContain('Marzo');

      unmount();
      renderSettingsApp();

      const persistedPrefixList = await screen.findByTestId('settings-prefix-list');
      expect(within(persistedPrefixList).getByText(/Prefijo GFG/i)).toBeInTheDocument();
      expect(within(persistedPrefixList).getByText('47343')).toBeInTheDocument();

  await user.click(screen.getByTestId('sidebar-nav-settings-expirations'));

      const persistedExpirationsList = await screen.findByTestId('settings-expirations-list');
      expect(within(persistedExpirationsList).getByText('Marzo')).toBeInTheDocument();
      expect(within(persistedExpirationsList).getByText('MAR')).toBeInTheDocument();

      const restoreDefaultsButton = screen.getByTestId('settings-restore-defaults');
      await user.click(restoreDefaultsButton);

      expect(window.localStorage.getItem(storageKeys.prefixRules)).not.toContain('GFG');
      expect(window.localStorage.getItem(storageKeys.expirations)).not.toContain('Marzo');

  await user.click(screen.getByTestId('sidebar-nav-settings-prefixes'));

      await waitFor(() => {
        expect(screen.queryByTestId('settings-prefix-list')).not.toBeInTheDocument();
      });

  await user.click(screen.getByTestId('sidebar-nav-settings-expirations'));

      const defaultsExpirationsList = await screen.findByTestId('settings-expirations-list');
      expect(within(defaultsExpirationsList).queryByText('Marzo')).not.toBeInTheDocument();
    },
    TEST_TIMEOUT,
  );
});
