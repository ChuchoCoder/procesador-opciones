/**
 * Service for identifying and matching buy/sell operations for the same symbol
 * across different settlement periods (CI, 24hs, 1D, 2D, 3D, etc).
 */

/**
 * Groups buy and sell operations by symbol and settlement
 * @param {Array} operations - Array of operation objects
 * @returns {Object} Object with buy and sell operations grouped by symbol
 */
export const groupBuySellOperations = (operations) => {
  if (!Array.isArray(operations) || operations.length === 0) {
    return {
      bySymbol: new Map(),
      allBuys: [],
      allSells: [],
    };
  }

  const allBuys = [];
  const allSells = [];
  const bySymbol = new Map();

  operations.forEach((operation) => {
    const side = operation.side?.toUpperCase();
    
    // Only process operations that are not options (calls/puts)
    const isOption = operation.optionType === 'CALL' || operation.optionType === 'PUT';
    if (isOption) {
      return;
    }

    const symbol = operation.symbol || 'UNKNOWN';
    const settlement = operation.expiration || operation.settlement || 'CI';

    if (side === 'BUY') {
      allBuys.push(operation);
    } else if (side === 'SELL') {
      allSells.push(operation);
    }

    if (!bySymbol.has(symbol)) {
      bySymbol.set(symbol, {
        symbol,
        buys: [],
        sells: [],
        settlements: new Set(),
      });
    }

    const symbolGroup = bySymbol.get(symbol);
    symbolGroup.settlements.add(settlement);

    if (side === 'BUY') {
      symbolGroup.buys.push(operation);
    } else if (side === 'SELL') {
      symbolGroup.sells.push(operation);
    }
  });

  // Convert settlements Set to Array for each symbol
  bySymbol.forEach((group) => {
    group.settlements = Array.from(group.settlements).sort();
  });

  return {
    bySymbol,
    allBuys,
    allSells,
  };
};

/**
 * Identifies potential buy/sell pairs for arbitrage opportunities
 * @param {Array} operations - Array of operation objects
 * @returns {Array} Array of potential pairs with matching symbols
 */
export const identifyBuySellPairs = (operations) => {
  const { bySymbol } = groupBuySellOperations(operations);
  const pairs = [];

  bySymbol.forEach((group, symbol) => {
    if (group.buys.length > 0 && group.sells.length > 0) {
      // For each symbol with both buys and sells, create a summary
      pairs.push({
        symbol,
        buyCount: group.buys.length,
        sellCount: group.sells.length,
        settlements: group.settlements,
        buys: group.buys,
        sells: group.sells,
        totalBuyQuantity: group.buys.reduce((sum, op) => sum + (op.quantity || 0), 0),
        totalSellQuantity: group.sells.reduce((sum, op) => sum + (op.quantity || 0), 0),
      });
    }
  });

  return pairs.sort((a, b) => a.symbol.localeCompare(b.symbol));
};

/**
 * Filters operations to get only non-option buy/sell operations
 * @param {Array} operations - Array of operation objects
 * @returns {Object} Object with separate arrays for buys and sells
 */
export const getNonOptionOperations = (operations) => {
  if (!Array.isArray(operations) || operations.length === 0) {
    return { buys: [], sells: [] };
  }

  const buys = [];
  const sells = [];

  operations.forEach((operation) => {
    const isOption = operation.optionType === 'CALL' || operation.optionType === 'PUT';
    if (isOption) {
      return;
    }

    const side = operation.side?.toUpperCase();
    if (side === 'BUY') {
      buys.push(operation);
    } else if (side === 'SELL') {
      sells.push(operation);
    }
  });

  return { buys, sells };
};
