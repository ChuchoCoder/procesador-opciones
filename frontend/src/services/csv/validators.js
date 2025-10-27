const REQUIRED_COLUMNS = ['order_id', 'side', 'quantity', 'price'];

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

const ALLOWED_STATUSES = new Set(['fully_executed', 'partially_executed', 'cancelled']);
const ALLOWED_SIDES = new Set(['BUY', 'SELL']);
const ALLOWED_OPTION_TYPES = new Set(['CALL', 'PUT']);
const ALLOWED_EXEC_TYPES = new Set(['F']);

const EXCLUSION_REASONS = {
  missingRequiredField: 'missingRequiredField',
  invalidEventType: 'invalidEventType',
  invalidStatus: 'invalidStatus',
  invalidSide: 'invalidSide',
  invalidOptionType: 'invalidOptionType',
  invalidStrike: 'invalidStrike',
  invalidQuantity: 'invalidQuantity',
  invalidPrice: 'invalidPrice',
  invalidExecType: 'invalidExecType',
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

const ensureRequiredColumns = (rows) => {
  if (!Array.isArray(rows)) {
    throw new Error('El archivo no tiene un formato válido.');
  }

  if (rows.length === 0) {
    throw new Error('El archivo CSV no contiene operaciones. Verificá que el archivo tenga datos además del encabezado.');
  }

  const sample = rows[0] ?? {};
  const missing = REQUIRED_COLUMNS.filter((column) => !(column in sample));

  if (missing.length > 0) {
    throw new Error(`Faltan columnas requeridas: ${missing.join(', ')}.`);
  }
};

export const validateAndFilterRows = ({ rows = [] }) => {
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

    const execType = normalizeString(
      rawRow.exec_type ?? rawRow.execution_type ?? rawRow.execType ?? rawRow.executionType,
    ).toUpperCase();
    if (execType && !ALLOWED_EXEC_TYPES.has(execType)) {
      exclusions[EXCLUSION_REASONS.invalidExecType] += 1;
      return;
    }

    const side = normalizeString(rawRow.side).toUpperCase();
    if (!ALLOWED_SIDES.has(side)) {
      exclusions[EXCLUSION_REASONS.invalidSide] += 1;
      return;
    }

    const optionTypeRaw = normalizeString(rawRow.option_type).toUpperCase();
    const optionType = ALLOWED_OPTION_TYPES.has(optionTypeRaw) ? optionTypeRaw : '';

    const strike = parseNumber(rawRow.strike);
    if (rawRow.strike !== undefined && rawRow.strike !== null && strike === null) {
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

    const sanitizedRow = {
      order_id: normalizeString(rawRow.order_id),
      symbol: normalizeString(rawRow.symbol),
      expiration: normalizeString(rawRow.expiration ?? rawRow.expire_date ?? ''),
      security_id: normalizeString(rawRow.security_id ?? rawRow.securityId ?? ''),
      instrument: normalizeString(rawRow.instrument),
      text: normalizeString(rawRow.text),
      side,
      option_type: optionType || null,
      strike,
      quantity,
      price,
      status,
      raw: rawRow,
    };

    validated.push(sanitizedRow);
  });

  return {
    rows: validated,
    exclusions,
  };
};

export const validatorConstants = {
  REQUIRED_COLUMNS,
  EXCLUSION_REASONS,
};
