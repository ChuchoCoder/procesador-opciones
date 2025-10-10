# Quickstart Guide

## Prerequisites

- Node.js 18+ (includes npm 9+)
- Git (for cloning repository)

## Setup

```cmd
cd C:\git\procesador-opciones
cd frontend
npm install
```

## Development Workflow

1. **Start the dev server** (Vite + React 18):

   ```cmd
   npm run dev
   ```

   - Access the SPA at `http://localhost:5173`.
   - The app runs entirely client-side; ensure CSV files reside locally for upload tests.

2. **Run unit/integration tests** (Vitest + React Testing Library):

   ```cmd
   npm test
   ```

   - Use `npm run test:watch` (to be added in package scripts) for TDD per Constitution Principle 3.

3. **Lint & type checks** (to be added):
   - Plan to introduce ESLint + TypeScript/JS type validations; integrate as part of future tooling tasks.

## Manual Verification Checklist

- Upload sample CSV ≤500 rows and confirm processing completes in <100ms.
- Toggle averaging mode and verify row consolidation updates instantly.
- Confirm CALLS/PUTS tables respect Spanish localization while downloads use en-US numeric formatting.
- Trigger large file warning (>25k rows) using synthetic CSV to confirm the banner displays.
- Validate configuration persistence by refreshing the page and observing saved state restoration.

## Troubleshooting

- **Blank screen or runtime errors**: Check browser console for `PO:` prefixed logs; ensure dev server running.
- **Clipboard copy blocked**: Confirm browser permissions allow clipboard writes (Chrome requires user gesture).
- **Localization issues**: Verify strings originate from `src/strings/es-AR.js` and not hardcoded inside components.
