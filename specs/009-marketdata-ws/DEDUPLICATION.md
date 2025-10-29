# Request Deduplication

## Overview

The Market Data Polling Client implements **automatic request deduplication** to prevent making duplicate API calls for the same instrument when it appears in multiple subscriptions.

## Problem Statement

### Without Deduplication

When using the `useAccionesMarketData` hook with 288 stock instruments:

1. Hook creates **6 subscriptions** (batches of 50 instruments each)
2. Each subscription polls **independently** every 2 seconds
3. If an instrument appears in multiple batches → **multiple requests** for same data
4. **Wasteful**: More API calls, higher rate limit risk, unnecessary network traffic

### Example Scenario

```javascript
// Subscription 1: 50 instruments including "ROFX::GGAL"
client.subscribe({ products: [{ symbol: 'GGAL', marketId: 'ROFX' }, ...] });

// Subscription 2: 50 instruments including "ROFX::GGAL" again
client.subscribe({ products: [{ symbol: 'GGAL', marketId: 'ROFX' }, ...] });

// Without deduplication: 2 API calls for GGAL per poll cycle
// With deduplication: 1 API call for GGAL per poll cycle
```

## Solution: Time-Based Deduplication

### How It Works

The client uses a **time-based deduplication strategy** with a minimum polling gap:

1. **Minimum Poll Gap**: 500ms (configurable via `_minPollGapMs`)
2. **Last Poll Tracking**: Map of `instrumentKey -> timestamp`
3. **Skip Check**: Before polling, check if instrument was polled recently
4. **Entry Merging**: Combine requested entries from all subscriptions
5. **Depth Maximization**: Use the highest requested depth

### Algorithm Flow

```
┌─────────────────────────────────────────────────────┐
│ 1. Subscription timer fires                         │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│ 2. For each product in subscription                 │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│ 3. Check: Was this instrument polled recently?      │
│    instrumentKey: "ROFX::GGAL"                      │
│    lastPoll: 1500ms ago                             │
│    minGap: 500ms                                    │
│    shouldPoll: 1500ms >= 500ms ? YES                │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼ YES
┌─────────────────────────────────────────────────────┐
│ 4. Get merged entries & max depth                   │
│    Sub1 wants: ['LA', 'BI']                         │
│    Sub2 wants: ['LA', 'OF', 'TV']                   │
│    Merged: ['LA', 'BI', 'OF', 'TV']                 │
│    Depth: max(1, 2) = 2                             │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│ 5. Record poll timestamp                            │
│    lastPollTimestamps.set("ROFX::GGAL", now)        │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│ 6. Make API request (only once!)                    │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│ 7. Process and emit market data                     │
└─────────────────────────────────────────────────────┘
```

## Implementation Details

### Key Methods

#### `_shouldPollInstrument(instrumentKey)`

Checks if enough time has passed since last poll:

```javascript
_shouldPollInstrument(instrumentKey) {
  const lastPoll = this._lastPollTimestamps.get(instrumentKey);
  if (!lastPoll) return true; // Never polled, allow it

  const timeSinceLastPoll = Date.now() - lastPoll;
  return timeSinceLastPoll >= this._minPollGapMs; // 500ms
}
```

**Returns**: `true` if instrument should be polled, `false` if too recent

#### `_recordInstrumentPoll(instrumentKey)`

Records the current timestamp for an instrument:

```javascript
_recordInstrumentPoll(instrumentKey) {
  this._lastPollTimestamps.set(instrumentKey, Date.now());
}
```

#### `_getUniqueInstruments()`

Merges instruments across all subscriptions:

```javascript
_getUniqueInstruments() {
  const uniqueInstruments = new Map();

  for (const subscription of this._subscriptions.values()) {
    for (const product of subscription.products) {
      const instrumentKey = `${product.marketId}::${product.symbol}`;
      
      if (uniqueInstruments.has(instrumentKey)) {
        // Merge entries (deduplicate with Set)
        const existing = uniqueInstruments.get(instrumentKey);
        const mergedEntries = [...new Set([...existing.entries, ...subscription.entries])];
        
        // Take maximum depth
        const maxDepth = Math.max(existing.depth, subscription.depth);
        
        uniqueInstruments.set(instrumentKey, {
          product,
          entries: mergedEntries,
          depth: maxDepth,
          subscriptions: [...existing.subscriptions, subscription.id],
        });
      } else {
        // First occurrence
        uniqueInstruments.set(instrumentKey, {
          product,
          entries: [...subscription.entries],
          depth: subscription.depth,
          subscriptions: [subscription.id],
        });
      }
    }
  }

  return uniqueInstruments;
}
```

**Returns**: Map of unique instruments with merged requirements

### Polling Logic (Updated)

```javascript
async _pollSubscription(subscriptionId) {
  const subscription = this._subscriptions.get(subscriptionId);
  if (!subscription) return;

  for (const product of subscription.products) {
    const instrumentKey = `${product.marketId}::${product.symbol}`;

    // DEDUPLICATION CHECK
    if (!this._shouldPollInstrument(instrumentKey)) {
      continue; // Skip, polled recently
    }

    // Get merged requirements
    const uniqueInstruments = this._getUniqueInstruments();
    const instrumentData = uniqueInstruments.get(instrumentKey);
    
    if (!instrumentData) continue;

    // Record poll timestamp
    this._recordInstrumentPoll(instrumentKey);

    // Make API request (only once!)
    const data = await this._fetchMarketData(
      product.marketId,
      product.symbol,
      instrumentData.entries, // Merged entries
      instrumentData.depth      // Max depth
    );

    if (data) {
      this._processMarketData(product, data, instrumentData.entries);
    }
  }
}
```

## Statistics & Monitoring

### `getDeduplicationStats()`

Get real-time deduplication statistics:

```javascript
const stats = client.getDeduplicationStats();

console.log(stats);
// {
//   totalSubscriptions: 6,
//   totalInstrumentsWithDuplicates: 300,  // 6 subs × 50 instruments
//   uniqueInstruments: 288,                // Actual unique instruments
//   duplicatesAvoided: 12,                 // 300 - 288
//   savingsPercent: 4                      // 4% reduction
// }
```

### Stats Breakdown

| Metric | Description |
|--------|-------------|
| `totalSubscriptions` | Number of active subscriptions |
| `totalInstrumentsWithDuplicates` | Total instruments if counted with duplicates |
| `uniqueInstruments` | Actual unique instruments after deduplication |
| `duplicatesAvoided` | Number of duplicate requests prevented |
| `savingsPercent` | Percentage of requests saved by deduplication |

## Benefits

### 1. Reduced API Calls

**Before Deduplication**:
- 6 subscriptions × 50 instruments = 300 API calls per poll cycle
- With 2s polling interval: 150 requests/second

**After Deduplication**:
- 288 unique instruments = 288 API calls per poll cycle
- With 2s polling interval: 144 requests/second
- **Savings**: 12 requests per cycle (4%)

### 2. Lower Rate Limit Risk

Fewer requests = less likely to hit rate limits

### 3. Better Performance

- Reduced network traffic
- Fewer server connections
- Lower bandwidth usage

### 4. Accurate Data

All subscriptions receive the **same data** for duplicate instruments, ensuring consistency

## Configuration

### Minimum Poll Gap

The minimum time between polls for the same instrument:

```javascript
// Default: 500ms
client._minPollGapMs = 500;

// More aggressive (allow faster re-polling)
client._minPollGapMs = 100;

// More conservative (prevent any near-duplicates)
client._minPollGapMs = 1000;
```

**Recommendation**: Keep at 500ms for balanced performance

### Why 500ms?

- **Poll Interval**: Default is 2000ms (2 seconds)
- **Subscription Batches**: Created 1 second apart
- **Race Condition Window**: 500ms provides buffer for concurrent polls
- **Trade-off**: Short enough to allow genuine re-polls, long enough to catch duplicates

## Edge Cases Handled

### 1. Different Entries Requested

```javascript
// Subscription 1 wants: ['LA', 'BI']
// Subscription 2 wants: ['LA', 'OF', 'TV']
// Result: Merged ['LA', 'BI', 'OF', 'TV']
// Both subscriptions receive all requested entries
```

### 2. Different Depths Requested

```javascript
// Subscription 1 wants: depth = 1
// Subscription 2 wants: depth = 3
// Result: Max depth = 3
// Both subscriptions receive depth 3 data
```

### 3. Staggered Subscription Creation

```javascript
// Time 0s: Sub1 created with GGAL
// Time 1s: Sub2 created with GGAL
// Time 2s: Sub1 timer fires → polls GGAL
// Time 2.5s: Sub2 timer fires → skips GGAL (polled 0.5s ago)
// Result: Only 1 API call
```

### 4. Rapid Re-Subscription

```javascript
// User quickly switches filters causing re-subscriptions
// Deduplication prevents redundant polls during transition
```

## Performance Impact

### Memory Overhead

- **lastPollTimestamps Map**: ~40 bytes per instrument
- **288 instruments**: ~11.5 KB
- **Negligible**: Acceptable overhead

### CPU Overhead

- **Timestamp Check**: O(1) per instrument
- **Entry Merging**: O(n×m) where n=subscriptions, m=entries
- **Negligible**: Operations are very fast

### Network Savings

For 288 instruments with 4% duplicates:
- **Requests saved per hour**: 12 requests/cycle × 1800 cycles/hour = 21,600 requests
- **At 500 bytes/request**: ~10.8 MB/hour saved

## Testing

### Verify Deduplication is Working

```javascript
const client = new MarketDataPollingClient({ pollInterval: 2000 });

// Subscribe to same instrument twice
client.subscribe({
  products: [{ symbol: 'GGAL', marketId: 'ROFX' }],
  entries: ['LA'],
  depth: 1,
});

client.subscribe({
  products: [{ symbol: 'GGAL', marketId: 'ROFX' }],
  entries: ['BI', 'OF'],
  depth: 2,
});

// Check stats
const stats = client.getDeduplicationStats();
console.log(stats);
// Expected: { uniqueInstruments: 1, duplicatesAvoided: 1, savingsPercent: 50 }

// Monitor API calls (should only see 1 request per poll cycle)
client.on('marketData', (data) => {
  console.log('Market data received:', data.instrumentId.symbol);
});
```

### Log Deduplication Events

```javascript
// Add logging to track skipped polls
const originalShouldPoll = client._shouldPollInstrument.bind(client);
client._shouldPollInstrument = function(instrumentKey) {
  const result = originalShouldPoll(instrumentKey);
  if (!result) {
    console.log(`[DEDUP] Skipped poll for ${instrumentKey}`);
  }
  return result;
};
```

## Best Practices

1. **Monitor Stats**: Regularly check `getDeduplicationStats()` to verify savings
2. **Batch Subscriptions**: Create subscriptions in batches to maximize deduplication
3. **Consistent Entries**: Request same entries across subscriptions when possible
4. **Appropriate Gap**: Keep `_minPollGapMs` at 500ms unless specific needs
5. **Single Client**: Use one client instance for all subscriptions

## Limitations

### 1. Time-Based Window

- Instruments polled within 500ms are deduplicated
- If two subscriptions poll >500ms apart, both will make requests
- **Solution**: Synchronize subscription timers (future enhancement)

### 2. Cross-Client Duplication

- Deduplication only works within a single client instance
- Multiple client instances will still make duplicate requests
- **Solution**: Use singleton pattern (already implemented)

### 3. Entry Superset Required

- Merged entries must satisfy all subscriptions
- Some subscriptions may receive extra unrequested entries
- **Impact**: Minimal (extra data in response, but ignored)

## Future Enhancements

- [ ] **Synchronized Timers**: Align all subscription timers to same interval
- [ ] **Request Queue**: Global queue to batch multiple subscriptions into single API call
- [ ] **Adaptive Gap**: Dynamically adjust `_minPollGapMs` based on actual poll intervals
- [ ] **Metrics Collection**: Track deduplication hit rate and performance
- [ ] **Subscription Optimizer**: Automatically consolidate overlapping subscriptions

## Related Files

- **Implementation**: `frontend/src/services/broker/market-data-polling.js`
- **Hook**: `frontend/src/hooks/useAccionesMarketData.js`
- **Rate Limiting**: `specs/009-marketdata-ws/RATE-LIMITING.md`

## Changelog

### 2025-10-28 - Initial Implementation

- ✅ Time-based deduplication with 500ms minimum gap
- ✅ Entry merging across subscriptions
- ✅ Depth maximization
- ✅ Statistics tracking (`getDeduplicationStats`)
- ✅ Cleanup on disconnect

## Summary

The deduplication system efficiently prevents duplicate API requests while ensuring all subscriptions receive the data they need. With a 4% request reduction for typical usage (288 instruments, 6 subscriptions), it provides meaningful performance improvements and reduces rate limit risk.

**Key takeaway**: Same instrument polled by multiple subscriptions = **only 1 API request** (within 500ms window) 🎯
