export const DEFAULT_SYMBOL_CONFIGS = [
  { symbol: 'AL30', prefix: 'A30' },
  { symbol: 'ALUA', prefix: 'ALU' },
  { symbol: 'BBAR', prefix: 'BBA' },
  { symbol: 'BHIP', prefix: 'BHI' },
  { symbol: 'BMA', prefix: 'BMA' },
  { symbol: 'BYMA', prefix: 'BYM' },
  { symbol: 'CEPU', prefix: 'CEP' },
  { symbol: 'COME', prefix: 'COM' },
  { symbol: 'EDN', prefix: 'EDN' },
  { symbol: 'GGAL', prefix: 'GFG' },
  { symbol: 'METR', prefix: 'MET' },
  { symbol: 'MIRG', prefix: 'MIR' },
  { symbol: 'PAMP', prefix: 'PAM' },
  { symbol: 'SUPV', prefix: 'SUP' },
  { symbol: 'TECO2', prefix: 'TEC' },
  { symbol: 'TGNO4', prefix: 'TGN' },
  { symbol: 'TGSU2', prefix: 'TGS' },
  { symbol: 'TRAN', prefix: 'TRA' },
  { symbol: 'TXAR', prefix: 'TXA' },
  { symbol: 'YPFD', prefix: 'YPF' },
];

const buildPrefixSymbolMap = () => {
  const map = {};
  DEFAULT_SYMBOL_CONFIGS.forEach(({ symbol, prefix }) => {
    const normalizedPrefix = typeof prefix === 'string' ? prefix.trim().toUpperCase() : '';
    const normalizedSymbol = typeof symbol === 'string' ? symbol.trim().toUpperCase() : '';
    if (normalizedPrefix && normalizedSymbol) {
      map[normalizedPrefix] = normalizedSymbol;
    }
  });
  return Object.freeze(map);
};

export const DEFAULT_PREFIX_SYMBOL_MAP = buildPrefixSymbolMap();
