import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';

import CompraVentaView from '../../src/components/Processor/CompraVentaView.jsx';
import strings from '../../src/strings/es-AR.js';
import theme from '../../src/app/theme.js';

const renderWithTheme = (ui) => render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

describe('CompraVentaView settlement labels', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows option expirations using month names when available', () => {
    const expirationLabels = new Map([
      ['O', 'Octubre'],
    ]);

    renderWithTheme(
      <CompraVentaView
        operations={[
          {
            id: 'opt-1',
            symbol: 'GFGOCT24C',
            originalSymbol: 'GFGOCT24C',
            optionType: 'CALL',
            expiration: 'O',
            quantity: 10,
            price: 120,
            settlement: 'CI',
            feeAmount: 0,
            grossNotional: 0,
            feeBreakdown: null,
            side: 'BUY',
          },
          {
            id: 'equity-1',
            symbol: 'AL30',
            optionType: null,
            settlement: 'CI',
            quantity: 5,
            price: 100,
            feeAmount: 0,
            grossNotional: 0,
            feeBreakdown: null,
            side: 'SELL',
          },
        ]}
        groupOptions={[]}
        selectedGroupId={null}
        strings={strings.processor}
        expirationLabels={expirationLabels}
        onGroupChange={() => {}}
      />,
    );

    expect(screen.getByText('Octubre')).toBeInTheDocument();
    expect(screen.getAllByText('CI').length).toBeGreaterThan(0);
  });
});
