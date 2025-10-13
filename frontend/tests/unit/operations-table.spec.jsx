import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

import OperationsTable from '../../src/components/Processor/OperationsTable.jsx';
import strings from '../../src/strings/es-AR.js';

describe('OperationsTable inferred indicator', () => {
  afterEach(() => {
    cleanup();
  });

  const baseProps = {
    title: strings.processor.tables.callsTitle,
    strings: strings.processor,
    testId: 'operations-table',
  };

  it('shows inferred indicator when any leg was detected from token', () => {
    render(
      <OperationsTable
        {...baseProps}
        operations={[
          {
            originalSymbol: 'GGALENE24C120',
            totalQuantity: 3,
            strike: 120,
            averagePrice: 10.5,
            legs: [{ meta: { detectedFromToken: true } }],
          },
        ]}
      />,
    );

    expect(screen.getByTestId('operations-inferred-indicator')).toBeInTheDocument();
  });

  it('does not render indicator when no legs were detected from token', () => {
    render(
      <OperationsTable
        {...baseProps}
        operations={[
          {
            originalSymbol: 'GGALENE24C120',
            totalQuantity: 3,
            strike: 120,
            averagePrice: 10.5,
            legs: [{ meta: { detectedFromToken: false } }],
          },
        ]}
      />,
    );

    expect(screen.queryByTestId('operations-inferred-indicator')).not.toBeInTheDocument();
  });
});
