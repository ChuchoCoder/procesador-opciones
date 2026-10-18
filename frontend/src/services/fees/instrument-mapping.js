// instrument-mapping.js - Load and resolve instrument CfiCode -> fee category
//
// This module owns one replaceable mapping, built from a snapshot of the
// broker's instrument list (InstrumentsWithDetails.json in production).
//
// Interface contract, in full:
//   - `loadInstrumentMapping(data)` must run before any read. It REPLACES the
//     mapping: the last call wins. Production calls it once, from
//     `bootstrapFeeServices()`; tests call it with their own snapshot.
//   - Reading before a load THROWS. An unloaded mapping used to answer with
//     plausible-but-wrong values ('bonds', `null`) behind a `console.warn`,
//     which turned a bootstrap failure into silently wrong money.
//   - A load followed by a read for a symbol the snapshot does not carry still
//     returns `null`: that is a genuine "not in this snapshot", not an
//     initialization error. See docs/adr/0004.
//   - `resetInstrumentMapping()` clears it, for test teardown.

import { logUnknownCfiCode, logMappingDedupSummary } from '../logging/fee-logging.js';

// The loaded mapping. `null` means "not loaded yet", which is an error to read.
let _cfiCodeMap = null;
let _instrumentDetailsMap = null; // PriceConversionFactor / ContractMultiplier by symbol
let _unknownCfiCodes = null;

/**
 * CfiCode patterns for each fee category.
 * Based on ISO 10962 CFI Code standard for BCBA/ROFX instruments.
 * Adjust as needed per market specifications.
 */
const CFI_PATTERNS = {
  // Opciones: OPxxxx / OCxxxx (puts/calls) - Note: MUST check for options BEFORE futures
  // Options have specific strike/expiry patterns like "DLR/DIC25 1340 C"
  option: /^O[CP]/,
  // Futuros: FXxxxx (futures contracts like DLR/NOV25, DLR/DIC25)
  // Important: This should be checked BEFORE the bonds pattern to avoid misclassification
  future: /^F[XM]/,
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
 * Builds the CfiCode -> category map from an instruments snapshot.
 * Also builds a symbol -> instrument details map.
 * @param {Array} instrumentsData - parsed JSON array
 * @returns {{ cfiMap: Map<string, string>, detailsMap: Map<string, object> }}
 */
function buildCfiCodeMap(instrumentsData) {
  const map = new Map();
  const detailsMap = new Map();
  
  if (!Array.isArray(instrumentsData)) {
     
    console.error('PO: instrument-data-invalid', typeof instrumentsData);
    return { cfiMap: map, detailsMap };
  }

  for (const instr of instrumentsData) {
    const cfi = instr?.CfiCode;
    const symbol = instr?.InstrumentId?.symbol;
    
    if (typeof cfi === 'string' && cfi.length > 0) {
      let category = 'bonds'; // default fallback

      // Match patterns - ORDER MATTERS: check specific patterns before general ones
      // Check options first (most specific)
      if (CFI_PATTERNS.option.test(cfi)) {
        category = 'option';
      } 
      // Check futures (must be before caucion to avoid FR confusion)
      else if (CFI_PATTERNS.future.test(cfi)) {
        category = 'bonds'; // Futures use same fee structure as bonds/default derivatives
      }
      // Check cauciones (repos)
      else if (CFI_PATTERNS.caucion.test(cfi)) {
        category = 'caucion';
      }
      // Check equities
      else if (CFI_PATTERNS.accionCedear.test(cfi)) {
        category = 'accionCedear';
      }
      // Check letras (short-term debt)
      else if (CFI_PATTERNS.letra.test(cfi)) {
        category = 'letra';
      }
      // Check bonds (longer-term debt)
      else if (CFI_PATTERNS.bonds.test(cfi)) {
        category = 'bonds';
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

   
  console.info('PO: instrument-mapping-built', { totalCodes: map.size, totalSymbols: detailsMap.size });
  return { cfiMap: map, detailsMap };
}

/**
 * Loads an instruments snapshot, replacing whatever was loaded before.
 *
 * Last call wins. This used to be a silent no-op after the first call, so a
 * test that handed it a fixture kept reading whatever had been loaded first
 * (in the suite's case, the production snapshot) with no way to tell.
 *
 * @param {Array} instrumentsData - parsed instruments array
 */
export function loadInstrumentMapping(instrumentsData) {
  const result = buildCfiCodeMap(instrumentsData);
  _cfiCodeMap = result.cfiMap;
  _instrumentDetailsMap = result.detailsMap;
  _unknownCfiCodes = new Set();
}

/**
 * Clears the loaded mapping. After this, reads throw until the next load.
 * For test teardown; production never unloads.
 */
export function resetInstrumentMapping() {
  _cfiCodeMap = null;
  _instrumentDetailsMap = null;
  _unknownCfiCodes = null;
}

/**
 * Whether a snapshot is currently loaded.
 * @returns {boolean}
 */
export function isInstrumentMappingLoaded() {
  return _cfiCodeMap !== null;
}

const NOT_LOADED_MESSAGE =
  'instrument mapping not loaded: call loadInstrumentMapping() ' +
  '(production does so in bootstrapFeeServices) before resolving instruments';

function assertLoaded(context) {
  if (_cfiCodeMap === null) {
    throw new Error(`PO: ${NOT_LOADED_MESSAGE} [${context}]`);
  }
}

/**
 * Resolves a CfiCode to its fee category.
 * Falls back to 'bonds' and logs once per CfiCode the snapshot does not carry.
 * @param {string} cfiCode
 * @returns {string} category name
 * @throws {Error} if no snapshot has been loaded
 */
export function resolveCfiCategory(cfiCode) {
  assertLoaded('resolveCfiCategory');

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
 *
 * `null` means "this symbol is not in the loaded snapshot" — a real answer,
 * distinct from "nothing is loaded", which throws.
 *
 * @param {string} symbol - instrument symbol
 * @returns {object|null} - { cfiCode, priceConversionFactor, contractMultiplier } or null if not in the snapshot
 * @throws {Error} if no snapshot has been loaded
 */
export function getInstrumentDetails(symbol) {
  assertLoaded('getInstrumentDetails');

  // Try exact match first
  const exactMatch = _instrumentDetailsMap.get(symbol);
  if (exactMatch) {
    return exactMatch;
  }

  const normalizedSymbol = typeof symbol === 'string' ? symbol.trim().toUpperCase() : '';
  if (normalizedSymbol) {
    for (const [fullSymbol, details] of _instrumentDetailsMap.entries()) {
      if (typeof fullSymbol === 'string' && fullSymbol.trim().toUpperCase() === normalizedSymbol) {
        return details;
      }
    }
  }
  
  // Try partial match for tokenized symbols (e.g., GFGC50131O matches MERV - XMEV - GFGC50131O - 24hs)
  // This handles cases where CSV has simplified symbol but JSON has full qualified symbol
  if (normalizedSymbol) {
    for (const [fullSymbol, details] of _instrumentDetailsMap.entries()) {
      // Check if the full symbol contains the input symbol as a component
      // Split by spaces and dashes to get components
      const components = fullSymbol
        .split(/[\s-]+/)
        .map(c => c.trim().toUpperCase())
        .filter(c => c.length > 0);
      if (components.includes(normalizedSymbol)) {
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
