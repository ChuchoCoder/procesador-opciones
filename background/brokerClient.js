// Minimal broker client shim used by instrumentsSyncService (background copy)
import logger from './logging.js';

async function fetchInstruments() {
  try {
    const base = localStorage.getItem('broker.apiUrl') || null;
    if (!base) {
      logger.warn('brokerClient', 'fetchInstruments', 'No broker.apiUrl configured — returning empty list');
      return [];
    }
    const url = `${base.replace(/\/$/, '')}/rest/instruments/details`;
    const resp = await fetch(url, { credentials: 'include' });
    if (!resp.ok) {
      logger.warn('brokerClient', 'fetchInstruments', 'fetch failed', { status: resp.status });
      return [];
    }
    const json = await resp.json();
    return json || [];
  } catch (e) {
    logger.error('brokerClient', 'fetchInstruments', 'exception', { error: e && e.message });
    return [];
  }
}

export default {
  fetchInstruments,
};
