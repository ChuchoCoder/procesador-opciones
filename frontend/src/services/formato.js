/**
 * Number formatting for display.
 *
 * Callers name the *kind of number* they are showing — a cantidad, a precio, an
 * amount of money — and this module owns the rest: which locale applies, how
 * many fraction digits that kind carries, grouping, sign prefixes and the
 * negative-zero guard.
 *
 * It replaced `getDotDecimalLocale()` being called from 11 files, each of which
 * then built its own `Intl.NumberFormat` and chose its own digits: ~15 duplicate
 * helpers, 38 fraction-digit option objects, and three byte-identical formatters
 * inside a single function body. Six consecutive commits (48b6d0c, aefa586,
 * 0a5e322, c5794d5, 10661bc, 6dd5cf0) each had to revisit N call sites because
 * there was no single place to change.
 *
 * Scope: on-screen display. CSV and clipboard output keep their own formatting,
 * because the decimal separator in an exported file is a data-format decision
 * (spreadsheet import), not a presentation one.
 */

import { getDotDecimalLocale } from './locale.js';

const formatterCache = new Map();

/**
 * Resolve an Intl.NumberFormat for the user's current locale, memoised.
 *
 * The locale is resolved per call rather than once at module load, so changing
 * the regional-format preference takes effect without a page reload — the
 * previous module-level formatters required one.
 *
 * @param {Intl.NumberFormatOptions} options
 * @returns {Intl.NumberFormat|null} null when Intl is unavailable
 */
const getFormatter = (options) => {
  if (typeof Intl === 'undefined') return null;

  const locale = getDotDecimalLocale();
  const key = `${locale}|${JSON.stringify(options)}`;

  if (!formatterCache.has(key)) {
    try {
      formatterCache.set(key, new Intl.NumberFormat(locale, options));
    } catch {
      formatterCache.set(key, null);
    }
  }
  return formatterCache.get(key);
};

/** Render -0 as 0; a trading table showing "-0" is always noise. */
const normalizeZero = (value) => (Object.is(value, -0) ? 0 : value);

const format = (value, options, placeholder) => {
  if (!Number.isFinite(value)) return placeholder;

  const safeValue = normalizeZero(value);
  const formatter = getFormatter(options);

  return formatter ? formatter.format(safeValue) : String(safeValue);
};

const CANTIDAD_OPTIONS = { useGrouping: true, maximumFractionDigits: 0 };
const DECIMAL_OPTIONS = { useGrouping: true, minimumFractionDigits: 0, maximumFractionDigits: 4 };
const DOS_DECIMALES = { minimumFractionDigits: 2, maximumFractionDigits: 2 };

/**
 * A quantity of nominals or contracts: whole numbers, grouped.
 * @param {number} value
 * @param {{placeholder?: string}} [options]
 * @returns {string}
 */
export const formatCantidad = (value, { placeholder = '' } = {}) =>
  format(value, CANTIDAD_OPTIONS, placeholder);

/**
 * A general decimal value: up to 4 fraction digits, grouped, trailing zeros
 * dropped. Used where precision varies (strikes, ratios).
 * @param {number} value
 * @param {{placeholder?: string}} [options]
 * @returns {string}
 */
export const formatDecimal = (value, { placeholder = '' } = {}) =>
  format(value, DECIMAL_OPTIONS, placeholder);

/**
 * An instrument price: exactly 2 fraction digits.
 * @param {number} value
 * @param {{placeholder?: string}} [options]
 * @returns {string}
 */
export const formatPrecio = (value, { placeholder = '—' } = {}) =>
  format(value, DOS_DECIMALES, placeholder);

/**
 * An amount of money — fees, totals, P&L: exactly 2 fraction digits.
 * @param {number} value
 * @param {{placeholder?: string}} [options]
 * @returns {string}
 */
export const formatMoneda = (value, { placeholder = '—' } = {}) =>
  format(value, DOS_DECIMALES, placeholder);

/**
 * An amount of money carrying an explicit sign, so a credit and a debit are
 * distinguishable at a glance. Zero is rendered unsigned.
 * @param {number} value
 * @param {{placeholder?: string}} [options]
 * @returns {string}
 */
export const formatMonedaConSigno = (value, { placeholder = '—' } = {}) => {
  if (!Number.isFinite(value)) return placeholder;

  const safeValue = normalizeZero(value);
  const absolute = formatMoneda(Math.abs(safeValue), { placeholder });

  if (safeValue > 0) return `+${absolute}`;
  if (safeValue < 0) return `-${absolute}`;
  return absolute;
};

/**
 * An amount of money rendered with its currency symbol, per locale.
 * @param {number} value
 * @param {string} [currency='ARS']
 * @param {{placeholder?: string}} [options]
 * @returns {string}
 */
export const formatMonedaConSimbolo = (value, currency = 'ARS', { placeholder = '—' } = {}) =>
  format(
    value,
    { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 },
    placeholder,
  );

/**
 * A money amount with a caller-chosen number of fraction digits, for the few
 * places where precision is configured (repo fee tooltips, strike overrides).
 * @param {number} value
 * @param {number} decimals
 * @param {{placeholder?: string}} [options]
 * @returns {string}
 */
export const formatMonedaConDecimales = (value, decimals, { placeholder = '—' } = {}) =>
  format(
    value,
    { minimumFractionDigits: decimals, maximumFractionDigits: decimals },
    placeholder,
  );

/**
 * A rate already expressed in percent units (34.41 renders as "34.41%").
 * @param {number} value
 * @param {{decimals?: number, placeholder?: string}} [options]
 * @returns {string}
 */
export const formatPorcentaje = (value, { decimals = 2, placeholder = '—' } = {}) => {
  if (!Number.isFinite(value)) return placeholder;
  return `${formatMonedaConDecimales(value, decimals, { placeholder })}%`;
};

/**
 * A rate expressed as a fraction (0.21 renders as "21.00%").
 * @param {number} value
 * @param {{decimals?: number, placeholder?: string}} [options]
 * @returns {string}
 */
export const formatFraccionComoPorcentaje = (value, { decimals = 2, placeholder = '—' } = {}) => {
  if (!Number.isFinite(value)) return placeholder;
  return formatPorcentaje(value * 100, { decimals, placeholder });
};

/**
 * Escape hatch for hot render loops that format thousands of cells and want to
 * hoist the formatter. Prefer the named helpers above.
 * @param {Intl.NumberFormatOptions} [options]
 * @returns {Intl.NumberFormat|null}
 */
export const crearFormateador = (options = DOS_DECIMALES) => getFormatter(options);
