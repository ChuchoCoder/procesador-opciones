const HISTORICAL_HEADERS = new Set([
  'id',
  'timestamp',
  'status',
  'username',
  'userFix',
  'account',
  'segment',
  'symbol',
  'side',
  'price',
  'stopPrice',
  'size',
  'operatedSize',
  'accumulatedSize',
  'leavesSize',
  'timeInForce',
  'expireDate',
  'modifiers',
  'iceberg',
  'displayQuantity',
  'clientOrderId',
  'serverOrderId',
  'originalClientOrderId',
  'executionId',
  'orderType',
  'text',
  'omsCreated',
  'cpx',
]);

const DAILY_HEADERS = new Set([
  'id',
  'order_id',
  'account',
  'security_id',
  'symbol',
  'transact_time',
  'side',
  'ord_type',
  'order_price',
  'order_size',
  'exec_inst',
  'time_in_force',
  'expire_date',
  'stop_px',
  'last_cl_ord_id',
  'text',
  'exec_type',
  'ord_status',
  'last_price',
  'last_qty',
  'avg_price',
  'cum_qty',
  'leaves_qty',
  'event_subtype',
]);

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

  const normalized = normalizeString(value).replace(',', '.');
  if (!normalized) {
    return null;
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeTimestamp = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }

  const normalized = normalizeString(value);
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  if (Number.isFinite(parsed)) {
    return new Date(parsed).toISOString();
  }

  const asDate = new Date(normalized);
  return Number.isNaN(asDate.getTime()) ? normalized : asDate.toISOString();
};

const getRowHeaders = (row) => (row && typeof row === 'object' ? Object.keys(row) : []);

const hasRequiredHeaders = (row, requiredHeaders) =>
  Array.from(requiredHeaders).every((header) => Object.prototype.hasOwnProperty.call(row ?? {}, header));

export const detectOperationsReportFormat = (rows = []) => {
  const firstRow = rows.find((row) => row && typeof row === 'object') ?? null;
  if (!firstRow) {
    return 'unknown';
  }

  if (hasRequiredHeaders(firstRow, DAILY_HEADERS)) {
    return 'daily';
  }

  if (hasRequiredHeaders(firstRow, HISTORICAL_HEADERS)) {
    return 'historical';
  }

  const headers = new Set(getRowHeaders(firstRow));
  const historicalMarkers = ['clientOrderId', 'serverOrderId', 'operatedSize', 'accumulatedSize', 'leavesSize'];
  const dailyMarkers = ['order_id', 'exec_type', 'event_subtype', 'cum_qty'];

  if (historicalMarkers.every((header) => headers.has(header))) {
    return 'historical';
  }

  if (dailyMarkers.every((header) => headers.has(header))) {
    return 'daily';
  }

  return 'unknown';
};

const resolveHistoricalOrderId = (row) =>
  normalizeString(
    row.clientOrderId ?? row.serverOrderId ?? row.originalClientOrderId ?? row.id,
  );

const getHistoricalExecutedQuantity = (row) =>
  parseNumber(row?.accumulatedSize) ?? parseNumber(row?.operatedSize);

const getHistoricalCumulativeQuantity = (row) =>
  parseNumber(row?.operatedSize) ?? parseNumber(row?.accumulatedSize);

const inferHistoricalExecType = (status, cumulativeQuantity) => {
  if (status === 'FILLED' || status === 'PARTIALLY_FILLED') {
    return 'F';
  }

  if (status === 'CANCELLED' && cumulativeQuantity > 0) {
    return 'F';
  }

  if (status === 'CANCELLED') {
    return '4';
  }

  if (status === 'REJECTED') {
    return '8';
  }

  return null;
};

const shouldKeepHistoricalRow = (row) => {
  const status = normalizeString(row?.status).toUpperCase();
  if (!status) {
    return false;
  }

  const cumulativeQuantity = getHistoricalCumulativeQuantity(row) ?? 0;

  if (status === 'FILLED' || status === 'PARTIALLY_FILLED') {
    return true;
  }

  return status === 'CANCELLED' && cumulativeQuantity > 0;
};

export const normalizeHistoricalOperationRows = (rows = []) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return [];
  }

  return rows.reduce((acc, row, index) => {
    if (!row || typeof row !== 'object' || !shouldKeepHistoricalRow(row)) {
      return acc;
    }

    const status = normalizeString(row.status).toUpperCase();
    const quantity = getHistoricalExecutedQuantity(row);
    const cumulativeQuantity = getHistoricalCumulativeQuantity(row);
    const price = parseNumber(row.price);
    const orderId = resolveHistoricalOrderId(row);
    const execType = inferHistoricalExecType(status, cumulativeQuantity ?? 0);

    if (!orderId || quantity === null || quantity <= 0 || price === null || price <= 0 || !execType) {
      return acc;
    }

    acc.push({
      id: normalizeString(row.executionId ?? row.clientOrderId ?? row.serverOrderId ?? row.id ?? `historical-${index}`),
      order_id: orderId,
      account: normalizeString(row.account),
      security_id: normalizeString(row.symbol),
      symbol: normalizeString(row.symbol),
      transact_time: normalizeTimestamp(row.timestamp),
      side: normalizeString(row.side).toUpperCase(),
      ord_type: normalizeString(row.orderType ?? 'LIMIT').toUpperCase(),
      order_price: price,
      order_size: quantity,
      exec_inst: null,
      time_in_force: normalizeString(row.timeInForce),
      expire_date: normalizeString(row.expireDate),
      stop_px: parseNumber(row.stopPrice),
      last_cl_ord_id: normalizeString(row.clientOrderId ?? row.serverOrderId ?? row.originalClientOrderId),
      text: normalizeString(row.text),
      exec_type: execType,
      ord_status: status.toLowerCase(),
      last_price: price,
      last_qty: quantity,
      avg_price: price,
      cum_qty: cumulativeQuantity ?? quantity,
      leaves_qty: parseNumber(row.leavesSize) ?? 0,
      quantity,
      price,
      option_type: null,
      strike: null,
      event_type: 'execution_report',
      event_subtype: 'execution_report',
      raw: row,
      report_format: 'historical',
    });

    return acc;
  }, []);
};
