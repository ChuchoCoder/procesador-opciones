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

describe('CompraVentaView net total display', () => {
  afterEach(() => {
    cleanup();
  });

  it('should display "Neto" column header in both tables', () => {
    renderWithTheme(
      <CompraVentaView
        operations={[]}
        groupOptions={[]}
        selectedGroupId={null}
        strings={strings.processor}
        expirationLabels={new Map()}
        onGroupChange={() => {}}
      />,
    );

    // Should find "Neto" in both BUY and SELL tables
    const netoHeaders = screen.getAllByText('Neto');
    expect(netoHeaders.length).toBeGreaterThanOrEqual(2); // At least 2 (BUY and SELL tables)
  });

  it('should display net total for BUY operations (gross + fees)', () => {
    const grossNotional = 10000;
    const feeAmount = 100;
    // Expected net total = 10100 (gross + fees for BUY)

    renderWithTheme(
      <CompraVentaView
        operations={[
          {
            id: 'buy-1',
            symbol: 'GGAL',
            originalSymbol: 'GGAL',
            optionType: null,
            settlement: 'CI',
            quantity: 100, // Positive = BUY
            price: 100,
            feeAmount,
            grossNotional,
            feeBreakdown: {
              commissionPct: 0.0006,
              rightsPct: 0.00005,
              vatPct: 0.21,
              commissionAmount: 60,
              rightsAmount: 5,
              vatAmount: 35,
              category: 'accionCedear',
              source: 'config',
            },
            side: 'BUY',
          },
        ]}
        groupOptions={[]}
        selectedGroupId={null}
        strings={strings.processor}
        expirationLabels={new Map()}
        onGroupChange={() => {}}
      />,
    );

    // Check that the formatted net total is displayed in BUY table
    const buyTable = screen.getByTestId('processor-buy-table');
    expect(buyTable).toHaveTextContent('10.100,00');
  });

  it('should display net total for SELL operations (gross - fees)', () => {
    const grossNotional = 10000;
    const feeAmount = 100;
    // Expected net total = 9900 (gross - fees for SELL)

    renderWithTheme(
      <CompraVentaView
        operations={[
          {
            id: 'sell-1',
            symbol: 'GGAL',
            originalSymbol: 'GGAL',
            optionType: null,
            settlement: 'CI',
            quantity: -100, // Negative = SELL
            price: 100,
            feeAmount,
            grossNotional,
            feeBreakdown: {
              commissionPct: 0.0006,
              rightsPct: 0.00005,
              vatPct: 0.21,
              commissionAmount: 60,
              rightsAmount: 5,
              vatAmount: 35,
              category: 'accionCedear',
              source: 'config',
            },
            side: 'SELL',
          },
        ]}
        groupOptions={[]}
        selectedGroupId={null}
        strings={strings.processor}
        expirationLabels={new Map()}
        onGroupChange={() => {}}
      />,
    );

    // Check that the formatted net total is displayed in SELL table
    const sellTable = screen.getByTestId('processor-sell-table');
    expect(sellTable).toHaveTextContent('9.900,00');
  });

  it('should handle mixed BUY and SELL operations correctly', () => {
    renderWithTheme(
      <CompraVentaView
        operations={[
          {
            id: 'buy-1',
            symbol: 'GGAL',
            settlement: 'CI',
            quantity: 100, // BUY
            price: 100,
            feeAmount: 50,
            grossNotional: 10000,
            feeBreakdown: null,
            side: 'BUY',
          },
          {
            id: 'sell-1',
            symbol: 'YPF',
            settlement: 'CI',
            quantity: -50, // SELL
            price: 200,
            feeAmount: 50,
            grossNotional: 10000,
            feeBreakdown: null,
            side: 'SELL',
          },
        ]}
        groupOptions={[]}
        selectedGroupId={null}
        strings={strings.processor}
        expirationLabels={new Map()}
        onGroupChange={() => {}}
      />,
    );

    // BUY: 10000 + 50 = 10050 (should be in BUY table)
    const buyTable = screen.getByTestId('processor-buy-table');
    expect(buyTable).toHaveTextContent('10.050,00');
    
    // SELL: 10000 - 50 = 9950 (should be in SELL table)
    const sellTable = screen.getByTestId('processor-sell-table');
    expect(sellTable).toHaveTextContent('9.950,00');
  });
});
