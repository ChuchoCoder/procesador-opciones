import Papa from 'papaparse';

const MAX_ROWS = 50000;
const LARGE_FILE_WARNING_THRESHOLD = 25000;

const NUMERIC_HEADERS = ['quantity', 'price', 'strike'];

const defaultDynamicTyping = NUMERIC_HEADERS.reduce(
  (acc, header) => {
    acc[header] = true;
    return acc;
  },
  {},
);

const isEmptyRow = (row) =>
  Object.values(row).every((value) => value === null || value === undefined || value === '');

const sanitizeRow = (row) => {
  const trimmedEntries = Object.entries(row).reduce((acc, [key, value]) => {
    if (typeof value === 'string') {
      acc[key.trim()] = value.trim();
    } else {
      acc[key.trim()] = value;
    }
    return acc;
  }, {});

  return trimmedEntries;
};

export const parseOperationsCsv = (input, config = {}) =>
  new Promise((resolve, reject) => {
    const rows = [];
    let rowCount = 0;
    let exceededMaxRows = false;
    let warningThresholdExceeded = false;

    const parserConfig = {
      header: true,
      skipEmptyLines: 'greedy',
      worker: false,
      dynamicTyping: defaultDynamicTyping,
      delimitersToGuess: [',', ';', '\t'],
      transformHeader: (header) => header.trim(),
      ...config,
      step: (results, parser) => {
        const row = sanitizeRow(results.data);
        if (!isEmptyRow(row)) {
          rows.push(row);
          rowCount += 1;
        }

        if (rowCount === LARGE_FILE_WARNING_THRESHOLD) {
          warningThresholdExceeded = true;
        }

        if (rowCount >= MAX_ROWS) {
          exceededMaxRows = true;
          parser.abort();
        }

        if (typeof config.step === 'function') {
          config.step(results, parser);
        }
      },
      complete: (results, file) => {
        if (typeof config.complete === 'function') {
          config.complete(results, file);
        }

        resolve({
          rows,
          meta: {
            rowCount,
            exceededMaxRows,
            warningThresholdExceeded,
            errors: results.errors ?? [],
          },
        });
      },
      error: (error, file) => {
        if (typeof config.error === 'function') {
          config.error(error, file);
        }
        reject(error);
      },
    };

    Papa.parse(input, parserConfig);
  });

export const createCsvStringFromRows = (rows, headers) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return '';
  }

  return Papa.unparse({
    fields: headers,
    data: rows.map((row) => headers.map((header) => row[header] ?? '')),
  });
};
