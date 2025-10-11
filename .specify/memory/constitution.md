<!--
Sync Impact Report
Version change: 1.0.0 -> 1.1.0
Modified principles: (new) 6. Spanish (Argentina) User Interface Localization
Added sections: None (principle added under Core Principles)
Removed sections: None
Templates requiring updates:
	.specify/templates/plan-template.md ✅ (Add localization check to Constitution Check gate)
	.specify/templates/spec-template.md ✅ (Ensure user-visible text requirements align with locale mandate)
	.specify/templates/tasks-template.md ✅ (Tasks may need category for localization adjustments)
	.specify/templates/agent-file-template.md ⚠ (Regenerate to list localization technology guidance once plans created)
Deferred TODOs: None
-->

# Procesador Opciones Constitution

## Core Principles

### 1. Minimal Surface, Clear Purpose
All new code MUST directly support an end-user capability of the browser extension. Dead, speculative or
"future maybe" code is forbidden. Any utility used by only one feature stays colocated with that feature
until reused twice (then it may be promoted). Each file MUST have a single dominant responsibility.
Rationale: Keeps cognitive load low and prevents premature abstraction in a small extension codebase.

### 2. Deterministic Processing & Idempotence
Option processing logic MUST be pure or isolated behind a single side‑effect gateway (DOM updates, storage).
Given the same input text, processing MUST produce the same normalized output. All parsing and transforms
MUST be unit testable without DOM. Rationale: Predictability simplifies debugging and enables safe refactor.

### 3. Test Before Complex Change (NON‑NEGOTIABLE)
Whenever altering logic that transforms or filters option data, add or update a test FIRST that fails with the
current implementation. Happy path + at least one edge case (empty input OR malformed line). No major logic
change may merge without a test diff proving intent. Rationale: Guards data integrity and prevents silent drift.

### 4. Performance & Responsiveness Budget
Popup interactive readiness MUST be <150ms from open (p95 on a mid-tier laptop). Processing of a typical
input payload (<=500 lines) MUST complete in <100ms. Heavy computations MUST batch or yield (e.g., via
`requestIdleCallback`) if exceeding 16ms frame time. Rationale: Extension UX depends on snappy feedback.

### 5. Simplicity Over Framework Accretion
No additional frameworks or build steps beyond what is strictly necessary (current stack: raw JS + manifest).
Before adding a dependency, a justification documenting: benefit, size, simpler alternative rejection. Remove
unused code and dependencies promptly. Rationale: Small artifact, low attack surface, easy audits.

### 6. Spanish (Argentina) User Interface Localization

All user-visible interface text MUST be provided in Spanish (Argentina) (es-AR). Any newly added UI element
MUST ship with Spanish wording; English placeholders are forbidden in production. Centralize strings in a
single constants module enabling future translation keys. Numeric, date or currency formatting MUST use
locale-aware APIs (Intl) with `es-AR`. Temporary deviations require a `// DEVIATION:6` comment and tracking
issue. Rationale: Target user base is Argentina; consistent localized language increases clarity and trust.

## Technical Constraints

1. Runtime: Chrome/Chromium extension environment (Manifest V3). No server or backend services.
2. Storage: Use `chrome.storage` or `localStorage` only when the value must persist across sessions; otherwise
  keep ephemeral state in memory.
3. Security: Never eval dynamic strings; sanitize any user-pasted content only if executing (currently not).
4. Internationalization: All user-visible strings centralized in a single constants module for future i18n.
5. Error Handling: User-facing failures MUST show a concise, actionable message; internal details only in console.
6. Logging: Console logs MUST be structured with a consistent prefix `PO:` and removed when noise adds no value.
7. File Naming: Kebab-case for HTML/CSS/JS at root; module-scoped helpers suffixed with `-util.js` if generic.
8. Parsing: All option text parsing logic lives in one module exporting pure functions.

## Workflow & Quality Gates

Workflow Steps:

1. Clarify: Define the smallest user-visible outcome (update README if feature-level change).
2. Test Stub: If logic change, write failing test (principle 3) or add manual test notes if purely UI cosmetic.
3. Implement: Keep functions <60 lines; extract early if complexity grows.
4. Review: PR description MUST list which principle(s) are touched and how validated.
5. Validate: Run tests + manual open popup smoke test before merge.

Quality Gates:

- Lint passes (when linter added) and no TODO left untagged (Use `TODO(username): reason`).
- All changed logic covered by at least one test (where applicable).
- Bundle / script size increase >10KB requires justification.
- No new global variables introduced (except explicitly in manifest scope).
- Performance: Manual spot check with DevTools performance panel for large input features.

Violation Handling:

- Minor (documentation omission): fix in same PR or follow-up within 24h.
- Major (missing tests for logic change or perf regression): block merge until resolved.

## Governance

Authority Hierarchy: This constitution supersedes ad-hoc style preferences or historical patterns once ratified.

Amendments:

- Patch (x.y.z): Clarifications, wording, typo, reformat without semantic change.
- Minor (x.y.0): Add a new principle, section, or expand a mandate materially.
- Major (x.0.0): Remove or redefine a principle, or introduce a process that invalidates prior guarantees.

Amendment Process:

1. Draft proposal (issue or PR) referencing current version and intended bump level with rationale.
2. Provide diff of principle text + impact analysis (testing, files, potential refactors).
3. On approval, update constitution, increment version per above, set `Last Amended` date (ISO), keep
   original ratification date.

Compliance Review:

- Each PR reviewer MUST check changed files against Principles 1–5. Missing rationale = request changes.
- Quarterly (or every 10 merged feature PRs) perform a drift audit: list any files exceeding complexity or
  duplicated logic and create remediation tasks.

Derogations:

- Temporary deviations MUST include an inline `// DEVIATION:<principle #> reason + expiry` comment and an
  issue link. Expired derogations removed immediately.

Sunset / Retirement:

- If project scope evolves (e.g., adds React or build tooling), a Minor or Major bump introduces new
  constraints accompanied by migration notes appended as an addendum.

**Version**: 1.1.0 | **Ratified**: 2025-10-08 | **Last Amended**: 2025-10-08
