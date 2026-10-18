/* eslint-env node */
/**
 * Instruments that the historical CSV fixtures traded and that
 * `InstrumentsWithDetails.json` no longer carries.
 *
 * That file is a snapshot of the broker's *live* instrument list, so every
 * contract that matures drops out of it. The CSV fixtures, on the other hand,
 * are reports from fixed jornadas in 2025. The overlap shrinks with every
 * refresh of the snapshot, and when it shrinks past a symbol a spec asserts
 * on, the spec starts reading `getInstrumentDetails(...) === null` and fails —
 * or worse, keeps passing while the pipeline silently falls back to
 * `priceConversionFactor = 1`.
 *
 * So a spec pinned to a historical jornada declares the instruments of that
 * jornada here instead of hoping the live snapshot still has them.
 *
 * Every entry's values are copied from the surviving members of the same
 * family in the snapshot, not invented:
 *   - `D<dd><month><y>` dollar-linked bonds (D30O6, D31G6, D15E7, …):
 *     CfiCode `DYXTXR`, PriceConvertionFactor 0.01, ContractMultiplier 1.
 *   - DLR futures (DLR/AGO26, …): `FXXXSX`, factor 1, multiplier 1000.
 *   - options on DLR futures: `OCEFXS` / `OPEFXS`, factor 1, multiplier 1000.
 */

const dollarLinkedBond = (symbol) => ({
  InstrumentId: { marketId: 'ROFX', symbol },
  CfiCode: 'DYXTXR',
  ContractMultiplier: 1,
  RoundLot: 1,
  PriceConvertionFactor: 0.01,
  Currency: 'ARS',
});

const dlrFuture = (symbol) => ({
  InstrumentId: { marketId: 'ROFX', symbol },
  CfiCode: 'FXXXSX',
  ContractMultiplier: 1000,
  RoundLot: 1,
  PriceConvertionFactor: 1,
  Currency: 'ARS',
});

const dlrFutureOption = (symbol, cfiCode) => ({
  InstrumentId: { marketId: 'ROFX', symbol },
  CfiCode: cfiCode,
  ContractMultiplier: 1000,
  RoundLot: 1,
  PriceConvertionFactor: 1,
  Currency: 'ARS',
});

/** Instruments of the 2025-12-30 jornada (`ReporteOperaciones_17825-2025-12-30.csv`). */
export const EXPIRED_INSTRUMENTS_2025_12_30 = [
  dollarLinkedBond('MERV - XMEV - D30E6 - CI'),
  dollarLinkedBond('MERV - XMEV - D30E6 - 24hs'),
  dollarLinkedBond('MERV - XMEV - D16E6 - CI'),
  dollarLinkedBond('MERV - XMEV - D16E6 - 24hs'),
];

/** DLR futures and their options, as of the 2025-11-25 jornada. */
export const EXPIRED_DLR_CONTRACTS = [
  dlrFuture('DLR/NOV25'),
  dlrFuture('DLR/DIC25'),
  dlrFutureOption('DLR/DIC25 1340 C', 'OCEFXS'),
  dlrFutureOption('DLR/DIC25 1340 P', 'OPEFXS'),
];
