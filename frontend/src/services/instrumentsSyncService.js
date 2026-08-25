// Core instruments sync service (T007)
import brokerClient from './broker/client.js';
import storage from './instrumentsSyncStorage.js';
import brokerSession from './brokerSession.js';
import retryWithBackoff from './retryWithBackoff.js';
import logger from './logging.js';
import marketCalendar from './marketCalendar.js';

let memoizedRecord = null;

function normalizeInstrument(raw) {
  const issues = [];
  const instrument = {
    instrumentId: { marketId: raw.marketId || '', symbol: raw.symbol || '' },
    securityDescription: raw.securityDescription || '',
    cficode: raw.cficode || null,
    segment: raw.segment || null,
    lowLimitPrice: raw.lowLimitPrice != null ? Number(raw.lowLimitPrice) : null,
    highLimitPrice: raw.highLimitPrice != null ? Number(raw.highLimitPrice) : null,
    minPriceIncrement: raw.minPriceIncrement != null ? Number(raw.minPriceIncrement) : null,
    maturityDate: null,
    currency: raw.currency || null,
    orderTypes: raw.orderTypes || [],
    timesInForce: raw.timesInForce || [],
    instrumentPricePrecision: raw.instrumentPricePrecision != null ? Number(raw.instrumentPricePrecision) : null,
    instrumentSizePrecision: raw.instrumentSizePrecision != null ? Number(raw.instrumentSizePrecision) : null,
    contractMultiplier: raw.contractMultiplier != null ? Number(raw.contractMultiplier) : null,
    roundLot: raw.roundLot != null ? Number(raw.roundLot) : null,
  };
  // Normalize maturityDate
  if (raw.maturityDate) {
    const d = raw.maturityDate.replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3');
    instrument.maturityDate = d;
  } else {
    instrument.incomplete = true;
    instrument.issues = (instrument.issues || []).concat(['maturityDate: missing']);
  }
  return instrument;
}

function normalizeAndDedup(instruments) {
  const map = new Map();
  for (const r of instruments) {
    const norm = normalizeInstrument(r);
    const key = `${norm.instrumentId.marketId}|${norm.instrumentId.symbol}`;
    map.set(key, norm); // last wins
  }
  return Array.from(map.values());
}

async function fetchInstruments() {
  if (!brokerSession.isAuthenticated()) {
    logger.warn('sync', 'fetchInstruments', 'not authenticated');
    return [];
  }

  // Use retry policy for network robustness
  return await retryWithBackoff(async () => {
    const list = await brokerClient.fetchInstruments();
    return list;
  }, { retries: 3 });
}

async function saveRecord(record) {
  const meta = await storage.saveRecord(record);
  memoizedRecord = { meta, record };
  return meta;
}

async function shouldRunDailySync() {
  try {
    const now = new Date();

    // If today is not a market business day for BYMA, skip running the daily sync.
    // This prevents unnecessary syncs on weekends/holidays. The next business day
    // will be responsible for running the sync.
    try {
      if (!marketCalendar.isMarketBusinessDay(now, 'BYMA')) {
        logger.info('sync', 'shouldRunDailySync', 'skip - non-business day', { date: now.toISOString() });
        return false;
      }
    } catch (e) {
      // If calendar check fails, fallthrough to regular logic (be conservative)
      logger.warn('sync', 'shouldRunDailySync', 'marketCalendar check failed', { error: e && e.message });
    }

    const existing = await storage.readRecord();
    if (!existing) return true;
    const fetchedAt = new Date(existing.meta.fetchedAt);
    // run if fetchedAt date is older than today
    return fetchedAt.toDateString() !== now.toDateString();
  } catch (e) {
    return true;
  }
}

async function syncNow() {
  logger.info('sync', 'syncNow', 'start');
  try {
    if (!brokerSession.isAuthenticated()) {
      logger.warn('sync', 'syncNow', 'not authenticated - attempting fallback file');
      // Attempt to load static fallback file included in the frontend bundle
      try {
        if (typeof fetch === 'function') {
          const url = (typeof location !== 'undefined') ? new URL('/frontend/InstrumentsWithDetails.json', location.origin).href : '/frontend/InstrumentsWithDetails.json';
          const r = await fetch(url);
          if (r && r.ok) {
            const json = await r.json();
            const instruments = normalizeAndDedup(json.instruments || json);
            const record = { fetchedAt: new Date().toISOString(), source: 'fallback-file', instruments };
            const meta = await saveRecord(record);
            return { ok: true, meta, fallback: true };
          }
        }
      } catch (e) {
        logger.warn('sync', 'syncNow', 'fallback load failed', { error: e && e.message });
      }
      return { ok: false, reason: 'not-authenticated' };
    }
    const raw = await fetchInstruments();
    const instruments = normalizeAndDedup(raw || []);
    const record = { fetchedAt: new Date().toISOString(), source: 'broker-api', instruments };
    const meta = await saveRecord(record);
    logger.info('sync', 'syncNow', 'completed', { parts: meta.parts });
    return { ok: true, meta };
  } catch (e) {
    logger.error('sync', 'syncNow', 'failed', { error: e && e.message });
    return { ok: false, reason: e && e.message };
  }
}

function getMemoized() {
  return memoizedRecord;
}

export default {
  fetchInstruments,
  normalizeAndDedup,
  saveRecord,
  shouldRunDailySync,
  syncNow,
  getMemoized,
};
