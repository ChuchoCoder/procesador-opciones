import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadRepoFeeDefaults,
  getDefaultBrokerFees,
  getRepoFeeConfig,
  setRepoFeeConfig,
  clearRepoFeeConfig,
} from '../../src/services/fees/broker-fees-storage.js';
import feeConfigJson from '../../src/services/fees/fees-config.json';

describe('broker-fees-storage', () => {
  it('loads repo defaults from bundled fees-config.json', async () => {
    const defaults = await loadRepoFeeDefaults();

    expect(defaults).toEqual(
      expect.objectContaining({
        arancelCaucionColocadora: { ARS: 1.5, USD: 0.2 },
        arancelCaucionTomadora: { ARS: 3.0, USD: 0.2 },
        derechosDeMercadoDailyRate: { ARS: 0.0005, USD: 0.0005 },
        gastosGarantiaDailyRate: { ARS: 0.0005, USD: 0.0005 },
        ivaRepoRate: 0.21,
      }),
    );
  });

  it('returns broker defaults from fees-config for getDefaultBrokerFees', () => {
    const brokerDefaults = getDefaultBrokerFees();

    expect(brokerDefaults.commission).toBe(feeConfigJson.broker.commission);
  });
});

describe('repo fee config persistence', () => {
  beforeEach(async () => {
    await clearRepoFeeConfig();
  });

  it('persists arancel caucion TNA overrides per currency and role', async () => {
    await setRepoFeeConfig({
      arancelCaucionColocadora: { ARS: 2.75, USD: 0.35 },
      arancelCaucionTomadora: { ARS: 4.5, USD: 0.4 },
    });

    const reloaded = await getRepoFeeConfig({ forceReload: true });

    expect(reloaded.arancelCaucionColocadora).toEqual({ ARS: 2.75, USD: 0.35 });
    expect(reloaded.arancelCaucionTomadora).toEqual({ ARS: 4.5, USD: 0.4 });
  });

  it('keeps a zero arancel instead of falling back to the default', async () => {
    await setRepoFeeConfig({
      arancelCaucionTomadora: { ARS: 0, USD: 0 },
    });

    const reloaded = await getRepoFeeConfig({ forceReload: true });

    expect(reloaded.arancelCaucionTomadora).toEqual({ ARS: 0, USD: 0 });
  });

  it('restores bundled defaults on clear', async () => {
    await setRepoFeeConfig({ arancelCaucionColocadora: { ARS: 9.9, USD: 9.9 } });

    const defaults = await clearRepoFeeConfig();
    expect(defaults.arancelCaucionColocadora).toEqual({ ARS: 1.5, USD: 0.2 });

    const reloaded = await getRepoFeeConfig({ forceReload: true });
    expect(reloaded.arancelCaucionColocadora).toEqual({ ARS: 1.5, USD: 0.2 });
  });
});
