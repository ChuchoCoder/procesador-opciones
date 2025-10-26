// fee-enrichment.js - Attaches fee calculations to operation rows
// Integrates with process-operations pipeline to add fee fields.

import { calculateFee } from './fee-calculator.js';
import { calculateRepoExpenseBreakdown, calculateAccruedInterest, parseTenorDays } from './repo-fees.js';
import { resolveCfiCategory, getInstrumentDetails, getUnknownCfiCodes } from './instrument-mapping.js';
import { getEffectiveRates } from '../bootstrap-defaults.js';
import { getRepoFeeConfig } from './broker-fees-storage.js';
import { logFeeProcessingSummary } from '../logging/fee-logging.js';

const REPO_SOURCE_PREFIX = 'repo';

const isRepoCfiCode = (value) => typeof value === 'string' && /^(RP|FR)/.test(value);

const gatherCandidateSources = (operation, options = {}) => {
  const {
    includeMeta = true,
    includeRawMeta = true,
  } = options;
  const sources = [];
  if (operation && typeof operation === 'object') {
    sources.push(operation);
    if (includeMeta && operation.meta && typeof operation.meta === 'object') {
      sources.push(operation.meta);
    }
    if (operation.raw && typeof operation.raw === 'object') {
      sources.push(operation.raw);
      if (includeRawMeta && operation.raw.meta && typeof operation.raw.meta === 'object') {
        sources.push(operation.raw.meta);
      }
    }
  }
  return sources;
};

const toNumber = (value) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const sanitized = trimmed
    .replace(/\s+/g, '')
    .replace(/[A-Za-z%$]/g, '');

  if (!sanitized) {
    return null;
  }

  const hasComma = sanitized.includes(',');
  const hasDot = sanitized.includes('.');
  const dotCount = hasDot ? (sanitized.match(/\./g) || []).length : 0;

  const directCandidate = Number(sanitized);
  const digitsOnly = sanitized.replace(/[^0-9-]/g, '');
  const isLikelyThousandsDot = hasDot && !hasComma && (dotCount > 1 || (sanitized.lastIndexOf('.') >= 0
    && sanitized.length - sanitized.lastIndexOf('.') - 1 === 3
    && digitsOnly.length > 3));

  if (Number.isFinite(directCandidate) && !isLikelyThousandsDot) {
    return directCandidate;
  }

  const argentinianCandidate = Number(
    sanitized
      .replace(/\./g, '')
      .replace(',', '.'),
  );
  if (Number.isFinite(argentinianCandidate)) {
    return argentinianCandidate;
  }

  const usCandidate = Number(sanitized.replace(/,/g, ''));
  if (Number.isFinite(usCandidate)) {
    return usCandidate;
  }

  const fallback = Number(sanitized.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(fallback) ? fallback : null;
};

const pickFirstNumber = (operation, candidateKeys = [], options = {}) => {
  const sources = gatherCandidateSources(operation, options);
  for (const source of sources) {
    for (const key of candidateKeys) {
      if (source && Object.prototype.hasOwnProperty.call(source, key)) {
        const numeric = toNumber(source[key]);
        if (numeric !== null) {
          return numeric;
        }
      }
    }
  }
  return null;
};

const pickFirstString = (operation, candidateKeys = [], options = {}) => {
  const sources = gatherCandidateSources(operation, options);
  for (const source of sources) {
    for (const key of candidateKeys) {
      if (source && Object.prototype.hasOwnProperty.call(source, key)) {
        const value = source[key];
        if (value === undefined || value === null) {
          continue;
        }
        const stringValue = String(value).trim();
        if (stringValue.length > 0) {
          return stringValue;
        }
      }
    }
  }
  return null;
};

const normalizeRepoCurrency = (rawCurrency) => {
  if (typeof rawCurrency !== 'string') {
    return null;
  }
  const normalized = rawCurrency.trim().toUpperCase();
  if (!normalized) {
    return null;
  }
  if (normalized === 'U$S' || normalized === 'US$' || normalized === 'UUSD') {
    return 'USD';
  }
  if (normalized === 'DOLAR' || normalized === 'DÓLAR') {
    return 'USD';
  }
  if (normalized === 'PESO' || normalized === 'PESOS') {
    return 'ARS';
  }
  if (normalized.startsWith('USD')) {
    return 'USD';
  }
  if (normalized.startsWith('ARS')) {
    return 'ARS';
  }
  return normalized;
};

const inferCurrencyFromLabels = (labels = []) => {
  for (const label of labels) {
    if (typeof label !== 'string') {
      continue;
    }
    const normalized = label.trim().toUpperCase();
    if (!normalized) {
      continue;
    }
    if (normalized.includes('PESO') || normalized.includes('ARS')) {
      return 'ARS';
    }
    if (
      normalized.includes('DOLAR')
      || normalized.includes('DÓLAR')
      || normalized.includes('USD')
      || normalized.includes('U$S')
      || normalized.includes('US$')
    ) {
      return 'USD';
    }
  }
  return null;
};

const normalizeRepoRole = (rawRole, fallbackFromSide) => {
  const candidates = [];
  if (typeof rawRole === 'string') {
    candidates.push(rawRole);
  }
  if (typeof fallbackFromSide === 'string') {
    candidates.push(fallbackFromSide);
  }

  for (const candidate of candidates) {
    const normalized = candidate.trim().toLowerCase();
    if (!normalized) {
      continue;
    }
    if ([
      'colocadora',
      'colocador',
      'lender',
      'sell',
      'seller',
      'venta',
      'vende',
    ].includes(normalized)) {
      return 'colocadora';
    }
    if ([
      'tomadora',
      'tomador',
      'borrower',
      'buy',
      'buyer',
      'compra',
      'comprarepo',
    ].includes(normalized)) {
      return 'tomadora';
    }
  }

  return null;
};

const mapSideToRole = (side) => {
  if (typeof side !== 'string') {
    return null;
  }

  const normalized = side.trim().toUpperCase();
  if (normalized === 'BUY') {
    return 'tomadora';
  }
  if (normalized === 'SELL') {
    return 'colocadora';
  }

  return null;
};

const extractRepoOperationInput = (operation, instrumentDetails) => {
  const displayNameCandidate = pickFirstString(operation, [
    'instrumentDisplayName',
    'instrument_description',
    'instrumentName',
    'instrument_name',
    'instrument',
    'description',
  ]);

  const displayNameFallbacks = [
    displayNameCandidate,
    operation?.originalSymbol,
    operation?.symbol,
    instrumentDetails?.displayName,
    operation?.raw?.symbol,
  ];

  const displayName = displayNameFallbacks.find((value) => typeof value === 'string' && value.trim().length > 0)
    || '';

  let rawCfiCode = instrumentDetails?.cfiCode
    || operation?.cfiCode
    || operation?.raw?.cfiCode
    || operation?.raw?.CfiCode
    || operation?.meta?.cfiCode;

  if (!rawCfiCode) {
    const cfiCandidate = pickFirstString(operation, [
      'cfiCode',
      'cficode',
      'cfi_code',
      'CFICode',
      'CFICODE',
      'cfi',
    ]);
    if (cfiCandidate) {
      rawCfiCode = cfiCandidate;
    }
  }

  const normalizedCfiCode = typeof rawCfiCode === 'string' ? rawCfiCode.trim().toUpperCase() : '';

  const repoDescriptor = pickFirstString(operation, [
    'securityDescription',
    'security_description',
    'instrumentDescription',
    'instrument_description',
    'productDescription',
    'product_description',
    'securityType',
    'security_type',
    'instrumentType',
    'instrument_type',
    'productType',
    'product_type',
  ]);

  const repoHintSources = [
    displayName,
    ...displayNameFallbacks,
    repoDescriptor,
    operation?.raw?.security_description,
    operation?.raw?.SecurityDescription,
    operation?.raw?.description,
    operation?.raw?.instrument,
    operation?.raw?.instrumentDescription,
  ];

  const hasRepoHints = repoHintSources.some((value) => {
    if (typeof value !== 'string') {
      return false;
    }
    const upper = value.toUpperCase();
    return upper.includes('CAUCION') || upper.includes('CAUCIÓN') || upper.includes('REPO');
  });

  const resolvedCfiCode = isRepoCfiCode(normalizedCfiCode)
    ? normalizedCfiCode
    : hasRepoHints
      ? (normalizedCfiCode || 'RP-UNKNOWN')
      : null;

  if (!resolvedCfiCode) {
    return null;
  }

  const currencyValue = pickFirstString(operation, [
    'repoCurrency',
    'currency',
    'currencyId',
    'instrumentCurrency',
    'settlementCurrency',
    'currency_code',
    'currency_code_id',
    'currency_code_value',
  ]);
  let currency = normalizeRepoCurrency(currencyValue);

  const roleValue = pickFirstString(operation, [
    'repoRole',
    'role',
    'repoParticipant',
    'participationRole',
    'repo_role',
    'role_repo',
    'participant_role',
  ]);
  const roleFromSide = mapSideToRole(operation?.side);
  const role = normalizeRepoRole(roleValue, roleFromSide) || roleFromSide;

  let principalAmount = pickFirstNumber(operation, [
    'principalAmount',
    'principal_amount',
    'principal',
    'capitalAmount',
    'capital_amount',
    'capital',
    'last_qty',
    'totalPrincipal',
  ], {
    includeMeta: false,
    includeRawMeta: false,
  });
  if (principalAmount === null) {
    principalAmount = pickFirstNumber(operation, [
      'principalAmount',
      'principal_amount',
      'principal',
      'capitalAmount',
      'capital_amount',
      'capital',
      'last_qty',
      'totalPrincipal',
    ]);
  }
  if (principalAmount === null) {
    const quantityCandidates = [
      operation?.quantity,
      operation?.raw?.quantity,
      operation?.raw?.order_size,
      operation?.raw?.last_qty,
      operation?.raw?.cum_qty,
    ];
    for (const candidate of quantityCandidates) {
      const numeric = toNumber(candidate);
      if (numeric !== null && numeric !== 0) {
        principalAmount = Math.abs(numeric);
        break;
      }
    }
  }

  let baseAmount = pickFirstNumber(operation, [
    'baseAmount',
    'base_amount',
    'montoBase',
    'monto_base',
  ], {
    includeMeta: false,
    includeRawMeta: false,
  });
  if (baseAmount === null) {
    baseAmount = pickFirstNumber(operation, [
      'baseAmount',
      'base_amount',
      'montoBase',
      'monto_base',
    ]);
  }
  let priceTNA = pickFirstNumber(operation, [
    'priceTNA',
    'price_tna',
    'tna',
    'tasaTna',
    'tasa_tna',
    'repoRate',
    'repo_rate',
    'price',
    'order_price',
    'last_price',
    'avg_price',
  ]);
  const tenorDays = pickFirstNumber(operation, [
    'tenorDays',
    'tenor_days',
    'tenor',
    'plazoDias',
    'plazo_dias',
    'days',
  ]);

  if (priceTNA === null && Number.isFinite(operation?.price)) {
    priceTNA = operation.price;
  }

  if (!currency) {
    const currencyFromDetails = normalizeRepoCurrency(instrumentDetails?.currency ?? null);
    if (currencyFromDetails) {
      currency = currencyFromDetails;
    }
  }

  if (!currency) {
    currency = inferCurrencyFromLabels([
      instrumentDetails?.currency,
      instrumentDetails?.displayName,
      ...displayNameFallbacks,
    ]);
  }

  const tenorFromDisplay = parseTenorDays(displayName);
  const resolvedTenorDays = Number.isFinite(tenorDays) && tenorDays > 0
    ? Math.trunc(tenorDays)
    : tenorFromDisplay > 0
      ? tenorFromDisplay
      : null;

  if ((baseAmount === null || baseAmount === 0)
    && principalAmount !== null
    && principalAmount > 0
    && priceTNA !== null
    && resolvedTenorDays !== null
    && resolvedTenorDays > 0) {
    const accrued = calculateAccruedInterest(principalAmount, priceTNA, resolvedTenorDays);
    if (Number.isFinite(accrued)) {
      baseAmount = principalAmount + accrued;
    }
  }

  if (!currency || !role) {
    return null;
  }

  return {
    id: operation?.id ?? operation?.orderId ?? null,
    cfiCode: resolvedCfiCode,
    currency,
    role,
    principalAmount,
    baseAmount,
    priceTNA,
    tenorDays: resolvedTenorDays ?? tenorDays ?? null,
    instrument: {
      cfiCode: resolvedCfiCode,
      displayName,
      currency,
    },
  };
};

const maybeCalculateRepoBreakdown = (operation, instrumentDetails, repoFeeConfig) => {
  if (!repoFeeConfig) {
    return null;
  }

  const repoOperation = extractRepoOperationInput(operation, instrumentDetails);
  if (!repoOperation) {
    return null;
  }

  return calculateRepoExpenseBreakdown(
    {
      ...repoOperation,
    },
    repoFeeConfig,
  );
};

const isRepoBreakdown = (breakdown) => typeof breakdown?.source === 'string'
  && breakdown.source.startsWith(REPO_SOURCE_PREFIX);

/**
 * Enriches a single operation with fee calculation fields.
 * @param {object} operation - enriched operation from process-operations
 * @param {object} effectiveRates - precomputed rates by category
 * @param {object} [options]
 * @param {object} [options.repoFeeConfig]
 * @returns {object} operation with added fee fields (feeAmount, feeBreakdown, category)
 */
export function enrichOperationWithFee(operation, effectiveRates, options = {}) {
  if (!operation) return operation;

  const { repoFeeConfig } = options;
  const quantity = operation.quantity ?? 0;
  const price = operation.price ?? 0;
  // Use originalSymbol first (full CSV symbol like "MERV - XMEV - PFE - CI")
  // This matches the symbol format in InstrumentsWithDetails.json
  const symbol = operation.originalSymbol || operation.symbol || '';
  
  // Get instrument details (PriceConversionFactor, ContractMultiplier, CfiCode)
  const instrumentDetails = getInstrumentDetails(symbol);
  
  // Resolve category from CfiCode
  let cfiCode = instrumentDetails?.cfiCode || operation.raw?.cfiCode || operation.raw?.CfiCode || operation.meta?.cfiCode;
  let category = 'bonds'; // default fallback

  if (cfiCode) {
    category = resolveCfiCategory(cfiCode);
  } else if (operation.optionType === 'CALL' || operation.optionType === 'PUT') {
    category = 'option';
  }

  // Use instrument-specific values with fallbacks
  const priceConversionFactor = instrumentDetails?.priceConversionFactor ?? 1;
  const contractMultiplier = instrumentDetails?.contractMultiplier ?? (category === 'option' ? 100 : 1);
  
  // Calculate gross notional: quantity × contractMultiplier × price
  // Note: price here is the raw CSV price (monetary value before normalization)
  // Fee is calculated on monetary notional, then normalized later
  const grossNotional = Math.abs(quantity) * contractMultiplier * price;

  // Calculate fee using pure calculator (fee is in monetary units)
  const feeResult = calculateFee({ grossNotional, category }, effectiveRates);
  
  // Normalize the fee amount to match normalized price scale
  const normalizedFeeAmount = feeResult.feeAmount * priceConversionFactor;

  const repoBreakdown = maybeCalculateRepoBreakdown(operation, instrumentDetails, repoFeeConfig);
  const useRepoBreakdown = isRepoBreakdown(repoBreakdown);
  const feeBreakdown = useRepoBreakdown ? repoBreakdown : feeResult.feeBreakdown;
  const feeAmount = useRepoBreakdown ? (repoBreakdown.totalExpenses ?? 0) : normalizedFeeAmount;
  const resolvedCategory = useRepoBreakdown ? 'caucion' : category;
  const resolvedCfiCode = useRepoBreakdown && repoBreakdown?.instrument?.cfiCode
    ? repoBreakdown.instrument.cfiCode
    : cfiCode;
  const netSettlement = useRepoBreakdown
    ? repoBreakdown.netSettlement ?? null
    : operation.netSettlement ?? null;

  return {
    ...operation,
    grossNotional,
    category: resolvedCategory,
    cfiCode: resolvedCfiCode || null,
    feeAmount,
    feeBreakdown,
    netSettlement,
  };
}

/**
 * Enriches an array of operations with fee calculations.
 * Logs summary of processed rows and unknown CfiCodes.
 * @param {Array<object>} operations - enriched operations from process-operations
 * @returns {Array<object>} operations with fee fields
 */
export async function enrichOperationsWithFees(operations) {
  if (!Array.isArray(operations) || operations.length === 0) {
    return operations;
  }

  const effectiveRates = getEffectiveRates();
  const repoFeeConfig = await getRepoFeeConfig();
  
  // Debug: log effective rates
   
  console.log('PO: effective-rates', effectiveRates, {
    repoFeeConfigLoaded: Boolean(repoFeeConfig),
  });

  const enriched = operations.map((op) => enrichOperationWithFee(op, effectiveRates, { repoFeeConfig }));

  // Log summary
  const unknownCfiCodes = getUnknownCfiCodes();
  logFeeProcessingSummary({
    totalRows: enriched.length,
    unknownCfiCodes,
  });

  return enriched;
}
