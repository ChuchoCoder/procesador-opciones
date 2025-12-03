# quickstart.md — How to run and validate locally

1. During development, open the extension in Chrome using `Load unpacked` pointing to the repository root or `extension-dist` build output.
2. Ensure you have a valid Broker API session in the extension (login flow used by the app). Verify `BrokerSession.isAuthenticated === true` in the console.
3. Manual sync: open popup and use the "Actualizar instrumentos" action (UI label to be added in Spanish). Confirm in DevTools Application -> Local Storage (`localStorage.instrumentsWithDetails`) and in `chrome.storage.local` (use `chrome.storage.local.get` in console) that the record exists and `fetchedAt` is an ISO timestamp.
4. Simulate failure: invalidate session or block network request to `GET https://BASE_URL/rest/instruments/details` and reload popup; confirm code falls back to `frontend/InstrumentsWithDetails.json` and a diagnostic console log is emitted.
5. Observability: logs will be prefixed with `PO:instruments-sync` and include `{ phase, step, message }` for easy filtering.

Dev notes:
- To test alarm-based scheduling, open `chrome://extensions/` -> Service worker for the extension and use the `Inspect views` to trigger/observe the alarm handler. Alternatively, call the sync handler manually from the background context for integration tests.
