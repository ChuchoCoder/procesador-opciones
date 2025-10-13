/**
 * Settings validation and formatting utilities
 * Per repository constitution: pure functions, testable without DOM
 */

import { DECIMALS_MIN, DECIMALS_MAX, SUFFIX_MIN_LENGTH, SUFFIX_MAX_LENGTH } from './settings-types.js';

/**
 * Validate and normalize symbol identifier
 * @param {string} symbol - Raw symbol input
 * @returns {{valid: boolean, normalized?: string, error?: string}}
 */
export function validateSymbol(symbol) {
  if (!symbol || typeof symbol !== 'string') {
    return { valid: false, error: 'Symbol is required' };
  }

  const trimmed = symbol.trim().toUpperCase();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Symbol cannot be empty' };
  }

  // Allow letters and numbers only
  if (!/^[A-Z0-9]+$/.test(trimmed)) {
    return { valid: false, error: 'Symbol must contain only letters and numbers' };
  }

  return { valid: true, normalized: trimmed };
}

/**
 * Validate option prefix
 * @param {string} prefix - Prefix string
 * @returns {{valid: boolean, value?: string, error?: string}}
 */
export function validatePrefix(prefix) {
  if (prefix === null || prefix === undefined) {
    return { valid: false, error: 'Prefix is required' };
  }

  const trimmed = String(prefix).trim().toUpperCase();
  
  // Empty prefix is valid (optional field)
  if (trimmed.length === 0) {
    return { valid: true, value: '' };
  }

  // Allow letters and numbers
  if (!/^[A-Z0-9]+$/.test(trimmed)) {
    return { valid: false, error: 'Prefix must contain only letters and numbers' };
  }

  return { valid: true, value: trimmed };
}

/**
 * Validate suffix (1 or 2 letters only)
 * @param {string} suffix - Suffix input
 * @returns {{valid: boolean, normalized?: string, error?: string}}
 */
export function validateSuffix(suffix) {
  if (!suffix || typeof suffix !== 'string') {
    return { valid: false, error: 'Suffix is required' };
  }

  const trimmed = suffix.trim().toUpperCase();
  const len = trimmed.length;

  if (len < SUFFIX_MIN_LENGTH || len > SUFFIX_MAX_LENGTH) {
    return { valid: false, error: `Suffix must be ${SUFFIX_MIN_LENGTH}-${SUFFIX_MAX_LENGTH} letters` };
  }

  if (!/^[A-Z]+$/.test(trimmed)) {
    return { valid: false, error: 'Suffix must contain only letters' };
  }

  return { valid: true, normalized: trimmed };
}

/**
 * Validate decimals range
 * @param {number|string} decimals - Decimal precision
 * @returns {{valid: boolean, value?: number, error?: string}}
 */
export function validateDecimals(decimals) {
  const num = typeof decimals === 'string' ? parseInt(decimals, 10) : decimals;

  if (isNaN(num) || !Number.isInteger(num)) {
    return { valid: false, error: 'Decimals must be an integer' };
  }

  if (num < DECIMALS_MIN || num > DECIMALS_MAX) {
    return { valid: false, error: `Decimals must be between ${DECIMALS_MIN} and ${DECIMALS_MAX}` };
  }

  return { valid: true, value: num };
}

/**
 * Format a strike token with given decimals
 * @param {string} rawToken - Raw numeric token (e.g., "47343")
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted token (e.g., "4734.3")
 */
export function formatStrikeToken(rawToken, decimals) {
  if (!rawToken || typeof rawToken !== 'string') {
    return rawToken;
  }

  // Remove non-digits
  const digits = rawToken.replace(/\D/g, '');
  if (digits.length === 0) {
    return rawToken;
  }

  if (decimals <= 0) {
    return digits;
  }

  // Insert decimal point
  const len = digits.length;
  if (len <= decimals) {
    return '0.' + digits.padStart(decimals, '0');
  }

  const intPart = digits.substring(0, len - decimals);
  const fracPart = digits.substring(len - decimals);
  return `${intPart}.${fracPart}`;
}

/**
 * Check if a symbol already exists in storage
 * @param {string} symbol - Symbol to check
 * @param {function} getAllSymbols - Function that returns array of existing symbols
 * @returns {boolean}
 */
export function symbolExists(symbol, getAllSymbols) {
  const normalized = symbol.trim().toUpperCase();
  const existing = getAllSymbols();
  return existing.includes(normalized);
}
