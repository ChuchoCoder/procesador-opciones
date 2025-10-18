# T016 Implementation Summary: Token Storage Integration

**Date**: October 15, 2025  
**Task**: T016 - Integrate token storage & expiry check  
**Status**: ✅ COMPLETE

## Overview

Implemented automatic token validation and refresh logic that integrates with the existing config-context broker authentication state. The token manager proactively refreshes tokens within 60 seconds of expiry to prevent authentication failures during sync operations.

## Files Created

### 1. `frontend/src/services/broker/token-manager.js` (96 lines)

Pure utility module providing token lifecycle management:

- **`needsRefresh(brokerAuth)`**: Checks if token expires within 60s threshold
- **`isTokenValid(brokerAuth)`**: Validates token hasn't expired
- **`performRefresh(brokerAuth)`**: Calls jsrofex-client to refresh token, preserves account metadata
- **`ensureValidToken(brokerAuth, dispatchSetAuth)`**: Main integration point - validates token, auto-refreshes if needed, returns valid token ready for API calls

**Key Design Decisions**:
- 60-second refresh threshold per research.md decision 6
- Preserves `accountId` and `displayName` across refresh
- Throws descriptive errors (`NOT_AUTHENTICATED`, `TOKEN_EXPIRED`) for caller handling
- Pure functions - no side effects except through dispatcher callback

### 2. `frontend/tests/unit/token-manager.spec.js` (23 tests, all passing)

Comprehensive test coverage:

**needsRefresh tests (7)**:
- Returns false for missing auth/token/expiry
- Returns false if >60s until expiry
- Returns true if ≤60s until expiry or already expired
- Boundary test at exactly 60s threshold

**isTokenValid tests (5)**:
- Returns false for missing auth/token/expiry
- Returns true if not yet expired
- Returns false if already expired

**performRefresh tests (5)**:
- Throws if no token available
- Calls jsrofex-client with current token
- Preserves account metadata (accountId, displayName)
- Propagates errors from jsrofex-client

**ensureValidToken tests (6)**:
- Throws NOT_AUTHENTICATED if no auth
- Throws TOKEN_EXPIRED if already expired
- Returns token directly if valid and >60s until expiry
- Auto-refreshes if within 60s threshold
- Dispatches SET_BROKER_AUTH with new token after refresh
- Propagates refresh errors without updating auth

### 3. `frontend/src/hooks/use-broker-sync.example.js` (70 lines)

Example integration pattern showing how sync-service.js (US1) will use token-manager:

- **`useBrokerSync()` hook**: Demonstrates withValidToken wrapper pattern
- **`withValidToken(operation)`**: Higher-order function handling token validation before operation execution
- **`fetchOperations()` example**: Shows real-world usage with jsrofex-client
- Includes code sample for sync-service.js implementation

## Files Modified

### 1. `frontend/src/state/config-context.jsx`

Added broker sync action helpers to context:

```javascript
setBrokerAuth: (authData) => dispatch({ type: 'SET_BROKER_AUTH', payload: authData }),
clearBrokerAuth: () => dispatch({ type: 'CLEAR_BROKER_AUTH' }),
startSync: (sessionId) => dispatch({ type: 'START_SYNC', payload: { sessionId } }),
stagePage: (operations, pageIndex) => dispatch({ type: 'STAGE_PAGE', payload: { operations, pageIndex } }),
commitSync: (operations, syncMeta) => dispatch({ type: 'COMMIT_SYNC', payload: { operations, syncMeta } }),
failSync: (error) => dispatch({ type: 'FAIL_SYNC', payload: { error } }),
cancelSync: () => dispatch({ type: 'CANCEL_SYNC' }),
```

**Rationale**: Provides typed action dispatchers for sync operations, avoiding manual action object construction.

### 2. `specs/004-integrate-jsrofex-to/tasks.md`

Marked T016 as `[X]` complete.

## Integration Points

### How Sync-Service Will Use Token Manager (Phase 3 - US1)

```javascript
import { ensureValidToken } from './token-manager.js';
import { listOperations } from './jsrofex-client.js';

export async function syncOperations(brokerAuth, dispatchSetAuth, dispatchStage) {
  try {
    // Automatic token refresh if within 60s of expiry
    const token = await ensureValidToken(brokerAuth, dispatchSetAuth);
    
    let pageToken = null;
    do {
      const result = await listOperations(token, 'today', pageToken);
      dispatchStage(result.operations, result.pageIndex);
      pageToken = result.nextPageToken;
    } while (pageToken);
    
    return { success: true };
  } catch (error) {
    if (error.message.includes('TOKEN_EXPIRED')) {
      // Trigger re-authentication flow
      return { success: false, needsReauth: true };
    }
    throw error;
  }
}
```

### Token Lifecycle Flow

1. **Login** (US1): User provides credentials → jsrofex-client.login() → dispatch SET_BROKER_AUTH with {token, expiry}
2. **Sync Start**: Call ensureValidToken(brokerAuth, setBrokerAuth)
3. **Check Validity**: If now ≥ expiry, throw TOKEN_EXPIRED → clear auth, show login
4. **Check Refresh Need**: If now ≥ expiry - 60s, call performRefresh()
5. **Auto-Refresh**: jsrofex-client.refreshToken() → dispatch SET_BROKER_AUTH with new token
6. **Return Valid Token**: Token guaranteed valid for next 60+ seconds
7. **API Call**: Use token with listOperations() or other broker endpoints

## Test Results

```
✓ tests/unit/token-manager.spec.js (23 tests) 22ms
  ✓ token-manager > needsRefresh (7 tests)
  ✓ token-manager > isTokenValid (5 tests)
  ✓ token-manager > performRefresh (5 tests)
  ✓ token-manager > ensureValidToken (6 tests)

Test Files  1 passed (1)
     Tests  23 passed (23)
```

## Lint Status

**Before**: 15 errors, 6 warnings  
**After**: 0 errors, 6 warnings (pre-existing React hook warnings in unrelated files)

All new code passes ESLint with no errors.

## Performance Considerations

- **Token validation**: O(1) timestamp comparison
- **Refresh threshold**: 60s buffer prevents auth failures during multi-page sync
- **Metadata preservation**: Avoids re-fetching account info on refresh
- **No caching**: Relies on config-context state as single source of truth

## Security Notes

- Token stored in config-context state (persisted via localStorage/chrome.storage)
- No raw credentials stored - only token + expiry
- Token expiry enforced client-side (server should also validate)
- Refresh failures clear auth state to force re-login
- Token security test (T062) will validate no credentials leak

## Next Steps

Remaining Foundational tasks before User Story P1:

- **T061**: SyncSession log structure in context (append-only session history)
- **T062**: Token security test (verify no raw credentials persisted)
- **T065**: Atomic rollback integration test (mid-sync failure handling)
- **T072**: Audit log stub (compliance logging for sync operations)

Then proceed to **Phase 3: User Story P1 (T017-T029)** - Automatic Operations Sync UI.

## Dependencies

**Imports**:
- `jsrofex-client.js`: refreshToken() function
- `config-context.jsx`: brokerAuth state, setBrokerAuth dispatcher

**Imported By** (future):
- `sync-service.js` (US1): Main sync orchestration
- Login components (US1): Initial authentication flow
- Manual refresh button (US3): User-triggered sync
