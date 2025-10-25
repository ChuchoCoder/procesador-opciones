## research.md — Daily Instruments Sync

Decision: Use a hybrid storage strategy that prefers `chrome.storage.local` and writes a compatibility copy to `localStorage.instrumentsWithDetails`.

Rationale:
- `chrome.storage.local` provides an async API and generally higher storage quota in extension context and is suitable for larger payloads (catalogs). Using it prevents `localStorage` quota exceptions and avoids blocking the popup thread.
- Existing UI and tests in the repo reference `localStorage.instrumentsWithDetails` in multiple places; to avoid large refactors in this iteration we will write a compatibility copy to `localStorage` after successful fetch. Future work can migrate read-paths to `chrome.storage`.

Alternatives considered:
- Only `localStorage`: simpler, but risk of quota exceptions and synchronous blocking; rejected.
- Only `chrome.storage.local`: ideal for quota but requires refactoring any code that reads `localStorage` directly; chosen approach is incremental and low-risk.

Decision: Use `chrome.alarms` in the service worker (MV3) to schedule a daily sync at 09:45 ART and set a fallback check on popup startup.

Rationale:
- `chrome.alarms` supports scheduled events that fire even if the popup UI is not open (service worker will be woken to execute the callback). This satisfies the requirement to attempt daily sync even if the user isn't interacting with the UI at 09:45.

Alternatives considered:
- Only check on popup open: simpler but misses runs when user is not interacting. Rejected due to FR-010 requirement.

Decision: Sharding policy and part size: default shard part size = 256KB. Storage record will include metadata to recompose parts.

Rationale:
- 256KB balances number of parts and probability of exceeding per-key limits for `localStorage` while keeping recomposition CPU cost reasonable in JS. `chrome.storage.local` has larger quotas but sharding keeps behavior predictable across environments.

Decision: Retry policy and token handling

- Retry: exponential backoff with jitter, max 3 retries within a 5-minute window (as required by FR-008). Backoff base 2s, then 4s, then 8s (randomized +/-25%).
- Token: only attempt fetch if `BrokerSession.isAuthenticated === true`. If a `tryRefresh()` helper exists, call it before fetch; otherwise, fail fast and surface diagnostic logs.

Assumptions resolved:
- The repo exposes a `BrokerSession` concept. If not present, the code will only check the extension's existing auth state and provide hooks for future refresh.
- User-visible strings will be placed in the centralized strings module (`frontend/src/strings` or equivalent). Any new UI label (e.g., "Última sincronización") will be added in Spanish (es-AR).

Outcome: All prior NEEDS CLARIFICATION entries in `plan.md` are resolved with the above decisions. Next: create `data-model.md`, `contracts/*` and `quickstart.md` and update agent context.
