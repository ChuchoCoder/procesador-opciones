// expiration-labels.js - Shared utilities for mapping expiration tokens to human-readable labels

export const DEFAULT_EXPIRATION_TOKEN = 'NONE';
export const UNKNOWN_EXPIRATION_TOKEN = 'UNKNOWN';

// Default fallback names for common expiration tokens (Spanish locale by default)
export const FALLBACK_EXPIRATION_NAMES = new Map([
  ['EN', 'Enero'],
  ['ENE', 'Enero'],
  ['ENERO', 'Enero'],
  ['FE', 'Febrero'],
  ['FEB', 'Febrero'],
  ['FEBRERO', 'Febrero'],
  ['MR', 'Marzo'],
  ['MAR', 'Marzo'],
  ['MARZO', 'Marzo'],
  ['AB', 'Abril'],
  ['ABR', 'Abril'],
  ['ABRIL', 'Abril'],
  ['MY', 'Mayo'],
  ['MAY', 'Mayo'],
  ['MAYO', 'Mayo'],
  ['JN', 'Junio'],
  ['JUN', 'Junio'],
  ['JUNIO', 'Junio'],
  ['JL', 'Julio'],
  ['JU', 'Julio'],
  ['JUL', 'Julio'],
  ['JULIO', 'Julio'],
  ['AG', 'Agosto'],
  ['AGO', 'Agosto'],
  ['AGOSTO', 'Agosto'],
  ['SE', 'Septiembre'],
  ['SEP', 'Septiembre'],
  ['SET', 'Septiembre'],
  ['SEPT', 'Septiembre'],
  ['SEPTIEMBRE', 'Septiembre'],
  ['OC', 'Octubre'],
  ['OCT', 'Octubre'],
  ['OCTUBRE', 'Octubre'],
  ['O', 'Octubre'],
  ['NV', 'Noviembre'],
  ['NOV', 'Noviembre'],
  ['NOVIEMBRE', 'Noviembre'],
  ['DC', 'Diciembre'],
  ['DIC', 'Diciembre'],
  ['DICIEMBRE', 'Diciembre'],
  ['DU', 'Diciembre'],
  ['DEU', 'Diciembre'],
]);

const HS_SUFFIX_REGEX = /^(\d+)HS$/i;

const normalizeToken = (value = '') => {
  if (typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  return trimmed.toUpperCase();
};

/**
 * Resolves an expiration token into a display label.
 * Falls back to config-provided labels or default Spanish month names.
 * @param {string} value - expiration token (e.g., "O", "Oct", "24hs")
 * @param {object} options
 * @param {Map<string,string>} [options.expirationLabels] - custom labels keyed by token
 * @param {Map<string,string>} [options.fallbackNames] - fallback labels keyed by token
 * @returns {string} formatted label, or empty string if not resolvable
 */
export function resolveExpirationLabel(value, { expirationLabels, fallbackNames = FALLBACK_EXPIRATION_NAMES } = {}) {
  if (typeof value !== 'string') {
    return '';
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  const normalized = trimmed.toUpperCase();

  if (normalized === DEFAULT_EXPIRATION_TOKEN) {
    return '';
  }

  const hsMatch = trimmed.match(HS_SUFFIX_REGEX);
  if (hsMatch) {
    return `${hsMatch[1]}hs`;
  }

  if (normalized === UNKNOWN_EXPIRATION_TOKEN) {
    return '??';
  }

  if (expirationLabels?.has(normalized)) {
    return expirationLabels.get(normalized);
  }

  if (fallbackNames?.has(normalized)) {
    return fallbackNames.get(normalized);
  }

  return trimmed;
}

/**
 * Normalizes an expiration token for grouping purposes.
 * @param {string} value
 * @param {string} [defaultToken=DEFAULT_EXPIRATION_TOKEN]
 * @returns {string}
 */
export function normalizeExpirationToken(value, defaultToken = DEFAULT_EXPIRATION_TOKEN) {
  const normalized = normalizeToken(value);
  return normalized || defaultToken;
}
