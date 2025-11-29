// BrokerSession adapter shim (background copy)
import logger from './logging.js';

function isAuthenticated() {
  try {
    if (typeof window !== 'undefined' && window.__BROKER_SESSION && typeof window.__BROKER_SESSION.isAuthenticated === 'function') {
      return !!window.__BROKER_SESSION.isAuthenticated();
    }
    const v = localStorage.getItem('broker.isAuthenticated');
    return v === 'true';
  } catch (e) {
    logger.warn('brokerSession', 'isAuthenticated', 'check failed', { error: e && e.message });
    return false;
  }
}

async function tryRefresh() {
  logger.info('brokerSession', 'tryRefresh', 'shim called - no refresh available');
  return false;
}

export default {
  isAuthenticated,
  tryRefresh,
};
