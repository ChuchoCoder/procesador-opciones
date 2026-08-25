// BrokerSession adapter shim
// Exposes isAuthenticated() and tryRefresh() as promised in the plan.
import logger from './logging';
import { readItem, storageKeys } from './storage/local-storage.js';

async function isAuthenticated() {
  try {
    // Check multiple sources for authentication status:
    
    // 1. Check if there's a global session object (for background scripts)
    if (typeof window !== 'undefined' && window.__BROKER_SESSION && typeof window.__BROKER_SESSION.isAuthenticated === 'function') {
      return !!window.__BROKER_SESSION.isAuthenticated();
    }
    
    // 2. Check storage for persisted auth state (primary method)
    const brokerAuth = await readItem(storageKeys.brokerAuth);
    if (brokerAuth && brokerAuth.token) {
      // Optionally check token expiry if available
      if (brokerAuth.expiry) {
        const isExpired = Date.now() > brokerAuth.expiry;
        if (!isExpired) {
          return true;
        }
        logger.info('brokerSession', 'isAuthenticated', 'token expired');
      } else {
        // No expiry info, assume valid
        return true;
      }
    }
    
    return false;
  } catch (e) {
    logger.warn('brokerSession', 'isAuthenticated', 'check failed', { error: e && e.message });
    return false;
  }
}

async function tryRefresh() {
  // Default shim: no-op and return false indicating no refresh performed
  logger.info('brokerSession', 'tryRefresh', 'shim called - no refresh available');
  return false;
}

export default {
  isAuthenticated,
  tryRefresh,
};
