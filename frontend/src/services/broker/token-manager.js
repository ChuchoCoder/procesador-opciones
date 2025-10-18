// Token storage & automatic refresh logic (T016)
// Integrates with config-context brokerAuth state slice

import { refreshToken } from './jsrofex-client.js';

/**
 * Token refresh threshold: refresh if expiry within 60 seconds.
 * Per research.md decision 6: "proactive refresh when now > expiry - 60s"
 */
const REFRESH_THRESHOLD_MS = 60 * 1000;

/**
 * Check if token needs refresh based on expiry threshold.
 * @param {Object|null} brokerAuth - { token, expiry, accountId?, displayName? }
 * @returns {boolean} True if token should be refreshed
 */
export function needsRefresh(brokerAuth) {
  if (!brokerAuth || !brokerAuth.token || !brokerAuth.expiry) {
    return false; // No token to refresh
  }

  const now = Date.now();
  const expiryThreshold = brokerAuth.expiry - REFRESH_THRESHOLD_MS;
  
  return now >= expiryThreshold;
}

/**
 * Check if token is still valid (not expired).
 * @param {Object|null} brokerAuth - { token, expiry, accountId?, displayName? }
 * @returns {boolean} True if token is valid
 */
export function isTokenValid(brokerAuth) {
  if (!brokerAuth || !brokerAuth.token || !brokerAuth.expiry) {
    return false;
  }

  return Date.now() < brokerAuth.expiry;
}

/**
 * Attempt to refresh the current token.
 * @param {Object} brokerAuth - Current auth state { token, expiry, accountId?, displayName? }
 * @returns {Promise<Object>} New auth object { token, expiry, accountId?, displayName? }
 * @throws {Error} If refresh fails (TOKEN_EXPIRED, network error, etc.)
 */
export async function performRefresh(brokerAuth) {
  if (!brokerAuth || !brokerAuth.token) {
    throw new Error('REFRESH_FAILED: No current token available');
  }

  const { token, expiry } = await refreshToken(brokerAuth.token);
  
  // Preserve account metadata across refresh
  return {
    token,
    expiry,
    accountId: brokerAuth.accountId,
    displayName: brokerAuth.displayName,
  };
}

/**
 * Get valid token, refreshing if necessary.
 * Integration point for sync operations.
 * 
 * @param {Object} brokerAuth - Current auth state from config context
 * @param {Function} dispatchSetAuth - Dispatcher for SET_BROKER_AUTH action
 * @returns {Promise<string>} Valid token ready for use
 * @throws {Error} If no auth, token expired and refresh fails, or other errors
 */
export async function ensureValidToken(brokerAuth, dispatchSetAuth) {
  if (!brokerAuth || !brokerAuth.token) {
    throw new Error('NOT_AUTHENTICATED: No broker session available');
  }

  // Check if token already expired
  if (!isTokenValid(brokerAuth)) {
    throw new Error('TOKEN_EXPIRED: Re-authentication required');
  }

  // Check if token needs proactive refresh
  if (needsRefresh(brokerAuth)) {
    const newAuth = await performRefresh(brokerAuth);
    dispatchSetAuth(newAuth);
    return newAuth.token;
  }

  // Token is valid and not near expiry
  return brokerAuth.token;
}
