import { CLIPBOARD_SCOPES } from './clipboard-service.js';

export const EXPORT_SCOPES = { ...CLIPBOARD_SCOPES };

const quantityFormatter = typeof Intl !== 'undefined'
  ? new Intl.NumberFormat('en-US', {
      useGrouping: false,
      maximumFractionDigits: 0,
    })
  : null;

const decimalFormatter = typeof Intl !== 'undefined'
  ? new Intl.NumberFormat('en-US', {
      useGrouping: false,
      minimumFractionDigits: 0,
      maximumFractionDigits: 4,
    })
  : null;

const formatQuantity = (value) => {
  if (!Number.isFinite(value)) {
    return '';
  }
  if (quantityFormatter) {
    return quantityFormatter.format(value);
  }
  return String(value);
};

const formatDecimal = (value) => {
  if (!Number.isFinite(value)) {
    return '';
  }
  if (decimalFormatter) {
    return decimalFormatter.format(value);
  }
  return String(value);
};

const getOperations = (report, scope) => {
  const calls = report?.calls?.operations ?? [];
  const puts = report?.puts?.operations ?? [];

  switch (scope) {
    case CLIPBOARD_SCOPES.CALLS:
      return { label: 'CALLS', operations: calls };
    case CLIPBOARD_SCOPES.PUTS:
      return { label: 'PUTS', operations: puts };
    case CLIPBOARD_SCOPES.COMBINED:
      return { label: 'COMBINED', operations: [...calls, ...puts], calls, puts };
    default:
      return { label: scope, operations: [] };
  }
};

const buildCsvLines = (operations) => {
  const header = 'Cantidad,Strike,Precio';
  const rows = operations.map(
    (operation) =>
      [
        formatQuantity(operation.totalQuantity),
        formatDecimal(operation.strike),
        formatDecimal(operation.averagePrice),
      ].join(','),
  );
  return [header, ...rows];
};

const buildCombinedLines = (calls, puts) => {
  const header = 'Tipo,Cantidad,Strike,Precio';
  const callRows = (calls ?? []).map((operation) =>
    [
      'CALLS',
      formatQuantity(operation.totalQuantity),
      formatDecimal(operation.strike),
      formatDecimal(operation.averagePrice),
    ].join(','),
  );
  const putRows = (puts ?? []).map((operation) =>
    [
      'PUTS',
      formatQuantity(operation.totalQuantity),
      formatDecimal(operation.strike),
      formatDecimal(operation.averagePrice),
    ].join(','),
  );
  return [header, ...callRows, ...putRows];
};

const buildFileName = (report, scope) => {
  const symbol = report?.summary?.activeSymbol ?? 'OPERACIONES';
  const expiration = report?.summary?.activeExpiration ?? 'GEN';
  const suffix = scope ?? 'COMBINED';
  return `${symbol}_${expiration}_${suffix}.csv`;
};

export const exportReportToCsv = async ({ report, scope, documentRef }) => {
  if (!report) {
    throw new Error('No hay datos para exportar.');
  }

  const { operations, calls, puts } = getOperations(report, scope);
  if (!operations || operations.length === 0) {
    throw new Error('No hay datos disponibles en el ámbito seleccionado.');
  }

  const lines =
    scope === CLIPBOARD_SCOPES.COMBINED
      ? buildCombinedLines(calls, puts)
      : buildCsvLines(operations);

  const csvContent = `${lines.join('\n')}\n`;
  const fileName = buildFileName(report, scope);

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = (typeof URL !== 'undefined' && URL.createObjectURL)
    ? URL.createObjectURL(blob)
    : null;

  if (!url) {
    throw new Error('No se pudo crear el archivo para descargar.');
  }

  const doc = documentRef ?? (typeof document !== 'undefined' ? document : null);
  if (!doc) {
    throw new Error('No se pudo acceder al documento para iniciar la descarga.');
  }

  const link = doc.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  link.style.display = 'none';
  doc.body.appendChild(link);
  link.click();
  doc.body.removeChild(link);

  if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
    URL.revokeObjectURL(url);
  }

  return fileName;
};
