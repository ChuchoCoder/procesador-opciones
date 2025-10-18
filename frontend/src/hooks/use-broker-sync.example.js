// Example integration: Custom hook for broker sync operations with automatic token refresh (T016)
// This demonstrates how sync-service.js (US1) will use token-manager.js

import { useCallback } from 'react';
import { useConfig } from '../state/config-hooks.js';
import { ensureValidToken } from '../services/broker/token-manager.js';

/**
 * Example hook showing token manager integration pattern.
 * Real implementation will be in sync-service.js (T017-T029).
 * 
 * @returns {Object} Sync operations with automatic token refresh
 */
export function useBrokerSync() {
  const { brokerAuth, setBrokerAuth, clearBrokerAuth } = useConfig();

  /**
   * Execute broker operation with automatic token validation/refresh.
   * @param {Function} operation - Async function receiving valid token
   * @returns {Promise<any>} Operation result
   */
  const withValidToken = useCallback(
    async (operation) => {
      try {
        // Ensure token is valid, refresh if needed (within 60s threshold)
        const token = await ensureValidToken(brokerAuth, setBrokerAuth);
        
        // Execute the actual broker operation with valid token
        return await operation(token);
      } catch (error) {
        // Handle authentication failures
        if (error.message.includes('TOKEN_EXPIRED') || error.message.includes('NOT_AUTHENTICATED')) {
          // Clear auth state, trigger login flow
          clearBrokerAuth();
          throw error;
        }
        
        // Propagate other errors (rate limiting, network, etc.)
        throw error;
      }
    },
    [brokerAuth, setBrokerAuth, clearBrokerAuth]
  );

  /**
   * Example: Fetch operations with automatic token management.
   * Real implementation will be in sync-service.js
   */
  const fetchOperations = useCallback(
    async (tradingDay, pageToken = null) => {
      return withValidToken(async (token) => {
        // Import listOperations from jsrofex-client
        const { listOperations } = await import('../services/broker/jsrofex-client.js');
        
        return listOperations(token, tradingDay, pageToken);
      });
    },
    [withValidToken]
  );

  return {
    withValidToken,
    fetchOperations,
    isAuthenticated: !!brokerAuth?.token,
    needsLogin: !brokerAuth?.token,
  };
}

/**
 * Example usage in sync-service.js (Phase 3 - US1):
 * 
 * ```javascript
 * import { ensureValidToken } from './token-manager.js';
 * import { listOperations } from './jsrofex-client.js';
 * 
 * export async function syncOperations(brokerAuth, dispatchSetAuth, dispatchStage) {
 *   try {
 *     // Automatic token refresh if within 60s of expiry
 *     const token = await ensureValidToken(brokerAuth, dispatchSetAuth);
 *     
 *     let pageToken = null;
 *     do {
 *       const result = await listOperations(token, 'today', pageToken);
 *       dispatchStage(result.operations, result.pageIndex);
 *       pageToken = result.nextPageToken;
 *     } while (pageToken);
 *     
 *     return { success: true };
 *   } catch (error) {
 *     if (error.message.includes('TOKEN_EXPIRED')) {
 *       // Trigger re-authentication flow
 *       return { success: false, needsReauth: true };
 *     }
 *     throw error;
 *   }
 * }
 * ```
 */
