import { parseOperationsCsv } from './parser.js';
import { validateAndFilterRows } from './validators.js';
import { buildConsolidatedViews } from './consolidator.js';
import { createDevLogger } from '../logging/dev-logger.js';
import { normalizeOperationRows } from './legacy-normalizer.js';
import { getAllSymbols, loadSymbolConfig } from '../storage-settings.js';
import { normalizeOperation } from '../broker/dedupe-utils.js';
import { enrichOperationsWithFees } from '../fees/fee-enrichment.js';

const OPTION_TOKEN_REGEX = /^([A-Z0-9]+?)([CV])(\d+(?:\.\d+)?)(.*)$/;
const DEFAULT_EXPIRATION = 'NONE';
const UNKNOWN_EXPIRATION = 'UNKNOWN';

/**
 * Load all symbol configurations and create a prefix map
 * @returns {Promise<Object>} Map of prefix → SymbolConfiguration
 */
const loadPrefixMap = async () => {
  const prefixMap = {};
  const symbols = await getAllSymbols();
  
  for (const symbol of symbols) {
    const config = await loadSymbolConfig(symbol);
    if (config && config.prefixes && Array.isArray(config.prefixes)) {
      for (const prefix of config.prefixes) {
        const normalizedPrefix = prefix.toUpperCase().trim();
        if (normalizedPrefix) {
          prefixMap[normalizedPrefix] = config;
        }
      }
    }
    // Support legacy single prefix field
    else if (config && config.prefix) {
      const normalizedPrefix = config.prefix.toUpperCase().trim();
      if (normalizedPrefix) {
        prefixMap[normalizedPrefix] = config;
      }
    }
  }
  
  return prefixMap;
};

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
  
  // Strike decimals are resolved later via configuration overrides; parse the raw numeric value here.
  const strikeValue = Number.parseFloat(strikeGroup);
  
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
    strikeToken: strikeGroup,
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

const clampDecimals = (value, fallback = 0) => {
  if (value === undefined || value === null) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  if (parsed <= 0) {
    return 0;
  }
  if (parsed > 6) {
    return 6;
  }
  return Math.round(parsed);
};

const formatStrikeTokenValue = (strikeToken = '', decimals = 0) => {
  if (!strikeToken) {
    return null;
  }

  const normalizedDecimals = clampDecimals(decimals, 0);

  const normalizedToken = String(strikeToken).trim();
  if (!normalizedToken) {
    return null;
  }

  const digitsOnly = normalizedToken.replace(/[^0-9]/g, '');
  if (!digitsOnly) {
    const numeric = Number.parseFloat(normalizedToken);
    return Number.isFinite(numeric) ? numeric : null;
  }

  if (normalizedDecimals <= 0) {
    const numeric = Number.parseFloat(digitsOnly);
    return Number.isFinite(numeric) ? numeric : null;
  }

  const padded = digitsOnly.padStart(normalizedDecimals + 1, '0');
  const whole = padded.slice(0, -normalizedDecimals) || '0';
  const decimal = padded.slice(-normalizedDecimals);
  const composed = `${whole}.${decimal}`;
  const numeric = Number.parseFloat(composed);
  return Number.isFinite(numeric) ? numeric : null;
};

/**
 * Find the expiration code by checking which expiration has a suffix matching the token
 * @param {string} tokenSuffix - The suffix from the token (e.g., 'O', 'OC', 'OCT')
 * @param {Object} symbolConfig - The symbol configuration with expirations
 * @returns {string} The matching expiration code (e.g., 'OCT') or the original suffix
 */
const findExpirationCodeBySuffix = (tokenSuffix, symbolConfig) => {
  if (!tokenSuffix || !symbolConfig?.expirations) {
    return tokenSuffix || '';
  }

  const upper = tokenSuffix.toUpperCase();
  
  // Check each expiration to see if any of its suffixes match
  for (const [expirationCode, expirationSettings] of Object.entries(symbolConfig.expirations)) {
    if (expirationSettings?.suffixes?.includes(upper)) {
      return expirationCode;
    }
  }
  
  // No match found, return original suffix
  return upper;
};

const resolveExpirationCode = (tokenMatch, explicitExpiration, symbolConfig) => {
  if (tokenMatch?.expiration) {
    return findExpirationCodeBySuffix(tokenMatch.expiration, symbolConfig);
  }
  const normalized = toUpperCase(explicitExpiration);
  if (!normalized) {
    return '';
  }
  const cleaned = normalized.replace(/[^0-9A-Z]/g, '');
  return findExpirationCodeBySuffix(cleaned, symbolConfig);
};

const resolveStrikeDecimals = ({ symbolConfig, strikeToken, expirationCode }) => {
  if (!symbolConfig) {
    return 0;
  }

  // Start with symbol-level default (previously defaultDecimals, now strikeDefaultDecimals)
  let decimals = clampDecimals(symbolConfig.strikeDefaultDecimals ?? symbolConfig.defaultDecimals ?? 0, 0);

  // Check for expiration-level override
  if (expirationCode && symbolConfig.expirations) {
    const expirationConfig = symbolConfig.expirations[expirationCode];
    if (expirationConfig) {
      // Expiration-level default takes priority
      if (expirationConfig.decimals !== undefined) {
        decimals = clampDecimals(expirationConfig.decimals, decimals);
      }
      
      // Check for strike-specific override at expiration level
      if (strikeToken && Array.isArray(expirationConfig.overrides)) {
        const override = expirationConfig.overrides.find(o => o.raw === strikeToken);
        if (override && override.formatted) {
          // Calculate decimals from formatted string
          const decimalIndex = override.formatted.indexOf('.');
          if (decimalIndex >= 0) {
            decimals = override.formatted.length - decimalIndex - 1;
          } else {
            decimals = 0;
          }
        }
      }
    }
  }

  return decimals;
};

const applyPrefixRule = ({ tokenMatch, symbolConfig, explicitExpiration }) => {
  if (!symbolConfig) {
    return {
      symbol: null,
      strike: tokenMatch?.strike,
      decimalsApplied: null,
    };
  }

  const strikeToken = tokenMatch?.strikeToken ?? '';
  const expirationCode = resolveExpirationCode(tokenMatch, explicitExpiration, symbolConfig);
  const decimals = resolveStrikeDecimals({
    symbolConfig,
    strikeToken: strikeToken ? strikeToken.toUpperCase() : '',
    expirationCode,
  });

  const formattedStrike = strikeToken
    ? formatStrikeTokenValue(strikeToken, decimals)
    : null;

  return {
    symbol: symbolConfig.symbol ? toUpperCase(symbolConfig.symbol) : null,
    strike: formattedStrike ?? tokenMatch?.strike ?? null,
    decimalsApplied: decimals,
  };
};

export const enrichOperationRow = async (row = {}, configuration = {}) => {
  const prefixMap = configuration.prefixMap ?? await loadPrefixMap();
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
  const tokenFilledStrike =
    (explicitStrike === null || explicitStrike === undefined || explicitStrike === 0)
    && tokenStrike !== undefined;
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

  const symbolConfig = tokenSymbol ? prefixMap[tokenSymbol] : undefined;
  let appliedDecimals = null;

  if (symbolConfig) {
    const { symbol: mappedSymbol, strike: mappedStrike, decimalsApplied } = applyPrefixRule({
      tokenMatch,
      symbolConfig,
      explicitExpiration: expiration,
    });

    if (mappedSymbol) {
      symbol = mappedSymbol;
    }

    const usingTokenStrike = tokenFilledStrike || (!Number.isFinite(strike) && mappedStrike !== null);
    if (usingTokenStrike && Number.isFinite(mappedStrike)) {
      strike = mappedStrike;
    }

    appliedDecimals = decimalsApplied;
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

  if (symbolConfig) {
    meta.prefixRule = tokenSymbol;
    if (appliedDecimals !== null) {
      meta.strikeDecimals = appliedDecimals;
    }
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
  '1D', '2D', '3D', '4D', '5D', '6D', '7D', '8D', '9D', '10D', '11D', '12D', '13D', '14D', '15D',
  '16D', '17D', '18D', '19D', '20D', '21D', '22D', '23D', '24D', '25D', '26D', '27D', '28D', '29D', '30D',
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
    totalOrders: meta.totalOrders,
    excluded: meta.excluded,
    warningThresholdExceeded:
      meta.warningThresholdExceeded ?? rowCount > LARGE_FILE_WARNING_THRESHOLD,
    exceededMaxRows: meta.exceededMaxRows ?? rowCount > MAX_ROWS,
    errors: Array.isArray(meta.errors) ? meta.errors : [],
  };
};

const resolveRows = async ({ file, parserConfig, dataSource }) => {
  // Data source adapter is required
  if (!dataSource || typeof dataSource.parse !== 'function') {
    throw new Error('Debes proporcionar un adaptador de fuente de datos (dataSource) válido.');
  }

  try {
    const parsed = await dataSource.parse(file, parserConfig);
    return {
      rows: parsed.rows,
      meta: normalizeParseMeta(parsed.rows, parsed.meta),
    };
  } catch (error) {
    const sourceType = typeof dataSource.getSourceType === 'function' 
      ? dataSource.getSourceType() 
      : 'desconocido';
    throw new Error(`Error al procesar datos desde fuente ${sourceType}: ${error.message}`);
  }
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

const normalizeTimestampValue = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const isoCandidate = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T');
    const parsed = Date.parse(isoCandidate);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return null;
};

const resolveTradeTimestamp = (raw = {}) => {
  const candidates = [
    raw.tradeTimestamp,
    raw.trade_timestamp,
    raw.transactTime,
    raw.transact_time,
    raw.executionTime,
    raw.execution_time,
    raw.lastExecutionTime,
    raw.last_execution_time,
    raw.eventTime,
    raw.event_time,
  ];

  for (const candidate of candidates) {
    const parsed = normalizeTimestampValue(candidate);
    if (parsed !== null) {
      return parsed;
    }
  }

  return Date.now();
};

const createNormalizedCsvOperation = (operation) => {
  const rawSource = operation?.raw ?? {};

  return normalizeOperation(
    {
      order_id: operation?.orderId ?? rawSource.order_id ?? operation?.id ?? null,
      operation_id: rawSource.operation_id ?? rawSource.execution_id ?? rawSource.id ?? null,
      symbol: operation?.symbol,
      optionType: operation?.optionType,
      side: operation?.side,
      quantity: operation?.quantity,
      price: operation?.price,
      tradeTimestamp: resolveTradeTimestamp(rawSource),
      strike: operation?.strike,
      expirationDate: operation?.expiration,
      status: operation?.meta?.status ?? rawSource.status ?? null,
      sourceReferenceId: operation?.id ?? rawSource.order_id ?? null,
    },
    'csv',
  );
};

const sanitizeConfiguration = (configuration) => {
  if (!configuration) {
    throw new Error('Falta la configuración activa para procesar operaciones.');
  }
  return configuration;
};

export const processOperations = async ({
  file,
  configuration,
  fileName,
  parserConfig,
  dataSource,
} = {}) => {
  const activeConfiguration = sanitizeConfiguration(configuration);
  
  // Load prefix map from new settings format if not already provided
  if (!activeConfiguration.prefixMap) {
    activeConfiguration.prefixMap = await loadPrefixMap();
  }
  
  const logger = createDevLogger('Procesamiento');
  const timer = logger.time('processOperations');
  const startTime = getNow();

  const resolvedFileName = resolveFileName({ fileName, file });
  const { rows: parsedRows, meta: parseMeta } = await resolveRows({ 
    file, 
    parserConfig,
    dataSource,
  });

  logger.log(`Inicio de procesamiento - ${formatLogFileInfo(resolvedFileName, parseMeta.rowCount)}`);

  // Check for empty file early to provide a clear error message
  if (!parsedRows || parsedRows.length === 0) {
    throw new Error('El archivo CSV no contiene operaciones. Verificá que el archivo tenga datos además del encabezado.');
  }

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

  const enrichedOperations = await Promise.all(validatedRows.map(async (row, index) => {
    const enrichment = await enrichOperationRow(row, activeConfiguration);

    const optionType = enrichment.type === 'CALL' || enrichment.type === 'PUT' ? enrichment.type : 'UNKNOWN';
    const strike = enrichment.strike ?? row.strike ?? null;
    const originalSymbol = typeof row.symbol === 'string' ? row.symbol.trim() : '';

    return {
      id: enrichment.id || String(row.order_id || index),
      orderId: row.order_id,
      originalSymbol: originalSymbol || enrichment.symbol,
      matchedSymbol: enrichment.symbol,
      symbol: enrichment.symbol,
      expiration: enrichment.expiration,
      optionType,
      strike,
      quantity: row.quantity,
      price: row.price,
      side: row.side,
      source: 'csv',
      meta: {
        ...enrichment.meta,
        status: row.status ?? '',
      },
      raw: row.raw ?? row,
    };
  }));

  // Enrich operations with fee calculations (Feature 004)
  const enrichedWithFees = await enrichOperationsWithFees(enrichedOperations);

  // Normalize operations for CSV source (Feature 004-integrate-jsrofex-to)
  const normalizedOperations = enrichedWithFees.map(createNormalizedCsvOperation);

  const optionOperationsForConsolidation = enrichedWithFees.filter(
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
    operations: enrichedWithFees,
    normalizedOperations,
    meta: {
      parse: parseMeta,
    },
  };
};
