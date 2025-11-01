// Simple market calendar helper
// Exports:
// - isMarketBusinessDay(date, marketId)
// - nextMarketBusinessDay(date, marketId)
//
// This implementation uses weekend rules and a small per-market holiday list.
// For production, replace the holiday list with an authoritative source.

const HOLIDAYS_BY_MARKET = {
  // Example market: BYMA (Buenos Aires) - add known holidays as 'YYYY-MM-DD'
  BYMA: [
    // Platzholders - real holidays should be added from an authoritative calendar
    // '2025-01-01',
  ],
};

function toDate(d) {
  if (typeof d === 'string') return new Date(d);
  if (d instanceof Date) return new Date(d.getTime());
  return new Date();
}

function isWeekend(date) {
  const d = toDate(date);
  const day = d.getUTCDay(); // 0 = Sunday, 6 = Saturday
  return day === 0 || day === 6;
}

function formatISODate(date) {
  const d = toDate(date);
  return d.toISOString().slice(0, 10);
}

function isHoliday(date, marketId = 'BYMA') {
  const iso = formatISODate(date);
  const list = HOLIDAYS_BY_MARKET[marketId] || [];
  return list.includes(iso);
}

function isMarketBusinessDay(date, marketId = 'BYMA') {
  try {
    if (isWeekend(date)) return false;
    if (isHoliday(date, marketId)) return false;
    return true;
  } catch (e) {
    // On error, be conservative and treat as business day so syncs are not skipped
    return true;
  }
}

function nextMarketBusinessDay(date, marketId = 'BYMA') {
  const d = toDate(date);
  // move to next day
  d.setUTCDate(d.getUTCDate() + 1);
  // iterate until business day found
  for (let i = 0; i < 14; i++) {
    if (isMarketBusinessDay(d, marketId)) return d;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  // fallback: return date + 1
  return d;
}

export default {
  isMarketBusinessDay,
  nextMarketBusinessDay,
};
