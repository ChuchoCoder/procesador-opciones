import { describe, it, expect } from 'vitest';
import { loadRepoFeeDefaults, getDefaultBrokerFees } from '../../src/services/fees/broker-fees-storage.js';
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
