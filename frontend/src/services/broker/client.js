// Minimal broker client shim used by instrumentsSyncService
// Exposes fetchInstruments() that returns parsed JSON array of instrument details
import logger from '../logging.js';
import { readItem, storageKeys } from '../storage/local-storage.js';

async function fetchInstruments() {
  // Try to read broker auth token and API URL from storage
  try {
    // Get broker authentication token
    const brokerAuth = await readItem(storageKeys.brokerAuth);
    if (!brokerAuth || !brokerAuth.token) {
      logger.warn('brokerClient', 'fetchInstruments', 'No authentication token found');
      return [];
    }
    
    // Get broker API base URL
    const brokerApiUrl = await readItem(storageKeys.brokerApiUrl);
    const base = brokerApiUrl || 'https://api.remarkets.primary.com.ar';
    
    const url = `${base.replace(/\/$/, '')}/rest/instruments/details`;
    
    logger.info('brokerClient', 'fetchInstruments', 'fetching', { url });
    
    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Auth-Token': brokerAuth.token,
      },
    });
    
    if (!resp.ok) {
      logger.warn('brokerClient', 'fetchInstruments', 'fetch failed', { status: resp.status });
      return [];
    }
    
    const json = await resp.json();
    
    // API returns { status: "OK", instruments: [...] }
    // Extract the instruments array
    const instruments = json?.instruments || json;
    const instrumentsArray = Array.isArray(instruments) ? instruments : [];
    
    logger.info('brokerClient', 'fetchInstruments', 'success', { count: instrumentsArray.length });
    return instrumentsArray;
  } catch (e) {
    logger.error('brokerClient', 'fetchInstruments', 'exception', { error: e && e.message });
    return [];
  }
}

export default {
  fetchInstruments,
};
