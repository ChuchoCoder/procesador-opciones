# Research Summary

## Bundler Selection (Vite vs webpack)

- **Decision**: Adopt Vite 5.x (ESBuild-powered dev server + Rollup build) as the SPA bundler.
- **Rationale**: Vite provides sub-second dev server start, fast HMR needed for iterative UI work, and produces optimized Rollup builds with code splitting. It natively supports React, integrates easily with Material UI and papaparse, and keeps configuration lightweight—aligning with Constitution Principle 5 (Simplicity) while enabling offline-first output.
- **Alternatives considered**: webpack 5 (feature-rich but slower DX and more boilerplate), Parcel (zero-config but less mature ecosystem for fine-grained control), Create React App (deprecated, lacks modern build optimizations).

## React Testing Stack (Jest + RTL vs Vitest)

- **Decision**: Use Vitest with React Testing Library and @testing-library/user-event for unit/integration tests.
- **Rationale**: Vitest shares configuration with Vite, providing faster in-memory execution and minimal setup while supporting ES modules and JSX out of the box. Testing Library enforces user-centric tests and pairs with existing CSV logic unit tests. This combination reduces duplicate config (Principle 5) and supports DOM + pure function tests (Principle 2 & 3).
- **Alternatives considered**: Jest (mature but requires extra config to mirror Vite, slower run times), Cypress (good for end-to-end but heavier for unit scope), Playwright (similar to Cypress, kept for future E2E needs).
