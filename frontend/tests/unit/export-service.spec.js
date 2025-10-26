/* eslint-env node, jest */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { exportReportToCsv, EXPORT_SCOPES } from '../../src/services/csv/export-service.js';

const buildAnchor = () => ({
  setAttribute: vi.fn(),
  style: {},
  click: vi.fn(),
});

const buildDocumentStub = () => ({
  createElement: vi.fn(() => buildAnchor()),
  body: {
    appendChild: vi.fn(),
    removeChild: vi.fn(),
  },
});

const baseReport = {
  summary: {
    activeSymbol: 'GGAL',
    activeExpiration: 'ENE24',
  },
  calls: {
    operations: [
      {
        originalSymbol: 'GGALENE24C120',
        totalQuantity: 3,
        strike: 120,
        averagePrice: 10.5,
      },
      {
        originalSymbol: 'GGALENE24C125',
        totalQuantity: -2,
        strike: 125.5,
        averagePrice: 9.75,
      },
    ],
  },
  puts: {
    operations: [
      {
        originalSymbol: 'GGALENE24P110',
        totalQuantity: 5,
        strike: 110,
        averagePrice: 1.2345,
      },
    ],
  },
};

describe('export-service', () => {
  let originalCreateObjectURL;
  let originalRevokeObjectURL;
  let OriginalBlob;

  beforeEach(() => {
    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;
    OriginalBlob = globalThis.Blob;

    URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    URL.revokeObjectURL = vi.fn();
    globalThis.Blob = class MockBlob {
      constructor(parts, options) {
        this.parts = parts;
        this.options = options;
      }
    };
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    globalThis.Blob = OriginalBlob;
    vi.restoreAllMocks();
  });

  it('exports CALLS scope to CSV and triggers download element', async () => {
    const documentRef = buildDocumentStub();

    const fileName = await exportReportToCsv({
      report: baseReport,
      scope: EXPORT_SCOPES.CALLS,
      documentRef,
    });

    expect(fileName).toBe('GGAL_ENE24_CALLS.csv');

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    const [blobArg] = URL.createObjectURL.mock.calls[0];
  expect(blobArg.parts).toBeDefined();
  const csvText = blobArg.parts.join('');
  expect(csvText.trim()).toBe(
      ['Cantidad,Strike,Precio', '3,120,10.5', '-2,125.5,9.75'].join('\n'),
    );

    expect(documentRef.createElement).toHaveBeenCalledWith('a');
    const anchor = documentRef.createElement.mock.results[0].value;
    expect(anchor.setAttribute).toHaveBeenCalledWith('download', 'GGAL_ENE24_CALLS.csv');
    expect(anchor.click).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('exports COMBINED scope including call and put sections', async () => {
    const documentRef = buildDocumentStub();

    await exportReportToCsv({
      report: baseReport,
      scope: EXPORT_SCOPES.COMBINED,
      documentRef,
    });

  const [blobArg] = URL.createObjectURL.mock.calls[0];
  const csvText = blobArg.parts.join('');

    expect(csvText.trim()).toBe(
      [
        'Tipo,Cantidad,Strike,Precio',
        'CALLS,3,120,10.5',
        'CALLS,-2,125.5,9.75',
        'PUTS,5,110,1.2345',
      ].join('\n'),
    );
  });

  it('throws a Spanish error when scope has no operations', async () => {
    await expect(
      exportReportToCsv({
        report: {
          summary: baseReport.summary,
          calls: { operations: [] },
          puts: { operations: [] },
        },
        scope: EXPORT_SCOPES.CALLS,
      }),
    ).rejects.toThrowError('No hay datos disponibles en el ámbito seleccionado.');
  });
});
