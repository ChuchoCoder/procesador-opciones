const TAB = '\t';

export const CLIPBOARD_SCOPES = {
  CALLS: 'CALLS',
  PUTS: 'PUTS',
  COMBINED: 'COMBINED',
};

export const CLIPBOARD_ERROR_MESSAGES = {
  invalidScope: 'Ámbito de copia inválido.',
  unavailable: 'La función de portapapeles no está disponible en este navegador.',
  emptyScope: 'No hay datos disponibles para copiar.',
  copyFailed: 'No se pudo copiar al portapapeles. Inténtalo nuevamente.',
};

const HEADERS = ['Fecha', 'Cantidad', 'Strike', 'Precio'];

const DATE_FORMATTER = typeof Intl !== 'undefined'
  ? new Intl.DateTimeFormat(navigator?.language || 'es-AR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  : null;

const STRIKE_FORMATTER = typeof Intl !== 'undefined'
  ? new Intl.NumberFormat('en-US', {
      useGrouping: false,
      minimumFractionDigits: 0,
      maximumFractionDigits: 4,
    })
  : null;

const PRICE_FORMATTER = typeof Intl !== 'undefined'
  ? new Intl.NumberFormat('en-US', {
      useGrouping: false,
      minimumFractionDigits: 0,
      maximumFractionDigits: 4,
    })
  : null;

const formatStrike = (strike) => {
  if (!Number.isFinite(strike)) {
    return '';
  }
  if (STRIKE_FORMATTER) {
    return STRIKE_FORMATTER.format(strike);
  }
  return String(strike);
};

const formatPrice = (price) => {
  if (!Number.isFinite(price)) {
    return '';
  }
  if (PRICE_FORMATTER) {
    return PRICE_FORMATTER.format(price);
  }
  return String(price);
};

const formatQuantity = (quantity) => {
  if (!Number.isFinite(quantity)) {
    return '';
  }

  if (Number.isInteger(quantity)) {
    return quantity.toString();
  }

  if (PRICE_FORMATTER) {
    return PRICE_FORMATTER.format(quantity);
  }

  return String(quantity);
};

const formatDate = (operation) => {
  // Try to get the date from the operation's raw data
  const transactTime = operation?.raw?.transact_time || operation?.legs?.[0]?.raw?.transact_time;
  
  if (!transactTime) {
    return '';
  }

  try {
    // transact_time is typically in ISO format: "2025-10-08 13:58:51.454000Z"
    const date = new Date(transactTime);
    
    if (!isNaN(date.getTime())) {
      if (DATE_FORMATTER) {
        return DATE_FORMATTER.format(date);
      }
      // Fallback: manual formatting as YYYY-MM-DD or MM/DD/YYYY
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${month}/${day}/${year}`;
    }
  } catch (_error) {
    // If date parsing fails, return empty string
    void _error;
  }

  return '';
};

const formatOperationRow = (operation) => [
  formatDate(operation),
  formatQuantity(operation?.totalQuantity),
  formatStrike(operation?.strike),
  formatPrice(operation?.averagePrice),
].join(TAB);

const isValidScope = (scope) =>
  Object.values(CLIPBOARD_SCOPES).includes(scope);

const resolveViewData = (report, viewKey) => {
  if (viewKey && report?.views && report.views[viewKey]) {
    return report.views[viewKey];
  }

  return {
    calls: report?.calls,
    puts: report?.puts,
    summary: report?.summary,
  };
};

const getOperations = (viewData, scope) => {
  const calls = viewData?.calls?.operations ?? [];
  const puts = viewData?.puts?.operations ?? [];

  switch (scope) {
    case CLIPBOARD_SCOPES.CALLS:
      return calls;
    case CLIPBOARD_SCOPES.PUTS:
      return puts;
    case CLIPBOARD_SCOPES.COMBINED:
      return [...calls, ...puts];
    default:
      return [];
  }
};

const buildSectionRows = (label, operations) => {
  if (!operations || operations.length === 0) {
    return [];
  }

  const rows = [label];
  operations.forEach((operation) => {
    rows.push(formatOperationRow(operation));
  });
  return rows;
};

const createModeSuffix = (summary) => {
  const averagingEnabled = Boolean(summary?.averagingEnabled);
  return averagingEnabled ? ' (CON PROMEDIOS)' : ' (SIN PROMEDIOS)';
};

export const buildClipboardPayload = ({ report, scope, view }) => {
  if (!isValidScope(scope)) {
    throw new Error(CLIPBOARD_ERROR_MESSAGES.invalidScope);
  }

  const viewData = resolveViewData(report, view);
  const operations = getOperations(viewData, scope);
  if (!operations || operations.length === 0) {
    throw new Error(CLIPBOARD_ERROR_MESSAGES.emptyScope);
  }

  if (scope === CLIPBOARD_SCOPES.COMBINED) {
    const suffix = createModeSuffix(viewData?.summary ?? report?.summary);
    const combinedRows = [];
    const callsRows = buildSectionRows(
      `OPERACIONES CALLS${suffix}`,
      viewData?.calls?.operations ?? report?.calls?.operations ?? [],
    );
    const putsRows = buildSectionRows(
      `OPERACIONES PUTS${suffix}`,
      viewData?.puts?.operations ?? report?.puts?.operations ?? [],
    );

    if (callsRows.length > 0) {
      combinedRows.push(...callsRows);
    }

    if (putsRows.length > 0) {
      if (combinedRows.length > 0) {
        combinedRows.push('');
      }
      combinedRows.push(...putsRows);
    }

    if (combinedRows.length === 0) {
      throw new Error(CLIPBOARD_ERROR_MESSAGES.emptyScope);
    }

    return combinedRows.join('\n');
  }

  const rows = operations.map((operation) => formatOperationRow(operation));
  return rows.join('\n');
};

const resolveClipboard = (clipboard) => {
  if (clipboard && typeof clipboard.writeText === 'function') {
    return clipboard;
  }

  const globalNavigator = typeof globalThis !== 'undefined' ? globalThis.navigator : undefined;

  if (globalNavigator && globalNavigator.clipboard && typeof globalNavigator.clipboard.writeText === 'function') {
    return globalNavigator.clipboard;
  }

  return null;
};

export const copyReportToClipboard = async ({ report, scope, view, clipboard }) => {
  const resolvedClipboard = resolveClipboard(clipboard);
  if (!resolvedClipboard) {
    throw new Error(CLIPBOARD_ERROR_MESSAGES.unavailable);
  }

  const payload = buildClipboardPayload({ report, scope, view });

  try {
    await resolvedClipboard.writeText(payload);
  } catch (error) {
    throw new Error(CLIPBOARD_ERROR_MESSAGES.copyFailed, { cause: error });
  }
};
