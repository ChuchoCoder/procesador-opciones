import { symbolExists, saveSymbolConfig } from './storage-settings.js';
import { createDefaultSymbolConfigWithOverrides } from './settings-types.js';
import { DEFAULT_SYMBOL_CONFIGS } from './prefix-defaults.js';
import feeConfigJson from './fees/fees-config.json';
import { validateFeeConfig, computeEffectiveRates } from './fees/config-validation.js';
import { loadInstrumentMapping } from './fees/instrument-mapping.js';
import { loadBrokerFees } from './fees/broker-fees-storage.js';
import instrumentsData from '../../InstrumentsWithDetails.json';

let _validatedFeeConfig = null;
let _effectiveRates = null;
let _loadingFeeConfigPromise = null;

const buildFeeConfig = async () => {
  try {
    const brokerOverrides = await loadBrokerFees();
    const mergedConfig = {
      ...feeConfigJson,
      broker: {
        ...feeConfigJson?.broker,
        ...brokerOverrides,
      },
    };

    _validatedFeeConfig = validateFeeConfig(mergedConfig);
    _effectiveRates = computeEffectiveRates(_validatedFeeConfig);
     
    console.info('PO: fee-config-validated', Object.keys(_effectiveRates));
  } catch (error) {
     
    console.error('PO: fee-config-validation-failed', error);
    _validatedFeeConfig = { byma: {}, broker: {} };
    _effectiveRates = {};
  }

  return _validatedFeeConfig;
};

const ensureFeeConfigLoaded = async () => {
  if (_validatedFeeConfig) {
    return _validatedFeeConfig;
  }

  if (!_loadingFeeConfigPromise) {
    _loadingFeeConfigPromise = buildFeeConfig().finally(() => {
      _loadingFeeConfigPromise = null;
    });
  }

  return _loadingFeeConfigPromise;
};

/**
 * Loads, validates, and caches the fee configuration.
 * Call once during app bootstrap.
 * @returns {object} validated config structure
 */
export const loadFeeConfig = () => ensureFeeConfigLoaded();

/**
 * Returns precomputed effective fee rates by category.
 * Must call loadFeeConfig() first.
 * @returns {object} rates map
 */
export function getEffectiveRates() {
  if (!_effectiveRates) {
    throw new Error('Fee services not initialized. Call bootstrapFeeServices() first.');
  }
  return _effectiveRates;
}

export const refreshFeeServices = async () => {
  _validatedFeeConfig = null;
  _effectiveRates = null;
  return ensureFeeConfigLoaded();
};

/**
 * Initializes instrument CfiCode mapping.
 * Call once during app bootstrap after instruments data available.
 */
export function initializeInstrumentMapping() {
  try {
    loadInstrumentMapping(instrumentsData);
     
    console.info('PO: instrument-mapping-initialized');
  } catch (e) {
     
    console.error('PO: instrument-mapping-init-failed', e);
  }
}

/**
 * Seed storage with default symbol configs if missing.
 * Returns an array of symbols that were created (for info).
 */
export async function seedDefaultSymbols() {
  const created = [];

  for (const { symbol: sym, prefix } of DEFAULT_SYMBOL_CONFIGS) {
    try {
      // symbolExists may return boolean or Promise
      const exists = symbolExists(sym);
      const isPresent = (exists && typeof exists.then === 'function') ? await exists : exists;
      if (!isPresent) {
        // Create default config with overrides (GGAL special-case)
        const cfg = createDefaultSymbolConfigWithOverrides(sym);
        // Set the default prefix
        cfg.prefix = prefix;
        const saved = saveSymbolConfig(cfg);
        // saveSymbolConfig may be sync or Promise
        const ok = (saved && typeof saved.then === 'function') ? await saved : saved;
        if (ok) created.push(sym);
      }
    } catch (e) {
      // ignore per-symbol errors but log
      console.error('seedDefaultSymbols: failed for', sym, e);
    }
  }

  return created;
}

/**
 * Initializes all bootstrap services: fee config, instrument mapping.
 * Call once during app startup.
 */
export async function bootstrapFeeServices() {
  await ensureFeeConfigLoaded();
  initializeInstrumentMapping();
}
