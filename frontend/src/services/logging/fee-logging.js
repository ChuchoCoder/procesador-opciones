// fee-logging.js - structured logging helpers for per-operation fees
// Prefix all logs with PO: to integrate with existing logging filters.

export function logFeeProcessingSummary({ totalRows, unknownCfiCodes }) {
  // unknownCfiCodes: Set or array
  const unknownCount = unknownCfiCodes ? (unknownCfiCodes.size || unknownCfiCodes.length || 0) : 0;
  console.info('PO: fee-summary', { totalRows, unknownCfiCodes: unknownCount });
}

export function logUnknownCfiCode(cfiCode) {
  console.warn('PO: fee-unknown-cfi', { cfiCode });
}

export function logConfigWarning(code, context) {
  // code examples: missing-option-commission
  console.warn('PO: fee-config-warning', { code, context });
}

export function logMappingDedupSummary(set) {
  console.info('PO: fee-mapping-dedup', { count: set.size });
}
