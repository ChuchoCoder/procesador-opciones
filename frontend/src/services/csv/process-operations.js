import { parseOperationsCsv } from './parser.js';
import { validateAndFilterRows } from './validators.js';
import { consolidateOperations } from './consolidator.js';
import { createDevLogger } from '../logging/dev-logger.js';
import { normalizeOperationRows } from './legacy-normalizer.js';

const LARGE_FILE_WARNING_THRESHOLD = 25000;
const MAX_ROWS = 50000;

const getNow = () => {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
};

const timestampFormatter =
  typeof Intl !== 'undefined'
    ? new Intl.DateTimeFormat('es-AR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      })
    : null;

const formatTimestamp = (date) => {
  if (!timestampFormatter) {
    return date.toISOString();
  }
  return timestampFormatter.format(date);
};

const combineExclusions = (...sources) =>
  sources.reduce((acc, source) => {
    if (!source) {
      return acc;
    }

    Object.entries(source).forEach(([reason, count]) => {
      acc[reason] = (acc[reason] ?? 0) + count;
    });

    return acc;
  }, {});

const sumExclusions = (exclusions) =>
  Object.values(exclusions).reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0);

const computeGroupStats = (operations) => {
  if (!Array.isArray(operations) || operations.length === 0) {
    return {
      rows: 0,
      netQuantity: 0,
      grossQuantity: 0,
      notional: 0,
    };
  }

  return operations.reduce(
    (aggregated, operation) => {
      aggregated.rows += 1;
      aggregated.netQuantity += operation.totalQuantity;
      aggregated.grossQuantity += Math.abs(operation.totalQuantity);
      aggregated.notional += operation.totalQuantity * operation.averagePrice;
      return aggregated;
    },
    {
      rows: 0,
      netQuantity: 0,
      grossQuantity: 0,
      notional: 0,
    },
  );
};

const roundNumber = (value, decimals = 4) => {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

const buildWarnings = (meta) => {
  if (!meta) {
    return [];
  }

  const warnings = [];

  if (meta.warningThresholdExceeded) {
    warnings.push('largeFileThreshold');
  }

  if (meta.exceededMaxRows) {
    warnings.push('maxRowsExceeded');
  }

  if (Array.isArray(meta.errors) && meta.errors.length > 0) {
    warnings.push('parseErrors');
  }

  return warnings;
};

const normalizeParseMeta = (rows, meta = {}) => {
  const rowCount = meta.rowCount ?? rows.length ?? 0;

  return {
    rowCount,
    warningThresholdExceeded:
      meta.warningThresholdExceeded ?? rowCount > LARGE_FILE_WARNING_THRESHOLD,
    exceededMaxRows: meta.exceededMaxRows ?? rowCount > MAX_ROWS,
    errors: Array.isArray(meta.errors) ? meta.errors : [],
  };
};

const resolveRows = async ({ rows, file, parserConfig }) => {
  if (Array.isArray(rows)) {
    return {
      rows,
      meta: normalizeParseMeta(rows, { rowCount: rows.length }),
    };
  }

  if (!file) {
    throw new Error('Debes proporcionar un archivo CSV o filas procesadas para continuar.');
  }

  const parsed = await parseOperationsCsv(file, parserConfig);
  return {
    rows: parsed.rows,
    meta: normalizeParseMeta(parsed.rows, parsed.meta),
  };
};

const resolveFileName = ({ fileName, file }) => {
  if (typeof fileName === 'string' && fileName.length > 0) {
    return fileName;
  }
  if (file && typeof file.name === 'string') {
    return file.name;
  }
  return 'operaciones.csv';
};

const formatLogFileInfo = (name, rowCount) => `${name} | filas: ${rowCount}`;

const sanitizeConfiguration = (configuration) => {
  if (!configuration) {
    throw new Error('Falta la configuración activa para procesar operaciones.');
  }
  return configuration;
};

export const processOperations = async ({
  file,
  rows,
  configuration,
  fileName,
  parserConfig,
} = {}) => {
  const activeConfiguration = sanitizeConfiguration(configuration);
  const logger = createDevLogger('Procesamiento');
  const timer = logger.time('processOperations');
  const startTime = getNow();

  const resolvedFileName = resolveFileName({ fileName, file });
  const { rows: parsedRows, meta: parseMeta } = await resolveRows({ rows, file, parserConfig });

  logger.log(`Inicio de procesamiento - ${formatLogFileInfo(resolvedFileName, parseMeta.rowCount)}`);

  const { rows: normalizedRows, missingColumns } = normalizeOperationRows(parsedRows, activeConfiguration);

  if (missingColumns.length > 0) {
    const unresolvedColumns = missingColumns.filter((column) =>
      normalizedRows.every((row) => row[column] === null || row[column] === undefined),
    );

    if (unresolvedColumns.length === missingColumns.length) {
      throw new Error(`Faltan columnas requeridas: ${unresolvedColumns.join(', ')}.`);
    }
  }

  let validated;
  try {
    validated = validateAndFilterRows({ rows: normalizedRows, configuration: activeConfiguration });
  } catch (error) {
    logger.warn('Validación fallida', { error: error.message });
    throw error;
  }

  const consolidation = consolidateOperations(validated.operations, {
    useAveraging: Boolean(activeConfiguration.useAveraging),
  });

  const combinedExclusions = combineExclusions(validated.exclusions, consolidation.exclusions);
  const totalExcluded = sumExclusions(combinedExclusions);

  logger.log(
    `Filtrado completo - filas válidas: ${validated.operations.length}, excluidas: ${totalExcluded}`,
  );
  logger.log(
    `Clasificación - CALLS: ${consolidation.calls.length}, PUTS: ${consolidation.puts.length}`,
  );
  logger.log('Detalle exclusiones', combinedExclusions);

  const callsStats = computeGroupStats(consolidation.calls);
  const putsStats = computeGroupStats(consolidation.puts);

  const warnings = buildWarnings(parseMeta);
  const processedAt = formatTimestamp(new Date());

  const callsRows = consolidation.calls.length;
  const putsRows = consolidation.puts.length;
  const totalRows = callsRows + putsRows;

  const durationFromLogger = timer({
    fileName: resolvedFileName,
    totalRows,
    warnings,
  });

  const durationMs = roundNumber(durationFromLogger || getNow() - startTime, 2);
  logger.log(`Procesamiento completo - duración: ${durationMs}ms`);

  return {
    summary: {
      callsRows,
      putsRows,
      totalRows,
      averagingEnabled: Boolean(activeConfiguration.useAveraging),
      activeSymbol: activeConfiguration.activeSymbol ?? '',
      activeExpiration: activeConfiguration.activeExpiration ?? '',
      processedAt,
      fileName: resolvedFileName,
      rawRowCount: parseMeta.rowCount,
      validRowCount: validated.operations.length,
      excludedRowCount: totalExcluded,
      warnings,
      durationMs,
    },
    calls: {
      operations: consolidation.calls,
      stats: {
        ...callsStats,
        notional: roundNumber(callsStats.notional, 4),
      },
    },
    puts: {
      operations: consolidation.puts,
      stats: {
        ...putsStats,
        notional: roundNumber(putsStats.notional, 4),
      },
    },
    exclusions: {
      combined: combinedExclusions,
      validation: validated.exclusions,
      consolidation: consolidation.exclusions,
    },
    meta: {
      parse: parseMeta,
    },
  };
};
