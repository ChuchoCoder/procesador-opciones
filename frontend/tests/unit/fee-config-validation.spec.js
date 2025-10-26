// fee-config-validation.spec.js - Unit tests for config validation (US1)
// Covers: invalid numbers -> sanitized defaults & warnings

/* eslint-env node, jest */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { validateFeeConfig, computeEffectiveRates } from '../../src/services/fees/config-validation.js';
import * as feeLogging from '../../src/services/logging/fee-logging.js';

describe('Fee Config Validation', () => {
  beforeEach(() => {
    vi.spyOn(feeLogging, 'logConfigWarning').mockImplementation(() => {});
  });

  it('should sanitize negative broker commission to 0', () => {
    const rawConfig = {
      byma: { 
        derechosDeMercado: { accionCedear: 0.07, letra: 0.001, bonds: 0.01, option: 0.2, iva: 0.21 },
        cauciones: { derechosDeMercadoDailyRate: 0.0005, gastosGarantiaDailyRate: 0.0005 }
      },
      broker: { commission: -0.6 },
    };
    
    const validated = validateFeeConfig(rawConfig);
    expect(validated.broker.commission).toBe(0);
    expect(feeLogging.logConfigWarning).toHaveBeenCalled();
  });

  it('should default VAT (iva) to 0.21 if missing', () => {
    const rawConfig = {
      byma: { 
        derechosDeMercado: { accionCedear: 0.07, letra: 0.001, bonds: 0.01, option: 0.2 },
        cauciones: {}
      },
      broker: { commission: 0.6 },
    };
    
    const validated = validateFeeConfig(rawConfig);
    expect(validated.byma.derechosDeMercado.iva).toBe(0.21);
  });

  it('should sanitize invalid VAT to 0.21', () => {
    const rawConfig = {
      byma: { 
        derechosDeMercado: { accionCedear: 0.07, letra: 0.001, bonds: 0.01, option: 0.2, iva: 'invalid' },
        cauciones: {}
      },
      broker: { commission: 0.6 },
    };
    
    const validated = validateFeeConfig(rawConfig);
    expect(validated.byma.derechosDeMercado.iva).toBe(0.21);
  });

  it('should compute effective rates correctly for accionCedear with VAT', () => {
    const validatedConfig = {
      byma: { 
        derechosDeMercado: { accionCedear: 0.07, letra: 0.001, bonds: 0.01, option: 0.2, iva: 0.21 },
        cauciones: { derechosDeMercadoDailyRate: 0.0005, gastosGarantiaDailyRate: 0.0005 }
      },
      broker: { commission: 0.6, arancelCaucionColocadora: 1.5, arancelCaucionTomadora: 3.0 },
    };
    
    const rates = computeEffectiveRates(validatedConfig);
    expect(rates.accionCedear).toBeDefined();
    expect(rates.accionCedear.effectiveRate).toBeGreaterThan(0);
    
    // Manual calculation check: (commission + accionCedear) × (1 + iva) / 100
    // = (0.6 + 0.07) × 1.21 / 100 = 0.67 × 1.21 / 100 = 0.8107 / 100 = 0.008107
    const expectedEffective = (0.6 + 0.07) * (1 + 0.21) / 100;
    expect(rates.accionCedear.effectiveRate).toBeCloseTo(expectedEffective, 8);
    expect(rates.accionCedear.vatPct).toBe(0.21);
  });

  it('should compute effective rates correctly for letra without VAT', () => {
    const validatedConfig = {
      byma: { 
        derechosDeMercado: { accionCedear: 0.07, letra: 0.001, bonds: 0.01, option: 0.2, iva: 0.21 },
        cauciones: { derechosDeMercadoDailyRate: 0.0005, gastosGarantiaDailyRate: 0.0005 }
      },
      broker: { commission: 0.6, arancelCaucionColocadora: 1.5, arancelCaucionTomadora: 3.0 },
    };
    
    const rates = computeEffectiveRates(validatedConfig);
    
    // Manual calculation: (commission + letra) / 100 = (0.6 + 0.001) / 100 = 0.00601
    const expectedEffective = (0.6 + 0.001) / 100;
    expect(rates.letra.effectiveRate).toBeCloseTo(expectedEffective, 8);
    expect(rates.letra.vatPct).toBe(0); // NO VAT on letra
  });

  it('should handle empty config gracefully', () => {
    const validated = validateFeeConfig({});
    expect(validated.byma).toBeDefined();
    expect(validated.broker).toBeDefined();
    expect(validated.byma.derechosDeMercado.iva).toBe(0.21);
    expect(validated.broker.commission).toBe(0.6); // default fallback
  });
});
