import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';

import OperationsTable from '../../src/components/Processor/OperationsTable.jsx';
import strings from '../../src/strings/es-AR.js';
import theme from '../../src/app/theme.js';

describe('OperationsTable', () => {
  afterEach(() => {
    cleanup();
  });

  const baseProps = {
    title: strings.processor.tables.callsTitle,
    strings: strings.processor,
    testId: 'operations-table',
  };

  const renderWithTheme = (component) => {
    return render(<ThemeProvider theme={theme}>{component}</ThemeProvider>);
  };
  
  describe('net total display', () => {
    it('should display "Neto" column header', () => {
      renderWithTheme(
        <OperationsTable
          {...baseProps}
          operations={[]}
        />,
      );

      expect(screen.getByText('Neto')).toBeInTheDocument();
    });

    it('should display net total for BUY operations (gross + fees)', () => {
      const grossNotional = 10000;
      const feeAmount = 100;
      const expectedNetTotal = 10100; // gross + fees for BUY

      renderWithTheme(
        <OperationsTable
          {...baseProps}
          operations={[
            {
              originalSymbol: 'GGALENE24C120',
              totalQuantity: 5, // Positive = BUY
              strike: 120,
              averagePrice: 10.5,
              grossNotional,
              feeAmount,
              feeBreakdown: {
                commissionPct: 0.0006,
                rightsPct: 0.00005,
                vatPct: 0.21,
                commissionAmount: 60,
                rightsAmount: 5,
                vatAmount: 35,
                category: 'option',
                source: 'config',
              },
            },
          ]}
        />,
      );

      // Check that the formatted net total is displayed (10.100,00 in es-AR format)
      expect(screen.getByText('10.100,00')).toBeInTheDocument();
    });

    it('should display net total for SELL operations (gross - fees)', () => {
      const grossNotional = 10000;
      const feeAmount = 100;
      const expectedNetTotal = 9900; // gross - fees for SELL

      renderWithTheme(
        <OperationsTable
          {...baseProps}
          operations={[
            {
              originalSymbol: 'GGALENE24C120',
              totalQuantity: -5, // Negative = SELL
              strike: 120,
              averagePrice: 10.5,
              grossNotional,
              feeAmount,
              feeBreakdown: {
                commissionPct: 0.0006,
                rightsPct: 0.00005,
                vatPct: 0.21,
                commissionAmount: 60,
                rightsAmount: 5,
                vatAmount: 35,
                category: 'option',
                source: 'config',
              },
            },
          ]}
        />,
      );

      // Check that the formatted net total is displayed (9.900,00 in es-AR format)
      expect(screen.getByText('9.900,00')).toBeInTheDocument();
    });

    it('should handle zero fees correctly', () => {
      const grossNotional = 5000;
      const feeAmount = 0;

      renderWithTheme(
        <OperationsTable
          {...baseProps}
          operations={[
            {
              originalSymbol: 'GGALENE24C120',
              totalQuantity: 10,
              strike: 120,
              averagePrice: 10.5,
              grossNotional,
              feeAmount,
              feeBreakdown: null,
            },
          ]}
        />,
      );

      // Net total should equal gross when fees are zero
      expect(screen.getByText('5.000,00')).toBeInTheDocument();
    });
  });
});

