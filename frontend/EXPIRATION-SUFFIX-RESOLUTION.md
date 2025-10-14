# Expiration Suffix Resolution - Settings-Based Approach

## Overview
The processor now resolves expiration codes dynamically by looking up suffixes in the symbol configuration settings. This eliminates hardcoded mappings and allows flexible configuration per symbol.

## How It Works

### 1. Configuration Structure
Each symbol has expirations with configurable suffixes:

```javascript
{
  symbol: 'GGAL',
  prefix: 'GFG',
  expirations: {
    OCT: {
      suffixes: ['O', 'OC'],  // October can be O or OC in tokens
      decimals: 1,             // Expiration-level decimal override
      overrides: []            // Strike-specific overrides
    },
    DIC: {
      suffixes: ['D', 'DI'],  // December can be D or DI
      decimals: 0,
      overrides: []
    }
  }
}
```

### 2. Token Parsing Flow

**Example token**: `GFGV47343O`
- **Prefix**: `GFG` → Maps to GGAL symbol config
- **Type**: `V` → PUT
- **Strike**: `47343` → Raw strike value
- **Expiration**: `O` → Suffix to resolve

### 3. Suffix Resolution Logic

```javascript
// In process-operations.js
const findExpirationCodeBySuffix = (tokenSuffix, symbolConfig) => {
  // Check each expiration's suffixes array
  for (const [expirationCode, settings] of Object.entries(symbolConfig.expirations)) {
    if (settings?.suffixes?.includes(tokenSuffix)) {
      return expirationCode;  // Returns 'OCT' for suffix 'O'
    }
  }
  return tokenSuffix;  // No match, return original
};
```

**For token `GFGV47343O`**:
1. Extract suffix `O` from token
2. Look through GGAL expirations
3. Find `OCT` has `suffixes: ['O', 'OC']`
4. Match found! Use `OCT` expiration code
5. Apply `OCT` configuration: 1 decimal

**Result**: Strike `47343` → Formatted as `4734.3`

### 4. Decimal Resolution Priority

1. **Strike-specific override** (highest priority)
   - Check `expirations[OCT].overrides` for matching raw strike
   - Calculate decimals from `formatted` string

2. **Expiration-level default**
   - Use `expirations[OCT].decimals`

3. **Symbol-level default** (lowest priority)
   - Use `strikeDefaultDecimals` or `defaultDecimals`

## Benefits

✅ **No hardcoded mappings** - All configuration in settings
✅ **Flexible per symbol** - Each symbol can define its own suffixes
✅ **Multiple suffix support** - Same expiration can have multiple valid forms (O, OC, OCT)
✅ **User configurable** - Users can add/modify suffixes through settings UI

## Configuration Example

For GGAL with October expiration accepting both `O` and `OC`:

```javascript
// In localStorage: po:settings:GGAL
{
  "symbol": "GGAL",
  "prefix": "GFG",
  "defaultDecimals": 0,
  "strikeDefaultDecimals": 0,
  "expirations": {
    "OCT": {
      "suffixes": ["O", "OC"],
      "decimals": 1,
      "overrides": []
    }
  }
}
```

## Testing

Run the manual test:
```bash
cd frontend
node test-suffix-lookup.js
```

Expected output:
```
✅ SUCCESS: Strike correctly formatted as 4734.3 using October config (1 decimal)
✅ SUCCESS: OC suffix also works correctly
```

## Code References

- **Suffix resolution**: `findExpirationCodeBySuffix()` in `process-operations.js`
- **Expiration lookup**: `resolveExpirationCode()` in `process-operations.js`
- **Decimal resolution**: `resolveStrikeDecimals()` in `process-operations.js`
- **Settings type**: `ExpirationSetting` in `settings-types.js`
