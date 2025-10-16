// config-validation.js - Validate and sanitize fee configuration JSON
// Ensures all numeric fields are finite and >=0; applies defaults for missing values.

import { logConfigWarning } from '../logging/fee-logging.js';

/**
 * Sanitizes a numeric percentage field. Returns 0 if invalid/negative.
 * @param {number} value - raw percentage (whole %, e.g., 0.6 for 0.6%)
 * @param {string} fieldName - for logging context
 * @returns {number} sanitized value >= 0
 */
function sanitizePercentage(value, fieldName) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    logConfigWarning('invalid-percentage', { field: fieldName, value });
    return 0;
  }
  return value;
}

/**
 * Validates and sanitizes the raw fee config JSON.
 * Missing or invalid fields -> defaults; warnings logged.
 * @param {object} rawConfig - loaded JSON object
 * @returns {object} validated config with structure: { byma: { derechosDeMercado, cauciones }, broker: {...} }
 */
export function validateFeeConfig(rawConfig) {
  if (!rawConfig || typeof rawConfig !== 'object') {
    logConfigWarning('invalid-config-root', { rawConfig });
    return { 
      byma: { 
        derechosDeMercado: { accionCedear: 0, letra: 0, bonds: 0, option: 0, iva: 0.21 },
        cauciones: { derechosDeMercadoDailyRate: 0, gastosGarantiaDailyRate: 0 }
      }, 
      broker: { commission: 0, arancelCaucionColocadora: 0, arancelCaucionTomadora: 0 } 
    };
  }

  const byma = rawConfig.byma || {};
  const broker = rawConfig.broker || {};
  const derechosDeMercado = byma.derechosDeMercado || {};
  const cauciones = byma.cauciones || {};

  // Sanitize BYMA derechos de mercado fields (whole percentages)
  const accionCedearPct = sanitizePercentage(derechosDeMercado.accionCedear, 'byma.derechosDeMercado.accionCedear');
  const letraPct = sanitizePercentage(derechosDeMercado.letra, 'byma.derechosDeMercado.letra');
  const bondsPct = sanitizePercentage(derechosDeMercado.bonds, 'byma.derechosDeMercado.bonds');
  const optionPct = sanitizePercentage(derechosDeMercado.option, 'byma.derechosDeMercado.option');
  
  // VAT special handling: default to 0.21 if missing/invalid, only applies to accionCedear
  let ivaPct = derechosDeMercado.iva;
  if (typeof ivaPct !== 'number' || !Number.isFinite(ivaPct) || ivaPct < 0 || ivaPct > 1) {
    if (ivaPct !== undefined) {
      logConfigWarning('invalid-vat', { value: ivaPct });
    }
    ivaPct = 0.21; // default IVA Argentina
  }

  // Sanitize BYMA cauciones fields (daily rate percentages)
  const derechosMercadoDailyRate = sanitizePercentage(cauciones.derechosDeMercadoDailyRate, 'byma.cauciones.derechosDeMercadoDailyRate');
  const gastosGarantiaDailyRate = sanitizePercentage(cauciones.gastosGarantiaDailyRate, 'byma.cauciones.gastosGarantiaDailyRate');

  // Sanitize broker fields (whole percentages)
  let brokerCommissionPct = sanitizePercentage(broker.commission, 'broker.commission');
  if (brokerCommissionPct === 0 && broker.commission === undefined) {
    logConfigWarning('missing-broker-commission', { fallback: 0.6 });
    brokerCommissionPct = 0.6; // default broker commission
  }
  
  const arancelColocadora = sanitizePercentage(broker.arancelCaucionColocadora, 'broker.arancelCaucionColocadora');
  const arancelTomadora = sanitizePercentage(broker.arancelCaucionTomadora, 'broker.arancelCaucionTomadora');

  return {
    byma: {
      derechosDeMercado: {
        accionCedear: accionCedearPct,
        letra: letraPct,
        bonds: bondsPct,
        option: optionPct,
        iva: ivaPct,
      },
      cauciones: {
        derechosDeMercadoDailyRate: derechosMercadoDailyRate,
        gastosGarantiaDailyRate: gastosGarantiaDailyRate,
      },
    },
    broker: {
      commission: brokerCommissionPct,
      arancelCaucionColocadora: arancelColocadora,
      arancelCaucionTomadora: arancelTomadora,
    },
  };
}

/**
 * Precompute effective fee rates per category for performance.
 * VAT applies to BOTH: Commission AND Derechos (rights) for Acciones/CEDEARs and Options
 * VAT does NOT apply to: Letras, Bonds, Cauciones
 * 
 * For accionCedear & option: effectiveRate = (commission + rights) × (1 + VAT) / 100
 * For letra & bonds: effectiveRate = (commission + rights) / 100
 * 
 * @param {object} validatedConfig - output from validateFeeConfig
 * @returns {object} map { category: { commissionPct, rightsPct, vatPct, effectiveRate } }
 */
export function computeEffectiveRates(validatedConfig) {
  const { byma, broker } = validatedConfig;
  const brokerCommission = broker.commission;
  const iva = byma.derechosDeMercado.iva;

  // Acción/CEDEAR: (commission + accionCedear rights) × (1 + VAT)
  const accionCedearRights = byma.derechosDeMercado.accionCedear;
  const accionCedearEffective = (brokerCommission + accionCedearRights) * (1 + iva) / 100;

  // Letra: commission + letra rights NO VAT
  const letraRights = byma.derechosDeMercado.letra;
  const letraEffective = (brokerCommission + letraRights) / 100;

  // Bonds: commission + bonds rights NO VAT
  const bondsRights = byma.derechosDeMercado.bonds;
  const bondsEffective = (brokerCommission + bondsRights) / 100;

  // Option: (commission + option rights) × (1 + VAT)
  const optionRights = byma.derechosDeMercado.option;
  const optionEffective = (brokerCommission + optionRights) * (1 + iva) / 100;

  return {
    accionCedear: {
      commissionPct: brokerCommission / 100,
      rightsPct: accionCedearRights / 100,
      vatPct: iva,
      effectiveRate: accionCedearEffective,
    },
    letra: {
      commissionPct: brokerCommission / 100,
      rightsPct: letraRights / 100,
      vatPct: 0, // NO VAT on letra
      effectiveRate: letraEffective,
    },
    bonds: {
      commissionPct: brokerCommission / 100,
      rightsPct: bondsRights / 100,
      vatPct: 0, // NO VAT on bonds
      effectiveRate: bondsEffective,
    },
    option: {
      commissionPct: brokerCommission / 100,
      rightsPct: optionRights / 100, // options have their own rights (0.2%)
      vatPct: iva, // VAT applies to options
      effectiveRate: optionEffective,
    },
    caucion: {
      commissionPct: 0, // cauciones use different structure
      rightsPct: 0,
      vatPct: 0,
      effectiveRate: 0, // computed per operation based on days
      dailyRates: byma.cauciones,
      aranceles: {
        colocadora: broker.arancelCaucionColocadora / 100, // annual fraction
        tomadora: broker.arancelCaucionTomadora / 100,
      },
    },
  };
}
