import { extractInstrumentToken } from './legacy-normalizer.js';

const REQUIRED_COLUMNS = [
  'order_id',
  'symbol',
  'side',
  'option_type',
  'strike',
  'quantity',
  'price',
];

const EXECUTION_EVENT = 'execution_report';

const STATUS_NORMALIZATION = {
  fully_executed: 'fully_executed',
  partially_executed: 'partially_executed',
  filled: 'fully_executed',
  partial_fill: 'partially_executed',
  ejecutada: 'fully_executed',
  'ejecutada.': 'fully_executed',
  'parcialmente ejecutada': 'partially_executed',
  'parcialmente ejecutado': 'partially_executed',
  'parcialmente ejecutada.': 'partially_executed',
};

const ALLOWED_STATUSES = new Set(['fully_executed', 'partially_executed']);
const ALLOWED_SIDES = new Set(['BUY', 'SELL']);
const ALLOWED_OPTION_TYPES = new Set(['CALL', 'PUT']);

const EXCLUSION_REASONS = {
  missingRequiredField: 'missingRequiredField',
  invalidEventType: 'invalidEventType',
  invalidStatus: 'invalidStatus',
  invalidSide: 'invalidSide',
  invalidOptionType: 'invalidOptionType',
  outOfScope: 'outOfScope',
  invalidStrike: 'invalidStrike',
  invalidQuantity: 'invalidQuantity',
  invalidPrice: 'invalidPrice',
};

const normalizeString = (value) => {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim();
};

const normalizeStatus = (rawStatus) => {
  const normalized = normalizeString(rawStatus).toLowerCase();
  if (normalized in STATUS_NORMALIZATION) {
    return STATUS_NORMALIZATION[normalized];
  }
  return normalized;
};

const parseNumber = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
};

const resolveSuffixes = (configuration) => {
  const { expirations = {}, activeExpiration } = configuration;
  const selected = expirations?.[activeExpiration];
  if (!selected || !Array.isArray(selected.suffixes)) {
    return [];
  }
  return selected.suffixes.map((suffix) => normalizeString(suffix)).filter(Boolean);
};

const resolveCandidateSymbols = (row) => {
  const values = [];

  if (typeof row === 'string') {
    values.push(row);
  } else if (row && typeof row === 'object') {
    values.push(row.symbol, row.security_id, row.instrument);

    if (typeof row.symbol === 'string' && row.symbol.includes(' - ')) {
      const parts = row.symbol.split(' - ');
      values.push(parts[parts.length - 1], parts[parts.length - 2]);
    }
  }

  return values
    .map((candidate) => normalizeString(candidate))
    .filter(Boolean)
    .flatMap((candidate) => {
      const upperCandidate = candidate.toUpperCase();
      const variants = [upperCandidate];
      const token = extractInstrumentToken(upperCandidate);
      if (token && token !== upperCandidate) {
        variants.push(token);
      }
      return variants;
    });
};

const matchesScope = (row, configuration) => {
  const activeSymbol = normalizeString(configuration.activeSymbol);
  if (!activeSymbol) {
    return { matched: false, reason: EXCLUSION_REASONS.outOfScope };
  }

  const activeSymbolUpper = activeSymbol.toUpperCase();
  const suffixes = resolveSuffixes(configuration);
  const suffixesUpper = suffixes.map((suffix) => suffix.toUpperCase());

  const candidates = resolveCandidateSymbols(row);

  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    if (!candidate.startsWith(activeSymbolUpper)) {
      continue;
    }

    const remainder = candidate.slice(activeSymbolUpper.length);
    const remainderWithoutOption = remainder.replace(/^(C|V)/, '');

    if (suffixes.length === 0) {
      return { matched: true, matchedSymbol: activeSymbol, matchedExpirationSuffix: '' };
    }

    const matchedIndex = suffixesUpper.findIndex((suffix) =>
      remainderWithoutOption.startsWith(suffix) || remainderWithoutOption.endsWith(suffix),
    );
    if (matchedIndex === -1) {
      continue;
    }

    return {
      matched: true,
      matchedSymbol: activeSymbol,
      matchedExpirationSuffix: suffixes[matchedIndex] ?? '',
    };
  }

  return { matched: false, reason: EXCLUSION_REASONS.outOfScope };
};

const ensureRequiredColumns = (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return;
  }

  const sample = rows[0] ?? {};
  const missing = REQUIRED_COLUMNS.filter((column) => !(column in sample));

  if (missing.length > 0) {
    throw new Error(`Faltan columnas requeridas: ${missing.join(', ')}.`);
  }
};

export const validateAndFilterRows = ({ rows = [], configuration }) => {
  ensureRequiredColumns(rows);

  const exclusions = Object.values(EXCLUSION_REASONS).reduce(
    (acc, reason) => ({ ...acc, [reason]: 0 }),
    {},
  );

  const validated = [];

  rows.forEach((rawRow) => {
    const mapped = {};
    REQUIRED_COLUMNS.forEach((column) => {
      mapped[column] = rawRow[column];
    });

    const missingFields = REQUIRED_COLUMNS.filter((column) => mapped[column] === undefined);
    if (missingFields.length > 0) {
      exclusions[EXCLUSION_REASONS.missingRequiredField] += 1;
      return;
    }

    const eventType = normalizeString(rawRow.event_type ?? rawRow.event_subtype);
    if (eventType && eventType.toLowerCase() !== EXECUTION_EVENT) {
      exclusions[EXCLUSION_REASONS.invalidEventType] += 1;
      return;
    }

    const status = normalizeStatus(rawRow.status ?? rawRow.ord_status ?? rawRow.exec_status);
    if (status && !ALLOWED_STATUSES.has(status)) {
      exclusions[EXCLUSION_REASONS.invalidStatus] += 1;
      return;
    }

    const side = normalizeString(rawRow.side).toUpperCase();
    if (!ALLOWED_SIDES.has(side)) {
      exclusions[EXCLUSION_REASONS.invalidSide] += 1;
      return;
    }

    const optionType = normalizeString(rawRow.option_type).toUpperCase();
    if (!ALLOWED_OPTION_TYPES.has(optionType)) {
      exclusions[EXCLUSION_REASONS.invalidOptionType] += 1;
      return;
    }

    const strike = parseNumber(rawRow.strike);
    if (strike === null) {
      exclusions[EXCLUSION_REASONS.invalidStrike] += 1;
      return;
    }

    const quantity = parseNumber(rawRow.quantity);
    if (quantity === null || quantity === 0) {
      exclusions[EXCLUSION_REASONS.invalidQuantity] += 1;
      return;
    }

    const price = parseNumber(rawRow.price);
    if (price === null || price <= 0) {
      exclusions[EXCLUSION_REASONS.invalidPrice] += 1;
      return;
    }

    const scopeMatch = matchesScope(rawRow, configuration);
    if (!scopeMatch.matched) {
      exclusions[scopeMatch.reason] += 1;
      return;
    }

    validated.push({
      orderId: normalizeString(rawRow.order_id),
      originalSymbol: normalizeString(rawRow.symbol),
      side,
      optionType,
      strike,
      quantity,
      price,
      matchedSymbol: scopeMatch.matchedSymbol,
      matchedExpirationSuffix: scopeMatch.matchedExpirationSuffix,
      metadata: {
        status,
      },
    });
  });

  return {
    operations: validated,
    exclusions,
  };
};

export const validatorConstants = {
  REQUIRED_COLUMNS,
  EXCLUSION_REASONS,
};
