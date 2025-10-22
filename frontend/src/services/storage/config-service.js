import {
  readItem,
  writeItem,
  storageAvailable,
  storageKeys,
} from './local-storage.js';

const rawDefaultConfiguration = {
  expirations: {
    Enero: { suffixes: ['ENE'] },
    Febrero: { suffixes: ['FEB'] },
  },
  activeExpiration: 'Enero',
  useAveraging: false,
  brokerApiUrl: 'https://api.remarkets.primary.com.ar',
};

const cloneDefaults = () => ({
  expirations: Object.fromEntries(
    Object.entries(rawDefaultConfiguration.expirations).map(([key, value]) => [
      key,
      { suffixes: [...value.suffixes] },
    ]),
  ),
  activeExpiration: rawDefaultConfiguration.activeExpiration,
  useAveraging: rawDefaultConfiguration.useAveraging,
  brokerApiUrl: rawDefaultConfiguration.brokerApiUrl,
});

export const DEFAULT_CONFIGURATION = Object.freeze(cloneDefaults());

const unique = (values) => {
  const seen = new Set();
  const result = [];
  values.forEach((value) => {
    if (!seen.has(value)) {
      seen.add(value);
      result.push(value);
    }
  });
  return result;
};

const sanitizeSuffixes = (suffixes) => {
  if (!Array.isArray(suffixes)) {
    return [];
  }

  return unique(
    suffixes
      .map((suffix) => (typeof suffix === 'string' ? suffix.trim().toUpperCase() : ''))
      .filter(Boolean),
  );
};

const sanitizeExpirations = (expirations) => {
  if (!expirations || typeof expirations !== 'object') {
    return cloneDefaults().expirations;
  }

  const sanitizedEntries = Object.entries(expirations)
    .map(([name, config]) => {
      const normalizedName = typeof name === 'string' ? name.trim() : '';
      const suffixes = sanitizeSuffixes(config?.suffixes);

      if (!normalizedName || suffixes.length === 0) {
        return null;
      }

      return [normalizedName, { suffixes }];
    })
    .filter(Boolean);

  if (sanitizedEntries.length === 0) {
    return cloneDefaults().expirations;
  }

  return Object.fromEntries(sanitizedEntries);
};

const ensureActiveSelection = (collection, activeKey) => {
  const keys = Array.isArray(collection)
    ? collection
    : Object.keys(collection ?? {});

  if (keys.length === 0) {
    return undefined;
  }

  if (keys.includes(activeKey)) {
    return activeKey;
  }

  return keys[0];
};

const sanitizeBoolean = (value, fallback) => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return fallback;
};

const sanitizeOperationsSlice = (operations) => (
  Array.isArray(operations) ? [...operations] : []
);

const sanitizeBrokerAuth = (auth) => {
  if (!auth || typeof auth !== 'object') {
    return null;
  }

  const normalizedExpiry = (() => {
    if (typeof auth.expiry === 'number' && Number.isFinite(auth.expiry)) {
      return auth.expiry;
    }
    if (typeof auth.expiry === 'string') {
      const parsed = Number(auth.expiry);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  })();

  return {
    token: typeof auth.token === 'string' ? auth.token : null,
    expiry: normalizedExpiry,
    accountId: typeof auth.accountId === 'string' ? auth.accountId : null,
    displayName: typeof auth.displayName === 'string' ? auth.displayName : null,
  };
};

const SYNC_DEFAULTS = {
  status: 'idle',
  lastSyncTimestamp: null,
  inProgress: false,
  sessionId: null,
  startTime: null,
  pagesFetched: 0,
  operationsImportedCount: 0,
  lastUpdateTime: null,
  endTime: null,
  mode: 'daily',
  estimatedTotal: null,
  lastSummary: null,
  error: null,
  rateLimitMs: null,
};

const sanitizeLastSummary = (summary) => {
  if (!summary || typeof summary !== 'object') {
    return null;
  }

  const toNumber = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);
  const totalOperations = typeof summary.totalOperations === 'number' && Number.isFinite(summary.totalOperations)
    ? summary.totalOperations
    : null;

  return {
    operationsAdded: toNumber(summary.operationsAdded),
    newOrders: toNumber(summary.newOrders),
    totalOperations,
    mode: typeof summary.mode === 'string' ? summary.mode : null,
  };
};

const sanitizeSyncState = (sync) => {
  if (!sync || typeof sync !== 'object') {
    return { ...SYNC_DEFAULTS };
  }

  const getNumberOrNull = (value) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };

  return {
    status: typeof sync.status === 'string' ? sync.status : SYNC_DEFAULTS.status,
    lastSyncTimestamp: getNumberOrNull(sync.lastSyncTimestamp),
    inProgress: Boolean(sync.inProgress),
    sessionId: typeof sync.sessionId === 'string' ? sync.sessionId : null,
    startTime: getNumberOrNull(sync.startTime),
    pagesFetched: typeof sync.pagesFetched === 'number' && Number.isFinite(sync.pagesFetched)
      ? sync.pagesFetched
      : SYNC_DEFAULTS.pagesFetched,
    operationsImportedCount:
      typeof sync.operationsImportedCount === 'number' && Number.isFinite(sync.operationsImportedCount)
        ? sync.operationsImportedCount
        : SYNC_DEFAULTS.operationsImportedCount,
    lastUpdateTime: getNumberOrNull(sync.lastUpdateTime),
    endTime: getNumberOrNull(sync.endTime),
    mode: typeof sync.mode === 'string' ? sync.mode : SYNC_DEFAULTS.mode,
    estimatedTotal: getNumberOrNull(sync.estimatedTotal),
    lastSummary: sanitizeLastSummary(sync.lastSummary),
    error: typeof sync.error === 'string' ? sync.error : SYNC_DEFAULTS.error,
    rateLimitMs: getNumberOrNull(sync.rateLimitMs),
  };
};

const sanitizeSyncSessions = (sessions) => {
  if (!Array.isArray(sessions)) {
    return [];
  }

  const getNumber = (value, fallback = 0) => (
    typeof value === 'number' && Number.isFinite(value)
      ? value
      : fallback
  );

  const toSession = (session) => {
    if (!session || typeof session !== 'object') {
      return {
        sessionId: null,
        startTime: null,
        endTime: null,
        status: 'unknown',
        operationsImportedCount: 0,
        source: 'broker',
        message: null,
        retryAttempts: 0,
      };
    }

    return {
      sessionId: typeof session.sessionId === 'string' ? session.sessionId : null,
      startTime: getNumber(session.startTime, null),
      endTime: getNumber(session.endTime, null),
      status: typeof session.status === 'string' ? session.status : 'unknown',
      operationsImportedCount: getNumber(session.operationsImportedCount),
      source: typeof session.source === 'string' ? session.source : 'broker',
      message: typeof session.message === 'string' ? session.message : null,
      retryAttempts: getNumber(session.retryAttempts),
    };
  };

  return sessions.map(toSession);
};

const sanitizePrefixRules = (rules) => {
  if (!rules || typeof rules !== 'object') {
    return {};
  }

  return { ...rules };
};

const sanitizeBrokerApiUrl = (url) => {
  if (typeof url !== 'string' || !url.trim()) {
    return rawDefaultConfiguration.brokerApiUrl;
  }

  const trimmed = url.trim();
  
  // Basic URL validation
  try {
    new URL(trimmed);
    return trimmed;
  } catch {
    return rawDefaultConfiguration.brokerApiUrl;
  }
};

export const sanitizeConfiguration = (candidate = {}) => {
  const defaults = cloneDefaults();

  const expirations = sanitizeExpirations(candidate.expirations ?? defaults.expirations);

  const activeExpiration = ensureActiveSelection(
    Object.keys(expirations),
    candidate.activeExpiration ?? defaults.activeExpiration,
  );

  const useAveraging = sanitizeBoolean(
    candidate.useAveraging,
    defaults.useAveraging,
  );

  return {
    expirations,
    activeExpiration: activeExpiration ?? defaults.activeExpiration,
    useAveraging,
    operations: sanitizeOperationsSlice(candidate.operations),
    brokerOperations: sanitizeOperationsSlice(candidate.brokerOperations),
    brokerAuth: sanitizeBrokerAuth(candidate.brokerAuth),
    sync: sanitizeSyncState(candidate.sync),
    stagingOps: sanitizeOperationsSlice(candidate.stagingOps),
    syncSessions: sanitizeSyncSessions(candidate.syncSessions),
    prefixRules: sanitizePrefixRules(candidate.prefixRules),
    brokerApiUrl: sanitizeBrokerApiUrl(candidate.brokerApiUrl),
  };
};

export const loadConfiguration = async () => {
  if (!storageAvailable()) {
    return cloneDefaults();
  }

  const candidate = {
    expirations: await readItem(storageKeys.expirations),
    activeExpiration: await readItem(storageKeys.activeExpiration),
    useAveraging: await readItem(storageKeys.useAveraging),
    brokerApiUrl: await readItem(storageKeys.brokerApiUrl),
    brokerAuth: await readItem(storageKeys.brokerAuth),
    operations: await readItem(storageKeys.operations),
    brokerOperations: await readItem(storageKeys.brokerOperations),
  };

  return sanitizeConfiguration(candidate);
};

export const saveConfiguration = (configuration) => {
  const sanitized = sanitizeConfiguration(configuration);

  if (!storageAvailable()) {
    return sanitized;
  }

  writeItem(storageKeys.expirations, sanitized.expirations);
  writeItem(storageKeys.activeExpiration, sanitized.activeExpiration);
  writeItem(storageKeys.useAveraging, sanitized.useAveraging);
  writeItem(storageKeys.brokerApiUrl, sanitized.brokerApiUrl);
  writeItem(storageKeys.brokerAuth, sanitized.brokerAuth);
  writeItem(storageKeys.operations, sanitized.operations);
  writeItem(storageKeys.brokerOperations, sanitized.brokerOperations);

  return sanitized;
};

export const resetConfiguration = () => {
  const defaults = cloneDefaults();

  if (!storageAvailable()) {
    return defaults;
  }

  writeItem(storageKeys.expirations, defaults.expirations);
  writeItem(storageKeys.activeExpiration, defaults.activeExpiration);
  writeItem(storageKeys.useAveraging, defaults.useAveraging);
  writeItem(storageKeys.brokerApiUrl, defaults.brokerApiUrl);
  writeItem(storageKeys.brokerAuth, null);

  return defaults;
};
