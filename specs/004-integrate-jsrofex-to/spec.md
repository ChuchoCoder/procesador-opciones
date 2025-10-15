# Feature Specification: Integrate jsRofex for Automatic Broker Operations Retrieval (while keeping CSV upload)

**Feature Branch**: `004-integrate-jsrofex-to`  
**Created**: 2025-10-15  
**Status**: Draft  
**Input**: User description: "Integrate jsRofex into the web application so I can retrieve the operations automatically just by logging into my broker. We should still support loading the operations using an external CSV file as we do now"

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.
  
  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - Automatic Operations Sync After Broker Login (Priority: P1)

After logging into their broker account within the application, a user triggers an automatic retrieval of their latest operations (trades) without needing to export or manually prepare a file.

**Why this priority**: Eliminates manual CSV preparation, reducing friction and data entry errors. Provides immediate up-to-date trading data, enabling core processing flows faster.

**Independent Test**: Can be fully tested by performing a broker login with valid credentials and verifying that operations appear automatically in the processor without manual file upload.

**Acceptance Scenarios**:

1. **Given** a user with valid broker credentials and no operations loaded, **When** they log in successfully, **Then** the system retrieves and displays all available operations for the configured date range.
2. **Given** a user already has operations synced earlier today, **When** they log in again or trigger a manual refresh, **Then** only new operations since last sync are added (no duplicates).
3. **Given** a user logs in but the broker API returns an authentication error, **When** the sync is attempted, **Then** the user sees a clear message explaining login failed and no operations are changed.
4. **Given** network instability during retrieval, **When** the request fails mid-way, **Then** the user sees a retry option and partial data is not committed.

---

### User Story 2 - Manual CSV Upload Still Supported (Priority: P2)

User can continue to upload a local CSV file of operations if they prefer or if broker integration is unavailable.

**Why this priority**: Preserves existing workflow and provides fallback when automatic integration encounters issues or for users without broker access.

**Independent Test**: Can be fully tested by uploading a sample CSV and verifying operations load identically to current system behavior alongside broker-synced operations (without duplicates when same trades appear).

**Acceptance Scenarios**:

1. **Given** a user has not logged into broker, **When** they upload a valid CSV, **Then** operations load successfully as before.
2. **Given** a user has already synced operations via broker, **When** they upload a CSV containing overlapping operations, **Then** duplicates are prevented and only new operations are added.
3. **Given** an invalid CSV format, **When** the user uploads it, **Then** a clear validation error message appears and no changes are applied.
4. **Given** the user prefers manual only, **When** they dismiss or ignore broker login, **Then** they can still process operations normally via CSV.

---

### User Story 3 - Manual Refresh & Sync Status Visibility (Priority: P3)

User can manually trigger a "Refresh operations" action and view last sync timestamp, source (Broker vs CSV), and count of operations imported.

**Why this priority**: Improves transparency and control; users can ensure they work with current data and understand data provenance.

**Independent Test**: Can be fully tested by initiating a refresh and verifying status metadata updates without requiring implementation of other stories besides minimal retrieval logic.

**Acceptance Scenarios**:

1. **Given** the user previously synced operations, **When** they click Refresh, **Then** new operations are retrieved and last sync timestamp updates.
2. **Given** there are no new broker operations, **When** user refreshes, **Then** system confirms "No new operations" and timestamp updates without duplicates.
3. **Given** a previous sync failed due to network, **When** user refreshes after connectivity returns, **Then** operations load and failure indicator is cleared.
4. **Given** both CSV and broker sources have contributed data, **When** user views sync status, **Then** they see counts per source.

---

[Add more user stories as needed, each with an assigned priority]

### Edge Cases

- Broker returns zero operations for a valid logged-in user (empty dataset) – should show an informative "No operations found" state without error.
- Duplicate detection when the same trade appears in both broker retrieval and a later CSV upload.
- Partial failure: Some pages of operations retrieved before timeout – must roll back or re-fetch to avoid partial/inconsistent state.
- Broker session expires mid-sync – prompt re-authentication without losing already loaded operations.
- User switches broker accounts – previous operations from the prior broker are cleared (except any operations originally imported via CSV) per chosen behavior.
- Very large number of operations (e.g., >10,000) – ensure pagination or batch retrieval to avoid freezing UI.
- CSV upload after an automatic sync that already loaded those operations – verify idempotency.
- Clock skew: Operation timestamps slightly differ between broker API and CSV; matching logic should tolerate minor differences (e.g., seconds). 
- User cancels a manual refresh in progress – ensure no partial commit.
- Retrieval while existing local unsaved edits (if future editing allowed) – ensure no overwrite of draft modifications.
- Token expiry during an in-progress sync – sync aborts gracefully and prompts re-auth.

## Requirements *(mandatory)*

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
-->

### Functional Requirements

- **FR-001**: System MUST allow a user to log in to their broker account through an in-app flow to enable automatic operations retrieval.
- **FR-002**: System MUST automatically retrieve the user's latest operations immediately after successful broker login.
- **FR-003**: System MUST prevent duplicate operations when importing from broker and CSV (matching by composite trade identity: symbol, type, strike, expiration, quantity, price, timestamp tolerance).
- **FR-004**: System MUST provide a manual "Refresh operations" action to re-sync new broker operations on demand.
- **FR-005**: System MUST continue supporting CSV upload workflow unchanged for users preferring manual input.
- **FR-006**: System MUST display sync status including last sync timestamp, number of operations imported, and source breakdown (Broker vs CSV).
- **FR-007**: System MUST handle broker authentication failures with a clear, user-friendly message and no data modification.
- **FR-008**: System MUST ensure retrieval is atomic: either all targeted operations for the request are applied or none (no partial commit on failure).
- **FR-009**: System MUST support large operation sets (assume up to 20,000 operations) without UI lock, providing progressive feedback if retrieval exceeds 2 seconds.
- **FR-010**: System MUST allow the user to switch broker accounts; upon successful login to a different broker, all previously retrieved broker-origin operations are cleared while CSV-imported operations remain.
- **FR-011**: System MUST log retrieval outcomes (success/failure counts) for audit and troubleshooting (non-technical user phrasing: maintain an internal record of sync activity).
- **FR-012**: System MUST allow re-upload of CSV after broker sync without generating duplicates.
- **FR-013**: System MUST match operations across sources even if timestamps differ by up to a tolerance of 1 second.
- **FR-014**: System MUST provide a visible indicator when a sync is in progress and allow user cancellation.
- **FR-015**: System MUST inform the user when no new operations are available during refresh.
- **FR-016**: System MUST store only an expiring session token post-login and never persist raw broker credentials locally; token refresh must occur silently until expiry.
- **FR-017**: System MUST rely on broker-side rate limiting (no internal throttle) and present a clear message with suggested wait time when broker returns a rate limit response.
- **FR-018**: System MUST group operations by broker order_id; multiple operation_id values under the same order_id represent sequential revisions merged into a single Order with revision history.
- **FR-019**: System MUST automatically retry a failed broker sync up to 3 times with incremental short delays (e.g., 2s, 5s, 10s) before presenting a failure message and manual retry option.

*Clarification markers limited to critical scope decisions.*

### Functional Requirements Acceptance Criteria

| ID | Acceptance Criteria (User-Facing Validation) |
|----|----------------------------------------------|
| FR-001 | User can enter broker credentials and receive success confirmation; failed attempt shows clear error without data change. |
| FR-002 | After login, operations list populates automatically without manual action within target performance window. |
| FR-003 | Importing same operations via both broker sync and CSV does not increase total unique operations count (verified by sample overlapping dataset). |
| FR-004 | Clicking Refresh retrieves only new operations; if none, a "No new operations" message appears. |
| FR-005 | CSV upload continues to function even if broker never logged in; existing CSV tests still pass. |
| FR-006 | Status panel shows last sync time, total imported in last action, and counts per source (Broker/CSV). |
| FR-007 | Invalid credentials or expired session yields explanatory message and zero new operations added. |
| FR-008 | Forced network interruption mid-retrieval results in no partial additions (operation count unchanged). |
| FR-009 | Retrieval of a stress dataset (~20k ops) maintains interactive UI (no freeze) and displays progress or spinner. |
| FR-010 | Switching to a different broker account removes previous broker-sourced operations while CSV-sourced items remain visible. |
| FR-011 | Each sync attempt creates an internal record accessible for audit (e.g., through a log view or export in future). |
| FR-012 | Re-uploading a CSV containing already imported operations does not create duplicates (unique count unchanged). |
| FR-013 | Operations from both sources within 1 second timestamp difference merge as single entry; difference >1s treated as distinct. |
| FR-014 | During sync a visible in-progress indicator appears; cancel action stops retrieval and no partial data is added. |
| FR-015 | User sees a "No new operations" notice when refresh finds zero additions. |
| FR-016 | After login, only a session token is retained; inspection shows no stored raw credentials; token expiry triggers re-auth prompt without data loss. |
| FR-017 | Rapid consecutive refresh causing broker rate limit response shows a message with recommended retry time; system does not block manual attempts unless broker rejects again. |
| FR-018 | Multiple rows with same order_id but distinct operation_id produce one logical Order with correct revision count; re-import of identical revision leaves count unchanged. |
| FR-019 | Simulated transient failures trigger up to 3 automatic retries (timings logged); persistent failure displays final error and a Retry button; successful retry aborts remaining attempts. |

### Key Entities *(include if feature involves data)*

- **Operation**: Represents a single trade/transaction. Attributes (conceptual): symbol, underlying, optionType (call/put), action (buy/sell), quantity, price, tradeTimestamp, strike, expirationDate, source (Broker | CSV), sourceReferenceId, importTimestamp.
- **SyncSession**: Represents a retrieval attempt. Attributes: sessionId, startTime, endTime, status (success | failed | canceled | partial-rolled-back), operationsImportedCount, source (Broker), message.
- **BrokerAccount**: Represents authenticated broker context. Attributes: accountId, displayName, lastLoginTimestamp, status (active | expired), operationsLastSyncTimestamp.
- **DuplicateResolution** (conceptual process entity, not necessarily persisted): Keeps track of matching criteria applied between retrieved and existing operations.
- **Order**: Logical grouping of revisions sharing order_id. Attributes: order_id, revisions[] (each tied to operation_id), creationTimestamp (earliest revision), latestTimestamp (latest revision), aggregateQuantity, latestPrice, status (from latest revision), source (Broker). CSV entries without order_id do not form Orders.

## Success Criteria *(mandatory)*

<!--
  ACTION REQUIRED: Define measurable success criteria.
  These must be technology-agnostic and measurable.
-->

### Measurable Outcomes

- **SC-001**: Users can complete broker login and see their operations populated in under 30 seconds for up to 5,000 operations.
- **SC-002**: Duplicate rate after mixed broker + CSV imports remains below 0.5% in validation audits (goal: effectively zero duplicates).
- **SC-003**: 90% of users who attempt broker login successfully retrieve operations without requiring CSV fallback on first attempt.
- **SC-004**: Manual CSV uploads decrease by at least 40% among users who previously performed weekly uploads (indicating adoption of automatic sync).
- **SC-005**: Refresh action returns "No new operations" or new operations list in under 10 seconds for up to 20,000 existing operations.
- **SC-006**: User-reported data mismatch issues between broker and CSV sources reduced by 60% post feature release.
- **SC-007**: Sync failure with meaningful message visible within 2 seconds of error detection (authentication or network).

## Assumptions

- Broker integration via jsRofex provides necessary endpoints to authenticate and list recent operations (trades) for the logged-in account.
- Timestamp tolerance for duplicate matching is exactly 1 second (user defined).
- Large dataset upper bound assumed at 20,000 operations for performance criteria.
- On broker account switch, previously retrieved broker operations are cleared while CSV-imported operations persist.
- Initial automatic retrieval scope is limited to today's operations (current trading day) by default; extended history can be fetched via future enhancements or manual actions.
- Network failures are transient; user can retry manually.
- Only an expiring session token is stored post-login; raw credentials are never persisted.
- Only an expiring session token is stored post-login; raw credentials are never persisted.
- Refresh attempts are not locally throttled; broker responses govern effective rate limiting.
- Uniqueness hierarchy: Prefer (order_id + operation_id); fallback to composite identity when order_id absent (for CSV).
- Transient failure handling: Up to 3 auto-retries (2s,5s,10s) then surface failure.

## Clarifications Resolved

1. Broker account switch behavior: Clear previously retrieved broker operations; retain CSV operations.
2. Timestamp duplicate matching tolerance: 1 second.
3. Default automatic retrieval window: Today only (current trading day).
4. Credential handling/storage: Store only an expiring session token (no raw credentials), refresh silently while valid.

## Clarifications

### Session 2025-10-15

- Q: Broker Credentials Handling & Storage → A: Store only expiring session token (Option C)
- Q: Rate Limiting & Refresh Throttle → A: No enforced limit; rely on broker errors (Option D)
- Q: Operation Uniqueness Key → A: Use order_id + operation_id; fallback composite when no order_id.
- Q: Reliability Fallback → A: Auto-retry 3 times (Option A)

## Success Criteria Traceability

| Requirement | Related Success Criteria |
|-------------|--------------------------|
| FR-001, FR-002 | SC-001, SC-003 |
| FR-003, FR-012, FR-013 | SC-002, SC-006 |
| FR-004, FR-015 | SC-005 |
| FR-007, FR-014 | SC-007 |
| FR-010 | SC-006 (data consistency) |
| FR-009 | SC-005 |
| FR-016 | SC-007 (security feedback on failure) |
| FR-017 | SC-005 (refresh responsiveness) |
| FR-018 | SC-002 (duplicate control), SC-006 (data consistency) |
| FR-019 | SC-007 (failure handling responsiveness) |

| FR-016 | SC-007 (security feedback on failure) |

