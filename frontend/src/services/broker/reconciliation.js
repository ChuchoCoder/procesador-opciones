// Reconciliation engine: compares CSV-sourced and broker-sourced operations to surface
// inconsistencies between the two ingestion paths (see dedupe-utils.js source guard for
// why order_id can't be used across sources: CSV and broker use incompatible ID namespaces).

export const DEFAULT_TIME_WINDOW_MS = 3000;

const DIFF_FIELDS = ['quantity', 'optionType', 'strike', 'expirationDate', 'tradeTimestamp'];

const bucketKey = (op) => `${op.symbol}|${op.action}`;

const roundPrice = (price) => {
  const num = Number(price);
  return Number.isFinite(num) ? num.toFixed(2) : 'NaN';
};

const exactKey = (op) => `${roundPrice(op.price)}|${op.quantity}`;

const groupBy = (list, keyFn) => {
  const map = new Map();
  list.forEach((item) => {
    const key = keyFn(item);
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(item);
  });
  return map;
};

/**
 * Greedy bipartite consuming match between two lists within a time window.
 * Each broker entry can be consumed by at most one csv entry (and vice versa),
 * unlike a naive .some()-based check which can let multiple candidates all
 * "match" the same single entry.
 *
 * @returns {{ pairs: Array<{csv: Object, broker: Object, deltaMs: number}>, leftoverCsv: Array, leftoverBroker: Array }}
 */
export function greedyConsumingMatch(csvList, brokerList, timeWindowMs) {
  const brokerConsumed = new Array(brokerList.length).fill(false);
  const pairs = [];
  const leftoverCsv = [];

  const sortedCsv = [...csvList].sort((a, b) => a.tradeTimestamp - b.tradeTimestamp);

  sortedCsv.forEach((csvOp) => {
    let bestIndex = -1;
    let bestDelta = Infinity;

    brokerList.forEach((brokerOp, index) => {
      if (brokerConsumed[index]) {
        return;
      }
      const delta = Math.abs(csvOp.tradeTimestamp - brokerOp.tradeTimestamp);
      if (delta <= timeWindowMs && delta < bestDelta) {
        bestDelta = delta;
        bestIndex = index;
      }
    });

    if (bestIndex === -1) {
      leftoverCsv.push(csvOp);
      return;
    }

    brokerConsumed[bestIndex] = true;
    pairs.push({ csv: csvOp, broker: brokerList[bestIndex], deltaMs: bestDelta });
  });

  const leftoverBroker = brokerList.filter((_, index) => !brokerConsumed[index]);

  return { pairs, leftoverCsv, leftoverBroker };
}

const computeDiffFields = (csvOp, brokerOp) => DIFF_FIELDS
  .filter((field) => csvOp[field] !== brokerOp[field])
  .map((field) => ({ field, csvValue: csvOp[field], brokerValue: brokerOp[field] }));

/**
 * Collapse multiple entries sharing the same order_id into a single merged
 * entry. The correct collapse strategy differs by source:
 *
 * - CSV: daily reports emit one row per execution-report EVENT (e.g.
 *   "Parcialmente ejecutada" followed by "Ejecutada"), and each row's
 *   `quantity` is that event's own fill delta (last_qty), NOT a running
 *   total -- so rows for one order must be SUMMED to reach the order's true
 *   total quantity. Rows can even arrive out of chronological order, so
 *   taking the max or the last row in file order both undercount.
 * - Broker: multiple entries sharing an order_id are revision/snapshot
 *   duplicates of the SAME order (e.g. the API re-lists an order across a
 *   replace/modify with a new clOrdId but the same orderId), and each
 *   already reports the order's cumulative quantity -- summing them would
 *   double-count. Keep the entry with the largest quantity instead.
 *
 * Operations without an order_id pass through unchanged.
 */
export function collapsePartialFillsByOrder(operations = []) {
  const byOrderId = new Map();
  const withoutOrderId = [];

  operations.forEach((op) => {
    if (!op.order_id) {
      withoutOrderId.push(op);
      return;
    }
    if (!byOrderId.has(op.order_id)) {
      byOrderId.set(op.order_id, []);
    }
    byOrderId.get(op.order_id).push(op);
  });

  const merged = [...byOrderId.values()].map((rows) => {
    if (rows.length === 1) {
      return rows[0];
    }

    if (rows[0]?.source === 'csv') {
      const totalQuantity = rows.reduce((sum, row) => sum + (row.quantity ?? 0), 0);
      const latest = rows.reduce((a, b) => ((b.tradeTimestamp ?? 0) > (a.tradeTimestamp ?? 0) ? b : a));
      return {
        ...latest,
        quantity: totalQuantity,
        rawSource: rows.map((row) => row.rawSource),
      };
    }

    return rows.reduce((a, b) => ((b.quantity ?? 0) > (a.quantity ?? 0) ? b : a));
  });

  return [...merged, ...withoutOrderId];
}

/**
 * Reconcile CSV-sourced and broker-sourced operations without relying on order_id
 * (CSV and broker use incompatible ID namespaces, and one order_id can correspond
 * to several partial fills).
 *
 * Matching is bucketed by symbol+side, then run in two passes:
 * 1. Exact match: same price+quantity, nearest timestamp within timeWindowMs.
 * 2. Mismatch detection: on what's left after step 1, same price only, nearest
 *    timestamp within timeWindowMs -- surfaces quantity/other-field differences
 *    instead of reporting them as absent.
 * Anything left after both passes has no candidate sharing symbol+side+price
 * within the window at all, and is reported as genuinely absent on one side.
 *
 * @param {Array} csvOperations - normalized operations, source: 'csv'
 * @param {Array} brokerOperations - normalized operations, source: 'broker'
 * @param {{ timeWindowMs?: number }} [options]
 * @returns {{
 *   matched: Array<{ id: string, csv: Object, broker: Object, deltaMs: number }>,
 *   mismatched: Array<{ id: string, csv: Object, broker: Object, deltaMs: number, diffFields: Array<{field: string, csvValue: *, brokerValue: *}> }>,
 *   absent: Array<{ id: string, side: 'csv'|'broker', operation: Object }>,
 *   summary: { csvTotal: number, brokerTotal: number, matchedCount: number, mismatchedCount: number, absentCsvCount: number, absentBrokerCount: number },
 * }}
 */
export function reconcileOperations(csvOperations = [], brokerOperations = [], options = {}) {
  const timeWindowMs = options.timeWindowMs ?? DEFAULT_TIME_WINDOW_MS;

  // Collapse CSV partial-fill progressions (and any stray duplicate broker
  // snapshots) to one entry per order_id before matching -- see collapsePartialFillsByOrder.
  const collapsedCsvOperations = collapsePartialFillsByOrder(csvOperations);
  const collapsedBrokerOperations = collapsePartialFillsByOrder(brokerOperations);

  const matched = [];
  const mismatched = [];
  const absent = [];

  const csvBuckets = groupBy(collapsedCsvOperations, bucketKey);
  const brokerBuckets = groupBy(collapsedBrokerOperations, bucketKey);
  const allBucketKeys = new Set([...csvBuckets.keys(), ...brokerBuckets.keys()]);

  allBucketKeys.forEach((bucket) => {
    const csvBucketOps = csvBuckets.get(bucket) ?? [];
    const brokerBucketOps = brokerBuckets.get(bucket) ?? [];

    // Step 1: exact match (price + quantity) within the bucket.
    const csvExactGroups = groupBy(csvBucketOps, exactKey);
    const brokerExactGroups = groupBy(brokerBucketOps, exactKey);
    const exactKeys = new Set([...csvExactGroups.keys(), ...brokerExactGroups.keys()]);

    const csvLeftover = [];
    const brokerLeftover = [];

    exactKeys.forEach((key) => {
      const csvGroup = csvExactGroups.get(key) ?? [];
      const brokerGroup = brokerExactGroups.get(key) ?? [];
      const { pairs, leftoverCsv, leftoverBroker } = greedyConsumingMatch(csvGroup, brokerGroup, timeWindowMs);

      pairs.forEach(({ csv, broker, deltaMs }) => {
        matched.push({ id: `${csv.id}::${broker.id}`, csv, broker, deltaMs });
      });
      csvLeftover.push(...leftoverCsv);
      brokerLeftover.push(...leftoverBroker);
    });

    // Step 2: mismatch detection on leftovers, grouped by price only (symbol+side fixed by bucket).
    const csvLooseGroups = groupBy(csvLeftover, (op) => roundPrice(op.price));
    const brokerLooseGroups = groupBy(brokerLeftover, (op) => roundPrice(op.price));
    const looseKeys = new Set([...csvLooseGroups.keys(), ...brokerLooseGroups.keys()]);

    looseKeys.forEach((key) => {
      const csvGroup = csvLooseGroups.get(key) ?? [];
      const brokerGroup = brokerLooseGroups.get(key) ?? [];
      const { pairs, leftoverCsv, leftoverBroker } = greedyConsumingMatch(csvGroup, brokerGroup, timeWindowMs);

      pairs.forEach(({ csv, broker, deltaMs }) => {
        mismatched.push({
          id: `${csv.id}::${broker.id}`,
          csv,
          broker,
          deltaMs,
          diffFields: computeDiffFields(csv, broker),
        });
      });

      leftoverCsv.forEach((op) => absent.push({ id: op.id, side: 'csv', operation: op }));
      leftoverBroker.forEach((op) => absent.push({ id: op.id, side: 'broker', operation: op }));
    });
  });

  const summary = {
    csvTotal: collapsedCsvOperations.length,
    brokerTotal: collapsedBrokerOperations.length,
    matchedCount: matched.length,
    mismatchedCount: mismatched.length,
    absentCsvCount: absent.filter((entry) => entry.side === 'csv').length,
    absentBrokerCount: absent.filter((entry) => entry.side === 'broker').length,
  };

  return { matched, mismatched, absent, summary };
}
