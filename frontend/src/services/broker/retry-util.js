// Retry/backoff utility (T015)
// Implements exponential backoff with configurable retry sequence

const DEFAULT_RETRY_SEQUENCE = [2000, 5000, 10000]; // milliseconds

/**
 * Sleep for specified milliseconds.
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff.
 * @param {Function} fn - Async function to retry
 * @param {Object} options - { retrySequence?: number[], shouldRetryFn?: (error) => boolean }
 * @returns {Promise<any>} Result of fn on success
 * @throws {Error} Last error if all retries exhausted
 */
export async function retryWithBackoff(fn, options = {}) {
  const { retrySequence = DEFAULT_RETRY_SEQUENCE, shouldRetryFn = () => true } = options;
  
  let lastError;
  
  // Try once without delay
  try {
    return await fn();
  } catch (error) {
    lastError = error;
    if (!shouldRetryFn(error)) {
      throw error;
    }
  }

  // Retry with backoff
  for (let i = 0; i < retrySequence.length; i++) {
    const delay = retrySequence[i];
    await sleep(delay);
    
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!shouldRetryFn(error)) {
        throw error;
      }
    }
  }

  // All retries exhausted
  throw lastError;
}

/**
 * Get suggested wait time from rate limit error.
 * @param {Error|string} error - Error with rate limit info
 * @returns {number} Suggested wait time in milliseconds (default 60s if not specified)
 */
export function parseRetryAfter(error) {
  if (error && typeof error.retryAfter === 'number' && Number.isFinite(error.retryAfter)) {
    return error.retryAfter * 1000;
  }

  const message = typeof error === 'string' ? error : (error && error.message) || '';

  const directMatch = message.match(/RATE_LIMITED:(\d+)/i);
  if (directMatch) {
    return Number.parseInt(directMatch[1], 10);
  }

  const retryHeaderMatch = message.match(/retry after (\d+)/i);
  if (retryHeaderMatch) {
    return Number.parseInt(retryHeaderMatch[1], 10) * 1000;
  }

  return 60000; // default 60s
}
