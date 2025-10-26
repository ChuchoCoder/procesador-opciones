// repo-fees.js - Repo (cauciones) fee calculation helpers

import { createWarnLogger } from '../logging/index.js';

const DISPLAY_ROUNDING = Object.freeze({
  displayDecimals: 2,
  roundingMode: 'HALF_UP',
});

export const REPO_RECONCILIATION_TOLERANCE = 0.01;

const defaultLogger = createWarnLogger('repo-fees');

let repoFeesLogger = defaultLogger;

const ensureNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const clampToNonNegative = (value) => (value > 0 ? value : 0);
// conservative reference to satisfy linter when helper is retained for future use
void clampToNonNegative;

const rateLabelsByKey = {
  arancel: 'Arancel de caución',
  derechos: 'Derechos de mercado (diario)',
  gastos: 'Gastos de garantía (diario)',
  iva: 'IVA Repo',
};

const getOperationTenor = (repoOperation) => {
  const providedTenor = ensureNumber(repoOperation?.tenorDays);
  if (providedTenor > 0) {
    return Math.trunc(providedTenor);
  }

  const displayName = repoOperation?.instrument?.displayName ?? '';
  return parseTenorDays(displayName);
};

export function setRepoFeesLogger(logger) {
  if (logger && typeof logger.warn === 'function') {
    repoFeesLogger = logger;
    return;
  }

  repoFeesLogger = defaultLogger;
}

export function parseTenorDays(displayName = '') {
  if (typeof displayName !== 'string' || displayName.length === 0) {
    return 0;
  }

  const tenorMatch = displayName.match(/(-?\d+)\s*[dD]\b/);
  if (!tenorMatch) {
    return 0;
  }

  const parsed = Number.parseInt(tenorMatch[1], 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }

  return parsed;
}

export function calculateAccruedInterest(principalAmount = 0, priceTNA = 0, tenorDays = 0) {
  const principal = ensureNumber(principalAmount);
  const tnaPercent = ensureNumber(priceTNA);
  const days = ensureNumber(tenorDays);

  if (principal <= 0 || tnaPercent === 0 || days <= 0) {
    return 0;
  }

  return principal * (tnaPercent / 100) * (days / 365);
}

export function reconcileBaseAmount(principalAmount = 0, accruedInterest = 0, baseAmount = 0, tolerance = REPO_RECONCILIATION_TOLERANCE) {
  const principal = ensureNumber(principalAmount);
  const accrued = ensureNumber(accruedInterest);
  const base = ensureNumber(baseAmount);
  const expectedBase = principal + accrued;
  const diff = base - expectedBase;
  const reconciles = Math.abs(diff) <= ensureNumber(tolerance);

  return {
    reconciles,
    diff,
    expected: expectedBase,
    actual: base,
    tolerance: ensureNumber(tolerance),
  };
}

export function calculateArancel(baseAmount = 0, ratePercent = 0, tenorDays = 0) {
  const base = ensureNumber(baseAmount);
  const rate = ensureNumber(ratePercent);
  const days = ensureNumber(tenorDays);

  if (base <= 0 || rate <= 0 || days <= 0) {
    return 0;
  }

  return base * (rate / 100) * (days / 365);
}

export function calculateDerechosMercado(baseAmount = 0, dailyRatePercent = 0, tenorDays = 0) {
  const base = ensureNumber(baseAmount);
  const rate = ensureNumber(dailyRatePercent);
  const days = ensureNumber(tenorDays);

  if (base <= 0 || rate <= 0 || days <= 0) {
    return 0;
  }

  return base * (rate / 100) * days;
}

export function calculateGastosGarantia(baseAmount = 0, dailyRatePercent = 0, tenorDays = 0, role = 'colocadora') {
  if (role !== 'tomadora') {
    return 0;
  }

  const base = ensureNumber(baseAmount);
  const rate = ensureNumber(dailyRatePercent);
  const days = ensureNumber(tenorDays);

  if (base <= 0 || rate <= 0 || days <= 0) {
    return 0;
  }

  return base * (rate / 100) * days;
}

export function calculateIva(amounts = [], ivaRate = 0) {
  if (!Array.isArray(amounts) || amounts.length === 0) {
    return 0;
  }

  const rate = ensureNumber(ivaRate);
  if (rate <= 0) {
    return 0;
  }

  const base = amounts.reduce((acc, item) => acc + ensureNumber(item), 0);
  if (base === 0) {
    return 0;
  }

  return base * rate;
}

const buildBreakdownSkeleton = (repoOperation) => ({
  repoOperationId: repoOperation?.id ?? null,
  currency: repoOperation?.currency ?? null,
  role: repoOperation?.role ?? null,
  tenorDays: 0,
  principalAmount: ensureNumber(repoOperation?.principalAmount),
  baseAmount: ensureNumber(repoOperation?.baseAmount),
  accruedInterest: 0,
  arancelAmount: 0,
  derechosMercadoAmount: 0,
  gastosGarantiaAmount: 0,
  ivaAmount: 0,
  totalExpenses: 0,
  netSettlement: ensureNumber(repoOperation?.baseAmount),
  warnings: [],
  status: 'pending',
  blocked: false,
  source: 'repo',
  errorMessage: null,
  reconciliation: {
    reconciles: true,
    diff: 0,
    expected: ensureNumber(repoOperation?.baseAmount),
    actual: ensureNumber(repoOperation?.baseAmount),
    tolerance: REPO_RECONCILIATION_TOLERANCE,
  },
  rounding: DISPLAY_ROUNDING,
});

const resolveRatesForCurrency = (repoFeeConfig, currency, role) => {
  const safeCurrency = typeof currency === 'string' ? currency : null;
  const arancelKey = role === 'tomadora' ? 'arancelCaucionTomadora' : 'arancelCaucionColocadora';

  const arancelConfig = repoFeeConfig?.[arancelKey] ?? {};
  const derechosConfig = repoFeeConfig?.derechosDeMercadoDailyRate ?? {};
  const gastosConfig = repoFeeConfig?.gastosGarantiaDailyRate ?? {};

  return {
    arancelPercent: ensureNumber(safeCurrency ? arancelConfig[safeCurrency] : 0),
    derechosDailyPercent: ensureNumber(safeCurrency ? derechosConfig[safeCurrency] : 0),
    gastosDailyPercent: ensureNumber(safeCurrency ? gastosConfig[safeCurrency] : 0),
    ivaRate: ensureNumber(repoFeeConfig?.ivaRepoRate),
  };
};

const detectMissingRates = ({ arancelPercent, derechosDailyPercent, gastosDailyPercent, ivaRate }, role) => {
  const missing = [];

  if (arancelPercent <= 0) {
    missing.push('arancel');
  }
  if (derechosDailyPercent <= 0) {
    missing.push('derechos');
  }
  if (role === 'tomadora' && gastosDailyPercent <= 0) {
    missing.push('gastos');
  }
  if (ivaRate <= 0) {
    missing.push('iva');
  }

  return missing;
};

const buildMissingRatesMessage = ({ currency, role, missingKeys }, strings) => {
  const currencyLabel = currency ?? '---';
  const roleLabel = role ?? '---';
  const missingList = missingKeys
    .map((key) => rateLabelsByKey[key] || key)
    .join(', ');

  const defaultMessage = `Faltan tasas para ${currencyLabel} ${roleLabel}: ${missingList}. Abrí Configuración para completarlas.`;

  if (!strings) {
    return defaultMessage;
  }

  const template = strings?.repo?.tooltip?.missingConfigDescription;
  if (typeof template !== 'string' || template.length === 0) {
    return defaultMessage;
  }

  const roles = strings?.repo?.roles ?? {};
  const currencies = strings?.repo?.currencies ?? {};
  const prettyRole = roles[role] || roleLabel;
  const prettyCurrency = currencies[currency] || currencyLabel;

  return template
    .replace('{currency}', prettyCurrency)
    .replace('{role}', prettyRole)
    .replace('{missing}', missingList);
};

const repoCfiPattern = /^(RP|FR)/;

const shouldProcessRepoOperation = (repoOperation) => {
  const cfiCode = repoOperation?.instrument?.cfiCode ?? repoOperation?.cfiCode;
  if (typeof cfiCode !== 'string') {
    return false;
  }
  return repoCfiPattern.test(cfiCode);
};

export function calculateRepoExpenseBreakdown(repoOperation = {}, repoFeeConfig = {}) {
  if (!shouldProcessRepoOperation(repoOperation)) {
    return null;
  }

  const breakdown = buildBreakdownSkeleton(repoOperation);
  const tenorDays = getOperationTenor(repoOperation);
  breakdown.tenorDays = tenorDays;

  if (tenorDays <= 0) {
    const warning = {
      code: 'REPO_TENOR_INVALID',
      message: 'Tenor no disponible para la operación de caución.',
    };
    breakdown.warnings.push(warning);
    breakdown.blocked = true;
    breakdown.status = 'error';
    breakdown.source = 'repo-tenor-invalid';
    breakdown.errorMessage = warning.message;
    repoFeesLogger.warn('Repo tenor invalid', {
      repoOperationId: breakdown.repoOperationId,
      displayName: repoOperation?.instrument?.displayName,
    });
    return breakdown;
  }

  const { arancelPercent, derechosDailyPercent, gastosDailyPercent, ivaRate } = resolveRatesForCurrency(
    repoFeeConfig,
    breakdown.currency,
    breakdown.role,
  );

  const missingRates = detectMissingRates({ arancelPercent, derechosDailyPercent, gastosDailyPercent, ivaRate }, breakdown.role);
  if (missingRates.length > 0) {
    const warning = {
      code: 'REPO_CONFIG_INCOMPLETE',
      message: buildMissingRatesMessage({
        currency: breakdown.currency,
        role: breakdown.role,
        missingKeys: missingRates,
      }),
      missingRates,
      currency: breakdown.currency,
      role: breakdown.role,
    };
    breakdown.warnings.push(warning);
    breakdown.blocked = true;
    breakdown.status = 'error';
    breakdown.source = 'repo-config-error';
    breakdown.errorMessage = warning.message;
    breakdown.totalExpenses = 0;
    breakdown.netSettlement = breakdown.baseAmount;

    repoFeesLogger.warn('Repo fee config incomplete', {
      repoOperationId: breakdown.repoOperationId,
      currency: breakdown.currency,
      role: breakdown.role,
      missingRates,
    });

    return breakdown;
  }

  const accruedInterest = calculateAccruedInterest(
    breakdown.principalAmount,
    ensureNumber(repoOperation?.priceTNA),
    tenorDays,
  );
  breakdown.accruedInterest = accruedInterest;

  const reconciliation = reconcileBaseAmount(
    breakdown.principalAmount,
    accruedInterest,
    breakdown.baseAmount,
    REPO_RECONCILIATION_TOLERANCE,
  );
  breakdown.reconciliation = reconciliation;

  if (!reconciliation.reconciles) {
    const warning = {
      code: 'REPO_BASE_AMOUNT_MISMATCH',
      message: 'El monto base no concilia con principal + interés devengado.',
      diff: reconciliation.diff,
    };
    breakdown.warnings.push(warning);
    repoFeesLogger.warn('Repo base amount mismatch', {
      repoOperationId: breakdown.repoOperationId,
      diff: reconciliation.diff,
      expected: reconciliation.expected,
      actual: reconciliation.actual,
    });
  }

  const arancelAmount = calculateArancel(breakdown.baseAmount, arancelPercent, tenorDays);
  const derechosMercadoAmount = calculateDerechosMercado(breakdown.baseAmount, derechosDailyPercent, tenorDays);
  const gastosGarantiaAmount = calculateGastosGarantia(
    breakdown.baseAmount,
    gastosDailyPercent,
    tenorDays,
    breakdown.role,
  );
  const ivaAmount = calculateIva([arancelAmount, derechosMercadoAmount, gastosGarantiaAmount], ivaRate);

  const totalExpenses = arancelAmount + derechosMercadoAmount + gastosGarantiaAmount + ivaAmount;
  const netSettlement = breakdown.role === 'tomadora'
    ? breakdown.baseAmount + totalExpenses
    : breakdown.baseAmount - totalExpenses;

  breakdown.arancelAmount = arancelAmount;
  breakdown.derechosMercadoAmount = derechosMercadoAmount;
  breakdown.gastosGarantiaAmount = gastosGarantiaAmount;
  breakdown.ivaAmount = ivaAmount;
  breakdown.totalExpenses = totalExpenses;
  breakdown.netSettlement = netSettlement;
  breakdown.status = 'ok';
  breakdown.source = 'repo';

  return breakdown;
}
