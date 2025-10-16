import { symbolExists, saveSymbolConfig } from './storage-settings.js';
import { createDefaultSymbolConfigWithOverrides } from './settings-types.js';
import { DEFAULT_SYMBOL_CONFIGS } from './prefix-defaults.js';
// Fee config loader with validation (Phase 2 integration)
import feeConfigJson from './fees/fees-config.json';
import { validateFeeConfig, computeEffectiveRates } from './fees/config-validation.js';
import { loadInstrumentMapping } from './fees/instrument-mapping.js';
// Instrument data for mapping
import instrumentsData from '../../InstrumentsWithDetails.json';

let _validatedFeeConfig = null;
let _effectiveRates = null;

/**
 * Loads, validates, and caches the fee configuration.
 * Call once during app bootstrap.
 * @returns {object} validated config structure
 */
export function loadFeeConfig() {
  if (_validatedFeeConfig) return _validatedFeeConfig;
  
  try {
    _validatedFeeConfig = validateFeeConfig(feeConfigJson);
    _effectiveRates = computeEffectiveRates(_validatedFeeConfig);
    // eslint-disable-next-line no-console
    console.info('PO: fee-config-validated', Object.keys(_effectiveRates));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('PO: fee-config-validation-failed', e);
    _validatedFeeConfig = { byma: {}, broker: {} };
    _effectiveRates = {};
  }
  
  return _validatedFeeConfig;
}

/**
 * Returns precomputed effective fee rates by category.
 * Must call loadFeeConfig() first.
 * @returns {object} rates map
 */
export function getEffectiveRates() {
  if (!_effectiveRates) {
    loadFeeConfig(); // lazy init
  }
  return _effectiveRates;
}

/**
 * Initializes instrument CfiCode mapping.
 * Call once during app bootstrap after instruments data available.
 */
export function initializeInstrumentMapping() {
  try {
    loadInstrumentMapping(instrumentsData);
    // eslint-disable-next-line no-console
    console.info('PO: instrument-mapping-initialized');
  } catch (e) {
    // eslint-disable-next-line no-console
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
      // eslint-disable-next-line no-console
      console.error('seedDefaultSymbols: failed for', sym, e);
    }
  }

  return created;
}

/**
 * Initializes all bootstrap services: fee config, instrument mapping.
 * Call once during app startup.
 */
export function bootstrapFeeServices() {
  loadFeeConfig();
  initializeInstrumentMapping();
}
