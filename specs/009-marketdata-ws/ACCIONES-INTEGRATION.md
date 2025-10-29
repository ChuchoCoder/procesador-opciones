# Acciones Page Integration - REST API Polling

## Overview

The Acciones page has been successfully integrated with REST API polling for real-time market data. This document describes the implementation and how to use it.

## Implementation Summary

### Components Created

1. **`useAccionesMarketData.js`** - Custom React hook
   - Manages market data polling for stock instruments (CFI: ESXXXX)
   - Filters instruments from `InstrumentsWithDetails.json`
   - Handles connection state, errors, and data updates
   - Batches subscriptions to avoid overwhelming the API

2. **`AccionesPage.jsx`** - Updated page component
   - Displays real-time market data in a table
   - Shows: Symbol, Currency, Last Price, Bid, Offer, Volume, Status
   - Includes search functionality
   - Connects to broker authentication from config context

### Data Flow

```
Config Context (brokerAuth.token)
         ↓
  useAccionesMarketData Hook
         ↓
  MarketDataPollingClient
         ↓
  REST API (/marketdata/get)
         ↓
  Market Data Events
         ↓
  AccionesPage Table Display
```

## Usage

### Prerequisites

1. **Authentication Required**: User must be authenticated with broker
   - Token stored in config context: `state.brokerAuth.token`
   - Set via: `dispatch({ type: 'SET_BROKER_AUTH', payload: { token, expiry } })`

2. **Instruments Data**: `InstrumentsWithDetails.json` must be present
   - Loaded automatically by the hook
   - Filters for CFI code: `ESXXXX` (stocks)

### Basic Usage

The page works automatically when:
1. User is authenticated (has valid broker token)
2. Instruments data is available
3. Page is mounted/rendered

```jsx
// AccionesPage auto-connects when token available
import AccionesPage from './components/Acciones/AccionesPage';

// In your router
<Route path="/acciones" element={<AccionesPage />} />
```

### Authentication Setup

To enable market data on the Acciones page, set up broker authentication:

```javascript
import { useConfig } from './state/config-hooks';
import { login } from './services/broker/jsrofex-client';

function LoginComponent() {
  const { dispatch } = useConfig();
  
  const handleLogin = async (username, password) => {
    try {
      // Authenticate with broker
      const { token, expiry } = await login({ username, password });
      
      // Store in config context
      dispatch({
        type: 'SET_BROKER_AUTH',
        payload: { token, expiry }
      });
      
      // Now Acciones page will have access to token
    } catch (error) {
      console.error('Login failed:', error);
    }
  };
  
  return (
    <form onSubmit={handleLogin}>
      {/* Login form UI */}
    </form>
  );
}
```

## Hook API

### `useAccionesMarketData(options)`

#### Options

```typescript
{
  token: string;              // Required: Authentication token
  enabled: boolean;           // Default: true - Whether polling is active
  pollInterval: number;       // Default: 2000ms - Polling frequency
  entries: Array<string>;     // Default: ['LA', 'BI', 'OF'] - Data entries
  depth: number;              // Default: 1 - Order book depth
}
```

#### Returns

```typescript
{
  // State
  marketData: Object;         // { "ROFX::SYMBOL": { LA, BI, OF, ... } }
  instruments: Array;         // List of stock instruments
  isConnected: boolean;       // Connection status
  error: string | null;       // Error message if any
  
  // Computed
  instrumentCount: number;    // Total instruments
  dataCount: number;          // Instruments with data
  
  // Methods
  getInstrumentData(symbol, marketId): Object | null;
  getAllInstrumentsWithData(): Array<{instrument, data}>;
  setPollInterval(ms): void;
}
```

## Features

### Real-time Updates

- **Polling Interval**: 2 seconds (default)
- **Change Detection**: Only updates UI when data actually changes
- **Batch Subscriptions**: Subscribes to 50 instruments at a time
- **Progressive Loading**: Spreads subscriptions over time to reduce load

### Display Features

- ✅ Real-time price updates
- ✅ Bid/Offer with sizes
- ✅ Volume display
- ✅ Currency indicator (ARS/USD)
- ✅ Status indicator (Active/No data)
- ✅ Search/filter by symbol
- ✅ Connection status
- ✅ Error handling and display

### UI Elements

1. **Status Bar**
   - Connection indicator (Connected/Disconnected)
   - Instrument counts
   - Search box

2. **Market Data Table**
   - Symbol column
   - Currency badge
   - Last price (bold, primary color)
   - Bid (green) with size
   - Offer (red) with size
   - Volume
   - Status chip

3. **Empty States**
   - No authentication warning
   - Loading spinner
   - Error alerts
   - No results from search

## Stock Instruments

### Filtered Criteria

Only instruments with **CFI Code = ESXXXX** are included:
- ES = Equity (stock)
- XXXX = Additional classification

### Current Stock Count

The hook automatically loads all stock instruments from `InstrumentsWithDetails.json`. Typical count: **288 instruments**.

### Symbol Format

Stock symbols vary in format:
- `MERV - XMEV - A3 - 24hs`
- `MERV - XMEV - AAPL - CI`
- etc.

## Performance Considerations

### API Load

- **Default Polling**: 2000ms (2 seconds)
- **Batch Size**: 50 instruments per subscription
- **Batch Delay**: 1 second between batches
- **Total Initial Load**: ~6 seconds for 288 instruments (6 batches)

### Bandwidth

- **Per Instrument**: ~200-500 bytes per poll
- **288 Instruments**: ~140KB per poll (2 seconds)
- **Per Minute**: ~4.2MB (acceptable)

### Optimization Options

1. **Increase poll interval** for less frequent updates:
   ```javascript
   pollInterval: 5000 // 5 seconds
   ```

2. **Reduce entries** to fetch less data:
   ```javascript
   entries: ['LA'] // Only last price
   ```

3. **Filter instruments** before subscribing (custom hook modification)

## Error Handling

### Connection Errors

- Displayed in Alert component
- Automatically retries on next poll
- Does not interrupt existing data display

### Individual Instrument Errors

- Logged to console
- Does not trigger error alert
- Instrument shows "Sin datos" status

### Authentication Errors

- Token expiry detected automatically
- User sees "No authentication" warning
- Must re-authenticate to resume

## Testing

### Manual Testing Steps

1. **Without Authentication**:
   - Navigate to `/acciones`
   - Should see warning: "No authentication available"
   - No API calls made

2. **With Authentication**:
   - Log in with broker credentials
   - Navigate to `/acciones`
   - Should see "Conectado" status
   - Table populates progressively as subscriptions complete
   - Data updates every 2 seconds (if market active)

3. **Search Functionality**:
   - Type symbol name in search box
   - Table filters in real-time
   - Shows "No results" if no match

4. **Connection States**:
   - Initial: Loading spinner
   - Connected: Green "Conectado" chip
   - Error: Red alert with message

## Future Enhancements

Potential improvements for Phase 3+:

- [ ] Sorting by column (price, volume, etc.)
- [ ] Pagination/virtualization for large lists
- [ ] Price change indicators (up/down arrows)
- [ ] Color coding for price movements
- [ ] Favorite/watchlist functionality
- [ ] Export to CSV
- [ ] Chart integration (price history)
- [ ] WebSocket upgrade when authentication available
- [ ] Real-time sparklines
- [ ] Alerts/notifications on price changes

## Related Files

- **Hook**: `frontend/src/hooks/useAccionesMarketData.js`
- **Page**: `frontend/src/components/Acciones/AccionesPage.jsx`
- **Polling Client**: `frontend/src/services/broker/market-data-polling.js`
- **Auth Context**: `frontend/src/state/config-context.jsx`
- **Instruments**: `frontend/InstrumentsWithDetails.json`

## Troubleshooting

### No Data Appearing

1. **Check authentication**: Is `brokerAuth.token` set in config?
2. **Check console**: Are there API errors logged?
3. **Check network**: Are requests to `/rest/marketdata/get` succeeding?
4. **Check symbols**: Are the instrument symbols valid for the API?

### Slow Loading

1. **Market closed**: No data updates when market is closed
2. **API rate limits**: Consider increasing poll interval
3. **Network latency**: Check connection speed

### High CPU/Memory Usage

1. **Too many instruments**: Consider filtering to fewer instruments
2. **Fast polling**: Increase `pollInterval` to reduce frequency
3. **Browser performance**: Close other tabs, use hardware acceleration

## Conclusion

The Acciones page is now fully integrated with REST API polling for real-time market data. The implementation provides a solid foundation for Phase 2 and can be easily upgraded to WebSocket when authentication is resolved.

**Status**: ✅ **Ready for use** - Requires broker authentication to function.
