const normalizeString = (value) => {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim();
};

const parseNumber = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.length > 0) {
    const normalized = value.replace(/\s+/g, '');
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
};

const deriveStrike = (digits) => {
  if (!digits || typeof digits !== 'string') {
    return undefined;
  }

  const sanitized = digits.replace(/[^0-9]/g, '');
  if (sanitized.length === 0) {
    return undefined;
  }

  if (sanitized.length > 4) {
    const whole = sanitized.slice(0, -1);
    const decimal = sanitized.slice(-1);
    return Number(`${whole}.${decimal}`);
  }

  return Number(sanitized);
};

const REQUIRED_COLUMNS = [
  'order_id',
  'symbol',
  'side',
  'option_type',
  'strike',
  'quantity',
  'price',
];

export const extractInstrumentToken = (candidate = '') => {
  if (typeof candidate !== 'string') {
    return '';
  }

  const segments = candidate.split('_');
  const upperSegments = segments.map((segment) => segment.toUpperCase());

  if (upperSegments.length === 0) {
    return candidate.toUpperCase();
  }

  // Prefer longest segment that looks like an instrument token (contains letters + digits)
  const token = upperSegments
    .slice()
    .sort((a, b) => b.length - a.length)
    .find((segment) => /[A-Z]{2,}\d+/.test(segment));

  return (token ?? upperSegments[0]).replace(/[^A-Z0-9]/g, '');
};

export const deriveOptionData = (row, configuration) => {
  const activeSymbol = normalizeString(configuration?.activeSymbol).toUpperCase();
  if (!activeSymbol) {
    return {};
  }

  const candidateSources = [row.security_id, row.symbol, row.instrument];
  const candidate = candidateSources.map(normalizeString).find((value) => value.includes(activeSymbol));

  if (!candidate) {
    return {};
  }

  const instrumentToken = extractInstrumentToken(candidate);
  const pattern = new RegExp(`${activeSymbol}(C|V)(\\d+)([A-Z0-9]+)`);
  const match = instrumentToken.match(pattern);
  if (!match) {
    return {};
  }

  const [, optionCode, digits, suffix] = match;
  const optionType = optionCode === 'C' ? 'CALL' : optionCode === 'V' ? 'PUT' : undefined;
  const strike = deriveStrike(digits);

  const result = {};
  if (optionType) {
    result.option_type = optionType;
  }
  if (Number.isFinite(strike)) {
    result.strike = strike;
  }
  if (suffix) {
    result.__matchedSuffix = suffix;
  }

  return result;
};

const deriveQuantity = (row) => {
  const sources = [row.quantity, row.last_qty, row.cum_qty];
  for (const source of sources) {
    const value = parseNumber(source);
    if (Number.isFinite(value) && value !== 0) {
      return value;
    }
  }
  return undefined;
};

const derivePrice = (row) => {
  const sources = [row.price, row.last_price, row.avg_price, row.order_price];
  for (const source of sources) {
    const value = parseNumber(source);
    if (Number.isFinite(value) && value > 0) {
      return value;
    }
  }
  return undefined;
};

const assignIfMissing = (target, key, value) => {
  if ((target[key] === undefined || target[key] === null) && value !== undefined && value !== null) {
    target[key] = value;
  }
};

export const normalizeOperationRows = (rows = [], configuration) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { rows: Array.isArray(rows) ? rows : [], missingColumns: [...REQUIRED_COLUMNS] };
  }

  const presentColumns = new Set();

  rows.forEach((row) => {
    if (!row || typeof row !== 'object') {
      return;
    }

    REQUIRED_COLUMNS.forEach((column) => {
      if (Object.prototype.hasOwnProperty.call(row, column)) {
        presentColumns.add(column);
      }
    });
  });

  const missingColumns = REQUIRED_COLUMNS.filter((column) => !presentColumns.has(column));

  const normalizedRows = rows.map((row) => {
    const normalized = { ...row };

    REQUIRED_COLUMNS.forEach((column) => {
      if (!(column in normalized)) {
        normalized[column] = null;
      }
    });

    const optionData = deriveOptionData(normalized, configuration);

    assignIfMissing(normalized, 'option_type', optionData.option_type);
    assignIfMissing(normalized, 'strike', optionData.strike);

    const quantity = deriveQuantity(normalized);
    assignIfMissing(normalized, 'quantity', quantity);

    const price = derivePrice(normalized);
    assignIfMissing(normalized, 'price', price);

    return normalized;
  });

  return { rows: normalizedRows, missingColumns };
};

export const __testUtils = {
  normalizeString,
  parseNumber,
  deriveStrike,
  extractInstrumentToken,
  deriveOptionData,
  deriveQuantity,
  derivePrice,
};
