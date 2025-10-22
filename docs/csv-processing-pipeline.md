# CSV Processing Pipeline Documentation

## Overview

This document describes the complete flow of processing a CSV file containing options operations until the CALLS and PUTS are displayed in the UI. The pipeline is orchestrated by `processOperations` and involves multiple specialized components for parsing, validation, enrichment, consolidation, and display.

---

## Pipeline Architecture

The pipeline follows a multi-stage architecture:

1. **Configuration Loading** - Load symbol configurations and prefix mappings
2. **CSV Parsing** - Parse raw CSV file into structured rows
3. **Row Normalization** - Map diverse column names to standard format
4. **Validation & Filtering** - Filter valid execution reports and validate data
5. **Token Parsing & Enrichment** - Extract and enrich operation metadata from symbols
6. **Fee Enrichment** - Calculate trading fees and commissions
7. **Consolidation** - Aggregate operations with averaging logic
8. **Group Discovery** - Organize operations by symbol and expiration
9. **Report Building** - Construct final report with multiple views
10. **UI Display** - Render interactive tables with filtering

---

## Component Details

### 1. Configuration Loading (`loadPrefixMap`)

**Location:** `frontend/src/services/csv/process-operations.js`

**Purpose:** Loads all symbol configurations from storage and creates a mapping from option prefixes to symbol configurations.

**Process:**
- Retrieves all symbol identifiers from storage (e.g., "GGAL", "YPFD", "COME")
- For each symbol, loads its full configuration including:
  - `symbol`: The underlying symbol (e.g., "GGAL")
  - `prefixes`: Array of option prefixes (e.g., ["GFG", "GFGC", "GFGV"])
  - `defaultDecimals`: Default decimal places for strikes (e.g., 2)
  - `expirations`: Map of expiration codes to settings

**Example Configuration:**
```javascript
{
  "GGAL": {
    symbol: "GGAL",
    prefixes: ["GFG", "GFGC", "GFGV"],
    defaultDecimals: 2,
    expirations: {
      "OCT": {
        suffixes: ["O", "OC"],
        decimals: 1,
        overrides: [
          { raw: "47343", formatted: "4734.3" }
        ]
      },
      "DIC": {
        suffixes: ["D", "DI"],
        decimals: 1,
        overrides: []
      }
    }
  }
}
```

**Result:** Returns a `prefixMap` object where keys are uppercase prefixes and values are SymbolConfig objects:
```javascript
{
  "GFG": { symbol: "GGAL", ... },
  "GFGC": { symbol: "GGAL", ... },
  "GFGV": { symbol: "GGAL", ... },
  "YPF": { symbol: "YPFD", ... }
}
```

---

### 2. CSV Parsing (`parseOperationsCsv`)

**Location:** `frontend/src/services/csv/parser.js`

**Purpose:** Parses CSV file content into structured JavaScript objects using PapaParse library.

**Features:**
- **Delimiter Detection:** Automatically detects delimiter (comma, semicolon, or tab)
- **Header Extraction:** Uses first row as column headers
- **Dynamic Typing:** Automatically converts numeric columns (`quantity`, `price`, `strike`)
- **Empty Row Filtering:** Removes empty rows
- **Error Handling:** Collects parsing errors and warnings
- **Large File Handling:** 
  - Warning threshold: 25,000 rows
  - Maximum rows: 50,000 rows

**Process:**
1. Normalize input (handle File, Blob, or string)
2. Configure PapaParse with:
   - `header: true` - First row as headers
   - `skipEmptyLines: 'greedy'` - Remove empty rows
   - `dynamicTyping` - Auto-convert numbers
   - `transformHeader` - Trim whitespace
3. Parse CSV and collect rows
4. Return `{ rows: [...], meta: { rowCount, errors, ... } }`

**Example Input CSV:**
```csv
Symbolo,Numero de Orden,Lado,Precio,Cantidad,Estado
GFGC47343O,12345,BUY,5.25,100,ejecutada
YPFV60000DI,12346,SELL,3.75,50,ejecutada
```

**Example Output:**
```javascript
{
  rows: [
    { 
      Symbolo: "GFGC47343O", 
      "Numero de Orden": "12345",
      Lado: "BUY",
      Precio: 5.25,
      Cantidad: 100,
      Estado: "ejecutada"
    },
    { ... }
  ],
  meta: {
    rowCount: 2,
    errors: [],
    warningThresholdExceeded: false
  }
}
```

---

### 3. Row Normalization (`normalizeOperationRows`)

**Location:** `frontend/src/services/csv/legacy-normalizer.js`

**Purpose:** Maps diverse CSV column names (Spanish/English variants) to a standardized internal format.

**Column Mappings:**

| Standard Name | CSV Variants |
|--------------|--------------|
| `order_id` | "Numero de Orden", "order_id", "Number", "id" |
| `symbol` | "Symbolo", "Simbolo", "Symbol", "symbol" |
| `side` | "Lado", "Side", "side" |
| `option_type` | "option_type", "optionType", "tipo" |
| `strike` | "strike", "Strike", "Base" |
| `quantity` | "Cantidad", "Quantity", "quantity" |
| `price` | "Precio", "Price", "price" |
| `status` | "Estado", "Status", "status" |
| `expiration` | "Vencimiento", "expiration", "expire_date" |

**Side Normalization:**
- "COMPRA", "compra", "C" → "BUY"
- "VENTA", "venta", "V" → "SELL"
- "BUY", "SELL" → unchanged

**Example Transformation:**
```javascript
// Input (Spanish CSV)
{
  "Symbolo": "GFGC47343O",
  "Numero de Orden": "12345",
  "Lado": "COMPRA",
  "Precio": "5,25",
  "Cantidad": "100"
}

// Output (Normalized)
{
  order_id: "12345",
  symbol: "GFGC47343O",
  side: "BUY",
  price: 5.25,
  quantity: 100
}
```

---

### 4. Validation & Filtering (`validateAndFilterRows`)

**Location:** `frontend/src/services/csv/validators.js`

**Purpose:** Filters rows to include only valid, executed operations and validates data integrity.

#### Status Filtering

Only rows with execution status are included:

**Status Normalization Map:**
```javascript
{
  "ejecutada": "fully_executed",
  "ejecutada.": "fully_executed",
  "filled": "fully_executed",
  "FILLED": "fully_executed",
  "parcialmente ejecutada": "partially_executed",
  "partial_fill": "partially_executed"
}
```

**Allowed Statuses:** `fully_executed`, `partially_executed`

#### Event Type Filtering

Only `execution_report` events are included:
- Excludes order updates (`order_update`)
- Excludes cancellations
- Focuses on actual fills

#### Field Validation

**Required Fields:**
- `order_id`: Must exist
- `side`: Must be "BUY" or "SELL"
- `quantity`: Must be positive number
- `price`: Must be positive number

**Optional Validations:**
- `option_type`: If present, must be "CALL" or "PUT"
- `strike`: If present, must be valid number
- `exec_type`: If present, must be "F" (Fill)

#### Exclusion Tracking

The validator tracks exclusion reasons:
```javascript
{
  exclusions: {
    missingRequiredField: 3,
    invalidEventType: 5,
    invalidStatus: 2,
    invalidSide: 0,
    invalidOptionType: 1,
    invalidStrike: 0,
    invalidQuantity: 0,
    invalidPrice: 0
  }
}
```

**Example:**
```javascript
// Input
[
  { order_id: "123", side: "BUY", quantity: 100, price: 5.25, status: "ejecutada", event_type: "execution_report" }, // ✓ Valid
  { order_id: "124", side: "BUY", quantity: 50, price: 3.0, status: "cancelled" }, // ✗ Invalid status
  { order_id: "125", side: "BUY", quantity: 75, price: 4.5, event_type: "order_update" } // ✗ Invalid event type
]

// Output
{
  rows: [
    { order_id: "123", side: "BUY", quantity: 100, price: 5.25 }
  ],
  exclusions: {
    invalidStatus: 1,
    invalidEventType: 1,
    ...
  }
}
```

---

### 5. Token Parsing & Enrichment

This is the most complex stage, involving symbol detection, prefix matching, expiration resolution, and strike formatting.

#### 5.1 Token Parsing (`parseToken`)

**Location:** `frontend/src/services/csv/process-operations.js`

**Purpose:** Extracts structured metadata from option token strings using regex pattern matching.

**Token Regex Pattern:**
```javascript
/^([A-Z0-9]+?)([CV])(\d+(?:\.\d+)?)(.*)$/
```

**Pattern Breakdown:**
- `([A-Z0-9]+?)` - **Prefix/Symbol** (non-greedy) - e.g., "GFG", "YPF"
- `([CV])` - **Type Code** - C=CALL, V=PUT
- `(\d+(?:\.\d+)?)` - **Strike Token** - numeric value (may have decimal)
- `(.*)` - **Remainder** - expiration suffix and other info

**Token Parsing Examples:**

| Token | Symbol | Type | Strike Token | Expiration |
|-------|--------|------|--------------|------------|
| `GFGC47343O` | GFG | CALL | 47343 | O |
| `YPFV60000DI` | YPF | PUT | 60000 | DI |
| `COMC1500JUN` | COM | CALL | 1500 | JUN |
| `PAMC850.5O` | PAM | CALL | 850.5 | O |

**Code Example:**
```javascript
const token = "GFGC47343O";
const match = token.match(/^([A-Z0-9]+?)([CV])(\d+(?:\.\d+)?)(.*)$/);

// match result:
// [0]: "GFGC47343O" (full match)
// [1]: "GFG" (symbol prefix)
// [2]: "C" (type code)
// [3]: "47343" (strike token)
// [4]: "O" (remainder/expiration)

const parsed = {
  symbol: "GFG",
  type: "CALL",
  strike: 47343,
  strikeToken: "47343",
  expiration: "O"
};
```

#### 5.2 Prefix Matching

**Purpose:** Match the extracted prefix against configured symbols to determine the underlying instrument.

**Process:**
1. Extract prefix from token (e.g., "GFG")
2. Lookup prefix in `prefixMap`
3. Retrieve SymbolConfig for matched symbol

**Example:**
```javascript
// Token: "GFGC47343O"
// Extracted prefix: "GFG"

// Lookup in prefixMap
const symbolConfig = prefixMap["GFG"];

// Result:
{
  symbol: "GGAL",
  prefixes: ["GFG", "GFGC", "GFGV"],
  defaultDecimals: 2,
  expirations: { ... }
}

// Matched symbol: "GGAL" (Grupo Financiero Galicia)
```

**Common Prefix Mappings:**

| Prefix | Symbol | Description |
|--------|--------|-------------|
| GFG | GGAL | Grupo Financiero Galicia |
| YPF | YPFD | YPF |
| COM | COME | Comercio |
| PAM | PAMP | Pampa Energía |
| ALU | ALUA | Aluar |
| BYM | BYMA | BYMA |

#### 5.3 Expiration Detection & Resolution

**Location:** `resolveExpirationCode` in `process-operations.js`

**Purpose:** Determine the expiration cycle from token suffix using configuration-based suffix matching.

**Process:**

1. **Extract Suffix from Token:**
   ```javascript
   // Token: "GFGC47343O"
   // Parsed expiration: "O"
   ```

2. **Check Against Configuration:**
   ```javascript
   // SymbolConfig for GGAL
   expirations: {
     "OCT": {
       suffixes: ["O", "OC", "OCT"],
       decimals: 1,
       overrides: [...]
     },
     "DIC": {
       suffixes: ["D", "DI", "DIC"],
       decimals: 1,
       overrides: [...]
     }
   }
   ```

3. **Match Suffix:**
   - Search each expiration's `suffixes` array
   - Find first match for "O"
   - Result: "OCT" (October expiration)

**Expiration Suffix Examples:**

| Suffix | Matches | Expiration Code |
|--------|---------|-----------------|
| O, OC | "O" or "OC" | OCT (Octubre) |
| D, DI | "D" or "DI" | DIC (Diciembre) |
| F, FE | "F" or "FE" | FEB (Febrero) |
| AB, ABR | "AB" or "ABR" | ABR (Abril) |
| JN, JUN | "JN" or "JUN" | JUN (Junio) |
| AG, AGO | "AG" or "AGO" | AGO (Agosto) |

**Code Example:**
```javascript
function findExpirationCodeBySuffix(tokenSuffix, symbolConfig) {
  const upper = tokenSuffix.toUpperCase(); // "O"
  
  for (const [expirationCode, settings] of Object.entries(symbolConfig.expirations)) {
    if (settings.suffixes.includes(upper)) {
      return expirationCode; // Returns "OCT"
    }
  }
  
  return upper; // No match found
}
```

#### 5.4 Strike Decimal Resolution

**Location:** `resolveStrikeDecimals` in `process-operations.js`

**Purpose:** Determine the number of decimal places to use when formatting a strike value based on a hierarchical configuration system.

**Decimal Resolution Hierarchy:**

```
1. Symbol-level default (lowest priority)
   ↓
2. Expiration-level override
   ↓
3. Strike-specific override (highest priority)
```

**Process:**

**Step 1: Start with Symbol-level Default**
```javascript
const symbolConfig = prefixMap["GFG"]; // GGAL config
let decimals = symbolConfig.defaultDecimals; // e.g., 2
```

**Step 2: Check Expiration-level Override**
```javascript
const expirationCode = "OCT";
const expirationConfig = symbolConfig.expirations[expirationCode];

if (expirationConfig && expirationConfig.decimals !== undefined) {
  decimals = expirationConfig.decimals; // e.g., 1
}
```

**Step 3: Check Strike-specific Override**
```javascript
const strikeToken = "47343";

if (expirationConfig && expirationConfig.overrides) {
  const override = expirationConfig.overrides.find(o => o.raw === strikeToken);
  
  if (override && override.formatted) {
    // Calculate decimals from formatted string
    // "4734.3" has 1 decimal place
    const decimalIndex = override.formatted.indexOf('.');
    if (decimalIndex >= 0) {
      decimals = override.formatted.length - decimalIndex - 1;
    } else {
      decimals = 0;
    }
  }
}
```

**Complete Example:**

```javascript
// Configuration
const config = {
  symbol: "GGAL",
  defaultDecimals: 2, // ← Symbol-level default
  expirations: {
    "OCT": {
      suffixes: ["O", "OC"],
      decimals: 1, // ← Expiration-level override
      overrides: [
        { raw: "47343", formatted: "4734.3" }, // ← Strike-specific override (1 decimal)
        { raw: "50000", formatted: "500.00" }  // ← Strike-specific override (2 decimals)
      ]
    }
  }
};

// Resolution examples:
// Strike "47343" in OCT → 1 decimal (from override)
// Strike "45000" in OCT → 1 decimal (from expiration)
// Strike "45000" in DIC → 2 decimals (from symbol default)
```

**Practical Scenarios:**

| Token | Symbol Decimal | Expiration Decimal | Override | Final Decimals | Reason |
|-------|----------------|-------------------|----------|----------------|--------|
| GFGC47343O | 2 | 1 | "4734.3" (1) | **1** | Strike override |
| GFGC50000O | 2 | 1 | "500.00" (2) | **2** | Strike override |
| GFGC45000O | 2 | 1 | - | **1** | Expiration level |
| GFGC60000DI | 2 | - | - | **2** | Symbol default |

#### 5.5 Strike Formatting

**Location:** `formatStrikeTokenValue` in `process-operations.js`

**Purpose:** Convert a raw numeric strike token into a properly formatted strike value with the configured decimal places.

**Algorithm:**

```javascript
function formatStrikeTokenValue(strikeToken, decimals) {
  // Example: strikeToken = "47343", decimals = 1
  
  // 1. Extract digits only
  const digits = strikeToken.replace(/[^0-9]/g, ""); // "47343"
  
  // 2. Handle zero decimals case
  if (decimals <= 0) {
    return parseFloat(digits); // 47343
  }
  
  // 3. Pad to ensure enough digits
  const padded = digits.padStart(decimals + 1, '0');
  // "47343".padStart(2, '0') = "47343" (already long enough)
  
  // 4. Split into whole and decimal parts
  const whole = padded.slice(0, -decimals) || '0';
  // "47343".slice(0, -1) = "4734"
  
  const decimal = padded.slice(-decimals);
  // "47343".slice(-1) = "3"
  
  // 5. Compose final value
  const composed = `${whole}.${decimal}`; // "4734.3"
  
  return parseFloat(composed); // 4734.3
}
```

**Formatting Examples:**

| Strike Token | Decimals | Padded | Whole Part | Decimal Part | Result |
|--------------|----------|--------|------------|--------------|--------|
| "47343" | 1 | "47343" | "4734" | "3" | **4734.3** |
| "60000" | 2 | "60000" | "600" | "00" | **600.00** |
| "12345" | 3 | "12345" | "12" | "345" | **12.345** |
| "500" | 2 | "500" | "5" | "00" | **5.00** |
| "99" | 2 | "099" | "0" | "99" | **0.99** |
| "5" | 1 | "05" | "0" | "5" | **0.5** |
| "1234" | 0 | "1234" | - | - | **1234** |

**Edge Cases:**

```javascript
// Short token with high decimals
formatStrikeTokenValue("5", 3)
// Padded: "0005"
// Result: 0.005

// Already has decimal point (cleaned first)
formatStrikeTokenValue("47.343", 1)
// Digits: "47343"
// Result: 4734.3

// Non-numeric characters removed
formatStrikeTokenValue("4_734_3", 1)
// Digits: "47343"
// Result: 4734.3
```

**Integration with Configuration:**

```javascript
// Complete flow for token "GFGC47343O"
const tokenMatch = parseToken("GFGC47343O");
// { symbol: "GFG", strike: 47343, strikeToken: "47343", expiration: "O" }

const symbolConfig = prefixMap["GFG"];
const expirationCode = resolveExpirationCode(tokenMatch, null, symbolConfig);
// "OCT"

const decimals = resolveStrikeDecimals({
  symbolConfig,
  strikeToken: "47343",
  expirationCode: "OCT"
});
// 1 (from expiration or override)

const formattedStrike = formatStrikeTokenValue("47343", decimals);
// 4734.3
```

---

### 6. Fee Enrichment (`enrichOperationsWithFees`)

**Location:** `frontend/src/services/fees/fee-enrichment.js`

**Purpose:** Calculate trading fees and commissions for each operation based on instrument type and configured fee rates.

**Process:**

1. **Get Instrument Details:**
   ```javascript
   const instrumentDetails = getInstrumentDetails(operation.symbol);
   // Returns: { cfiCode, priceConversionFactor, contractMultiplier }
   ```

2. **Determine Category:**
   ```javascript
   const category = instrumentDetails.cfiCode?.startsWith('OC') ? 'options' : 'bonds';
   ```

3. **Calculate Gross Notional:**
   ```javascript
   const multiplier = instrumentDetails.contractMultiplier || 1;
   const grossNotional = operation.quantity * operation.price * multiplier;
   ```

4. **Apply Fee Rates:**
   ```javascript
   const feeConfig = configuration.fees || {};
   const commissionPct = feeConfig.broker || 0.005; // 0.5%
   const rightsPct = feeConfig.exchange || 0.001; // 0.1%
   const vatPct = 0.21; // 21%
   
   const commissionAmount = grossNotional * commissionPct;
   const rightsAmount = grossNotional * rightsPct;
   const vatAmount = (commissionAmount + rightsAmount) * vatPct;
   const totalFeeAmount = commissionAmount + rightsAmount + vatAmount;
   ```

**Example Fee Calculation:**

```javascript
// Operation
{
  symbol: "GGAL",
  quantity: 100,
  price: 5.25,
  side: "BUY"
}

// Instrument Details
{
  cfiCode: "OCXXXX", // Option
  priceConversionFactor: 1,
  contractMultiplier: 100
}

// Calculations
grossNotional = 100 × 5.25 × 100 = 52,500
commissionAmount = 52,500 × 0.005 = 262.50
rightsAmount = 52,500 × 0.001 = 52.50
vatAmount = (262.50 + 52.50) × 0.21 = 66.15
totalFeeAmount = 262.50 + 52.50 + 66.15 = 381.15

// Result
{
  ...operation,
  grossNotional: 52500,
  feeAmount: 381.15,
  feeBreakdown: {
    commissionPct: 0.005,
    commissionAmount: 262.50,
    rightsPct: 0.001,
    rightsAmount: 52.50,
    vatPct: 0.21,
    vatAmount: 66.15
  }
}
```

---

### 7. Consolidation (`buildConsolidatedViews`)

**Location:** `frontend/src/services/csv/consolidator.js`

**Purpose:** Aggregate operations to create two views: RAW (individual orders) and AVERAGED (aggregated by strike).

#### View Types

**RAW View (`useAveraging=false`):**
- Groups by: `orderId + symbol + optionType`
- Keeps individual orders separate
- Shows each order's VWAP across multiple fills
- Use case: Detailed trading analysis

**AVERAGED View (`useAveraging=true`):**
- Groups by: `symbol + optionType + strike`
- Aggregates all fills for same strike
- Calculates weighted average price across all orders
- Use case: Portfolio position view

#### Consolidation Algorithm

**Grouping Logic:**
```javascript
function getGroupKey(operation, useAveraging) {
  const symbol = operation.matchedSymbol || operation.originalSymbol;
  
  if (useAveraging) {
    return `${symbol}::${operation.optionType}::${operation.strike}::averaged`;
  } else {
    return `${operation.orderId}::${symbol}::${operation.optionType}`;
  }
}
```

**Aggregation:**
```javascript
// For each group:
const signedQuantity = (side === 'BUY' ? 1 : -1) * quantity;

group.netQuantity += signedQuantity;
group.weightedSum += signedQuantity * price;
```

**VWAP Calculation:**
```javascript
const averagePrice = group.weightedSum / group.netQuantity;
```

**Fee Aggregation:**
```javascript
const totalGrossNotional = legs.reduce((sum, leg) => sum + leg.grossNotional, 0);
const totalFeeAmount = legs.reduce((sum, leg) => sum + leg.feeAmount, 0);
```

#### Example: RAW View

```javascript
// Input Operations
[
  { orderId: "123", symbol: "GGAL", optionType: "CALL", strike: 4734.3, quantity: 50, price: 5.20, side: "BUY" },
  { orderId: "123", symbol: "GGAL", optionType: "CALL", strike: 4734.3, quantity: 50, price: 5.30, side: "BUY" },
  { orderId: "124", symbol: "GGAL", optionType: "CALL", strike: 4734.3, quantity: 25, price: 5.25, side: "BUY" }
]

// RAW Consolidation (grouped by orderId)
[
  {
    orderId: "123",
    symbol: "GGAL",
    optionType: "CALL",
    strike: 4734.3,
    totalQuantity: 100,  // 50 + 50
    averagePrice: 5.25,  // (50*5.20 + 50*5.30) / 100
    legs: [leg1, leg2]
  },
  {
    orderId: "124",
    symbol: "GGAL",
    optionType: "CALL",
    strike: 4734.3,
    totalQuantity: 25,
    averagePrice: 5.25,
    legs: [leg3]
  }
]
```

#### Example: AVERAGED View

```javascript
// Same Input Operations as above

// AVERAGED Consolidation (grouped by strike)
[
  {
    symbol: "GGAL",
    optionType: "CALL",
    strike: 4734.3,
    totalQuantity: 125,  // 50 + 50 + 25
    averagePrice: 5.25,  // (50*5.20 + 50*5.30 + 25*5.25) / 125
    legs: [leg1, leg2, leg3]
  }
]
```

#### Exclusions

**Zero Net Quantity:**
Operations with offsetting buys and sells are excluded:

```javascript
// Example: Buy 100 then Sell 100
[
  { symbol: "GGAL", optionType: "CALL", strike: 4734.3, quantity: 100, side: "BUY" },
  { symbol: "GGAL", optionType: "CALL", strike: 4734.3, quantity: 100, side: "SELL" }
]

// netQuantity = (+100) + (-100) = 0
// Result: Excluded from consolidated view
// Tracked in: exclusions.zeroNetQuantity
```

---

### 8. Group Discovery

**Purpose:** Organize operations into groups by symbol and expiration for filtering in the UI.

**Process:**

1. **Generate Group Key:**
   ```javascript
   function getOperationGroupId(operation) {
     const symbol = normalizeSymbol(operation.symbol);
     
     if (isOption(operation)) {
       const expiration = normalizeExpiration(operation.expiration);
       return `${symbol}::${expiration}`;
     } else {
       return `${symbol}::NONE`;
     }
   }
   ```

2. **Count Operations:**
   ```javascript
   groups.forEach(groupKey => {
     const operations = operationsByGroup.get(groupKey);
     
     const calls = operations.filter(op => op.optionType === 'CALL').length;
     const puts = operations.filter(op => op.optionType === 'PUT').length;
     
     groups.push({
       id: groupKey,
       symbol: extractSymbol(groupKey),
       expiration: extractExpiration(groupKey),
       counts: { calls, puts }
     });
   });
   ```

**Example Groups:**

```javascript
[
  {
    id: "GGAL::OCT",
    symbol: "GGAL",
    expiration: "OCT",
    counts: { calls: 15, puts: 8 }
  },
  {
    id: "GGAL::DIC",
    symbol: "GGAL",
    expiration: "DIC",
    counts: { calls: 10, puts: 5 }
  },
  {
    id: "YPFD::OCT",
    symbol: "YPFD",
    expiration: "OCT",
    counts: { calls: 20, puts: 12 }
  }
]
```

---

### 9. Report Building

**Purpose:** Construct the final `OperationsReport` object that contains all processed data, statistics, and metadata.

**Report Structure:**

```javascript
{
  // Summary statistics
  summary: {
    fileName: "Operations-2025-10-21.csv",
    processedAt: 1729531200000,
    rawRowCount: 150,
    validRowCount: 142,
    excludedRowCount: 8,
    warnings: [],
    callsRows: 85,
    putsRows: 57,
    totalRows: 142,
    groups: [...]
  },
  
  // Consolidated views
  views: {
    raw: {
      key: "raw",
      averagingEnabled: false,
      calls: {
        operations: [...],
        stats: {
          count: 85,
          totalQuantity: 5420,
          totalNotional: 284350.50,
          averagePrice: 52.44
        }
      },
      puts: {
        operations: [...],
        stats: {
          count: 57,
          totalQuantity: 3180,
          totalNotional: 156720.25,
          averagePrice: 49.28
        }
      },
      summary: {...},
      exclusions: {
        combined: {...},
        validation: {...},
        consolidation: {...}
      }
    },
    averaged: {
      // Same structure with aggregated data
    }
  },
  
  // All enriched operations
  operations: [...],
  
  // Operations normalized to CSV format
  normalizedOperations: [...],
  
  // Group metadata
  groups: [...],
  
  // Processing metadata
  meta: {
    parse: {
      rowCount: 150,
      errors: [],
      warningThresholdExceeded: false
    },
    duration: "1234ms"
  }
}
```

---

### 10. UI Display

**Components Involved:**
- `ProcessorScreen.jsx` - Main container
- `OpcionesView.jsx` - CALLS & PUTS display
- `OperationTypeTabs.jsx` - View switcher

#### Scoped Data Computation

**Purpose:** Filter and cache data based on selected group and averaging mode.

```javascript
function computeScopedData({ report, groups, selectedGroupId, useAveraging }) {
  // 1. Determine scope
  const allSelected = !selectedGroupId || selectedGroupId === '__ALL__';
  
  // 2. Filter operations
  const filteredOperations = allSelected
    ? report.operations
    : report.operations.filter(op => getOperationGroupId(op) === selectedGroupId);
  
  // 3. Rebuild consolidated views for filtered operations
  const consolidatedViews = buildConsolidatedViews(filteredOperations);
  
  // 4. Select active view
  const viewKey = useAveraging ? 'averaged' : 'raw';
  const activeView = consolidatedViews[viewKey];
  
  return {
    scopedReport: { ...report, operations: filteredOperations },
    activeView,
    calls: activeView.calls.operations,
    puts: activeView.puts.operations
  };
}
```

#### Display Components

**1. Group Selector:**
```jsx
<Select value={selectedGroupId} onChange={handleGroupChange}>
  <MenuItem value="__ALL__">Todos</MenuItem>
  <MenuItem value="GGAL::OCT">GGAL OCT</MenuItem>
  <MenuItem value="GGAL::DIC">GGAL DIC</MenuItem>
  <MenuItem value="YPFD::OCT">YPFD OCT</MenuItem>
</Select>
```

**2. Averaging Toggle:**
```jsx
<FormControlLabel
  control={
    <Switch
      checked={useAveraging}
      onChange={(e) => handleToggleAveraging(e.target.checked)}
    />
  }
  label="Promediar por Strike"
/>
```

**3. CALLS Table:**
```jsx
<TableContainer>
  <Table>
    <TableHead>
      <TableRow>
        <TableCell>Strike</TableCell>
        <TableCell align="right">Cantidad</TableCell>
        <TableCell align="right">Precio Promedio</TableCell>
        <TableCell align="right">Total</TableCell>
      </TableRow>
    </TableHead>
    <TableBody>
      {callsOperations.map(operation => (
        <TableRow key={operation.id}>
          <TableCell>{formatStrike(operation.strike)}</TableCell>
          <TableCell align="right">{formatQuantity(operation.totalQuantity)}</TableCell>
          <TableCell align="right">{formatPrice(operation.averagePrice)}</TableCell>
          <TableCell align="right">{formatTotal(operation.totalQuantity * operation.averagePrice)}</TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</TableContainer>
```

**4. PUTS Table:**
Similar structure to CALLS table.

**5. Actions:**
```jsx
<Stack direction="row" spacing={2}>
  <Button onClick={() => handleCopy('calls')}>Copiar CALLS</Button>
  <Button onClick={() => handleCopy('puts')}>Copiar PUTS</Button>
  <Button onClick={() => handleDownload('all')}>Exportar CSV</Button>
</Stack>
```

---

## Key Algorithms & Data Flows

### Complete Example Flow

**Input CSV Row:**
```csv
Symbolo,Numero de Orden,Lado,Precio,Cantidad,Estado
GFGC47343O,12345,COMPRA,5.25,100,ejecutada
```

**Processing Steps:**

1. **Parse:** Extract structured data
2. **Normalize:** Map "COMPRA" → "BUY", "Symbolo" → "symbol"
3. **Validate:** Check status="ejecutada" → "fully_executed" ✓
4. **Token Parse:** "GFGC47343O" → { prefix: "GFG", type: "CALL", strikeToken: "47343", expiration: "O" }
5. **Prefix Match:** "GFG" → Symbol "GGAL"
6. **Expiration Resolve:** "O" → "OCT"
7. **Decimals Resolve:** Symbol=2, Expiration=1, Override=1 → **1 decimal**
8. **Strike Format:** "47343" with 1 decimal → **4734.3**
9. **Fee Calculation:** Add fee breakdown
10. **Consolidation:** Group and calculate VWAP
11. **Display:** Render in table

**Final Operation:**
```javascript
{
  id: "order-12345",
  orderId: "12345",
  originalSymbol: "GFGC47343O",
  matchedSymbol: "GGAL",
  symbol: "GGAL",
  expiration: "OCT",
  optionType: "CALL",
  strike: 4734.3,
  quantity: 100,
  price: 5.25,
  side: "BUY",
  feeAmount: 381.15,
  meta: {
    prefixRule: "GFG",
    decimalsApplied: 1,
    detectedFromToken: true
  }
}
```

---

## Configuration System

### Symbol Configuration Structure

```javascript
{
  symbol: "GGAL",           // Underlying symbol
  prefix: "GFG",            // Primary option prefix
  prefixes: ["GFG", "GFGC", "GFGV"],  // All recognized prefixes
  defaultDecimals: 2,       // Symbol-level default for strikes
  strikeDefaultDecimals: 2, // Alias for defaultDecimals
  
  expirations: {
    "OCT": {
      suffixes: ["O", "OC", "OCT"],  // Valid suffixes
      decimals: 1,                    // Expiration-level override
      overrides: [                    // Strike-specific overrides
        {
          raw: "47343",
          formatted: "4734.3"
        },
        {
          raw: "50000",
          formatted: "500.00"
        }
      ]
    },
    "DIC": {
      suffixes: ["D", "DI", "DIC"],
      decimals: 1,
      overrides: []
    },
    "FEB": {
      suffixes: ["F", "FE", "FEB"],
      decimals: 2,
      overrides: []
    }
    // ... more expirations
  }
}
```

### Configuration Storage

**Location:** Browser `localStorage` via `storage-settings.js`

**Key Structure:**
- `symbols:list` - Array of symbol names
- `symbols:GGAL:config` - Configuration for GGAL
- `symbols:YPFD:config` - Configuration for YPFD
- etc.

---

## Error Handling

### Parsing Errors

**Handled by:** `parseOperationsCsv`

```javascript
{
  meta: {
    errors: [
      {
        row: 15,
        message: "Unable to parse row",
        code: "TooFewFields"
      }
    ]
  }
}
```

### Validation Exclusions

**Tracked by:** `validateAndFilterRows`

```javascript
{
  exclusions: {
    invalidStatus: 5,        // Rows with wrong status
    invalidEventType: 3,     // Non-execution events
    missingRequiredField: 2  // Missing data
  }
}
```

### Token Parsing Failures

**Fallback:** Use explicit fields from CSV

```javascript
// Token parse failed → use explicit values
if (!tokenMatch) {
  symbol = row.symbol;
  expiration = row.expiration;
  strike = row.strike;
  optionType = row.option_type;
}
```

---

## Performance Considerations

### Large File Handling

- **Warning Threshold:** 25,000 rows
- **Maximum Rows:** 50,000 rows
- **Streaming:** Not implemented (loads all in memory)

### Caching

**Scoped Data Cache:**
```javascript
// Cache consolidated views by group
const cache = new Map();
cache.set(groupKey, {
  reportToken: report,
  consolidatedViews: buildConsolidatedViews(operations)
});
```

### Optimization Strategies

1. **Memoization:** Use React.useMemo for expensive calculations
2. **Debouncing:** Debounce user input in filters
3. **Virtualization:** Consider for very large operation lists
4. **Lazy Loading:** Load groups on demand

---

## Testing Considerations

### Unit Test Coverage

**Key Functions to Test:**

1. `parseToken` - Token regex matching
2. `resolveStrikeDecimals` - Decimal hierarchy
3. `formatStrikeTokenValue` - Strike formatting
4. `resolveExpirationCode` - Suffix matching
5. `validateAndFilterRows` - Status normalization
6. `consolidateOperations` - VWAP calculation

### Integration Tests

1. End-to-end CSV processing
2. Configuration loading
3. Fee calculation accuracy
4. UI display correctness

### Test Data

Use real-world CSV exports with:
- Multiple symbols
- Multiple expirations
- Partial fills
- Buy and sell sides
- Various strike formats

---

## Future Enhancements

1. **Streaming Parser:** Handle larger files without memory constraints
2. **Background Processing:** Web Workers for heavy computation
3. **Advanced Filtering:** Multi-column filters with AND/OR logic
4. **Export Formats:** Excel, JSON, custom formats
5. **Historical Comparison:** Compare across multiple files
6. **Error Recovery:** Auto-correct common CSV issues

---

## Related Documentation

- [Feature 003: Redesigned Options Configuration Settings](../specs/003-redesign-the-current/spec.md)
- [Feature 004: jsRofex Integration](../specs/004-integrate-jsrofex-to/spec.md)
- [Data Model](../specs/003-redesign-the-current/data-model.md)
- [Manual Testing Guide](../specs/003-redesign-the-current/MANUAL-TESTING-GUIDE.md)
