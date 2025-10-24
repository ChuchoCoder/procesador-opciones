// sync-service.js - Broker operations sync orchestration (T020)
import { listOperations, setBaseUrl } from './jsrofex-client.js';
import { ensureValidToken } from './token-manager.js';
import { mergeBrokerBatch, normalizeOperation, dedupeOperations } from './dedupe-utils.js';
import { classifyError, shouldRetry, ERROR_CATEGORIES } from './error-taxonomy.js';
import { retryWithBackoff, parseRetryAfter } from './retry-util.js';

const DAILY_MODE = 'daily';
const REFRESH_MODE = 'refresh';

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);

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
 * Start daily sync: retrieve all operations for trading day, stage per page, commit atomically.
 * 
 * @param {Object} config - Sync configuration
 * @param {Object} config.brokerAuth - Current broker auth from context { token, expiry, accountId, displayName }
 * @param {Array} config.existingOperations - Current operations in state (for deduplication)
 * @param {Function} config.setBrokerAuth - Dispatcher for SET_BROKER_AUTH (token refresh)
 * @param {Function} config.startSync - Dispatcher for START_SYNC (initialize session)
 * @param {Function} config.stagePage - Dispatcher for STAGE_PAGE (accumulate page)
 * @param {Function} config.commitSync - Dispatcher for COMMIT_SYNC (atomic commit)
 * @param {Function} config.failSync - Dispatcher for FAIL_SYNC (error state)
 * @param {Function} config.cancelSync - Dispatcher for CANCEL_SYNC (user cancellation)
 * @param {string} config.tradingDay - Trading day to retrieve (e.g., 'today', 'YYYY-MM-DD')
 * @param {Function} config.onProgress - Optional progress callback: ({ pageIndex, operationsCount, pagesFetched }) => void
 * @param {Object} config.cancellationToken - Optional cancellation token: { isCanceled: boolean }
 * @param {number|null} config.minTimestamp - Optional minimum trade timestamp; operations <= value are ignored
 * @param {string} config.mode - Sync mode identifier ('daily' or 'refresh')
 * @param {string} config.brokerApiUrl - Optional broker API base URL to use for this sync
 * @returns {Promise<Object>} Result: { success: boolean, operationsAdded: number, error?: string, needsReauth?: boolean, rateLimited?: boolean }
 */
export async function startDailySync({
  brokerAuth,
  existingOperations,
  operations: currentOperations = [],
  setBrokerAuth,
  startSync,
  stagePage,
  commitSync,
  failSync,
  cancelSync,
  tradingDay = 'today',
  onProgress = null,
  cancellationToken = null,
  minTimestamp = null,
  mode = DAILY_MODE,
  brokerApiUrl,
}) {
  // Set base URL if provided
  if (brokerApiUrl) {
    setBaseUrl(brokerApiUrl);
  }
  const sessionId = `sync-${Date.now()}`;
  const baselineOperations = Array.isArray(existingOperations)
    ? existingOperations
    : Array.isArray(currentOperations)
      ? currentOperations
      : [];
  const dedupePool = [...baselineOperations];
  const candidateOperations = [];
  
  // DEBUG: Log baseline for deduplication
  // eslint-disable-next-line no-console
  console.log(`[Sync ${mode}] Starting with ${baselineOperations.length} baseline operations`);
  
  let pageToken = null;
  let pageIndex = 0;
  let totalRetries = 0;
  let lastEstimatedTotal = null;
  let totalEvaluated = 0;

  try {
    // Step 1: Validate token (auto-refresh if within 60s of expiry)
    const token = await ensureValidToken(brokerAuth, setBrokerAuth);
    
    // Step 2: Initialize sync session
    startSync(sessionId, { mode });

    // Step 3: Fetch operations with pagination
    
    do {
      // Check cancellation before each page
      if (cancellationToken?.isCanceled) {
        cancelSync({ mode });
        return { success: false, canceled: true, operationsAdded: 0, mode };
      }
      
      // Fetch page with retry on transient errors
      const pageResult = await fetchPageWithRetry({ token, tradingDay, pageToken });
      totalRetries += pageResult.retryAttempts || 0;

      if (!pageResult.success) {
        // Handle specific error types
        if (pageResult.category === ERROR_CATEGORIES.AUTH) {
          failSync({ error: 'TOKEN_EXPIRED', retryAttempts: totalRetries, mode });
          return { success: false, error: 'TOKEN_EXPIRED', needsReauth: true, mode };
        }

        if (pageResult.category === ERROR_CATEGORIES.RATE_LIMIT) {
          const waitMs = parseRetryAfter(pageResult.error);
          const errorMessage = `RATE_LIMITED:${waitMs}`;
          failSync({ error: errorMessage, retryAttempts: totalRetries, rateLimitMs: waitMs, mode });
          return {
            success: false,
            error: 'RATE_LIMITED',
            rateLimited: true,
            rateLimitMs: waitMs,
            mode,
          };
        }

        const message = pageResult.error?.message || 'SYNC_PAGE_ERROR';
        failSync({ error: message, retryAttempts: totalRetries, mode });
        return { success: false, error: message, mode };
      }

      // Normalize operations with source attribution
      const rawOperations = pageResult.data.operations || [];
      
      // DEBUG: Check first raw operation from broker
      if (pageIndex === 0 && rawOperations.length > 0) {
        // eslint-disable-next-line no-console
        console.log(`[Sync ${mode}] First RAW operation from broker:`, rawOperations[0]);
        // eslint-disable-next-line no-console
        console.log(`[Sync ${mode}] Raw operation keys:`, Object.keys(rawOperations[0]));
      }
      
      const normalized = rawOperations.map((op) => normalizeOperation(op, 'broker'));
      
      // DEBUG: Check first operation's deduplication keys
      if (pageIndex === 0 && normalized.length > 0) {
        const firstOp = normalized[0];
        // eslint-disable-next-line no-console
        console.log(`[Sync ${mode}] First NORMALIZED operation keys:`, {
          order_id: firstOp.order_id,
          operation_id: firstOp.operation_id,
          symbol: firstOp.symbol,
          tradeTimestamp: firstOp.tradeTimestamp,
          price: firstOp.price,
          quantity: firstOp.quantity,
        });
      }
      
      const timestampFiltered = isNumber(minTimestamp)
        ? normalized.filter((op) => op.tradeTimestamp > minTimestamp)
        : normalized;
      totalEvaluated += timestampFiltered.length;

      let acceptedForPage = [];
      if (timestampFiltered.length > 0) {
        acceptedForPage = dedupeOperations(dedupePool, timestampFiltered);
        // eslint-disable-next-line no-console
        console.log(`[Sync ${mode}] Page ${pageIndex}: ${timestampFiltered.length} operations fetched, ${acceptedForPage.length} accepted after dedup`);
        if (acceptedForPage.length > 0) {
          candidateOperations.push(...acceptedForPage);
          dedupePool.push(...acceptedForPage);
        }
      }

      stagePage(acceptedForPage, pageIndex, {
        estimatedTotal: pageResult.data.estimatedTotal ?? lastEstimatedTotal,
      });

      // Emit progress
      if (onProgress) {
        onProgress({
          pageIndex,
          operationsCount: candidateOperations.length,
          pagesFetched: pageIndex + 1,
          estimatedTotal: pageResult.data.estimatedTotal ?? lastEstimatedTotal,
          retrievedCount: timestampFiltered.length,
        });
      }

      lastEstimatedTotal = pageResult.data.estimatedTotal ?? lastEstimatedTotal;

      // Advance to next page
      pageToken = pageResult.data.nextPageToken || null;
      pageIndex += 1;
      
    } while (pageToken);
    
    // Check cancellation before commit
    if (cancellationToken?.isCanceled) {
      cancelSync({ mode });
      return { success: false, canceled: true, operationsAdded: 0, mode };
    }
    
    // Step 4: Deduplicate and merge with existing operations
    const { mergedOps, newOrdersCount, newOpsCount } = mergeBrokerBatch(
      baselineOperations,
      candidateOperations,
    );
    
    // eslint-disable-next-line no-console
    console.log(`[Sync ${mode}] Final merge: ${baselineOperations.length} baseline + ${candidateOperations.length} candidates = ${mergedOps.length} total (${newOpsCount} new)`);

    // Step 5: Atomic commit
    commitSync(mergedOps, {
      sessionId,
      newOperationsCount: newOpsCount,
      newOrdersCount,
      totalOperations: mergedOps.length,
      pagesFetched: pageIndex,
      mode,
      estimatedTotal: lastEstimatedTotal,
      evaluatedCount: totalEvaluated,
      retryAttempts: totalRetries,
    });
    
    return {
      success: true,
      operationsAdded: newOpsCount,
      newOrdersCount,
      totalOperations: mergedOps.length,
      pagesFetched: pageIndex,
      evaluatedCount: totalEvaluated,
      mode,
    };
    
  } catch (error) {
    // Catch-all for unexpected errors
    const errorMessage = error.message || 'Error de sincronización desconocido';
    failSync({ error: errorMessage, mode });
    // eslint-disable-next-line no-console
    console.warn('startDailySync failure', errorMessage);
    
    return {
      success: false,
      error: errorMessage,
      needsReauth: errorMessage.includes('TOKEN_EXPIRED') || errorMessage.includes('NOT_AUTHENTICATED'),
      mode,
    };
  }
}

/**
 * Refresh operations: fetch only operations newer than last sync timestamp.
 * Used for manual refresh button (US3).
 * 
 * @param {Object} config - Same as startDailySync but includes lastSyncTimestamp
 * @param {number|null} config.lastSyncTimestamp - Timestamp of last successful sync (epoch ms)
 * @returns {Promise<Object>} Result: { success: boolean, operationsAdded: number, hasNewOperations: boolean }
 */
export async function refreshNewOperations(params = {}) {
  const {
    sync,
    operations = [],
    cancellationToken = null,
    lastSyncTimestamp,
    ...rest
  } = params;

  const inferredLastSync = isNumber(lastSyncTimestamp)
    ? lastSyncTimestamp
    : isNumber(sync?.lastSyncTimestamp)
      ? sync.lastSyncTimestamp
      : null;

  const result = await startDailySync({
    ...rest,
    cancellationToken,
    existingOperations: operations,
    minTimestamp: inferredLastSync,
    mode: REFRESH_MODE,
  });

  return {
    ...result,
    hasNewOperations: (result.operationsAdded ?? 0) > 0,
    mode: REFRESH_MODE,
  };
}
