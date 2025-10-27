/**
 * Simple in-memory client state for Market Data subscriptions.
 * Keeps shape aligned with specs/data-model.md
 */

export function createClientState() {
  return {
    connectionState: 'disconnected', // 'disconnected' | 'connecting' | 'connected' | 'error'
    // Map<subscriptionId, Subscription>
    subscriptions: new Map(),
    // Map<instrumentKey, Map<entry, {sequenceId?, snapshotHash?, timestamp?}>>
    lastSeen: new Map(),
  };
}

export function addSubscription(state, subscriptionId, subscription) {
  state.subscriptions.set(subscriptionId, Object.assign({}, subscription, {createdAt: new Date().toISOString()}));
}

export function removeSubscription(state, subscriptionId) {
  state.subscriptions.delete(subscriptionId);
}

export function updateLastSeen(state, instrumentKey, entry, payload) {
  let byInstrument = state.lastSeen.get(instrumentKey);
  if (!byInstrument) {
    byInstrument = new Map();
    state.lastSeen.set(instrumentKey, byInstrument);
  }
  byInstrument.set(entry, Object.assign({timestamp: new Date().toISOString()}, payload));
}

export function getLastSeen(state, instrumentKey, entry) {
  const byInstrument = state.lastSeen.get(instrumentKey);
  if (!byInstrument) return null;
  return byInstrument.get(entry) || null;
}

// Return an array of subscription entries that match a given instrument identifier.
// A subscription's `products` can contain instrument ids formatted as "marketId:instrumentId" or simply instrumentId.
export function getSubscriptionsForInstrument(state, instrumentId) {
  const matches = [];
  for (const [subId, sub] of state.subscriptions.entries()) {
    if (!sub || !Array.isArray(sub.products)) continue;
    for (const p of sub.products) {
      if (!p) continue;
      // match by exact instrument id or market:instrument
      if (p === instrumentId || p.endsWith(`:${instrumentId}`) || p === `${instrumentId}`) {
        matches.push({ subscriptionId: subId, subscription: sub });
        break;
      }
    }
  }
  return matches;
}
