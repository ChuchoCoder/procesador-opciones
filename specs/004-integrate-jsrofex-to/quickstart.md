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

1. User opens processor UI.
2. If no active broker session: show BrokerLogin component.
3. User submits credentials -> `jsrofex-client.login()` -> token + expiry stored.
4. `sync-service.startDailySync()` paginates `/operations` endpoint:
   - For each page: normalize -> dedupe -> stage.
   - Emit progress updates to `SyncStatus`.
5. On completion: atomic commit of staged operations.
6. User can trigger manual refresh (`sync-service.refreshNewOperations()`) which requests pages newer than last sync timestamp (or full re-fetch if not supported by API).
7. Cancellation sets `isCancelled` flag; staging discarded.

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
