const SIGN_BY_SIDE = {
  BUY: 1,
  SELL: -1,
};

const formatNumber = (value, decimals = 4) => {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

const groupOperations = (operations, { useAveraging }) => {
  const groups = new Map();

  operations.forEach((operation) => {
    const baseSymbol = operation.matchedSymbol ?? operation.originalSymbol;

    const key = useAveraging
      ? [baseSymbol, operation.optionType, operation.strike, 'averaged'].join('::')
      : [operation.orderId, baseSymbol, operation.optionType].join('::');

    if (!groups.has(key)) {
      groups.set(key, {
        optionType: operation.optionType,
        strike: operation.strike,
        matchedSymbol: baseSymbol,
        legs: [],
        weightedSum: 0,
        netQuantity: 0,
        orderId: operation.orderId,
      });
    }

    const group = groups.get(key);
    const signedQuantity = SIGN_BY_SIDE[operation.side] * operation.quantity;

    group.legs.push(operation);
    group.netQuantity += signedQuantity;
    group.weightedSum += signedQuantity * operation.price;

    if (!useAveraging) {
      // For non-averaging mode keep strike as-is.
      group.strike = operation.strike;
    }
  });

  return groups;
};

export const consolidateOperations = (
  operations,
  { useAveraging = false } = {},
) => {
  if (!Array.isArray(operations) || operations.length === 0) {
    return {
      calls: [],
      puts: [],
      exclusions: {
        zeroNetQuantity: 0,
      },
    };
  }

  const groups = groupOperations(operations, { useAveraging });
  const calls = [];
  const puts = [];
  let zeroNetQuantity = 0;

  groups.forEach((group) => {
    if (group.netQuantity === 0) {
      zeroNetQuantity += 1;
      return;
    }

    const averagePrice = formatNumber(group.weightedSum / group.netQuantity);

    const representativeSymbol = group.legs[0]?.originalSymbol ?? group.matchedSymbol;

    // Aggregate fee data from legs (Feature 004)
    const totalGrossNotional = group.legs.reduce((sum, leg) => sum + (leg.grossNotional || 0), 0);
    const totalFeeAmount = group.legs.reduce((sum, leg) => sum + (leg.feeAmount || 0), 0);
    const firstLeg = group.legs[0];
    const category = firstLeg?.category || 'bonds';
    
    // Recompute fee breakdown for the total gross notional
    // (not using first leg's breakdown since it's for a single leg)
    const feeBreakdown = firstLeg?.feeBreakdown ? {
      ...firstLeg.feeBreakdown,
      // Recalculate amounts based on totalGrossNotional
      commissionAmount: totalGrossNotional * firstLeg.feeBreakdown.commissionPct,
      rightsAmount: totalGrossNotional * firstLeg.feeBreakdown.rightsPct,
      vatAmount: totalGrossNotional * (firstLeg.feeBreakdown.commissionPct + firstLeg.feeBreakdown.rightsPct) * firstLeg.feeBreakdown.vatPct,
    } : null;

    const consolidated = {
      originalSymbol: representativeSymbol,
      matchedSymbol: group.matchedSymbol,
      optionType: group.optionType,
      strike: group.strike,
      totalQuantity: group.netQuantity,
      averagePrice,
      legs: group.legs,
      orderId: group.orderId,
      // Fee fields (aggregated)
      grossNotional: totalGrossNotional,
      feeAmount: totalFeeAmount,
      feeBreakdown,
      category,
    };

    if (group.optionType === 'CALL') {
      calls.push(consolidated);
    } else {
      puts.push(consolidated);
    }
  });

  const sortByStrike = (a, b) => a.strike - b.strike;
  calls.sort(sortByStrike);
  puts.sort(sortByStrike);

  return {
    calls,
    puts,
    exclusions: {
      zeroNetQuantity,
    },
  };
};

const buildViewResult = (operations, useAveraging) => ({
  key: useAveraging ? 'averaged' : 'raw',
  useAveraging,
  ...consolidateOperations(operations, { useAveraging }),
});

export const buildConsolidatedViews = (operations = []) => ({
  raw: buildViewResult(operations, false),
  averaged: buildViewResult(operations, true),
});
