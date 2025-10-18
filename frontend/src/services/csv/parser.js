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

    // Normalize input so Papa.parse always receives a string or a File/Blob it knows how to handle.
    let normalizedInput = input;
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

    const normalizeAsync = () => {
      try {
        if (input && typeof input === 'object') {
          if (input.arrayBuffer && typeof input.arrayBuffer === 'function') {
            input.arrayBuffer().then((buf) => {
              try {
                normalizedInput = new TextDecoder('utf-8').decode(buf);
              } catch (e) {
                if (typeof console !== 'undefined' && console.warn) {
                  console.warn('CSV decode failed; using original input', e);
                }
              }
              Papa.parse(normalizedInput, parserConfig);
            });
            return true; // parsing will start after promise resolves
          } else if (input instanceof Blob) {
            // leave as is
          } else if (input.data) {
            normalizedInput = input.data;
          }
        }
      } catch (e) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('CSV normalization failed; continuing with original input', e);
        }
      }
      return false;
    };

    const deferred = normalizeAsync();
    if (deferred) {
      return; // we already scheduled Papa.parse
    }

    try {
      Papa.parse(normalizedInput, parserConfig);
    } catch (e) {
      // If normalization fails, proceed with original input so Papa can attempt parse
      // but log (in dev) silently.
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('CSV parse invocation failed', e);
      }
      reject(e);
    }

    Papa.parse(normalizedInput, parserConfig);
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
