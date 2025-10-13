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
  prefixRules: {},
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
  prefixRules: Object.fromEntries(
    Object.entries(rawDefaultConfiguration.prefixRules).map(([prefix, rule]) => [
      prefix,
      {
        symbol: rule.symbol,
        defaultDecimals: rule.defaultDecimals ?? 0,
        strikeOverrides: { ...(rule.strikeOverrides ?? {}) },
        expirationOverrides: Object.fromEntries(
          Object.entries(rule.expirationOverrides ?? {}).map(([exp, config]) => [
            exp,
            {
              defaultDecimals: config.defaultDecimals ?? 0,
              strikeOverrides: { ...(config.strikeOverrides ?? {}) },
            },
          ]),
        ),
      },
    ]),
  ),
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

const sanitizeDecimalValue = (value, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  const clamped = Math.max(0, Math.min(6, parsed));
  return Math.round(clamped);
};

const sanitizeStrikeOverrides = (overrides) => {
  if (!overrides || typeof overrides !== 'object') {
    return {};
  }

  const entries = Object.entries(overrides)
    .map(([strikeToken, decimals]) => {
      const normalizedToken = typeof strikeToken === 'string'
        ? strikeToken.trim().toUpperCase()
        : String(strikeToken ?? '').trim().toUpperCase();

      if (!normalizedToken) {
        return null;
      }

      return [normalizedToken, sanitizeDecimalValue(decimals, 0)];
    })
    .filter(Boolean);

  return Object.fromEntries(entries);
};

const sanitizeExpirationOverrides = (overrides) => {
  if (!overrides || typeof overrides !== 'object') {
    return {};
  }

  const entries = Object.entries(overrides)
    .map(([expirationCode, config]) => {
      const normalizedCode = typeof expirationCode === 'string'
        ? expirationCode.trim().toUpperCase()
        : '';

      if (!normalizedCode) {
        return null;
      }

      return [
        normalizedCode,
        {
          defaultDecimals: sanitizeDecimalValue(config?.defaultDecimals, 0),
          strikeOverrides: sanitizeStrikeOverrides(config?.strikeOverrides),
        },
      ];
    })
    .filter(Boolean);

  return Object.fromEntries(entries);
};

const sanitizePrefixRules = (rules) => {
  if (!rules || typeof rules !== 'object') {
    return cloneDefaults().prefixRules;
  }

  const entries = Object.entries(rules)
    .map(([prefix, rule]) => {
      const normalizedPrefix = typeof prefix === 'string' ? prefix.trim().toUpperCase() : '';
      if (!normalizedPrefix) {
        return null;
      }

      const normalizedSymbol = typeof rule?.symbol === 'string' ? rule.symbol.trim().toUpperCase() : '';

      return [
        normalizedPrefix,
        {
          symbol: normalizedSymbol,
          defaultDecimals: sanitizeDecimalValue(rule?.defaultDecimals, 0),
          strikeOverrides: sanitizeStrikeOverrides(rule?.strikeOverrides),
          expirationOverrides: sanitizeExpirationOverrides(rule?.expirationOverrides),
        },
      ];
    })
    .filter(Boolean);

  return Object.fromEntries(entries);
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

  const prefixRules = sanitizePrefixRules(candidate.prefixRules ?? defaults.prefixRules);

  return {
    expirations,
    activeExpiration: activeExpiration ?? defaults.activeExpiration,
    useAveraging,
    prefixRules,
  };
};

export const loadConfiguration = () => {
  if (!storageAvailable()) {
    return cloneDefaults();
  }

  const candidate = {
    expirations: readItem(storageKeys.expirations),
    activeExpiration: readItem(storageKeys.activeExpiration),
    useAveraging: readItem(storageKeys.useAveraging),
    prefixRules: readItem(storageKeys.prefixRules),
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
  writeItem(storageKeys.prefixRules, sanitized.prefixRules);

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
  writeItem(storageKeys.prefixRules, defaults.prefixRules);

  return defaults;
};
