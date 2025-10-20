# Research — Mejorar la visualización del arbitraje de plazos

Date: 2025-10-20

## Summary of decisions

- Decision: Implement UI changes entirely in the existing `frontend/` app using React components and the existing table component. Rationale: project already uses React + MUI; reusing component patterns preserves accessibility patterns and minimizes additional work. Alternatives considered: introduce a new table library (rejected due to weight and learning cost).

- Decision: Provide manual/QA scripts in `specs/*/quickstart.md` for verification; e2e tooling (Cypress/Playwright) can be considered later if needed.

- Decision: Do NOT add CSV export this iteration. Rationale: spec explicitly forbids CSV in this release.

- Decision: Lazy-load operations data per expanded row using existing frontend service endpoints. Cache per-row data in-memory (React state or a session-level cache object) and invalidate on page reload. Rationale: minimizes network and memory use while meeting FR-010.c.

## Open questions resolved (NEEDS CLARIFICATION -> resolved)

- Implementation notes for calculation logic location: consider placing pure mapping functions near the UI code that consumes them (e.g., `frontend/src/app` or `frontend/src/services`) to keep mapping and transformation logic discoverable.

- Require E2E tests for navigation and state preservation? → Deferred: provide manual/qa scripts in `specs/*/quickstart.md`. E2E tooling can be proposed in a follow-up if the team decides broader automation is required.

## Implementation considerations

- Accessibility: reuse ARIA patterns from existing table component. Ensure expand/collapse is keyboard reachable and preserves focus.
- Caching: implement a simple Map keyed by instrument id in a React context or module-level singleton. Expose clear() on page unload.
- Error handling: show loading spinner in expanded row; on error show contextual message and a retry button which re-fetches and updates cache.

## Alternatives considered

- Use server-side aggregation to precompute per-instrument breakdowns: rejected to avoid backend coordination and to meet the assumption of no backend schema changes.

## Rationale summary

Reusing existing frontend stack (React + Vite + MUI) minimizes risk and preserves accessibility patterns. Lazy-loading and session-only caching meet performance and UX goals without persistent storage changes.
