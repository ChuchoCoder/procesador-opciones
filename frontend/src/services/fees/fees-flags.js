// Feature flags for fee calculations
// Toggle caucion fee path (future enablement). Default false per research decision.
export const ENABLE_CAUCION_FEES = false;

export function isCaucionEnabled() {
  return ENABLE_CAUCION_FEES === true;
}
