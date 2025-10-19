// instrument-mapping.js - Load and resolve instrument CfiCode -> fee category
// Uses InstrumentsWithDetails.json; fallback to 'bonds' for unknown codes.
// Deduplicates warnings via Set.

import { logUnknownCfiCode, logMappingDedupSummary } from '../logging/fee-logging.js';

// Lazy-loaded mapping and dedup set
let _cfiCodeMap = null;
let _instrumentDetailsMap = null; // New: stores PriceConversionFactor and ContractMultiplier by symbol
let _unknownCfiCodes = null;

/**
 * CfiCode patterns for each fee category.
 * Based on ISO 10962 CFI Code standard for BCBA/ROFX instruments.
 * Adjust as needed per market specifications.
 */
const CFI_PATTERNS = {
  // Opciones: OPxxxx / OCxxxx (puts/calls)
  option: /^O[CP]/,
  // Acciones/CEDEARs: Exxxxx (all equities - shares, rights, entitlements, CEDEARs, etc.)
  accionCedear: /^E/,
  // Letras: DTxxxx legacy codes + DYxxxx (money-market short term instruments) + DBxxxx
  letra: /^(DT|DY|DB)/,
  // Bonds/Obligaciones: remaining D-prefixed instruments (bonds, notes, convertibles, etc.)
  bonds: /^D(?![TY])/,
  // Cauciones: FRxxxx (legacy) or RPxxxx (BYMA repos)
  caucion: /^(FR|RP)/,
};

/**
 * Builds the CfiCode -> category map from InstrumentsWithDetails.json.
 * Also builds a symbol -> instrument details map.
 * Executed once at first call.
 * @param {Array} instrumentsData - parsed JSON array
 * @returns {Map<string, string>}
 */
function buildCfiCodeMap(instrumentsData) {
  const map = new Map();
  const detailsMap = new Map();
  
  if (!Array.isArray(instrumentsData)) {
    // eslint-disable-next-line no-console
    console.error('PO: instrument-data-invalid', typeof instrumentsData);
    return { cfiMap: map, detailsMap };
  }

  for (const instr of instrumentsData) {
    const cfi = instr?.CfiCode;
    const symbol = instr?.InstrumentId?.symbol;
    
    if (typeof cfi === 'string' && cfi.length > 0) {
      let category = 'bonds'; // default fallback

      // Match patterns
      if (CFI_PATTERNS.option.test(cfi)) {
        category = 'option';
      } else if (CFI_PATTERNS.accionCedear.test(cfi)) {
        category = 'accionCedear';
      } else if (CFI_PATTERNS.letra.test(cfi)) {
        category = 'letra';
      } else if (CFI_PATTERNS.bonds.test(cfi)) {
        category = 'bonds';
      } else if (CFI_PATTERNS.caucion.test(cfi)) {
        category = 'caucion';
      }

      map.set(cfi, category);
    }
    
    // Store instrument details by symbol
    if (symbol) {
      // For options, use RoundLot (typically 100) as the multiplier if ContractMultiplier is 1
      const contractMult = instr?.ContractMultiplier ?? 1;
      const roundLot = instr?.RoundLot ?? 1;
      const effectiveMultiplier = contractMult === 1 && roundLot > 1 ? roundLot : contractMult;
      
      detailsMap.set(symbol, {
        cfiCode: cfi || null,
        priceConversionFactor: instr?.PriceConvertionFactor ?? 1,
        contractMultiplier: effectiveMultiplier,
        currency: instr?.Currency ?? null,
        displayName: symbol,
      });
    }
  }

  // eslint-disable-next-line no-console
  console.info('PO: instrument-mapping-built', { totalCodes: map.size, totalSymbols: detailsMap.size });
  return { cfiMap: map, detailsMap };
}

/**
 * Loads the instrument mapping (once per session).
 * Must be called after instruments data is available.
 * @param {Array} instrumentsData - parsed InstrumentsWithDetails.json
 */
export function loadInstrumentMapping(instrumentsData) {
  if (!_cfiCodeMap) {
    const result = buildCfiCodeMap(instrumentsData);
    _cfiCodeMap = result.cfiMap;
    _instrumentDetailsMap = result.detailsMap;
    _unknownCfiCodes = new Set();
  }
}

/**
 * Resolves a CfiCode to its fee category.
 * Falls back to 'bonds' and logs once per unknown code.
 * @param {string} cfiCode
 * @returns {string} category name
 */
export function resolveCfiCategory(cfiCode) {
  if (!_cfiCodeMap) {
    // eslint-disable-next-line no-console
    console.warn('PO: mapping-not-loaded', { cfiCode });
    return 'bonds'; // safe fallback
  }

  const category = _cfiCodeMap.get(cfiCode);
  if (category) {
    return category;
  }

  // Unknown code: add to dedup set and log once
  if (!_unknownCfiCodes.has(cfiCode)) {
    _unknownCfiCodes.add(cfiCode);
    logUnknownCfiCode(cfiCode);
  }

  return 'bonds'; // fallback
}

/**
 * Gets instrument details (PriceConversionFactor, ContractMultiplier, CfiCode) by symbol.
 * Tries exact match first, then partial match for tokenized symbols (e.g., GFGC50131O -> MERV - XMEV - GFGC50131O - 24hs)
 * @param {string} symbol - instrument symbol
 * @returns {object|null} - { cfiCode, priceConversionFactor, contractMultiplier } or null if not found
 */
export function getInstrumentDetails(symbol) {
  if (!_instrumentDetailsMap) {
    // eslint-disable-next-line no-console
    console.warn('PO: mapping-not-loaded-for-symbol', { symbol });
    return null;
  }
  
  // Try exact match first
  const exactMatch = _instrumentDetailsMap.get(symbol);
  if (exactMatch) {
    return exactMatch;
  }
  
  // Try partial match for tokenized symbols (e.g., GFGC50131O matches MERV - XMEV - GFGC50131O - 24hs)
  // This handles cases where CSV has simplified symbol but JSON has full qualified symbol
  if (symbol && symbol.length > 0) {
    for (const [fullSymbol, details] of _instrumentDetailsMap.entries()) {
      // Check if the full symbol contains the input symbol as a component
      // Split by spaces and dashes to get components
      const components = fullSymbol.split(/[\s-]+/).map(c => c.trim()).filter(c => c.length > 0);
      if (components.includes(symbol)) {
        return details;
      }
    }
  }
  
  return null;
}

/**
 * Returns the current set of unknown CfiCodes (for summary logging).
 * @returns {Set<string>}
 */
export function getUnknownCfiCodes() {
  return _unknownCfiCodes || new Set();
}

/**
 * Logs deduplicated summary of unknown codes.
 */
export function logUnknownSummary() {
  if (_unknownCfiCodes && _unknownCfiCodes.size > 0) {
    logMappingDedupSummary(_unknownCfiCodes);
  }
}
