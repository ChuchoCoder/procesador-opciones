import feeConfigJson from './fees-config.json';
import {
  readItem,
  writeItem,
  removeItem,
  storageAvailable,
  storageKeys,
} from '../storage/local-storage.js';

const DEFAULT_BROKER_FEES = Object.freeze({
  commission: feeConfigJson?.broker?.commission ?? 0
});

const normalizePercentage = (value) => {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric >= 0) {
    return numeric;
  }
  return null;
};

export const getDefaultBrokerFees = () => ({ ...DEFAULT_BROKER_FEES });

export const sanitizeBrokerFees = (candidate = {}) => {
  const defaults = getDefaultBrokerFees();
  const commission = normalizePercentage(candidate.commission);

  return {
    commission: commission ?? defaults.commission,
  };
};

export const loadBrokerFees = async () => {
  if (!storageAvailable()) {
    return getDefaultBrokerFees();
  }

  const stored = await readItem(storageKeys.brokerFees);
  if (!stored) {
    return getDefaultBrokerFees();
  }

  return sanitizeBrokerFees(stored);
};

export const saveBrokerFees = async (candidate) => {
  const sanitized = sanitizeBrokerFees(candidate);

  if (storageAvailable()) {
    await writeItem(storageKeys.brokerFees, sanitized);
  }

  return sanitized;
};

export const clearBrokerFees = async () => {
  if (!storageAvailable()) {
    return getDefaultBrokerFees();
  }

  await removeItem(storageKeys.brokerFees);
  return getDefaultBrokerFees();
};

/* -------------------------------------------------------------------------- */
/* Repo fee config (moved here from storage-settings.js)                         */
/* Consolidates repo-related fee defaults and persisted overrides under this    */
/* broker-fees-storage module so callers only need to import from a single     */
/* place for broker and repo fee configs.                                      */
/* -------------------------------------------------------------------------- */

const createEmptyRepoFeeConfig = () => ({
  arancelCaucionColocadora: { ARS: 1.5, USD: 0.2 },
  arancelCaucionTomadora: { ARS: 3.0, USD: 0.2 },
  derechosDeMercadoDailyRate: { ARS: 0.0005, USD: 0.0005 },
  gastosGarantiaDailyRate: { ARS: 0.0005, USD: 0.0005 },
  ivaRepoRate: 0.21,
  overridesMetadata: [],
});

const ensureNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const normalizeCurrencyMap = (candidate = {}, fallback = { ARS: 0, USD: 0 }) => ({
  ARS: ensureNumber(candidate.ARS, fallback.ARS ?? 0),
  USD: ensureNumber(candidate.USD, fallback.USD ?? 0),
});

const sanitizeRepoFeeConfig = (candidate = {}, fallbackConfig = createEmptyRepoFeeConfig()) => ({
  arancelCaucionColocadora: normalizeCurrencyMap(
    candidate.arancelCaucionColocadora,
    fallbackConfig.arancelCaucionColocadora,
  ),
  arancelCaucionTomadora: normalizeCurrencyMap(
    candidate.arancelCaucionTomadora,
    fallbackConfig.arancelCaucionTomadora,
  ),
  derechosDeMercadoDailyRate: normalizeCurrencyMap(
    candidate.derechosDeMercadoDailyRate,
    fallbackConfig.derechosDeMercadoDailyRate,
  ),
  gastosGarantiaDailyRate: normalizeCurrencyMap(
    candidate.gastosGarantiaDailyRate,
    fallbackConfig.gastosGarantiaDailyRate,
  ),
  ivaRepoRate: ensureNumber(candidate.ivaRepoRate, fallbackConfig.ivaRepoRate ?? 0),
  overridesMetadata: Array.isArray(candidate.overridesMetadata)
    ? [...candidate.overridesMetadata]
    : Array.isArray(fallbackConfig.overridesMetadata)
      ? [...fallbackConfig.overridesMetadata]
      : [],
});

let repoFeeDefaultsCache = null;
let repoFeeDefaultsPromise = null;
let repoFeeConfigCache = null;

/**
 * Load repo fee defaults from the bundled `fees-config.json` (consolidated)
 * If the bundled config doesn't contain repo defaults, fall back to the
 * built-in empty defaults created by `createEmptyRepoFeeConfig()`.
 */
const fetchRepoFeeDefaults = async () => {
  try {
    // fees-config.json may expose repo defaults under several keys depending
    // on how it was authored. Prefer an explicit `repo` key, then `bymaDefaults`,
    // and finally the root object as a last resort.
    const candidate = feeConfigJson?.repo ?? feeConfigJson?.bymaDefaults ?? feeConfigJson ?? {};
    return sanitizeRepoFeeConfig(candidate, createEmptyRepoFeeConfig());
  } catch (error) {
    console.warn('PO: Failed to load repo fee defaults from bundled fees-config.json. Falling back to zeros.', error);
    return createEmptyRepoFeeConfig();
  }
};

const readRepoFeeConfigFromStorage = async () => {
  try {
    const stored = await readItem(storageKeys.repoFeeConfig);
    if (!stored) return null;
    return stored;
  } catch (error) {
    console.warn('PO: Failed to read repo fee config from storage.', error);
    return null;
  }
};

const persistRepoFeeConfig = async (config) => {
  try {
    if (!config) return false;
    const success = await writeItem(storageKeys.repoFeeConfig, config);
    return success !== false;
  } catch (error) {
    console.warn('PO: Failed to persist repo fee config.', error);
    return false;
  }
};

const mergeRepoFeeOverrides = (baseConfig, override = {}) => ({
  arancelCaucionColocadora: {
    ...baseConfig.arancelCaucionColocadora,
    ...(override.arancelCaucionColocadora || {}),
  },
  arancelCaucionTomadora: {
    ...baseConfig.arancelCaucionTomadora,
    ...(override.arancelCaucionTomadora || {}),
  },
  derechosDeMercadoDailyRate: {
    ...baseConfig.derechosDeMercadoDailyRate,
    ...(override.derechosDeMercadoDailyRate || {}),
  },
  gastosGarantiaDailyRate: {
    ...baseConfig.gastosGarantiaDailyRate,
    ...(override.gastosGarantiaDailyRate || {}),
  },
  ivaRepoRate: override.ivaRepoRate ?? baseConfig.ivaRepoRate,
  overridesMetadata: Array.isArray(override.overridesMetadata)
    ? [...override.overridesMetadata]
    : baseConfig.overridesMetadata,
});

const resolveDefaults = async (forceReload = false) => {
  if (forceReload) {
    repoFeeDefaultsCache = null;
  }

  if (repoFeeDefaultsCache) {
    return repoFeeDefaultsCache;
  }

  if (!repoFeeDefaultsPromise) {
    repoFeeDefaultsPromise = fetchRepoFeeDefaults().then((defaults) => {
      repoFeeDefaultsCache = defaults;
      repoFeeDefaultsPromise = null;
      return defaults;
    }).catch((error) => {
      console.warn('PO: Repo fee defaults load promise failed.', error);
      repoFeeDefaultsCache = createEmptyRepoFeeConfig();
      repoFeeDefaultsPromise = null;
      return repoFeeDefaultsCache;
    });
  }

  return repoFeeDefaultsPromise;
};

export const loadRepoFeeDefaults = async (options = {}) => {
  const { forceReload = false } = options ?? {};
  return resolveDefaults(forceReload);
};

const resolveStoredRepoConfig = async (forceReload = false) => {
  if (forceReload) {
    repoFeeConfigCache = null;
  }

  if (repoFeeConfigCache) {
    return repoFeeConfigCache;
  }

  const defaults = await resolveDefaults(false);
  const stored = await readRepoFeeConfigFromStorage();
  const sanitized = stored ? sanitizeRepoFeeConfig(stored, defaults) : defaults;
  repoFeeConfigCache = sanitized;
  return sanitized;
};

export const getRepoFeeConfig = async (options = {}) => {
  const { forceReload = false } = options ?? {};
  return resolveStoredRepoConfig(forceReload);
};

export const setRepoFeeConfig = async (candidate = {}, options = {}) => {
  const { metadata } = options ?? {};
  const defaults = await resolveDefaults(false);
  const base = await resolveStoredRepoConfig(false);

  const merged = mergeRepoFeeOverrides(base || defaults, candidate);
  if (metadata && Array.isArray(metadata.overridesMetadata)) {
    merged.overridesMetadata = [...metadata.overridesMetadata];
  }

  const sanitized = sanitizeRepoFeeConfig(merged, defaults);
  sanitized.updatedAt = Date.now();

  const persisted = await persistRepoFeeConfig(sanitized);
  if (persisted) {
    repoFeeConfigCache = sanitized;
  }

  return sanitized;
};
