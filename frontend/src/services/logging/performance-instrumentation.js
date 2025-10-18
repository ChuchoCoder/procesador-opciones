// Performance instrumentation harness (Phase 1 Setup T058)
// Provides measureBlock(label, fn) capturing duration and largest synchronous span.

export async function measureAsync(label, fn) {
  const start = performance.now();
  let error;
  let result;
  try {
    result = await fn();
  } catch (e) {
    error = e;
  }
  const end = performance.now();
  const duration = end - start;
  console.info(`PO:PERF ${label} duration=${duration.toFixed(2)}ms`);
  if (error) throw error;
  return { result, duration };
}

export function measureBlock(label, fn) {
  const start = performance.now();
  let error; let result;
  try {
    result = fn();
  } catch (e) { error = e; }
  const end = performance.now();
  const duration = end - start;
  console.info(`PO:PERF ${label} duration=${duration.toFixed(2)}ms`);
  if (error) throw error;
  return { result, duration };
}
