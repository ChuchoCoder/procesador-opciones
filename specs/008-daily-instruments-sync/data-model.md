# data-model.md — Daily Instruments Sync

## Entities

1. InstrumentDetails
   - instrumentId: { marketId: string, symbol: string }
   - securityDescription: string
   - cficode: string
   - segment: { marketSegmentId: string, marketId: string }
   - lowLimitPrice: number
   - highLimitPrice: number
   - minPriceIncrement: number
   - tickPriceRanges: object
   - maturityDate: string (normalized to YYYY-MM-DD)
   - currency: string
   - orderTypes: string[]
   - timesInForce: string[]
   - instrumentPricePrecision: number
   - instrumentSizePrecision: number
   - contractMultiplier: number
   - roundLot: number
   - incomplete?: boolean
   - issues?: string[]

2. LocalStorageRecord (stored under key `instrumentsWithDetails` or sharded parts)
   - fetchedAt: ISO8601 timestamp
   - source: 'broker-api' | 'fallback-file'
   - versionHash: string (sha1 of canonical JSON)
   - instruments: InstrumentDetails[]
   - issuesSummary?: { countIncomplete: number, duplicatesRemoved: number }

3. Sharded storage representation
   - instrumentsWithDetails.meta -> { fetchedAt, source, versionHash, parts: n }
   - instrumentsWithDetails.part.<i> -> string (base64 or JSON fragment)
   - recomposition reads meta then concatenates parts in numeric order and validates versionHash

## Keys & Deduplication

- Deduplication key: `${instrument.instrumentId.marketId}|${instrument.instrumentId.symbol}`
- Keep last-seen record when duplicates found (last definition in API payload wins).

## Normalization rules

- `maturityDate`: accept incoming formats `YYYYMMDD` or `YYYY-MM-DD` and normalize to `YYYY-MM-DD` when saving. If missing or unparsable, set `incomplete: true` and add an issue entry: `maturityDate: missing`.
- Numeric values must be stored as numbers; if null or missing, set field to null and mark `incomplete: true`.

## Versioning & Integrity

- `versionHash`: compute SHA-1 of the canonical instruments array (sorted by dedup key and serialized with stable JSON) and store in meta for quick equality checks.
- On read, if recomposition fails or `versionHash` mismatches expected, trigger a fresh fetch (unless within retry window).

## Error modes

- Storage quota exceeded: write using sharded parts and metadata. If sharding fails, fall back to `frontend/InstrumentsWithDetails.json` and log diagnostic info.
- Fetch failure due to auth: do not attempt re-fetch unless session can be refreshed. Use fallback-file and log error at diagnostic level.
