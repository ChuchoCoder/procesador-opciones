# Storage API Contract

**Feature**: 001-feature-migrate-popup  
**Date**: 2025-10-10  
**Purpose**: Define the interface between React application and Chrome extension storage layer.

---

## Overview

All configuration persistence uses Chrome's `chrome.storage.local` API with flat key naming per FR-024. No namespacing or versioning in this iteration (simplicity per Constitution Principle 5).

---

## Storage Keys

Per FR-024, the following flat keys are used:

| Key | Type | Description |
|-----|------|-------------|
| `symbols` | `string[]` | Array of underlying symbol identifiers |
| `expirations` | `Record<string, string[]>` | Map of expiration names to suffix arrays |
| `activeSymbol` | `string` | Currently selected symbol |
| `activeExpiration` | `string` | Currently selected expiration |
| `useAveraging` | `boolean` | Strike-level averaging mode flag |

---

## API Methods

All methods return `Promise<T>` to accommodate Chrome's async storage API.

### `loadConfig(): Promise<Configuration>`

**Description**: Load all 5 configuration keys from storage. Apply defaults for any missing keys.

**Returns**:

```typescript
interface Configuration {
  symbols: string[];
  expirations: Record<string, string[]>;
  activeSymbol: string;
  activeExpiration: string;
  useAveraging: boolean;
}
```

**Default Values** (if key missing):

```javascript
{
  symbols: ["GGAL"],
  expirations: {
    "ENE": ["E", "F25"],
    "FEB": ["G", "H25"]
  },
  activeSymbol: "GGAL",
  activeExpiration: "ENE",
  useAveraging: false
}
```

**Example Implementation**:

```javascript
async function loadConfig() {
  const result = await chrome.storage.local.get([
    'symbols',
    'expirations',
    'activeSymbol',
    'activeExpiration',
    'useAveraging'
  ]);

  return {
    symbols: result.symbols || ["GGAL"],
    expirations: result.expirations || { "ENE": ["E", "F25"], "FEB": ["G", "H25"] },
    activeSymbol: result.activeSymbol || "GGAL",
    activeExpiration: result.activeExpiration || "ENE",
    useAveraging: result.useAveraging || false
  };
}
```

**Error Handling**: If `chrome.storage.local` unavailable (e.g., non-extension context during testing), throw descriptive error: "Chrome storage API no disponible."

---

### `saveConfig(config: Partial<Configuration>): Promise<void>`

**Description**: Save one or more configuration keys to storage. Only provided keys are updated; others remain unchanged.

**Parameters**:

- `config`: Partial configuration object with any subset of the 5 keys.

**Example Usage**:

```javascript
// Update only activeSymbol
await saveConfig({ activeSymbol: "YPFD" });

// Update multiple keys
await saveConfig({
  symbols: ["GGAL", "YPFD"],
  activeSymbol: "YPFD"
});
```

**Validation** (performed before saving):

1. If `symbols` provided, must be non-empty array.
2. If `activeSymbol` provided, must exist in current or updated `symbols` array.
3. If `expirations` provided, must have at least 1 key with non-empty suffix array.
4. If `activeExpiration` provided, must exist in current or updated `expirations` keys.

**Error Handling**: If validation fails, throw error with Spanish message (FR-023): "Configuración inválida: {reason}."

**Example Implementation**:

```javascript
async function saveConfig(partialConfig) {
  // Optional: validate before saving
  if (partialConfig.symbols && partialConfig.symbols.length === 0) {
    throw new Error("Configuración inválida: symbols no puede estar vacío.");
  }

  await chrome.storage.local.set(partialConfig);
}
```

---

### `restoreDefaults(): Promise<void>`

**Description**: Overwrite all 5 storage keys with hardcoded defaults (per FR-014).

**Example Implementation**:

```javascript
async function restoreDefaults() {
  const defaults = {
    symbols: ["GGAL"],
    expirations: { "ENE": ["E", "F25"], "FEB": ["G", "H25"] },
    activeSymbol: "GGAL",
    activeExpiration: "ENE",
    useAveraging: false
  };

  await chrome.storage.local.set(defaults);
}
```

---

## Testing Contract

### Unit Test Mock

For Vitest tests, mock `chrome.storage.local` in `tests/setup.js`:

```javascript
// tests/setup.js
global.chrome = {
  storage: {
    local: {
      data: {}, // in-memory storage for tests
      get(keys) {
        return Promise.resolve(
          keys.reduce((acc, key) => {
            acc[key] = this.data[key];
            return acc;
          }, {})
        );
      },
      set(items) {
        Object.assign(this.data, items);
        return Promise.resolve();
      },
      clear() {
        this.data = {};
        return Promise.resolve();
      }
    }
  }
};
```

### Test Cases (minimum per Constitution Principle 3)

1. **loadConfig with all keys present**: Returns exact stored values.
2. **loadConfig with missing keys**: Returns defaults for missing keys.
3. **saveConfig updates only specified keys**: Other keys remain unchanged.
4. **saveConfig validation rejects empty symbols**: Throws Spanish error message.
5. **restoreDefaults overwrites all keys**: All keys match hardcoded defaults after call.

---

## Performance

- **Read latency** (FR-011): `loadConfig()` must complete in <50ms on typical hardware (ensures popup interactive <150ms budget per Constitution Principle 4).
- **Write latency**: `saveConfig()` expected <20ms; non-blocking UI (fire-and-forget acceptable for non-critical updates like activeSymbol changes).

---

## Migration Notes (Future)

If future versions require namespacing (e.g., `popup.v1.symbols`), implement migration logic in `loadConfig()`:

1. Check for old flat keys (`symbols`, `expirations`, etc.).
2. If found, migrate to new namespaced keys and delete old keys.
3. Document migration in constitution amendment (per governance process).

**Current iteration**: No migration needed (flat keys per FR-024 accepted).
