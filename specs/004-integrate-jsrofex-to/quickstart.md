# Quickstart: Broker Operations Automatic Sync

Feature: Integrate jsRofex for automatic operations retrieval (branch `004-integrate-jsrofex-to`).

## Prerequisites

- Node.js 18+
- Existing extension build workflow (Vite + React already configured).
- Broker credentials for testing (use non-production or sandbox if available).

## Installation / Setup

1. Add broker service files:
   - `frontend/src/services/broker/jsrofex-client.js`
   - `frontend/src/services/broker/sync-service.js`
2. Add React components:
   - `frontend/src/components/Processor/BrokerLogin.jsx`
   - `frontend/src/components/Processor/SyncStatus.jsx`
3. Extend state context:
   - `frontend/src/state/operations-context.jsx` (or integrate into existing config context).
4. Add Spanish strings to `frontend/src/strings/es-AR.js` (keys: `brokerSync.loginButton`, `brokerSync.loginError`, `brokerSync.refresh`, `brokerSync.noNewOperations`, `brokerSync.inProgress`, `brokerSync.rateLimited`, `brokerSync.cancel`, `brokerSync.lastSync`).

## Core Flow

### Initial Login & Automatic Sync (US1)

1. User opens processor UI.
2. If no active broker session: show BrokerLogin component.
3. User submits credentials -> `jsrofex-client.login()` -> token + expiry stored in context.
4. `sync-service.startDailySync()` automatically triggers and paginates `/operations` endpoint:
   - For each page: normalize -> dedupe against existing operations -> stage.
   - Emit progress updates to `SyncStatus` component via `onProgress` callback.
   - Supports cancellation: user clicks cancel -> `cancelSync()` -> staging discarded, no partial commit.
5. On completion: atomic commit of staged operations via `commitSync()` action.
6. Token auto-refreshes if within 60s of expiry (proactive refresh).

### Manual Refresh (US3)

1. User clicks refresh button in `SyncStatus` component.
2. `sync-service.refreshNewOperations()` fetches only operations newer than `lastSyncTimestamp`:
   - Filters server responses by `tradeTimestamp > lastSyncTimestamp`.
   - Dedupes against existing operations (broker + CSV).
   - Updates sync metadata and displays count of new operations.
3. If no new operations: displays localized message "No hay nuevas operaciones".
4. Refresh supports cancellation and rate limiting like initial sync.

### CSV Upload Coexistence (US2)

1. User uploads CSV file via existing file picker.
2. CSV operations normalized with `source: 'csv'` attribute.
3. Merged with existing operations (broker + CSV) using same dedupe logic.
4. UI displays source breakdown: Broker count, CSV count, Total.

### Broker Account Switch (T067)

1. User can switch broker accounts (via login form or account menu).
2. `switchBrokerAccount(newAuthData)` action:
   - Clears all broker-sourced operations.
   - Retains all CSV-sourced operations.
   - Resets sync state.
3. User can then perform new initial sync with new account.

## Duplicate Detection

- Primary: `order_id` + `operation_id`.
- Fallback: composite attributes + timestamp tolerance bucket (1s).
- Implement pure utilities in `frontend/src/services/broker/dedupe-utils.js` (optional consolidation file).

## Error Handling

- 401/403 -> prompt re-login.
- 429 -> show rate limit message & backoff.
- Transient (timeout/5xx) -> auto-retry sequence (2s,5s,10s) then fail.

## Testing

- Unit: dedupe, merge, normalization.
- Integration: login + sync flow with mocked client returning paginated responses.
- Performance: large dataset (simulate 20k ops) ensure responsive UI (chunk merges).

## Spanish Localization

Add new Spanish strings and verify no hard-coded English remains. Use existing pattern in `es-AR.js`.

## Commands

To run tests:

```bash
npm test
```

To lint:

```bash
npm run lint
```

## Next Steps (Phase 2 Candidates)

- Historical range fetch.
- Virtualized table for large operation sets.
- Audit log visualization.
- Multi-broker profile support.

## References

- `plan.md`
- `research.md`
- `data-model.md`
- `contracts/broker-sync.openapi.yaml`
