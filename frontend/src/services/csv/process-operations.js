import { parseOperationsCsv } from './parser.js';
import { validateAndFilterRows } from './validators.js';
import { buildConsolidatedViews } from './consolidator.js';
import { createDevLogger } from '../logging/dev-logger.js';
import { normalizeOperationRows } from './legacy-normalizer.js';

const OPTION_TOKEN_REGEX = /^([A-Z0-9]+?)([CV])(\d+(?:\.\d+)?)(.*)$/;
const DEFAULT_EXPIRATION = 'NONE';
const UNKNOWN_EXPIRATION = 'UNKNOWN';

const isString = (value) => typeof value === 'string';

const normalizeString = (value) => {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim();
};

const toUpperCase = (value) => normalizeString(value).toUpperCase();

const parseNumeric = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const normalized = normalizeString(value).replace(',', '.');
  if (!normalized) {
    return null;
  }

  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
};

export const parseToken = (token) => {
  if (!isString(token)) {
    return null;
  }

  const candidate = token.trim().toUpperCase();
  if (!candidate) {
    return null;
  }

  const match = candidate.match(OPTION_TOKEN_REGEX);
  if (!match) {
    return null;
  }

  const [, symbol, typeCode, strikeGroup, remainder] = match;
  
  // Parse strike value: if no decimal point and more than 4 digits, treat last digit as decimal
  let strikeValue;
  if (strikeGroup.includes('.')) {
    strikeValue = Number.parseFloat(strikeGroup);
  } else if (strikeGroup.length > 4) {
    // e.g., "47343" -> 4734.3
    const whole = strikeGroup.slice(0, -1);
    const decimal = strikeGroup.slice(-1);
    strikeValue = Number.parseFloat(`${whole}.${decimal}`);
  } else {
    strikeValue = Number.parseFloat(strikeGroup);
  }
  
  if (!Number.isFinite(strikeValue)) {
    return null;
  }

  let expiration = remainder ? remainder.trim() : '';
  if (expiration.startsWith('.')) {
    expiration = expiration.slice(1);
  } else if (expiration.startsWith('-') || expiration.startsWith('_')) {
    expiration = expiration.slice(1);
  }

  expiration = expiration.replace(/[^0-9A-Z]+/g, '');
  const normalizedExpiration = expiration ? expiration.toUpperCase() : UNKNOWN_EXPIRATION;

  return {
    symbol,
    type: typeCode === 'C' ? 'CALL' : 'PUT',
    strike: strikeValue,
    expiration: normalizedExpiration,
  };
};

const tokenizeCandidateString = (value) => {
  if (!isString(value)) {
    return [];
  }

  const upperValue = value.toUpperCase();
  const collapsed = upperValue.replace(/[^0-9A-Z.]/g, '');

  const segments = upperValue
    .split(/[\s|\-_/]+/)
    .map((segment) => segment.replace(/[^0-9A-Z.]/g, ''))
    .filter(Boolean);

  const unique = new Set();
  segments.forEach((segment) => {
    if (segment.length > 3) {
      unique.add(segment);
    }
  });
  if (collapsed) {
    unique.add(collapsed);
  }

  return Array.from(unique);
};

const getTokenCandidates = (row) => {
  if (!row || typeof row !== 'object') {
    return [];
  }

  const sources = [
    row.token,
    row.option_token,
    row.instrumentToken,
    row.instrument_token,
    row.security_id,
    row.securityId,
    row.security,
    row.symbol,
    row.instrument,
    row.text,
    row.description,
    row.security_description,
    row.last_cl_ord_id,
  ];

  const candidates = sources.flatMap((value) => tokenizeCandidateString(value));
  return candidates;
};

const findTokenMatch = (row) => {
  const candidates = getTokenCandidates(row);

  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    const parsed = parseToken(candidate);
    if (parsed) {
      return {
        ...parsed,
        rawValue: candidate,
      };
    }
  }

  return null;
};

const shouldPreferTokenSymbol = (explicitSymbol) => {
  if (!explicitSymbol) {
    return true;
  }

  if (/[0-9]/.test(explicitSymbol)) {
    return true;
  }

  if (explicitSymbol.includes('.') || explicitSymbol.includes('-') || explicitSymbol.includes('_')) {
    return true;
  }

  return false;
};

const deriveSymbolFallback = (row, tokenMatch) => {
  if (tokenMatch && tokenMatch.symbol) {
    return tokenMatch.symbol;
  }

  const symbolString = toUpperCase(row?.symbol);
  if (symbolString) {
    if (symbolString.includes(' - ')) {
      const parts = symbolString.split(' - ').map((part) => part.trim()).filter(Boolean);
      if (parts.length >= 2) {
        return parts[parts.length - 2];
      }
    }
    return symbolString;
  }

  const securityId = toUpperCase(row?.security_id ?? row?.securityId);
  if (securityId) {
    const parts = securityId.split('_').map((part) => part.trim()).filter(Boolean);
    if (parts.length >= 2) {
      return parts[parts.length - 2];
    }
    return securityId;
  }

  const instrument = toUpperCase(row?.instrument ?? row?.text);
  if (instrument) {
    const segments = instrument.split(/[\s\-_/]+/).map((segment) => segment.trim()).filter(Boolean);
    if (segments.length > 0) {
      return segments[segments.length - 1];
    }
    return instrument;
  }

  return 'UNKNOWN';
};

const deriveExpirationFallback = (row, tokenMatch) => {
  if (tokenMatch && tokenMatch.expiration) {
    return tokenMatch.expiration;
  }

  const explicitExpiration = toUpperCase(row?.expiration ?? row?.expire_date ?? row?.activeExpiration);
  if (explicitExpiration) {
    return explicitExpiration;
  }

  const symbolString = toUpperCase(row?.symbol);
  if (symbolString.includes(' - ')) {
    const parts = symbolString.split(' - ').map((part) => part.trim()).filter(Boolean);
    if (parts.length >= 1) {
      return parts[parts.length - 1];
    }
  }

  const securityId = toUpperCase(row?.security_id ?? row?.securityId);
  if (securityId.includes('_')) {
    const parts = securityId.split('_').map((part) => part.trim()).filter(Boolean);
    if (parts.length >= 1) {
      return parts[parts.length - 1];
    }
  }

  return DEFAULT_EXPIRATION;
};

export const enrichOperationRow = (row = {}) => {
  const tokenMatch = findTokenMatch(row);

  const explicitSymbol = toUpperCase(row.symbol);
  const explicitExpiration = toUpperCase(row.expiration);
  const explicitStrike = parseNumeric(row.strike);
  const explicitType = toUpperCase(row.option_type ?? row.type ?? row.optionType);

  const tokenSymbol = tokenMatch?.symbol ?? '';
  const tokenExpiration = tokenMatch?.expiration ?? '';
  const tokenStrike = tokenMatch?.strike;
  const tokenType = tokenMatch?.type ?? '';

  const preferTokenSymbol = shouldPreferTokenSymbol(explicitSymbol);
  let symbol = preferTokenSymbol && tokenSymbol ? tokenSymbol : explicitSymbol;
  let expiration = explicitExpiration;
  let strike = explicitStrike;
  let type = explicitType === 'CALL' || explicitType === 'PUT' ? explicitType : '';

  const tokenFilledSymbol = !explicitSymbol && Boolean(tokenSymbol);
  const tokenFilledExpiration = !explicitExpiration && Boolean(tokenExpiration);
  const tokenFilledStrike = (strike === null || strike === undefined) && tokenStrike !== undefined;
  const tokenFilledType = !type && Boolean(tokenType);

  if (!symbol && tokenSymbol) {
    symbol = tokenSymbol;
  }

  if (!symbol) {
    symbol = deriveSymbolFallback(row, tokenMatch);
  }

  if (!expiration && tokenExpiration) {
    expiration = tokenExpiration;
  }

  if (!expiration || expiration.length === 0) {
    expiration = deriveExpirationFallback(row, tokenMatch);
  }

  if ((!strike || strike === 0) && tokenStrike !== undefined) {
    strike = tokenStrike;
  }

  if (!type && tokenType) {
    type = tokenType;
  }

  const normalizedSymbol = toUpperCase(symbol);
  const normalizedExpiration = expiration ? toUpperCase(expiration) : DEFAULT_EXPIRATION;
  const normalizedStrike = Number.isFinite(strike) ? strike : null;
  const normalizedType = type === 'CALL' || type === 'PUT' ? type : 'UNKNOWN';

  const detectedFromToken =
    tokenFilledSymbol || tokenFilledExpiration || tokenFilledStrike || tokenFilledType;

  const meta = {
    detectedFromToken,
  };

  if (detectedFromToken && tokenMatch?.rawValue) {
    meta.sourceToken = tokenMatch.rawValue;
  }

  return {
    id: String(row.order_id ?? row.id ?? ''),
    symbol: normalizedSymbol || 'UNKNOWN',
    expiration: normalizedExpiration || DEFAULT_EXPIRATION,
    strike: normalizedStrike,
    type: normalizedType,
    meta,
  };
};

const OPTION_GROUP_TYPES = new Set(['CALL', 'PUT']);

const SETTLEMENT_TOKENS = new Set([
  'CI', 'CONTADO', '24HS', '48HS', '72HS', '24H', '48H', '72H', 'T0', 'T1', 'T2', 'T+1', 'T+2',
]);

const MARKET_TOKENS = new Set([
  'MERV', 'XMEV', 'BCBA', 'BYMA', 'ROFEX', 'MATBA', 'MAE', 'NYSE', 'NASDAQ', 'CME', 'ICE',
]);

const MONTH_TOKENS = new Set([
  'EN', 'ENE', 'ENERO',
  'FE', 'FEB', 'FEBRERO',
  'MR', 'MAR', 'MARZO',
  'AB', 'ABR', 'ABRIL',
  'MY', 'MAY', 'MAYO',
  'JN', 'JUN', 'JUNIO',
  'JL', 'JUL', 'JULIO', 'JU',
  'AG', 'AGO', 'AGOSTO',
  'SE', 'SEP', 'SET', 'SEPT', 'SEPTIEMBRE',
  'OC', 'OCT', 'OCTUBRE',
  'NV', 'NOV', 'NOVIEMBRE',
  'DC', 'DIC', 'DICIEMBRE',
  'DU', 'DEU',
]);

const sanitizeInstrumentSegments = (symbol) => {
  if (!symbol) {
    return [];
  }

  const normalized = normalizeString(symbol).toUpperCase();
  if (!normalized) {
    return [];
  }

  const segments = normalized
    .split('-')
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (!segments.length) {
    return [];
  }

  const filtered = segments.slice();

  while (filtered.length > 1 && MARKET_TOKENS.has(filtered[0])) {
    filtered.shift();
  }

  while (filtered.length > 1 && MARKET_TOKENS.has(filtered[0])) {
    filtered.shift();
  }

  while (filtered.length > 1 && SETTLEMENT_TOKENS.has(filtered[filtered.length - 1])) {
    filtered.pop();
  }

  return filtered.length ? filtered : segments;
};

const splitInstrumentSymbol = (symbol) => {
  const segments = sanitizeInstrumentSegments(symbol);

  if (!segments.length) {
    return 'UNKNOWN';
  }

  if (segments.length === 1) {
    return segments[0];
  }

  if (segments.length === 2 && MONTH_TOKENS.has(segments[1])) {
    return segments.join(' ');
  }

  if (segments.length >= 2) {
    const last = segments[segments.length - 1];
    if (MONTH_TOKENS.has(last)) {
      return `${segments[segments.length - 2]} ${last}`;
    }
  }

  return segments[segments.length - 1];
};

const resolveGroupDescriptor = (operation) => {
  const normalizedSymbol = toUpperCase(operation?.symbol) || 'UNKNOWN';
  const normalizedExpiration = toUpperCase(operation?.expiration) || DEFAULT_EXPIRATION;
  const isOption = OPTION_GROUP_TYPES.has(operation?.type);

  if (isOption) {
    const symbol = normalizedSymbol;
    const expiration = normalizedExpiration || DEFAULT_EXPIRATION;
    const id = `${symbol}::${expiration}`;
    return { id, symbol, expiration, kind: 'option' };
  }

  const baseSymbol = splitInstrumentSymbol(normalizedSymbol);
  const expiration = DEFAULT_EXPIRATION;
  const id = `${baseSymbol}::${expiration}`;
  return { id, symbol: baseSymbol, expiration, kind: 'instrument' };
};

export const deriveGroups = (operations = []) => {
  if (!Array.isArray(operations) || operations.length === 0) {
    return [];
  }

  const groupsMap = new Map();

  operations.forEach((operation) => {
    if (!operation) {
      return;
    }

    const descriptor = resolveGroupDescriptor(operation);

    if (!groupsMap.has(descriptor.id)) {
      groupsMap.set(descriptor.id, {
        id: descriptor.id,
        symbol: descriptor.symbol,
        expiration: descriptor.expiration,
        kind: descriptor.kind,
        counts: {
          calls: 0,
          puts: 0,
          total: 0,
        },
      });
    }

    const group = groupsMap.get(descriptor.id);
    if (group.kind !== 'option' && descriptor.kind === 'option') {
      group.kind = 'option';
    }
    group.symbol = descriptor.symbol;
    group.expiration = descriptor.expiration;
    group.counts.total += 1;

    if (operation.type === 'CALL') {
      group.counts.calls += 1;
    } else if (operation.type === 'PUT') {
      group.counts.puts += 1;
    }
  });

  return Array.from(groupsMap.values()).sort((a, b) => {
    if (a.symbol === b.symbol) {
      return a.expiration.localeCompare(b.expiration);
    }
    return a.symbol.localeCompare(b.symbol);
  });
};

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

  const validatedRows = validated.rows ?? [];

  const enrichedOperations = validatedRows.map((row, index) => {
    const enrichment = enrichOperationRow(row);

    const optionType = enrichment.type === 'CALL' || enrichment.type === 'PUT' ? enrichment.type : 'UNKNOWN';
    const strike = enrichment.strike ?? row.strike ?? null;

    return {
      id: enrichment.id || String(row.order_id || index),
      orderId: row.order_id,
      originalSymbol: toUpperCase(row.symbol) || enrichment.symbol,
      matchedSymbol: enrichment.symbol,
      symbol: enrichment.symbol,
      expiration: enrichment.expiration,
      optionType,
      strike,
      quantity: row.quantity,
      price: row.price,
      side: row.side,
      meta: {
        ...enrichment.meta,
        status: row.status ?? '',
      },
      raw: row.raw ?? row,
    };
  });

  const optionOperationsForConsolidation = enrichedOperations.filter(
    (operation) => operation.optionType === 'CALL' || operation.optionType === 'PUT',
  );

  const views = buildConsolidatedViews(optionOperationsForConsolidation);
  const groupSummaries = deriveGroups(
    enrichedOperations.map((operation) => ({
      id: operation.id,
      symbol: operation.symbol,
      expiration: operation.expiration,
      type: operation.optionType,
    })),
  );
  const activeViewKey = activeConfiguration.useAveraging ? 'averaged' : 'raw';
  const processedAt = formatTimestamp(new Date());
  const warnings = buildWarnings(parseMeta);

  const viewSnapshots = Object.fromEntries(
    Object.entries(views).map(([key, consolidated]) => {
      const callsStats = computeGroupStats(consolidated.calls);
      const putsStats = computeGroupStats(consolidated.puts);
      const viewCombinedExclusions = combineExclusions(validated.exclusions, consolidated.exclusions);
      const viewTotalExcluded = sumExclusions(viewCombinedExclusions);

      const callsRows = consolidated.calls.length;
      const putsRows = consolidated.puts.length;
      const totalRows = callsRows + putsRows;

      return [
        key,
        {
          key,
          averagingEnabled: consolidated.useAveraging,
          calls: {
            operations: consolidated.calls,
            stats: {
              ...callsStats,
              notional: roundNumber(callsStats.notional, 4),
            },
          },
          puts: {
            operations: consolidated.puts,
            stats: {
              ...putsStats,
              notional: roundNumber(putsStats.notional, 4),
            },
          },
          summary: {
            callsRows,
            putsRows,
            totalRows,
            averagingEnabled: consolidated.useAveraging,
            activeSymbol: activeConfiguration.activeSymbol ?? '',
            activeExpiration: activeConfiguration.activeExpiration ?? '',
            processedAt,
            fileName: resolvedFileName,
            rawRowCount: parseMeta.rowCount,
            validRowCount: validatedRows.length,
            excludedRowCount: viewTotalExcluded,
            warnings,
            durationMs: 0,
            groups: groupSummaries,
          },
          exclusions: {
            combined: viewCombinedExclusions,
            validation: validated.exclusions,
            consolidation: consolidated.exclusions,
          },
        },
      ];
    }),
  );

  const activeViewSnapshot = viewSnapshots[activeViewKey];
  const totalExcluded = activeViewSnapshot.summary.excludedRowCount;

  logger.log(
    `Filtrado completo - filas válidas: ${validatedRows.length}, excluidas: ${totalExcluded}`,
  );
  logger.log(
    `Clasificación (${activeViewKey}) - CALLS: ${activeViewSnapshot.calls.operations.length}, PUTS: ${activeViewSnapshot.puts.operations.length}`,
  );
  logger.log('Detalle exclusiones', activeViewSnapshot.exclusions.combined);

  const alternateViewKey = activeViewKey === 'raw' ? 'averaged' : 'raw';
  const alternateViewSnapshot = viewSnapshots[alternateViewKey];
  if (alternateViewSnapshot) {
    logger.log(
      `Clasificación (${alternateViewKey}) - CALLS: ${alternateViewSnapshot.calls.operations.length}, PUTS: ${alternateViewSnapshot.puts.operations.length}`,
    );
  }

  const durationFromLogger = timer({
    fileName: resolvedFileName,
    totalRows: activeViewSnapshot.summary.totalRows,
    warnings,
    view: activeViewKey,
  });

  const durationMs = roundNumber(durationFromLogger || getNow() - startTime, 2);
  logger.log(`Procesamiento completo - duración: ${durationMs}ms`);

  Object.values(viewSnapshots).forEach((view) => {
    view.summary.durationMs = durationMs;
  });

  return {
    summary: activeViewSnapshot.summary,
    calls: activeViewSnapshot.calls,
    puts: activeViewSnapshot.puts,
    exclusions: activeViewSnapshot.exclusions,
    views: viewSnapshots,
    activeView: activeViewKey,
    groups: groupSummaries,
    operations: enrichedOperations,
    meta: {
      parse: parseMeta,
    },
  };
};
