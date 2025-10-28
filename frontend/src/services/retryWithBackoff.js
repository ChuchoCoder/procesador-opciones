// Simple retry with exponential backoff and jitter
import logger from './logging.js';

function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

async function retryWithBackoff(fn, { retries = 3, baseDelay = 2000, maxWindowMs = 5 * 60 * 1000 } = {}) {
  let attempt = 0;
  const start = Date.now();
  while (attempt <= retries) {
    try {
      return await fn();
    } catch (e) {
      attempt++;
      const now = Date.now();
      if (now - start > maxWindowMs || attempt > retries) {
        logger.error('retry', 'retryWithBackoff', 'max retries exceeded', { attempt, error: e && e.message });
        throw e;
      }
      const delay = baseDelay * Math.pow(2, attempt - 1);
      // jitter ±25%
      const jitter = delay * 0.25 * (Math.random() * 2 - 1);
      const wait = Math.max(0, Math.round(delay + jitter));
      logger.info('retry', 'retryWithBackoff', 'retrying', { attempt, wait });
      await sleep(wait);
    }
  }
}

export default retryWithBackoff;
