# Rate Limiting Implementation

## Overview

The Market Data Polling Client now includes comprehensive rate limiting logic to gracefully handle API rate limits and prevent overwhelming the server with too many requests.

## Features

### 1. Proactive Rate Limiting

**Request Throttling**: Limits the number of requests per second to prevent hitting API limits.

- Default: **10 requests per second**
- Configurable via `maxRequestsPerSecond` option
- Tracks request timestamps in a sliding window
- Automatically throttles requests when approaching limit

### 2. Reactive Rate Limiting

**429 Response Handling**: Detects and responds to rate limit errors from the API.

- Detects HTTP 429 (Too Many Requests) status codes
- Respects `Retry-After` header if provided by the server
- Falls back to exponential backoff if no `Retry-After` header

### 3. Exponential Backoff

**Progressive Retry Delays**: Increases backoff time on repeated rate limits.

- Initial backoff: **5 seconds** (configurable)
- Backoff multiplier: **2x** (configurable)
- Maximum backoff: **60 seconds** (configurable)
- Resets to initial value after successful resume

### 4. Automatic Recovery

**Seamless Resumption**: Automatically resumes polling after backoff period.

- Pauses all active subscriptions during rate limit
- Resumes automatically after backoff expires
- Emits connection events for UI feedback
- No manual intervention required

## Configuration

### Constructor Options

```javascript
const client = new MarketDataPollingClient({
  // Rate limiting configuration
  maxRequestsPerSecond: 10,           // Max requests per second (default: 10)
  rateLimitBackoffMs: 5000,           // Initial backoff delay (default: 5s)
  rateLimitMaxBackoffMs: 60000,       // Maximum backoff delay (default: 60s)
  rateLimitBackoffMultiplier: 2,      // Backoff multiplier (default: 2)
  
  // Other options
  pollInterval: 2000,                 // Polling interval (default: 2s)
  maxDepth: 5,                        // Max order book depth (default: 5)
});
```

### Configuration Recommendations

#### Conservative (Avoid Rate Limits)
```javascript
{
  maxRequestsPerSecond: 5,            // Lower request rate
  rateLimitBackoffMs: 10000,          // Longer initial backoff
  pollInterval: 3000,                 // Slower polling
}
```

#### Aggressive (Fast Updates)
```javascript
{
  maxRequestsPerSecond: 20,           // Higher request rate
  rateLimitBackoffMs: 2000,           // Shorter initial backoff
  pollInterval: 1000,                 // Faster polling
}
```

#### Balanced (Default)
```javascript
{
  maxRequestsPerSecond: 10,
  rateLimitBackoffMs: 5000,
  pollInterval: 2000,
}
```

## How It Works

### Request Flow

```
┌─────────────────────────────────────────────────────┐
│ 1. Subscription triggers poll                       │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│ 2. Check if rate limited                            │
│    - If yes: Skip request, return null              │
│    - If no: Continue                                │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│ 3. Check request rate (sliding window)              │
│    - Count requests in last 1 second                │
│    - If >= maxRequestsPerSecond: Wait 100ms, retry  │
│    - If < maxRequestsPerSecond: Continue            │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│ 4. Record request timestamp                         │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│ 5. Make API request                                 │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│ 6. Check response status                            │
│    - 429: Handle rate limit                         │
│    - 401/403: Auth error                            │
│    - 200: Process data                              │
│    - Other: Error                                   │
└─────────────────────────────────────────────────────┘
```

### Rate Limit Response Flow

```
┌─────────────────────────────────────────────────────┐
│ 1. Receive 429 response                             │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│ 2. Set rate limited flag                            │
│    _isRateLimited = true                            │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│ 3. Calculate backoff delay                          │
│    - Use Retry-After header if available            │
│    - Otherwise use current backoff value            │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│ 4. Emit error event for UI notification             │
│    type: 'RATE_LIMIT'                               │
│    message: "Rate limit exceeded. Retrying in Xs"   │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│ 5. Pause all active polling                         │
│    - Clear all poll timers                          │
│    - Keep subscriptions in memory                   │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│ 6. Schedule retry timer                             │
│    setTimeout(backoffMs)                            │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│ 7. Increase backoff for next time                   │
│    backoff *= multiplier (capped at max)            │
└─────────────────┬───────────────────────────────────┘
                  │
                  │ (Wait backoffMs)
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│ 8. Timer expires                                    │
│    - Clear rate limited flag                        │
│    - Reset backoff to initial value                 │
│    - Emit connection resumed event                  │
│    - Restart all subscriptions                      │
└─────────────────────────────────────────────────────┘
```

## Events

### Rate Limit Error Event

When a rate limit is detected, an error event is emitted:

```javascript
client.on('error', (error) => {
  if (error.type === 'RATE_LIMIT') {
    console.log(error.message); 
    // "Rate limit exceeded. Retrying in 5 seconds"
    
    console.log(error.backoffMs); 
    // 5000
  }
});
```

### Connection Events

Connection events are emitted during rate limit lifecycle:

```javascript
client.on('connection', (event) => {
  if (event.msg.includes('Rate limit cleared')) {
    console.log('Polling resumed after rate limit');
  }
});
```

## UI Integration

### AccionesPage Example

The Acciones page automatically displays rate limit warnings:

```jsx
{error && (
  <Alert 
    severity={error.includes('Rate limit') ? 'warning' : 'error'} 
    sx={{ mb: 3 }}
  >
    {error.includes('Rate limit') && '⏱️ '}
    {error}
  </Alert>
)}
```

**User sees**: 
> ⏱️ Rate limit exceeded. Retrying in 5 seconds

### Custom Hook Integration

The `useAccionesMarketData` hook passes error messages to the UI:

```javascript
const { error } = useAccionesMarketData({ token, enabled: true });

// error will contain rate limit messages automatically
```

## Testing

### Simulate Rate Limit

To test rate limiting behavior:

1. **Lower the rate limit threshold**:
   ```javascript
   const client = new MarketDataPollingClient({
     maxRequestsPerSecond: 1, // Very low limit
     pollInterval: 100,       // Fast polling
   });
   ```

2. **Subscribe to many instruments**:
   ```javascript
   client.subscribe({
     products: Array(100).fill({ symbol: 'TEST', marketId: 'ROFX' }),
     entries: ['LA'],
     depth: 1,
   });
   ```

3. **Observe events**:
   ```javascript
   client.on('error', (err) => {
     if (err.type === 'RATE_LIMIT') {
       console.log('Rate limit hit!', err);
     }
   });
   ```

### Mock 429 Response

For unit tests, mock the fetch response:

```javascript
global.fetch = vi.fn().mockResolvedValue({
  status: 429,
  ok: false,
  headers: new Map([['Retry-After', '10']]),
});
```

## Performance Considerations

### Request Rate vs. Poll Interval

With default settings:
- **Poll Interval**: 2000ms (2 seconds)
- **Max Requests/Second**: 10
- **Max Instruments**: ~20 per subscription (with polling)

If subscribing to **288 instruments** (Acciones page):
- **Requests per poll**: 288 requests
- **Time to complete**: ~29 seconds (288 / 10 req/s)
- **Effective update rate**: ~29 seconds per instrument

### Optimization Strategies

1. **Increase maxRequestsPerSecond** (if API allows):
   ```javascript
   maxRequestsPerSecond: 20  // Halves completion time
   ```

2. **Reduce poll interval** (after requests complete):
   ```javascript
   pollInterval: 30000  // Poll every 30s instead of 2s
   ```

3. **Batch subscriptions** (already implemented in hook):
   ```javascript
   // Subscribe in batches with delays
   for (let i = 0; i < instruments.length; i += 50) {
     await new Promise(resolve => setTimeout(resolve, 1000));
     client.subscribe({ products: instruments.slice(i, i + 50) });
   }
   ```

4. **Filter instruments** (reduce total count):
   ```javascript
   // Only subscribe to active instruments
   const active = instruments.filter(inst => inst.isActive);
   ```

## Troubleshooting

### Issue: Frequent Rate Limits

**Symptoms**: Repeated rate limit warnings

**Solutions**:
1. Decrease `maxRequestsPerSecond`
2. Increase `pollInterval`
3. Reduce number of subscribed instruments
4. Increase batch delays in subscription logic

### Issue: Slow Data Updates

**Symptoms**: Data not updating frequently enough

**Solutions**:
1. Increase `maxRequestsPerSecond` (if API allows)
2. Decrease `pollInterval`
3. Prioritize important instruments (subscribe selectively)

### Issue: Long Backoff Times

**Symptoms**: Polling paused for extended periods

**Solutions**:
1. Reduce `rateLimitMaxBackoffMs`
2. Reduce `rateLimitBackoffMultiplier`
3. Investigate why rate limits are being hit repeatedly
4. Check API rate limit documentation

## Best Practices

1. **Start Conservative**: Use default settings first, then optimize
2. **Monitor Events**: Log rate limit events to understand patterns
3. **Batch Intelligently**: Spread subscriptions over time
4. **Filter Instruments**: Only subscribe to necessary data
5. **Respect Retry-After**: Always honor server's Retry-After header
6. **Test Thoroughly**: Simulate rate limits in development
7. **Handle Gracefully**: Show clear UI messages to users
8. **Log Diagnostics**: Track rate limit frequency and patterns

## API Rate Limits

### Primary/Cocos API

The actual rate limits for the Primary API are:
- **Documentation**: Check official API docs for current limits
- **Headers**: Look for `X-RateLimit-*` headers in responses
- **Typical**: 100-1000 requests per minute (varies by endpoint)

### Recommended Settings by Instrument Count

| Instruments | maxRequestsPerSecond | pollInterval | Notes |
|------------|---------------------|--------------|-------|
| 1-10       | 10 (default)        | 2000ms       | Fast updates |
| 11-50      | 10                  | 3000ms       | Balanced |
| 51-100     | 10                  | 5000ms       | Conservative |
| 101-200    | 15                  | 10000ms      | Slow updates |
| 201+       | 20                  | 30000ms      | Minimal updates |

## Related Files

- **Implementation**: `frontend/src/services/broker/market-data-polling.js`
- **Hook**: `frontend/src/hooks/useAccionesMarketData.js`
- **UI**: `frontend/src/components/Acciones/AccionesPage.jsx`
- **Tests**: `frontend/tests/unit/market-data-polling.spec.js`
- **Integration Tests**: `frontend/tests/integration/broker-marketdata-polling.spec.js`

## Changelog

### 2025-10-28 - Initial Implementation

- ✅ Request throttling (sliding window)
- ✅ 429 status code detection
- ✅ Exponential backoff
- ✅ Retry-After header support
- ✅ Automatic recovery
- ✅ Event emission for UI feedback
- ✅ Cleanup on disconnect
- ✅ UI integration (warning display)

## Future Enhancements

- [ ] Adaptive rate limiting (learn from API responses)
- [ ] Per-endpoint rate limits (different limits for different API calls)
- [ ] Request prioritization (important instruments first)
- [ ] Circuit breaker pattern (stop requests after repeated failures)
- [ ] Metrics collection (track rate limit frequency, backoff times)
- [ ] Burst allowance (allow temporary bursts within limits)
- [ ] Token bucket algorithm (more sophisticated rate limiting)
