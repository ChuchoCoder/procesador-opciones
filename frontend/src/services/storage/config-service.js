import {
  readItem,
  writeItem,
  storageAvailable,
  storageKeys,
} from './local-storage.js';

const rawDefaultConfiguration = {
  symbols: ['GGAL', 'YPFD', 'PAMP'],
  expirations: {
    Enero: { suffixes: ['ENE'] },
    Febrero: { suffixes: ['FEB'] },
  },
  activeSymbol: 'GGAL',
  activeExpiration: 'Enero',
  useAveraging: false,
};

const cloneDefaults = () => ({
  symbols: [...rawDefaultConfiguration.symbols],
  expirations: Object.fromEntries(
    Object.entries(rawDefaultConfiguration.expirations).map(([key, value]) => [
      key,
      { suffixes: [...value.suffixes] },
    ]),
  ),
  activeSymbol: rawDefaultConfiguration.activeSymbol,
  activeExpiration: rawDefaultConfiguration.activeExpiration,
  useAveraging: rawDefaultConfiguration.useAveraging,
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

const sanitizeSymbols = (symbols) => {
  if (!Array.isArray(symbols)) {
    return [...DEFAULT_CONFIGURATION.symbols];
  }

  const normalized = unique(
    symbols
      .map((symbol) => (typeof symbol === 'string' ? symbol.trim().toUpperCase() : ''))
      .filter(Boolean),
  );

  if (normalized.length === 0) {
    return [...DEFAULT_CONFIGURATION.symbols];
  }

  return normalized;
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

  const symbols = sanitizeSymbols(candidate.symbols ?? defaults.symbols);
  const expirations = sanitizeExpirations(candidate.expirations ?? defaults.expirations);

  const activeSymbol = ensureActiveSelection(symbols, candidate.activeSymbol ?? defaults.activeSymbol);
  const activeExpiration = ensureActiveSelection(
    Object.keys(expirations),
    candidate.activeExpiration ?? defaults.activeExpiration,
  );

  const useAveraging = sanitizeBoolean(
    candidate.useAveraging,
    defaults.useAveraging,
  );

  return {
    symbols,
    expirations,
    activeSymbol: activeSymbol ?? defaults.activeSymbol,
    activeExpiration: activeExpiration ?? defaults.activeExpiration,
    useAveraging,
  };
};

export const loadConfiguration = () => {
  if (!storageAvailable()) {
    return cloneDefaults();
  }

  const candidate = {
    symbols: readItem(storageKeys.symbols),
    expirations: readItem(storageKeys.expirations),
    activeSymbol: readItem(storageKeys.activeSymbol),
    activeExpiration: readItem(storageKeys.activeExpiration),
    useAveraging: readItem(storageKeys.useAveraging),
  };

  return sanitizeConfiguration(candidate);
};

export const saveConfiguration = (configuration) => {
  const sanitized = sanitizeConfiguration(configuration);

  if (!storageAvailable()) {
    return sanitized;
  }

  writeItem(storageKeys.symbols, sanitized.symbols);
  writeItem(storageKeys.expirations, sanitized.expirations);
  writeItem(storageKeys.activeSymbol, sanitized.activeSymbol);
  writeItem(storageKeys.activeExpiration, sanitized.activeExpiration);
  writeItem(storageKeys.useAveraging, sanitized.useAveraging);

  return sanitized;
};

export const resetConfiguration = () => {
  const defaults = cloneDefaults();

  if (!storageAvailable()) {
    return defaults;
  }

  writeItem(storageKeys.symbols, defaults.symbols);
  writeItem(storageKeys.expirations, defaults.expirations);
  writeItem(storageKeys.activeSymbol, defaults.activeSymbol);
  writeItem(storageKeys.activeExpiration, defaults.activeExpiration);
  writeItem(storageKeys.useAveraging, defaults.useAveraging);

  return defaults;
};
