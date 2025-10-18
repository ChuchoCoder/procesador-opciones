# jsRofex REST API Integration Guide

## Overview

This document describes the integration with the Matba Rofex/Primary REST API for connecting to the broker. 

**Important**: We use **direct REST API calls** instead of the `jsRofex` npm package because:
- The `jsRofex` library requires Node.js modules (`request`, `util.inherits`, etc.) that don't work in browsers
- This is a browser-based Chrome extension/web application
- Direct REST calls are lighter and more transparent

## Installation

**No installation required** - we use the browser's native `fetch()` API to make HTTP requests to the Matba Rofex endpoints.

## Architecture

### Wrapper Pattern

The jsRofex library uses a callback-based API. To maintain consistency with the rest of the application's Promise-based architecture, we've implemented a wrapper layer in `frontend/src/services/broker/jsrofex-client.js`.

### Key Components

1. **jsrofex-client.js** - Main wrapper that:
   - Converts jsRofex callbacks to Promises
   - Maintains compatibility with existing broker API contracts
   - Provides environment configuration (reMarkets vs production)
   - Handles authentication and session management

2. **Environment Configuration**
   - `reMarkets`: Demo/testing environment (default)
   - `production`: Production environment

### API Functions

#### Authentication

```javascript
import { login, refreshToken } from './services/broker/jsrofex-client.js';

// Login
const { token, expiry } = await login({ 
  username: 'your-username', 
  password: 'your-password' 
});

// Refresh token (jsRofex maintains sessions internally)
const { token: newToken, expiry: newExpiry } = await refreshToken(token);
```

#### Retrieve Operations

```javascript
import { listOperations } from './services/broker/jsrofex-client.js';

// List all operations for default account
const { operations, estimatedTotal } = await listOperations({ 
  token: 'your-token' 
});

// List operations for specific date and account
const result = await listOperations({ 
  token: 'your-token',
  accountId: 'YOUR_ACCOUNT_ID',
  date: '2025-10-15' // YYYY-MM-DD format
});
```

#### Get Accounts

```javascript
import { getAccounts } from './services/broker/jsrofex-client.js';

const accounts = await getAccounts();
// Returns: [{ id: 'ACCOUNT123', name: 'Account Name', ... }]
```

#### Environment Management

```javascript
import { setEnvironment, getEnvironment } from './services/broker/jsrofex-client.js';

// Switch to production environment
setEnvironment('production');

// Get current environment
const env = getEnvironment(); // Returns: 'reMarkets' or 'production'
```

## Error Handling

The wrapper translates jsRofex errors into standardized error messages:

- `AUTH_FAILED`: Invalid credentials
- `AUTH_REQUIRED`: Not authenticated or token expired
- `LOGIN_ERROR`: Generic login failure
- `GET_ORDERS_ERROR`: Failed to retrieve orders
- `GET_ACCOUNTS_ERROR`: Failed to retrieve accounts
- `LIST_OPERATIONS_ERROR`: Failed to list operations

Example:

```javascript
try {
  const result = await login({ username: 'bad', password: 'bad' });
} catch (error) {
  if (error.message.includes('AUTH_FAILED')) {
    console.error('Invalid credentials');
  }
}
```

## Differences from REST Client

The previous implementation used a thin REST client with `fetch()`. The jsRofex integration differs in:

1. **Session Management**: jsRofex maintains sessions internally
2. **Token Handling**: Tokens are opaque identifiers; actual auth is managed by the library
3. **Pagination**: jsRofex doesn't support pagination (returns all operations)
4. **API Surface**: Uses jsRofex native methods (`get_all_orders_status`, `get_accounts`)

## Testing

Tests are located in `frontend/tests/unit/jsrofex-client.spec.js` and use Vitest mocks to simulate the jsRofex library behavior.

Run tests:

```bash
cd frontend
npm test -- jsrofex-client.spec.js
```

## Credentials

### reMarkets (Demo)

- Sign up at: <https://remarkets.primary.ventures/index.html>

### Production

- Contact MPI team: <mpi@primary.com.ar>

## jsRofex Library Documentation

Official README: <https://github.com/matbarofex/jsRofex/blob/master/README.md>

### Available Methods (from jsRofex)

- `login(user, password, callback)`: Authenticate user
- `get_accounts(callback)`: Get associated accounts
- `get_instruments(type, detailed, callback)`: Get available instruments
- `get_market_data(marketId, symbol, entries, depth, callback)`: Get real-time market data
- `send_order(...)`: Send new order to market
- `cancel_order(orderId, proprietary, callback)`: Cancel order
- `get_order_status(lookupType, orderId, proprietary, callback)`: Get order status
- `get_all_orders_status(accountId, callback)`: Get all orders for account
- `get_trade_history(marketId, symbol, date, callback)`: Get historical trades

## Integration Status

✅ Installed jsRofex from GitHub
✅ Created Promise-based wrapper
✅ Maintained existing API contract
✅ Updated and passing all unit tests
✅ Supports both reMarkets and production environments

## Next Steps

1. **UI Integration**: Update BrokerLogin component to use jsRofex
2. **State Management**: Integrate with existing operations context
3. **Account Selection**: Add UI for multiple account support
4. **Error Handling**: Enhance user-facing error messages in Spanish
5. **Integration Tests**: Update broker sync flow tests for jsRofex

## Notes

- The jsRofex library has some deprecated dependencies (request, uuid version 3.x)
- Consider monitoring for library updates
- WebSocket support available but not yet integrated (for real-time market data)

## Security Considerations

- Never store raw credentials; only session tokens
- Tokens expire after ~8 hours (configurable)
- Use `chrome.storage` for token persistence in extension context
- Clear tokens on logout or account switch
