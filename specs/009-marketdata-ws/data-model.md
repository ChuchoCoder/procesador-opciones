# data-model.md

Entities

- Subscription
  - id: string (internal subscription identifier)
  - products: array of ProductIdentifier
  - entries: array of strings (e.g., ["OF","BI","LA"]) — must be subset of supported entries
  - depth: integer >=1
  - status: enum [active, pending, failed, inactive]

- ProductIdentifier
  - marketId: string (e.g., "ROFX")
  - symbol: string (e.g., "DLR/DIC23")

- MarketDataMessage (incoming `Md`)
  - type: "Md"
  - instrumentId: ProductIdentifier
  - marketData: object with keys equal to entries (OF, BI, etc.) and values arrays of payload objects
  - sequenceId?: integer|string (optional but prefer numeric)
  - timestamp?: ISO8601 string or epoch millis

- NormalizedMarketDataEvent (internal consumer shape)
  - instrumentId: ProductIdentifier
  - entry: string
  - levels: array of { price: number, size: number }
  - sequenceId?: integer
  - receivedAt: epoch millis

Validation rules

- `depth` must be positive integer. Clients should cap requested depth at a safe maximum (e.g., 10) to avoid heavy payloads.
- `entries` must be a non-empty array of known entry codes. Unknown entries should be ignored silently (logged).
- `products` must include at least one valid product object (marketId + symbol). Invalid products should be rejected by the subscribe API with a clear error.

State transitions

- Subscription: pending -> active when server acknowledges or first message received; active -> inactive on connection loss after retries; active -> failed on repeated subscribe errors.

Events

- connection: { status: connected|disconnected|reconnecting, reason? }
- md:update: NormalizedMarketDataEvent
- subscription: { id, status, details }
