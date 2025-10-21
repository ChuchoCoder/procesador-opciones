<!--
Sync Impact Report
Version change: 2.0.0 -> 3.0.0
Modified principles:
  - 2. Deterministic Processing & Idempotence: removed a mandatory test requirement and clarified guidance
  - 3. Test On Request: redefined from TDD-first mandate to flexible testing guidance (tests encouraged when requested or warranted)
Added sections: None
Removed sections: None
Templates requiring updates:
  - .specify/templates/plan-template.md ✅ updated
  - .specify/templates/spec-template.md ✅ updated
  - .specify/templates/tasks-template.md ✅ updated
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

Option processing logic SHOULD favour pure functions or be isolated behind a single side‑effect gateway
(DOM updates, storage). Given the same input text, processing SHOULD produce the same normalized output.
Design parsing and transforms to be testable without DOM where practical; prefer pure functions for core
parsing and transforms to increase predictability and simplify debugging.

### 3. Testing Guidance

Testing is encouraged and must be proportionate to risk and stakeholder needs. When stakeholders explicitly
request automated tests, include a clear test plan (unit, integration, or end-to-end) covering the happy path
and representative edge cases. When automated tests are not requested, the contributor MUST document the
manual validation steps performed and any relevant test data or scenarios used.
Rationale: Balances engineering effort with observable risk while ensuring changes are verifiable.

### 4. Simplicity Over Framework Accretion

No additional frameworks or build steps beyond what is strictly necessary (current stack: raw JS + manifest).
Before adding a dependency, a justification documenting: benefit, size, simpler alternative rejection. Remove
unused code and dependencies promptly. Rationale: Small artifact, low attack surface, easy audits.

### 5. Spanish (Argentina) User Interface Localization

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
2. Validation Plan: If automated tests are requested, include a test plan and any required test scaffolding; otherwise
  include clear manual validation steps in the PR description.
3. Implement: Keep functions <60 lines; extract early if complexity grows.
4. Review: PR description MUST list which principle(s) are touched and how validated.
5. Validate: Run automated tests if present; perform a manual smoke test (open popup / SPA) and confirm behavior
  described in the PR before merge.

Quality Gates:

- Lint passes (when linter added) and no TODO left untagged (Use `TODO(username): reason`).
- If automated tests are requested by the specification or reviewers, include them; otherwise ensure manual
  validation steps are documented in the PR description.
- Bundle / script size increase >10KB requires justification.
- No new global variables introduced (except explicitly in manifest scope).
Violation Handling:

- Minor (documentation omission): fix in same PR or follow-up within 24h.
- Major (missing required validation or missing rationale for deviating from principles): block merge until
  resolved.

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

**Version**: 3.0.0 | **Ratified**: 2025-10-08 | **Last Amended**: 2025-10-20
