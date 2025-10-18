// Error taxonomy for broker API responses (T014)
// Maps error types to categories for retry/handling logic

export const ERROR_CATEGORIES = {
  AUTH: 'AUTH',
  RATE_LIMIT: 'RATE_LIMIT',
  TRANSIENT: 'TRANSIENT',
  PERMANENT: 'PERMANENT',
};

/**
 * Classify error message or HTTP status into category.
 * @param {Error|string} error - Error object or message
 * @param {number} [statusCode] - HTTP status code if available
 * @returns {string} Error category from ERROR_CATEGORIES
 */
export function classifyError(error, statusCode) {
  const message = typeof error === 'string' ? error : error.message || '';

  // Check status code first
  if (statusCode) {
    if (statusCode === 401 || statusCode === 403) {
      return ERROR_CATEGORIES.AUTH;
    }
    if (statusCode === 429) {
      return ERROR_CATEGORIES.RATE_LIMIT;
    }
    if (statusCode >= 500) {
      return ERROR_CATEGORIES.TRANSIENT;
    }
    if (statusCode >= 400 && statusCode < 500) {
      return ERROR_CATEGORIES.PERMANENT;
    }
  }

  // Check message patterns
  if (/AUTH_FAILED|AUTH_REQUIRED|TOKEN_EXPIRED/i.test(message)) {
    return ERROR_CATEGORIES.AUTH;
  }
  if (/RATE_LIMITED/i.test(message)) {
    return ERROR_CATEGORIES.RATE_LIMIT;
  }
  if (/timeout|network|ECONNREFUSED|SERVER_ERROR/i.test(message)) {
    return ERROR_CATEGORIES.TRANSIENT;
  }

  // Default to permanent for unknown errors
  return ERROR_CATEGORIES.PERMANENT;
}

/**
 * Check if error should be retried based on category.
 * @param {string} category - Error category
 * @returns {boolean} True if should retry
 */
export function shouldRetry(category) {
  return category === ERROR_CATEGORIES.TRANSIENT || category === ERROR_CATEGORIES.RATE_LIMIT;
}
