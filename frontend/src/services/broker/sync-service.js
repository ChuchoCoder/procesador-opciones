import { listOperations, setBaseUrl } from './jsrofex-client.js';
import { ensureValidToken } from './token-manager.js';
import { importBrokerOperations } from './broker-import-pipeline.js';
import { classifyError, shouldRetry, ERROR_CATEGORIES } from './error-taxonomy.js';
import { retryWithBackoff, parseRetryAfter } from './retry-util.js';
import { createDevLogger } from '../logging/dev-logger.js';

const logger = createDevLogger('SyncService');

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);

const normalizeTimestampValue = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const isoCandidate = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T');
    const parsed = Date.parse(isoCandidate);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return null;
};

async function fetchPageWithRetry({ token, tradingDay, pageToken }) {
  let attempts = 0;

  try {
    const data = await retryWithBackoff(
      async () => {
        attempts += 1;
        const params = {
          token,
        };
        if (pageToken) {
          params.pageToken = pageToken;
        }
        if (tradingDay && tradingDay !== 'today') {
          params.date = tradingDay;
        }
        return await listOperations(params);
      },
      {
        shouldRetryFn: (error) => shouldRetry(classifyError(error)),
      },
    );

    return {
      success: true,
      data,
      retryAttempts: Math.max(attempts - 1, 0),
    };
  } catch (error) {
    return {
      success: false,
      error,
      category: classifyError(error),
      retryAttempts: Math.max(attempts - 1, 0),
    };
  }
}

/**
 * Sync broker operations: retrieve all operations for trading day and process through unified pipeline.
 * Always replaces previous broker operations - does not merge or deduplicate with existing data.
 * 
 * @param {Object} config - Sync configuration
 * @param {Object} config.brokerAuth - Current broker auth from context { token, expiry, accountId, displayName }
 * @param {Function} config.setBrokerAuth - Dispatcher for SET_BROKER_AUTH (token refresh)
 * @param {Function} config.startSync - Dispatcher for START_SYNC (initialize session)
 * @param {Function} config.stagePage - Dispatcher for STAGE_PAGE (accumulate page)
 * @param {Function} config.commitSync - Dispatcher for COMMIT_SYNC (atomic commit)
 * @param {Function} config.failSync - Dispatcher for FAIL_SYNC (error state)
 * @param {Function} config.cancelSync - Dispatcher for CANCEL_SYNC (user cancellation)
 * @param {string} [config.tradingDay='today'] - Trading day to retrieve (e.g., 'today', 'YYYY-MM-DD')
 * @param {Function} [config.onProgress=null] - Optional progress callback: ({ pageIndex, operationsCount, pagesFetched }) => void
 * @param {Object} [config.cancellationToken=null] - Optional cancellation token: { isCanceled: boolean }
 * @param {string} [config.brokerApiUrl] - Optional broker API base URL to use for this sync
 * @param {Object} config.configuration - Active configuration (fee settings, symbol mappings) for unified pipeline
 * @returns {Promise<Object>} Result: { success: boolean, operationsAdded: number, error?: string, needsReauth?: boolean, rateLimited?: boolean }
 */
export async function startDailySync({
  brokerAuth,
  setBrokerAuth,
  startSync,
  stagePage,
  commitSync,
  failSync,
  cancelSync,
  tradingDay = 'today',
  onProgress = null,
  cancellationToken = null,
  brokerApiUrl,
  configuration,
}) {
  // Set base URL if provided
  if (brokerApiUrl) {
    setBaseUrl(brokerApiUrl);
  }
  const sessionId = `sync-${Date.now()}`;
  
  // IMPORTANT: Always start fresh - no merging with existing operations
  // Every broker sync replaces all previous broker operations
  const baselineOperations = [];
  
  const allRawOperations = []; // Collect all raw operations for unified pipeline
  let pageToken = null;
  let pageIndex = 0;
  let totalRetries = 0;
  let lastEstimatedTotal = null;

  try {
    // Step 1: Validate token (auto-refresh if within 60s of expiry)
    const token = await ensureValidToken(brokerAuth, setBrokerAuth);
    
    // Step 2: Initialize sync session
    startSync(sessionId);

    // Step 3: Fetch operations with pagination
    
    do {
      // Check cancellation before each page
      if (cancellationToken?.isCanceled) {
        cancelSync();
        return { success: false, canceled: true, operationsAdded: 0 };
      }
      
      // Fetch page with retry on transient errors
      const pageResult = await fetchPageWithRetry({ token, tradingDay, pageToken });
      totalRetries += pageResult.retryAttempts || 0;

      if (!pageResult.success) {
        // Handle specific error types
        if (pageResult.category === ERROR_CATEGORIES.AUTH) {
          failSync({ error: 'TOKEN_EXPIRED', retryAttempts: totalRetries });
          return { success: false, error: 'TOKEN_EXPIRED', needsReauth: true };
        }

        if (pageResult.category === ERROR_CATEGORIES.RATE_LIMIT) {
          const waitMs = parseRetryAfter(pageResult.error);
          const errorMessage = `RATE_LIMITED:${waitMs}`;
          failSync({ error: errorMessage, retryAttempts: totalRetries, rateLimitMs: waitMs });
          return {
            success: false,
            error: 'RATE_LIMITED',
            rateLimited: true,
            rateLimitMs: waitMs,
          };
        }

        const message = pageResult.error?.message || 'SYNC_PAGE_ERROR';
        failSync({ error: message, retryAttempts: totalRetries });
        return { success: false, error: message };
      }

      // Collect raw operations for unified pipeline - NO FILTERING
      const rawOperations = pageResult.data.operations || [];
      allRawOperations.push(...rawOperations);

      // Stage page for UI feedback (show count of operations collected so far)
      stagePage([], pageIndex, {
        estimatedTotal: pageResult.data.estimatedTotal ?? lastEstimatedTotal,
      });

      // Emit progress
      if (onProgress) {
        onProgress({
          pageIndex,
          operationsCount: allRawOperations.length,
          pagesFetched: pageIndex + 1,
          estimatedTotal: pageResult.data.estimatedTotal ?? lastEstimatedTotal,
          retrievedCount: rawOperations.length,
        });
      }

      lastEstimatedTotal = pageResult.data.estimatedTotal ?? lastEstimatedTotal;

      // Advance to next page
      pageToken = pageResult.data.nextPageToken || null;
      pageIndex += 1;
      
    } while (pageToken);
    
    // Check cancellation before processing
    if (cancellationToken?.isCanceled) {
        cancelSync();
      return { success: false, canceled: true, operationsAdded: 0 };
    }

    // Step 4: Process through unified pipeline
    if (!configuration) {
      const errorMessage = 'Configuration required for broker import processing';
      failSync({ error: errorMessage });
      return { success: false, error: errorMessage };
    }

    const importResult = await importBrokerOperations({
      operationsJson: allRawOperations,
      configuration,
      existingOperations: baselineOperations
    });

    // Step 5: Extract results for state management
    // Use mergedOperations which should equal allRawOperations since baselineOperations is empty
    const mergedOperations = importResult.brokerImport.mergedOperations;
    const operationsAdded = importResult.brokerImport.newOperationsCount;
    const newOrdersCount = importResult.brokerImport.newOrdersCount;

    // Step 6: Atomic commit - replaces all previous broker operations
    commitSync(mergedOperations, {
      sessionId,
      newOperationsCount: operationsAdded,
      newOrdersCount,
      totalOperations: mergedOperations.length,
      pagesFetched: pageIndex,
      estimatedTotal: lastEstimatedTotal,
      retryAttempts: totalRetries,
    });
    
    return {
      success: true,
      operationsAdded,
      newOrdersCount,
      totalOperations: mergedOperations.length,
      pagesFetched: pageIndex,
    };
    
  } catch (error) {
    // Catch-all for unexpected errors
    const errorMessage = error.message || 'Error de sincronización desconocido';
    failSync({ error: errorMessage });
    // eslint-disable-next-line no-console
    console.warn('startDailySync failure', errorMessage);
    
    return {
      success: false,
      error: errorMessage,
      needsReauth: errorMessage.includes('TOKEN_EXPIRED') || errorMessage.includes('NOT_AUTHENTICATED'),
    };
  }
}

// Alias for backward compatibility - both do the same thing now (always replace operations)
export const refreshNewOperations = startDailySync;
