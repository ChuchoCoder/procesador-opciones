// sync-service.js - Broker operations sync orchestration (T020)
import { listOperations, setBaseUrl } from './jsrofex-client.js';
import { ensureValidToken } from './token-manager.js';
import { mergeBrokerBatch, normalizeOperation, dedupeOperations } from './dedupe-utils.js';
import { classifyError, shouldRetry, ERROR_CATEGORIES } from './error-taxonomy.js';
import { retryWithBackoff, parseRetryAfter } from './retry-util.js';

export const DAILY_MODE = 'daily';

/**
 * La línea de base de operaciones con la que arranca una sincronización.
 *
 * La regla difiere según el modo, y es una decisión de dominio, no un detalle
 * de la función de sync:
 *
 * - **daily**: se descartan **todas** las operaciones del broker y se conservan
 *   sólo las de CSV. Cada jornada arranca de cero por el lado del broker.
 * - **refresh**: se conserva todo, porque el dedupe incremental necesita las
 *   operaciones previas para reconocer lo que ya estaba.
 *
 * Estaba inline dentro de `startDailySync`, y el spec que la cubría
 * (`broker-sync-daily-mode`) no importaba nada de `src/`: re-escribía el filtro
 * dentro del test y asserteaba sobre su propia copia. Esa copia afirmaba que en
 * modo daily se conservaban las operaciones del broker de hoy, es decir lo
 * contrario de lo que hace producción, y estaba en verde.
 *
 * @param {Array<object>} operaciones
 * @param {'daily'|'refresh'} modo
 * @returns {Array<object>}
 */
export const filtrarLineaDeBase = (operaciones = [], modo = DAILY_MODE) => {
  const lista = Array.isArray(operaciones) ? operaciones : [];

  if (modo === DAILY_MODE) {
    return lista.filter((op) => op?.source === 'csv');
  }

  return lista;
};
const REFRESH_MODE = 'refresh';

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
  mode = DAILY_MODE,
  brokerApiUrl,
}) {
  // Set base URL if provided
  if (brokerApiUrl) {
    setBaseUrl(brokerApiUrl);
  }
  const sessionId = `sync-${Date.now()}`;
  
  // For daily sync, filter baseline to exclude broker operations from previous days
  // For refresh mode, keep all operations (additive)
  let baselineOperations = Array.isArray(existingOperations)
    ? existingOperations
    : Array.isArray(currentOperations)
      ? currentOperations
      : [];
  
  // For both daily and refresh modes, filter out broker operations from previous days
  // This ensures "Today only" requirement is always enforced
  // Calculate start of today in local time (00:00:00)
  // Count operations before filtering
  const beforeCount = baselineOperations.length;
  const brokerBeforeCount = baselineOperations.filter(op => op.source === 'broker').length;
  const csvBeforeCount = baselineOperations.filter(op => op.source === 'csv').length;
  
  // Filtering strategy depends on sync mode:
  // - DAILY: Discard ALL broker ops (fresh start daily)
  // - REFRESH: Keep existing broker ops for deduplication (incremental)
  if (mode === DAILY_MODE) {
    baselineOperations = filtrarLineaDeBase(baselineOperations, DAILY_MODE);
    
    const afterCount = baselineOperations.length;
    const csvAfterCount = baselineOperations.length;
    const removedCount = brokerBeforeCount;
    
    console.log(`[Sync ${mode}] Filtered baseline - DAILY FRESH SYNC (all broker ops discarded):`, {
      before: { total: beforeCount, broker: brokerBeforeCount, csv: csvBeforeCount },
      after: { total: afterCount, csv: csvAfterCount },
      removedBrokerOps: removedCount,
    });
  } else {
    // REFRESH: Keep existing operations for deduplication
    console.log(`[Sync ${mode}] Keeping baseline for incremental refresh:`, {
      total: beforeCount,
      broker: brokerBeforeCount,
      csv: csvBeforeCount,
    });
  }
  
  // Only broker ops can ever be legitimate duplicates of incoming broker candidates
  // (CSV entries never share a reliable key with broker ops - see isDuplicate's source guard).
  const dedupePool = baselineOperations.filter((op) => op.source === 'broker');
  const candidateOperations = [];
  
  // DEBUG: Log baseline for deduplication
   
  if (mode === DAILY_MODE) {
    console.log(`[Sync ${mode}] Starting DAILY sync - fresh start (broker ops discarded)`);
    console.log(`[Sync ${mode}] Baseline: ${baselineOperations.length} CSV operations only`);
  } else {
    console.log(`[Sync ${mode}] Starting REFRESH sync - incremental update`);
    console.log(`[Sync ${mode}] Baseline: ${baselineOperations.length} total operations (for deduplication)`);
  }
  
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
         
        console.log(`[Sync ${mode}] First RAW operation from broker:`, rawOperations[0]);
         
        console.log(`[Sync ${mode}] Raw operation keys:`, Object.keys(rawOperations[0]));
      }
      
      const normalized = rawOperations.map((op) => normalizeOperation(op, 'broker'));
      
      // DEBUG: Check first operation's deduplication keys
      if (pageIndex === 0 && normalized.length > 0) {
        const firstOp = normalized[0];
         
        console.log(`[Sync ${mode}] First NORMALIZED operation keys:`, {
          order_id: firstOp.order_id,
          operation_id: firstOp.operation_id,
          symbol: firstOp.symbol,
          tradeTimestamp: firstOp.tradeTimestamp,
          price: firstOp.price,
          quantity: firstOp.quantity,
        });
      }
      
      // No se filtra por la hora de la última sync. `/rest/order/all` trae el
      // día entero, cada orden con su estado más reciente, y una orden que se
      // ejecuta entre que la API arma la respuesta y la sync guarda su marca de
      // tiempo (el reloj de la PC al commitear) queda con un `transactTime`
      // anterior a esa marca: filtrar por hora la perdía para siempre. Lo que ya
      // estaba lo reconoce el dedupe por orderId + execId, y `mergeBrokerBatch`
      // reemplaza el estado viejo de cada orden que cambió.
      totalEvaluated += normalized.length;

      let acceptedForPage = [];
      if (normalized.length > 0) {
        acceptedForPage = dedupeOperations(dedupePool, normalized);
         
        console.log(`[Sync ${mode}] Page ${pageIndex}: ${normalized.length} operations fetched, ${acceptedForPage.length} accepted after dedup`);
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
          retrievedCount: normalized.length,
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
    
    // Step 4: Merge baseline operations with NEW broker operations
    // DAILY: baseline = CSV only (fresh broker sync)
    // REFRESH: baseline = CSV + existing broker (incremental dedupe)
    const { mergedOps, newOrdersCount, newOpsCount } = mergeBrokerBatch(
      baselineOperations,
      candidateOperations,
    );
    
     
    console.log(`[Sync ${mode}] Sync complete: ${baselineOperations.length} baseline + ${candidateOperations.length} new = ${mergedOps.length} total (${newOpsCount} new ops)`);

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
 * Refresh operations: re-fetch the day and keep only what changed since the
 * operations already loaded (new orders and new exec reports of known ones).
 * Used for manual refresh button (US3).
 *
 * @param {Object} config - Same as startDailySync
 * @returns {Promise<Object>} Result: { success: boolean, operationsAdded: number, hasNewOperations: boolean }
 */
export async function refreshNewOperations(params = {}) {
  const {
    operations = [],
    cancellationToken = null,
    ...rest
  } = params;

  const result = await startDailySync({
    ...rest,
    cancellationToken,
    existingOperations: operations,
    mode: REFRESH_MODE,
  });

  return {
    ...result,
    hasNewOperations: (result.operationsAdded ?? 0) > 0,
    mode: REFRESH_MODE,
  };
}
