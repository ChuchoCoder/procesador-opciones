## Data Model for Market Data WebSocket feature

Entities:

- Subscription
  - id: string (internal client id)
  - products: array of Instrument identifiers (marketId + symbol)
  - entries: array of EntryType ("OF","BI","LA",...)
  - depth: integer (>=1)
  - createdAt: ISO timestamp
  - updatedAt: ISO timestamp

- Instrument
  - marketId: string
  - symbol: string
  - instrumentId: { marketId, symbol } (composite key)

- MarketDataMessage
  - type: "Md"
  - instrumentId: { marketId, symbol }
  - marketData: object mapping EntryType -> array of levels
    - level item: { price: number, size: number, sequenceId?: string, timestamp?: ISO }
  - raw: original payload (for debugging)

- ClientState
  - connectionState: enum { disconnected, connecting, connected, error }
  - subscriptions: map(subscriptionId -> Subscription)
  - lastSeen: map[instrumentId][entry] -> { sequenceId?, snapshotHash?, timestamp }

Validation rules:

- `depth` must be >=1 and integer; UI should cap `depth` to a sensible limit (e.g., 5) to avoid high memory use.
- `entries` must be a non-empty array of supported entry symbols; unsupported entries are ignored for an instrument.

State transitions (high level):

- disconnected -> connecting: when connect() invoked and token available
- connecting -> connected: on WS open and successful handshake
- connected -> disconnected: on WS close/error; triggers reconnection attempts
- connected -> error: on unrecoverable failures (e.g., 401 unauthorized) — notify auth module
