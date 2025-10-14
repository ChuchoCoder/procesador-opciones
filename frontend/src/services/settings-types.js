/**
 * Settings data shape types and constants
 * Aligned with specs/003-redesign-the-current/data-model.md
 */

/**
 * @typedef {Object} StrikeOverride
 * @property {string} raw - Raw numeric token (e.g., "47343")
 * @property {string} formatted - Formatted strike value (e.g., "4734.3")
 */

/**
 * @typedef {Object} ExpirationSetting
 * @property {string[]} suffixes - Allowed suffix forms (1-2 letters, uppercase)
 * @property {number} decimals - Expiration-specific default decimals (0-4)
 * @property {StrikeOverride[]} overrides - Strike override mappings
 */

/**
 * @typedef {Object} SymbolConfiguration
 * @property {string} symbol - Unique symbol identifier (uppercase)
 * @property {string} prefix - Option prefix
 * @property {number} defaultDecimals - Symbol default decimals (0-4)
 * @property {Object.<string, ExpirationSetting>} expirations - Map of expiration code to settings
 * @property {number} updatedAt - Last updated timestamp (unix ms)
 */

// Fixed expiration codes (per spec)
export const EXPIRATION_CODES = ['DIC', 'FEB', 'ABR', 'JUN', 'AGO', 'OCT'];

// Validation constraints
export const DECIMALS_MIN = 0;
export const DECIMALS_MAX = 4;
export const SUFFIX_MIN_LENGTH = 1;
export const SUFFIX_MAX_LENGTH = 2;

/**
 * Create a default SymbolConfiguration
 * @param {string} symbol - Symbol identifier (uppercase)
 * @returns {SymbolConfiguration}
 */
export function createDefaultSymbolConfig(symbol) {
  const expirations = {};
  EXPIRATION_CODES.forEach((code) => {
    expirations[code] = {
      suffixes: [code.charAt(0), code.substring(0, 2)], // Default: 1-letter and 2-letter forms
      decimals: 2,
      overrides: [],
    };
  });

  return {
    symbol: symbol.toUpperCase(),
    prefix: '',
    defaultDecimals: 2,
    expirations,
    updatedAt: Date.now(),
  };
}
