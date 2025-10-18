import { symbolExists, saveSymbolConfig } from './storage-settings.js';
import { createDefaultSymbolConfigWithOverrides } from './settings-types.js';

// Default symbol configurations with prefixes
// Based on MCP/BCBA ticker patterns (company-root style prefixes)
const DEFAULT_SYMBOL_CONFIGS = [
  { symbol: 'AL30', prefix: 'A30' },
  { symbol: 'ALUA', prefix: 'ALU' },
  { symbol: 'BBAR', prefix: 'BBA' },
  { symbol: 'BHIP', prefix: 'BHI' },
  { symbol: 'BMA', prefix: 'BMA' },
  { symbol: 'BYMA', prefix: 'BYM' },
  { symbol: 'CEPU', prefix: 'CEP' },
  { symbol: 'COME', prefix: 'COM' },
  { symbol: 'EDN', prefix: 'EDN' },
  { symbol: 'GGAL', prefix: 'GFG' },  // Grupo Financiero Galicia
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

/**
 * Seed storage with default symbol configs if missing.
 * Returns an array of symbols that were created (for info).
 */
export async function seedDefaultSymbols() {
  const created = [];

  for (const { symbol: sym, prefix } of DEFAULT_SYMBOL_CONFIGS) {
    try {
      // symbolExists may return boolean or Promise
      const exists = symbolExists(sym);
      const isPresent = (exists && typeof exists.then === 'function') ? await exists : exists;
      if (!isPresent) {
        // Create default config with overrides (GGAL special-case)
        const cfg = createDefaultSymbolConfigWithOverrides(sym);
        // Set the default prefix
        cfg.prefix = prefix;
        const saved = saveSymbolConfig(cfg);
        // saveSymbolConfig may be sync or Promise
        const ok = (saved && typeof saved.then === 'function') ? await saved : saved;
        if (ok) created.push(sym);
      }
    } catch (e) {
      // ignore per-symbol errors but log
      console.error('seedDefaultSymbols: failed for', sym, e);
    }
  }

  return created;
}
