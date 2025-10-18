# research.md

Decision: Frontend-only implementation using existing React 18 + Vite stack.

Rationale: The feature is purely UI and calculation-focused; the repository already contains a `frontend/` app using React and localStorage for settings. No backend changes are needed.

Alternatives considered:
- Server-side calculation: rejected because the project has no backend and the spec requires local override persistence.

Decision: BYMA default rates stored as a configuration JSON in `frontend/public/byma-defaults.json`.

Rationale: `frontend/public` is already served by Vite and accessible at runtime without a server. It allows users to manually update the file in deployments.

Alternatives considered:
- Storing defaults inside localStorage: rejected because defaults must be visible and editable in repository; using `public` provides a source-of-truth file and can be overridden by localStorage values.

Decision: Implement pure calculation functions in `frontend/src/services/fees/repo-fees.js` with unit tests using Vitest under `frontend/tests/unit/repo-fees.spec.js`.

Rationale: Tests run quickly, are integrable in CI, and satisfy the Constitution Check for deterministic logic testability.

Alternatives considered:
- Implementing the logic inside React components: rejected because harder to unit test and violates separation of concerns.

Decision: Add Spanish (es-AR) strings to `frontend/src/strings/es-AR.js` following existing patterns.

Rationale: The project centralizes strings per locale; adding new keys there ensures translations and avoids duplication.

Decision: Persist user overrides to existing settings system (`frontend/src/services/storage-settings.js`) using its API to store `repoFeeConfig` object.

Rationale: Reuse existing settings persistence for consistency and fewer changes.

Known unknowns (marked NEEDS CLARIFICATION):
- Exact location and name conventions for BYMA defaults in production deployments (will follow `frontend/public/byma-defaults.json`; ops can adjust).
- Whether the popup extension (popup.html/popup.js) also needs the same functionality; assumption: primary UI is `frontend/` app. If popup needs it, replicate calculation library into `popup.js`.

Outputs created:
- `frontend/src/services/fees/repo-fees.js` (planned)
- `frontend/tests/unit/repo-fees.spec.js` (planned)
- `frontend/public/byma-defaults.json` (planned)
- `frontend/src/strings/es-AR.js` (update planned)

