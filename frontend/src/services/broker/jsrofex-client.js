// jsRofex REST API client (T007)
// Direct REST API calls to Matba Rofex / Primary endpoints
// Browser-compatible (no Node.js dependencies)
// Based on jsRofex REST API documentation

// Base URL configuration
let BASE_URL = 'https://api.remarkets.primary.com.ar';
let currentToken = null;
let tokenExpiry = null;
// Reference tokenExpiry to avoid ESLint "assigned but never used" warning (it's read by other helpers)
void tokenExpiry;

/**
 * Set the base URL for API requests
 * @param {string} url - Base URL for the broker API
 */
export function setBaseUrl(url) {
  if (typeof url === 'string' && url.trim()) {
    BASE_URL = url.trim().replace(/\/$/, ''); // Remove trailing slash
    console.log('[jsRofex] Base URL set to:', BASE_URL);
  }
}

/**
 * Get the current base URL
 * @returns {string} Current base URL
 */
export function getBaseUrl() {
  return BASE_URL;
}

/**
 * Legacy compatibility: setEnvironment
 * Maps environment names to base URLs
 * @param {string} env - Environment name ('reMarkets' or 'production')
 */
export function setEnvironment(env) {
  if (env === 'reMarkets') {
    BASE_URL = 'https://api.remarkets.primary.com.ar';
  } else if (env === 'production') {
    BASE_URL = 'https://api.primary.com.ar';
  }
}

/**
 * Get the current environment name based on URL
 * @returns {string} Environment name
 */
export function getEnvironment() {
  if (BASE_URL.includes('remarkets')) {
    return 'reMarkets';
  }
  return 'production';
}

/**
 * Authenticate with broker and obtain session token.
 * Uses the Matba Rofex REST API authentication endpoint
 * @param {Object} credentials - { username, password }
 * @returns {Promise<{token: string, expiry: number}>} Auth response with token + expiry (epoch ms)
 * @throws {Error} On network failure or authentication failure
 */
export async function login({ username, password }) {
  try {
    const url = `${BASE_URL}/auth/getToken`;
    console.log('[jsRofex] Login request to:', url);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-Username': username,
        'X-Password': password,
      },
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('AUTH_FAILED: Invalid credentials');
      }
      throw new Error(`LOGIN_ERROR: HTTP ${response.status}`);
    }

    // Token is returned in the response header
    const token = response.headers.get('X-Auth-Token');
    
    if (!token) {
      throw new Error('AUTH_FAILED: No token received');
    }

    // Store token internally
    currentToken = token;
    
    // Set expiry to 8 hours from now (typical Primary API session duration)
    const expiry = Date.now() + (8 * 60 * 60 * 1000);
    tokenExpiry = expiry;
    
    return { token, expiry };
  } catch (error) {
    if (error.message.includes('AUTH_FAILED')) {
      throw error;
    }
    if (error.message.includes('Failed to fetch') || error.name === 'TypeError') {
      throw new Error('LOGIN_ERROR: Network error - check your connection');
    }
    throw new Error(`LOGIN_ERROR: ${error.message}`);
  }
}

/**
 * Refresh session token
 * Primary API doesn't have a separate refresh endpoint
 * This returns the same token with updated expiry
 * @param {string} token - Current session token
 * @returns {Promise<{token: string, expiry: number}>} Same token with new expiry
 */
export async function refreshToken(token) {
  // Primary API sessions are long-lived (8 hours)
  // No separate refresh endpoint - just extend expiry
  const expiry = Date.now() + (8 * 60 * 60 * 1000);
  tokenExpiry = expiry;
  return { token, expiry };
}

/**
 * Get accounts associated with the user
 * @param {string} token - Session token (optional, uses stored token if not provided)
 * @returns {Promise<Array>} Array of accounts
 */
export async function getAccounts(token = currentToken) {
  if (!token) {
    throw new Error('AUTH_REQUIRED: No authentication token available');
  }

  try {
    const response = await fetch(`${BASE_URL}/rest/accounts`, {
      method: 'GET',
      headers: {
        'X-Auth-Token': token,
      },
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('AUTH_REQUIRED: Token invalid or expired');
      }
      throw new Error(`GET_ACCOUNTS_ERROR: HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.accounts || [];
  } catch (error) {
    if (error.message.includes('AUTH_REQUIRED')) {
      throw error;
    }
    throw new Error(`GET_ACCOUNTS_ERROR: ${error.message}`);
  }
}

/**
 * Get all orders status for an account
 * @param {string} accountName - Account name (not id - the API requires the account name)
 * @param {string} token - Session token (optional, uses stored token if not provided)
 * @returns {Promise<Array>} Array of orders
 */
export async function getAllOrdersStatus(accountName, token = currentToken) {
  if (!token) {
    throw new Error('AUTH_REQUIRED: No authentication token available');
  }

  try {
    const response = await fetch(`${BASE_URL}/rest/order/all?accountId=${accountName}`, {
      method: 'GET',
      headers: {
        'X-Auth-Token': token,
      },
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('AUTH_REQUIRED: Token invalid or expired');
      }
      throw new Error(`GET_ORDERS_ERROR: HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.orders || [];
  } catch (error) {
    if (error.message.includes('AUTH_REQUIRED')) {
      throw error;
    }
    throw new Error(`GET_ORDERS_ERROR: ${error.message}`);
  }
}

/**
 * List operations for trading day
 * Retrieves orders from the Primary/Matba Rofex REST API
 * 
 * @param {Object} options - { date?: string (YYYY-MM-DD), pageToken?: string, token: string, accountName?: string }
 * @returns {Promise<{operations: Array, nextPageToken?: string, estimatedTotal?: number}>}
 * @throws {Error} On network failure, auth error, rate limit, or server error
 */
export async function listOperations({ date, token = currentToken, accountId }) {
  if (!token) {
    throw new Error('AUTH_REQUIRED: No authentication token available');
  }

  try {
    console.log('[jsRofex] listOperations using BASE_URL:', BASE_URL);
    
    // Get accounts if accountId not provided
    let targetAccountId = accountId;
    if (!targetAccountId) {
      const accounts = await getAccounts(token);
      if (accounts.length === 0) {
        throw new Error('No accounts found for this user');
      }
      // Use account name, not id (API requires account name)
      targetAccountId = accounts[0].name;
      console.log('[jsRofex] Using account:', targetAccountId, 'from accounts:', accounts);
    }

    // Get all orders for the account
    const orders = await getAllOrdersStatus(targetAccountId, token);

    // Filter by date if provided
    let filteredOperations = orders;
    if (date) {
      const targetDate = new Date(date).toISOString().split('T')[0];
      filteredOperations = orders.filter(order => {
        if (order.transactTime) {
          // Parse the transactTime format from Primary API
          // Format: "YYYYMMDD-HH:mm:ss.SSS-offset"
          const orderDateStr = order.transactTime.split('-')[0];
          const orderDate = `${orderDateStr.slice(0, 4)}-${orderDateStr.slice(4, 6)}-${orderDateStr.slice(6, 8)}`;
          return orderDate === targetDate;
        }
        return false;
      });
    }

    // Primary API doesn't support pagination for orders
    // Return all filtered operations
    return {
      operations: filteredOperations,
      nextPageToken: undefined,
      estimatedTotal: filteredOperations.length,
    };
  } catch (error) {
    if (error.message.includes('AUTH_REQUIRED') || error.message.includes('Token invalid')) {
      throw new Error('AUTH_REQUIRED: Token invalid or expired');
    }
    if (error.message.includes('429')) {
      throw new Error('RATE_LIMITED: Retry after 60 seconds');
    }
    if (error.message.includes('500') || error.message.includes('502') || error.message.includes('503')) {
      throw new Error(`SERVER_ERROR: ${error.message}`);
    }
    throw new Error(`LIST_OPERATIONS_ERROR: ${error.message}`);
  }
}

/**
 * Get all available instruments with their details
 * Retrieves the complete list of tradeable instruments from the Primary/Matba Rofex REST API
 * 
 * @param {string} token - Session token (optional, uses stored token if not provided)
 * @returns {Promise<{instruments: Array}>} Object containing array of instrument details
 * @throws {Error} On network failure, auth error, or server error
 */
export async function getAllInstruments(token = currentToken) {
  if (!token) {
    throw new Error('AUTH_REQUIRED: No authentication token available');
  }

  try {
    console.log('[jsRofex] getAllInstruments using BASE_URL:', BASE_URL);
    
    const response = await fetch(`${BASE_URL}/rest/instruments/all`, {
      method: 'GET',
      headers: {
        'X-Auth-Token': token,
      },
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('AUTH_REQUIRED: Token invalid or expired');
      }
      throw new Error(`GET_INSTRUMENTS_ERROR: HTTP ${response.status}`);
    }

    const data = await response.json();
    
    // API returns { instruments: [...] }
    return {
      instruments: data.instruments || [],
    };
  } catch (error) {
    if (error.message.includes('AUTH_REQUIRED')) {
      throw error;
    }
    if (error.message.includes('429')) {
      throw new Error('RATE_LIMITED: Retry after 60 seconds');
    }
    if (error.message.includes('500') || error.message.includes('502') || error.message.includes('503')) {
      throw new Error(`SERVER_ERROR: ${error.message}`);
    }
    throw new Error(`GET_INSTRUMENTS_ERROR: ${error.message}`);
  }
}

/**
 * Get trade history for a specific instrument
 * Retrieves historical trades from the Primary/Matba Rofex REST API
 * 
 * @param {Object} options - Query options
 * @param {string} options.marketId - Market identifier (e.g., 'ROFX')
 * @param {string} options.symbol - Instrument symbol (e.g., 'MERV - XMEV - GGAL - 24hs')
 * @param {string} options.dateFrom - Start date in YYYY-MM-DD format
 * @param {string} options.dateTo - End date in YYYY-MM-DD format
 * @param {boolean} [options.external=false] - Set to true for instruments from external markets (non Matba Rofex)
 * @param {string} options.token - Session token (optional, uses stored token if not provided)
 * @returns {Promise<{trades: Array}>} Object containing array of trade records
 * @throws {Error} On network failure, auth error, or server error
 */
export async function getTrades({ marketId, symbol, dateFrom, dateTo, external = false, token = currentToken }) {
  if (!token) {
    throw new Error('AUTH_REQUIRED: No authentication token available');
  }

  if (!marketId || !symbol || !dateFrom || !dateTo) {
    throw new Error('INVALID_PARAMS: marketId, symbol, dateFrom, and dateTo are required');
  }

  try {
    console.log('[jsRofex] getTrades using BASE_URL:', BASE_URL);
    
    // Build query string
    const params = new URLSearchParams({
      marketId,
      symbol,
      dateFrom,
      dateTo,
    });
    
    // Add external parameter if true (for non Matba Rofex instruments)
    if (external) {
      params.append('external', 'true');
    }
    
    const url = `${BASE_URL}/rest/data/getTrades?${params.toString()}`;
    console.log('[jsRofex] getTrades URL:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Auth-Token': token,
      },
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('AUTH_REQUIRED: Token invalid or expired');
      }
      throw new Error(`GET_TRADES_ERROR: HTTP ${response.status}`);
    }

    const data = await response.json();
    
    // API returns { trades: [...] } or similar structure
    return {
      trades: data.trades || data || [],
    };
  } catch (error) {
    if (error.message.includes('AUTH_REQUIRED')) {
      throw error;
    }
    if (error.message.includes('INVALID_PARAMS')) {
      throw error;
    }
    if (error.message.includes('429')) {
      throw new Error('RATE_LIMITED: Retry after 60 seconds');
    }
    if (error.message.includes('500') || error.message.includes('502') || error.message.includes('503')) {
      throw new Error(`SERVER_ERROR: ${error.message}`);
    }
    throw new Error(`GET_TRADES_ERROR: ${error.message}`);
  }
}
