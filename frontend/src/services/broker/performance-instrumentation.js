// Performance instrumentation for broker sync operations
// Records timing and main-thread blocking estimates.
// Usage: const perf = createSyncPerfTracker(); perf.mark('start'); ... perf.pageProcessed(pageOps.length); ... perf.mark('commit');
// Retrieve metrics via perf.getMetrics().

export function createSyncPerfTracker() {
  const marks = new Map();
  const pages = [];
  let operationsImported = 0;
  let largestBlockMs = 0;
  function now() { return performance.now(); }
  function mark(label) { marks.set(label, now()); }
  function pageProcessed(count, blockDurationEstimateMs) {
    operationsImported += count;
    pages.push({ count, t: now() });
    if (blockDurationEstimateMs && blockDurationEstimateMs > largestBlockMs) {
      largestBlockMs = blockDurationEstimateMs;
    }
  }
  function getMetrics() {
    const start = marks.get('start');
    const end = marks.get('end') ?? now();
    return {
      durationMs: start != null ? end - start : 0,
      pagesProcessed: pages.length,
      operationsImported,
      largestBlockMs,
      averagePageIntervalMs:
        pages.length > 1 ? (pages[pages.length - 1].t - pages[0].t) / (pages.length - 1) : 0,
    };
  }
  return { mark, pageProcessed, getMetrics };
}

export function withTiming(label, fn) {
  const t0 = performance.now();
  const result = fn();
  const t1 = performance.now();
  return { result, durationMs: t1 - t0, label };
}
