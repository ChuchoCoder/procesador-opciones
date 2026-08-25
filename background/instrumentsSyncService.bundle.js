// frontend/src/services/logging.js
var PREFIX = "PO:instruments-sync";
function info(phase, step, message, meta) {
  try {
    console.info(`${PREFIX} [INFO] ${phase}:${step} - ${message}`, meta || {});
  } catch (e) {
  }
}
function warn(phase, step, message, meta) {
  try {
    console.warn(`${PREFIX} [WARN] ${phase}:${step} - ${message}`, meta || {});
  } catch (e) {
  }
}
function error(phase, step, message, meta) {
  try {
    console.error(`${PREFIX} [ERROR] ${phase}:${step} - ${message}`, meta || {});
  } catch (e) {
  }
}
var logging_default = {
  info,
  warn,
  error
};

// frontend/src/services/broker/client.js
async function fetchInstruments() {
  try {
    const base = localStorage.getItem("broker.apiUrl") || null;
    if (!base) {
      logging_default.warn("brokerClient", "fetchInstruments", "No broker.apiUrl configured \u2014 returning empty list");
      return [];
    }
    const url = `${base.replace(/\/$/, "")}/rest/instruments/details`;
    const resp = await fetch(url, { credentials: "include" });
    if (!resp.ok) {
      logging_default.warn("brokerClient", "fetchInstruments", "fetch failed", { status: resp.status });
      return [];
    }
    const json = await resp.json();
    return json || [];
  } catch (e) {
    logging_default.error("brokerClient", "fetchInstruments", "exception", { error: e && e.message });
    return [];
  }
}
var client_default = {
  fetchInstruments
};

// frontend/src/services/instrumentsSyncStorage.js
var META_KEY = "instrumentsWithDetails.meta";
var PART_KEY_PREFIX = "instrumentsWithDetails.part.";
var DEFAULT_PART_SIZE = 256 * 1024;
async function sha1Hex(input) {
  if (typeof crypto !== "undefined" && crypto.subtle && crypto.subtle.digest) {
    const enc = new TextEncoder();
    const buf = await crypto.subtle.digest("SHA-1", enc.encode(input));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  let h = 0;
  for (let i = 0; i < input.length; i++) h = Math.imul(31, h) + input.charCodeAt(i) | 0;
  return (h >>> 0).toString(16);
}
function splitIntoParts(str, partSize = DEFAULT_PART_SIZE) {
  const parts = [];
  for (let i = 0; i < str.length; i += partSize) parts.push(str.slice(i, i + partSize));
  return parts;
}
async function saveRecord(record) {
  try {
    const canonical = JSON.stringify(record);
    const versionHash = await sha1Hex(canonical);
    const meta = { fetchedAt: record.fetchedAt, source: record.source || "broker-api", versionHash, parts: 0 };
    const parts = splitIntoParts(canonical);
    meta.parts = parts.length;
    const toSet = {};
    toSet[META_KEY] = meta;
    parts.forEach((p, idx) => {
      toSet[`${PART_KEY_PREFIX}${idx}`] = p;
    });
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local && chrome.storage.local.set) {
      chrome.storage.local.set(toSet, () => {
        if (chrome.runtime.lastError) {
          logging_default.warn("storage", "saveRecord", "chrome.storage.local.set failed", chrome.runtime.lastError);
        } else {
          logging_default.info("storage", "saveRecord", "saved to chrome.storage.local", { parts: meta.parts });
        }
      });
    }
    try {
      localStorage.setItem(META_KEY, JSON.stringify(meta));
      parts.forEach((p, idx) => localStorage.setItem(`${PART_KEY_PREFIX}${idx}`, p));
      logging_default.info("storage", "saveRecord", "saved compatibility localStorage", { parts: meta.parts });
    } catch (e) {
      logging_default.warn("storage", "saveRecord", "localStorage write failed", { error: e && e.message });
    }
    return meta;
  } catch (e) {
    logging_default.error("storage", "saveRecord", "failed to save record", { error: e && e.message });
    throw e;
  }
}
async function readRecord() {
  try {
    let metaRaw = null;
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local && chrome.storage.local.get) {
      metaRaw = await new Promise((res) => chrome.storage.local.get([META_KEY], (items) => res(items[META_KEY] || null)));
    } else if (typeof localStorage !== "undefined") {
      const v = localStorage.getItem(META_KEY);
      if (v) metaRaw = JSON.parse(v);
    }
    if (!metaRaw) return null;
    const parts = [];
    for (let i = 0; i < (metaRaw.parts || 0); i++) {
      let part = null;
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local && chrome.storage.local.get) {
        part = localStorage.getItem(`${PART_KEY_PREFIX}${i}`);
      } else if (typeof localStorage !== "undefined") {
        part = localStorage.getItem(`${PART_KEY_PREFIX}${i}`);
      }
      if (part == null) {
        logging_default.warn("storage", "readRecord", "missing part", { idx: i });
        return null;
      }
      parts.push(part);
    }
    const combined = parts.join("");
    const parsed = JSON.parse(combined);
    return { meta: metaRaw, record: parsed };
  } catch (e) {
    logging_default.error("storage", "readRecord", "failed to read record", { error: e && e.message });
    return null;
  }
}
var instrumentsSyncStorage_default = {
  saveRecord,
  readRecord
};

// frontend/src/services/brokerSession.js
function isAuthenticated() {
  try {
    if (typeof window !== "undefined" && window.__BROKER_SESSION && typeof window.__BROKER_SESSION.isAuthenticated === "function") {
      return !!window.__BROKER_SESSION.isAuthenticated();
    }
    const v = localStorage.getItem("broker.isAuthenticated");
    return v === "true";
  } catch (e) {
    logging_default.warn("brokerSession", "isAuthenticated", "check failed", { error: e && e.message });
    return false;
  }
}
async function tryRefresh() {
  logging_default.info("brokerSession", "tryRefresh", "shim called - no refresh available");
  return false;
}
var brokerSession_default = {
  isAuthenticated,
  tryRefresh
};

// frontend/src/services/retryWithBackoff.js
function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}
async function retryWithBackoff(fn, { retries = 3, baseDelay = 2e3, maxWindowMs = 5 * 60 * 1e3 } = {}) {
  let attempt = 0;
  const start = Date.now();
  while (attempt <= retries) {
    try {
      return await fn();
    } catch (e) {
      attempt++;
      const now = Date.now();
      if (now - start > maxWindowMs || attempt > retries) {
        logging_default.error("retry", "retryWithBackoff", "max retries exceeded", { attempt, error: e && e.message });
        throw e;
      }
      const delay = baseDelay * Math.pow(2, attempt - 1);
      const jitter = delay * 0.25 * (Math.random() * 2 - 1);
      const wait = Math.max(0, Math.round(delay + jitter));
      logging_default.info("retry", "retryWithBackoff", "retrying", { attempt, wait });
      await sleep(wait);
    }
  }
}
var retryWithBackoff_default = retryWithBackoff;

// frontend/src/services/marketCalendar.js
var HOLIDAYS_BY_MARKET = {
  // Example market: BYMA (Buenos Aires) - add known holidays as 'YYYY-MM-DD'
  BYMA: [
    // Platzholders - real holidays should be added from an authoritative calendar
    // '2025-01-01',
  ]
};
function toDate(d) {
  if (typeof d === "string") return new Date(d);
  if (d instanceof Date) return new Date(d.getTime());
  return /* @__PURE__ */ new Date();
}
function isWeekend(date) {
  const d = toDate(date);
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}
function formatISODate(date) {
  const d = toDate(date);
  return d.toISOString().slice(0, 10);
}
function isHoliday(date, marketId = "BYMA") {
  const iso = formatISODate(date);
  const list = HOLIDAYS_BY_MARKET[marketId] || [];
  return list.includes(iso);
}
function isMarketBusinessDay(date, marketId = "BYMA") {
  try {
    if (isWeekend(date)) return false;
    if (isHoliday(date, marketId)) return false;
    return true;
  } catch (e) {
    return true;
  }
}
function nextMarketBusinessDay(date, marketId = "BYMA") {
  const d = toDate(date);
  d.setUTCDate(d.getUTCDate() + 1);
  for (let i = 0; i < 14; i++) {
    if (isMarketBusinessDay(d, marketId)) return d;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return d;
}
var marketCalendar_default = {
  isMarketBusinessDay,
  nextMarketBusinessDay
};

// frontend/src/services/instrumentsSyncService.js
var memoizedRecord = null;
function normalizeInstrument(raw) {
  const issues = [];
  const instrument = {
    instrumentId: { marketId: raw.marketId || "", symbol: raw.symbol || "" },
    securityDescription: raw.securityDescription || "",
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
    roundLot: raw.roundLot != null ? Number(raw.roundLot) : null
  };
  if (raw.maturityDate) {
    const d = raw.maturityDate.replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3");
    instrument.maturityDate = d;
  } else {
    instrument.incomplete = true;
    instrument.issues = (instrument.issues || []).concat(["maturityDate: missing"]);
  }
  return instrument;
}
function normalizeAndDedup(instruments) {
  const map = /* @__PURE__ */ new Map();
  for (const r of instruments) {
    const norm = normalizeInstrument(r);
    const key = `${norm.instrumentId.marketId}|${norm.instrumentId.symbol}`;
    map.set(key, norm);
  }
  return Array.from(map.values());
}
async function fetchInstruments2() {
  if (!brokerSession_default.isAuthenticated()) {
    logging_default.warn("sync", "fetchInstruments", "not authenticated");
    return [];
  }
  return await retryWithBackoff_default(async () => {
    const list = await client_default.fetchInstruments();
    return list;
  }, { retries: 3 });
}
async function saveRecord2(record) {
  const meta = await instrumentsSyncStorage_default.saveRecord(record);
  memoizedRecord = { meta, record };
  return meta;
}
async function shouldRunDailySync() {
  try {
    const now = /* @__PURE__ */ new Date();
    try {
      if (!marketCalendar_default.isMarketBusinessDay(now, "BYMA")) {
        logging_default.info("sync", "shouldRunDailySync", "skip - non-business day", { date: now.toISOString() });
        return false;
      }
    } catch (e) {
      logging_default.warn("sync", "shouldRunDailySync", "marketCalendar check failed", { error: e && e.message });
    }
    const existing = await instrumentsSyncStorage_default.readRecord();
    if (!existing) return true;
    const fetchedAt = new Date(existing.meta.fetchedAt);
    return fetchedAt.toDateString() !== now.toDateString();
  } catch (e) {
    return true;
  }
}
async function syncNow() {
  logging_default.info("sync", "syncNow", "start");
  try {
    if (!brokerSession_default.isAuthenticated()) {
      logging_default.warn("sync", "syncNow", "not authenticated - attempting fallback file");
      try {
        if (typeof fetch === "function") {
          const url = typeof location !== "undefined" ? new URL("/frontend/InstrumentsWithDetails.json", location.origin).href : "/frontend/InstrumentsWithDetails.json";
          const r = await fetch(url);
          if (r && r.ok) {
            const json = await r.json();
            const instruments2 = normalizeAndDedup(json.instruments || json);
            const record2 = { fetchedAt: (/* @__PURE__ */ new Date()).toISOString(), source: "fallback-file", instruments: instruments2 };
            const meta2 = await saveRecord2(record2);
            return { ok: true, meta: meta2, fallback: true };
          }
        }
      } catch (e) {
        logging_default.warn("sync", "syncNow", "fallback load failed", { error: e && e.message });
      }
      return { ok: false, reason: "not-authenticated" };
    }
    const raw = await fetchInstruments2();
    const instruments = normalizeAndDedup(raw || []);
    const record = { fetchedAt: (/* @__PURE__ */ new Date()).toISOString(), source: "broker-api", instruments };
    const meta = await saveRecord2(record);
    logging_default.info("sync", "syncNow", "completed", { parts: meta.parts });
    return { ok: true, meta };
  } catch (e) {
    logging_default.error("sync", "syncNow", "failed", { error: e && e.message });
    return { ok: false, reason: e && e.message };
  }
}
function getMemoized() {
  return memoizedRecord;
}
var instrumentsSyncService_default = {
  fetchInstruments: fetchInstruments2,
  normalizeAndDedup,
  saveRecord: saveRecord2,
  shouldRunDailySync,
  syncNow,
  getMemoized
};
export {
  instrumentsSyncService_default as default
};
