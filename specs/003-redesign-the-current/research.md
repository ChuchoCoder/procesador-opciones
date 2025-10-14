# research.md


Decision: Use browser-localStorage for persistence in this iteration

Rationale:

- The feature operates entirely in the frontend UI and early rollout requires minimal infra changes.
- localStorage provides immediate, synchronous persistence with broad browser support and requires no backend changes.

Alternatives considered:

- Backend API persistence: centralizes configs but requires server work, auth, and migration. Deferred.
- IndexedDB: larger storage and async API; better for larger datasets but adds complexity. Consider for future if storage or concurrency needs increase.

Open questions (deferred to plan/tasks):

- Non-functional targets: latency, observability, and availability targets need to be defined.
- Concurrency behavior (multiple tabs) — research best practice for lock or last-writer-wins. Recommend short investigation during Phase 0.

Research tasks created:

- Research localStorage size limits and cross-browser behavior for expected payload sizes.
- Research localStorage concurrency patterns (storage events, broadcastChannel) and recommend a simple conflict policy.
- Research accessibility and i18n patterns for the settings UI (es-AR strings integration).
