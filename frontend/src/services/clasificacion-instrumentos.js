/**
 * Clasificación de instrumentos e identidad de grupos.
 *
 * Vive acá y no dentro de `ProcessorScreen` porque es lógica de dominio, no de
 * presentación: parsea los símbolos del reporte (mercado, segmento, especie,
 * venue), reconoce el plazo de una caución, deriva el token de una opción y
 * decide la clave con la que se agrupan las operaciones.
 *
 * La interfaz es chica a propósito. Las tablas de vocabulario del mercado
 * argentino (MERV/XMEV/BYMA/ROFEX, meses, tokens de liquidación) y los
 * helpers de saneamiento son implementación interna.
 *
 * Ver CONTEXT.md para los términos: instrumento, venue, strike, regla de
 * prefijo, vencimiento, grupo.
 */

import { DEFAULT_PREFIX_SYMBOL_MAP } from './prefix-defaults.js';
import {
  resolveExpirationLabel,
  normalizeExpirationToken,
  DEFAULT_EXPIRATION_TOKEN,
} from './csv/expiration-labels.js';

/**
 * Sentinel de "todos los grupos seleccionados". Estaba definido cuatro veces
 * de forma independiente (ProcessorScreen, GroupFilter, ArbitrajesView x2).
 */
export const ALL_GROUP_ID = '__ALL__';

export const OPTION_INSTRUMENT_KEY_PREFIX = 'optionInstrument::';
const OPTION_TOKEN_PREFIX_REGEX = /^([A-Z0-9]+?)[CV]\d+/i;


const buildGroupKey = (symbol = '', expiration = DEFAULT_EXPIRATION_TOKEN) => `${symbol}::${expiration}`;

export const OPTION_OPERATION_TYPES = new Set(['CALL', 'PUT']);

const normalizeGroupSymbol = (value = '') => {
  if (typeof value !== 'string') {
    return String(value ?? '').trim().toUpperCase() || 'UNKNOWN';
  }
  const trimmed = value.trim();
  return trimmed ? trimmed.toUpperCase() : 'UNKNOWN';
};

const normalizeGroupExpiration = (value = '') => normalizeExpirationToken(value);

const SETTLEMENT_TOKENS = new Set([
  'CI', 'CONTADO', '24HS', '48HS', '72HS', '24H', '48H', '72H', 'T0', 'T1', 'T2', 'T+1', 'T+2',
  // Note: Plazo tokens like '1D', '2D', '3D', etc. are NOT included here
  // They are handled separately as caución plazo indicators in data-aggregation.js
]);

const MARKET_TOKENS = new Set([
  'MERV', 'XMEV', 'BCBA', 'BYMA', 'ROFEX', 'MATBA', 'MAE', 'NYSE', 'NASDAQ', 'CME', 'ICE',
]);

const MONTH_TOKENS = new Set([
  'EN', 'ENE', 'ENERO',
  'FE', 'FEB', 'FEBRERO',
  'MR', 'MAR', 'MARZO',
  'AB', 'ABR', 'ABRIL',
  'MY', 'MAY', 'MAYO',
  'JN', 'JUN', 'JUNIO',
  'JL', 'JUL', 'JULIO', 'JU',
  'AG', 'AGO', 'AGOSTO',
  'SE', 'SEP', 'SET', 'SEPT', 'SEPTIEMBRE',
  'OC', 'OCT', 'OCTUBRE',
  'NV', 'NOV', 'NOVIEMBRE',
  'DC', 'DIC', 'DICIEMBRE',
  'DU', 'DEU',
]);

const sanitizeInstrumentSegments = (symbol) => {
  if (!symbol) {
    return [];
  }

  const normalized = normalizeGroupSymbol(symbol);
  if (!normalized || normalized === 'UNKNOWN') {
    return normalized ? [normalized] : [];
  }

  const segments = normalized
    .split('-')
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (!segments.length) {
    return [normalized];
  }

  const filtered = segments.slice();

  while (filtered.length > 1 && MARKET_TOKENS.has(filtered[0])) {
    filtered.shift();
  }

  while (filtered.length > 1 && MARKET_TOKENS.has(filtered[0])) {
    filtered.shift();
  }

  while (filtered.length > 1 && SETTLEMENT_TOKENS.has(filtered[filtered.length - 1])) {
    filtered.pop();
  }

  return filtered.length ? filtered : segments;
};

export const splitInstrumentSymbol = (symbol = '') => {
  const segments = sanitizeInstrumentSegments(symbol);

  if (segments.length === 0) {
    return 'UNKNOWN';
  }

  if (segments.length === 1) {
    return segments[0];
  }

  // Check for caución plazo pattern (e.g., "PESOS", "3D" or "DOLAR", "18D")
  if (segments.length === 2) {
    const last = segments[1];
    // Match plazo pattern: digits followed by 'D' (e.g., "3D", "18D")
    if (/^\d+D$/i.test(last)) {
      // For cauciones, return "INSTRUMENT:PLAZO" format (e.g., "PESOS:3")
      const plazoNumber = last.slice(0, -1); // Remove 'D'
      return `${segments[0]}:${plazoNumber}`;
    }
    
    if (MONTH_TOKENS.has(last)) {
      return segments.join(' ');
    }
  }

  if (segments.length >= 2) {
    const last = segments[segments.length - 1];
    
    // Check for caución plazo pattern in multi-segment symbols
    if (/^\d+D$/i.test(last)) {
      const plazoNumber = last.slice(0, -1);
      const instrument = segments[segments.length - 2];
      return `${instrument}:${plazoNumber}`;
    }
    
    if (MONTH_TOKENS.has(last)) {
      return `${segments[segments.length - 2]} ${last}`;
    }
  }

  return segments[segments.length - 1];
};

const extractOptionPrefixToken = (value = '') => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim().toUpperCase();
  if (!trimmed) {
    return null;
  }

  const tokenMatch = trimmed.match(OPTION_TOKEN_PREFIX_REGEX);
  if (tokenMatch) {
    return tokenMatch[1];
  }

  const [firstSegment] = trimmed.split(/\s+/);
  if (firstSegment && /^[A-Z0-9]{2,6}$/.test(firstSegment)) {
    return firstSegment;
  }

  if (/^[A-Z0-9]{2,6}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
};

export const getOperationGroupId = (operation = {}) => {
  const normalizedSymbol = normalizeGroupSymbol(operation.symbol);
  if (OPTION_OPERATION_TYPES.has(operation.optionType)) {
    const normalizedExpiration = normalizeGroupExpiration(operation.expiration);
    const expiration = normalizedExpiration || DEFAULT_EXPIRATION_TOKEN;
    return buildGroupKey(normalizedSymbol, expiration);
  }

  const baseSymbol = splitInstrumentSymbol(normalizedSymbol);
  return buildGroupKey(baseSymbol, DEFAULT_EXPIRATION_TOKEN);
};

export const getOptionInstrumentToken = (operation = {}) => {
  if (!operation || !OPTION_OPERATION_TYPES.has(operation.optionType)) {
    return null;
  }

  const candidates = [
    operation?.meta?.sourceToken,
    operation?.originalSymbol,
    operation?.raw?.symbol,
    operation?.symbol,
  ];

  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      if (trimmed) {
        return trimmed.toUpperCase();
      }
    }
  }

  return null;
};

export const isOptionGroup = (group) => {
  if (!group) {
    return false;
  }

  if (group.kind === 'option') {
    return true;
  }

  const calls = group.counts?.calls ?? 0;
  const puts = group.counts?.puts ?? 0;
  return calls + puts > 0;
};

export const extractBaseSymbol = (symbol = '') => {
  const trimmed = symbol.trim();
  if (!trimmed) {
    return '';
  }

  const parts = trimmed
    .split(/\s*-\s*/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length > 1) {
    const candidate = parts
      .slice(0, -1)
      .reverse()
      .find((part) => /[A-Z]/i.test(part) && !/^\d+$/.test(part));

    if (candidate) {
      const tokenMatch = candidate.match(/^([A-Z0-9]+?)[CV]\d+/i);
      if (tokenMatch) {
        return tokenMatch[1];
      }
      return candidate;
    }
  }

  return parts[0] ?? trimmed;
};

const formatExpirationLabel = (expiration = '', { expirationLabels } = {}) =>
  resolveExpirationLabel(expiration, { expirationLabels });

export const formatGroupLabel = (group, { prefixLabels, expirationLabels } = {}) => {
  if (!group) {
    return '';
  }

  if (!isOptionGroup(group)) {
    const [baseIdSymbol] = (group.id ?? '').split('::');
    if (baseIdSymbol) {
      return baseIdSymbol;
    }
    const baseSymbol = extractBaseSymbol(group.symbol ?? '');
    return baseSymbol || group.symbol || '';
  }

  const baseSymbol = extractBaseSymbol(group.symbol ?? '') || group.symbol || '';
  const symbolCandidates = [group.symbol, baseSymbol, (group.id ?? '').split('::')[0]];

  let displaySymbol = baseSymbol;

  for (let index = 0; index < symbolCandidates.length; index += 1) {
    const candidate = symbolCandidates[index];
    const prefix = extractOptionPrefixToken(candidate ?? '');
    if (!prefix) {
      continue;
    }
    const normalizedPrefix = prefix.toUpperCase();
    if (prefixLabels?.has(normalizedPrefix)) {
      displaySymbol = prefixLabels.get(normalizedPrefix);
      break;
    }
    displaySymbol = normalizedPrefix;
    break;
  }

  if (!displaySymbol) {
    displaySymbol = baseSymbol || group.symbol || '';
  }

  const expirationLabel = formatExpirationLabel(group.expiration ?? '', { expirationLabels });

  if (expirationLabel) {
    return `${displaySymbol} ${expirationLabel}`.trim();
  }

  return displaySymbol;
};
