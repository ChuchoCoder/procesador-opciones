// Feature flags for fee calculations
// Toggle caucion fee path (future enablement). Default false per research decision.
// ENABLED for arbitrage de plazos feature to calculate caución fees
export const ENABLE_CAUCION_FEES = true;

export function isCaucionEnabled() {
  return ENABLE_CAUCION_FEES === true;
}
