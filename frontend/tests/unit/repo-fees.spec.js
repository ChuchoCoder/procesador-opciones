import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  calculateRepoExpenseBreakdown,
  parseTenorDays,
  calculateAccruedInterest,
  reconcileBaseAmount,
  setRepoFeesLogger,
} from '../../src/services/fees/repo-fees.js';

const defaultConfig = {
  arancelCaucionColocadora: { ARS: 0.2, USD: 0.2 },
  arancelCaucionTomadora: { ARS: 0.25, USD: 0.25 },
  derechosDeMercadoDailyRate: { ARS: 0.0005, USD: 0.0005 },
  gastosGarantiaDailyRate: { ARS: 0.00035, USD: 0.00035 },
  ivaRepoRate: 0.21,
};

const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

describe('repo-fees calculation library', () => {
  const warnSpy = vi.fn();

  beforeEach(() => {
    warnSpy.mockReset();
    setRepoFeesLogger({ warn: warnSpy });
  });

  it('parses tenor days from instrument display name (case insensitive)', () => {
    expect(parseTenorDays('USD CAUCION 1D')).toBe(1);
    expect(parseTenorDays('caucion 7d')).toBe(7);
  });

  it('computes accrued interest and lender breakdown (colocadora)', () => {
    const repoOperation = {
      id: 'repo-1',
      principalAmount: 81700,
      baseAmount: 81701.79,
      priceTNA: 0.8,
      role: 'colocadora',
      currency: 'USD',
      instrument: {
        cfiCode: 'RPXXXX',
        displayName: 'MERV - CAUCION USD 1D',
      },
    };

    const breakdown = calculateRepoExpenseBreakdown(repoOperation, defaultConfig);

    expect(breakdown.tenorDays).toBe(1);
    expect(round2(breakdown.accruedInterest)).toBe(1.79);
    expect(round2(breakdown.arancelAmount)).toBe(0.45);
    expect(round2(breakdown.derechosMercadoAmount)).toBe(0.41);
    expect(round2(breakdown.gastosGarantiaAmount)).toBe(0);
    expect(round2(breakdown.ivaAmount)).toBe(0.18);
    expect(round2(breakdown.totalExpenses)).toBe(1.04);
    expect(round2(breakdown.netSettlement)).toBe(81700.75);
    expect(breakdown.reconciliation.reconciles).toBe(true);
    expect(breakdown.status).toBe('ok');
    expect(breakdown.blocked).toBe(false);
    expect(breakdown.source).toBe('repo');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('computes borrower breakdown (tomadora) with guarantee fees added', () => {
    const repoOperation = {
      id: 'repo-2',
      principalAmount: 50000,
      baseAmount: 50001.23,
      priceTNA: 0.9,
      role: 'tomadora',
      currency: 'USD',
      instrument: {
        cfiCode: 'RPYYYY',
        displayName: 'CAUCION USD 1D',
      },
    };

    const breakdown = calculateRepoExpenseBreakdown(repoOperation, defaultConfig);

    expect(breakdown.tenorDays).toBe(1);
    expect(round2(breakdown.gastosGarantiaAmount)).toBeGreaterThan(0);
    expect(round2(breakdown.netSettlement)).toBeGreaterThan(repoOperation.baseAmount);
    expect(round2(breakdown.totalExpenses)).toBeCloseTo(
      round2(
        breakdown.arancelAmount +
          breakdown.derechosMercadoAmount +
          breakdown.gastosGarantiaAmount +
          breakdown.ivaAmount,
      ),
      2,
    );
    expect(breakdown.reconciliation.reconciles).toBe(true);
    expect(breakdown.status).toBe('ok');
    expect(breakdown.blocked).toBe(false);
    expect(breakdown.source).toBe('repo');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('returns zero expenses and logs warning when tenor is missing', () => {
    const repoOperation = {
      id: 'repo-3',
      principalAmount: 45000,
      baseAmount: 45050,
      priceTNA: 1.1,
      role: 'colocadora',
      currency: 'ARS',
      instrument: {
        cfiCode: 'RPZZZZ',
        displayName: 'CAUCION SIN TENOR',
      },
    };

    const breakdown = calculateRepoExpenseBreakdown(repoOperation, defaultConfig);

    expect(breakdown.tenorDays).toBe(0);
    expect(breakdown.totalExpenses).toBe(0);
    expect(breakdown.arancelAmount).toBe(0);
    expect(breakdown.derechosMercadoAmount).toBe(0);
    expect(breakdown.gastosGarantiaAmount).toBe(0);
    expect(breakdown.ivaAmount).toBe(0);
    expect(breakdown.status).toBe('error');
    expect(breakdown.blocked).toBe(true);
    expect(breakdown.source).toBe('repo-tenor-invalid');
    expect(warnSpy).toHaveBeenCalled();
    expect(breakdown.warnings).toContainEqual(
      expect.objectContaining({ code: 'REPO_TENOR_INVALID' }),
    );
  });

  it('reports reconciliation mismatch and logs warning when base amount diverges', () => {
    const repoOperation = {
      id: 'repo-4',
      principalAmount: 60000,
      priceTNA: 1,
      role: 'colocadora',
      currency: 'USD',
      instrument: {
        cfiCode: 'RPABCD',
        displayName: 'CAUCION 1D',
      },
    };

    const tenorDays = parseTenorDays(repoOperation.instrument.displayName);
    const accruedInterest = calculateAccruedInterest(
      repoOperation.principalAmount,
      repoOperation.priceTNA,
      tenorDays,
    );
    // Intentionally add mismatch beyond tolerance
    repoOperation.baseAmount = repoOperation.principalAmount + accruedInterest + 0.5;

    const breakdown = calculateRepoExpenseBreakdown(repoOperation, defaultConfig);

    expect(breakdown.reconciliation.reconciles).toBe(false);
    expect(Math.abs(breakdown.reconciliation.diff)).toBeGreaterThan(0.01);
    expect(breakdown.status).toBe('ok');
    expect(breakdown.blocked).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
    expect(breakdown.warnings).toContainEqual(
      expect.objectContaining({ code: 'REPO_BASE_AMOUNT_MISMATCH' }),
    );
  });

  it('blocks calculation and surfaces error when repo fee config is incomplete', () => {
    const repoOperation = {
      id: 'repo-5',
      principalAmount: 25000,
      baseAmount: 25010,
      priceTNA: 0.7,
      role: 'colocadora',
      currency: 'USD',
      instrument: {
        cfiCode: 'RPTEST',
        displayName: 'CAUCION USD 1D',
      },
    };

    const incompleteConfig = {
      ...defaultConfig,
      arancelCaucionColocadora: { ARS: 0.2, USD: 0 },
    };

    const breakdown = calculateRepoExpenseBreakdown(repoOperation, incompleteConfig);

    expect(breakdown.status).toBe('error');
    expect(breakdown.blocked).toBe(true);
    expect(breakdown.source).toBe('repo-config-error');
    expect(breakdown.totalExpenses).toBe(0);
    expect(breakdown.netSettlement).toBe(repoOperation.baseAmount);
    expect(breakdown.errorMessage).toMatch(/USD/i);
    expect(breakdown.warnings).toContainEqual(
      expect.objectContaining({ code: 'REPO_CONFIG_INCOMPLETE' }),
    );
    expect(warnSpy).toHaveBeenCalled();
  });
});
