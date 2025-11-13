# Data Model — Redesigned Options Configuration Settings

This document defines the entities, validation rules, and on-disk (localStorage) shapes used by the redesigned Settings feature. It is intentionally small and focused; follow the repository constitution (colocate utilities until reused twice).

## Overview

- Storage target: browser `localStorage` (namespace prefix: `po:settings:`). Per-symbol settings are stored under `po:settings:<SYMBOL>` where `<SYMBOL>` is the uppercase symbol identifier.
- Expected payload size: small. Aim for < 10KB per symbol configuration. Keep override lists compact and avoid storing full historic logs.

## Entities

1. SymbolConfiguration

```json
{
  "symbol": "GGAL",
  "prefix": "GFG",
  "defaultDecimals": 2,
  "expirations": {
    "DIC": { /* ExpirationSetting */ },
    "FEB": { /* ExpirationSetting */ }
  },
  "updatedAt": 1697200000000
}
```

Fields

- `symbol` (string, uppercase): unique symbol identifier. Required.
- `prefix` (string): option prefix, validated via `validatePrefix`.
- `defaultDecimals` (integer, 0..4): default decimals that apply when expiration override is absent.
- `expirations` (object): map of expiration code → ExpirationSetting.
- `updatedAt` (unix ms timestamp): last persisted time used for last-write-wins comparisons.

1. ExpirationSetting

```json
{
  "suffixes": ["O","OC"],
  "decimals": 1,
  "overrides": [ /* StrikeOverride list */ ]
}
```

Fields

- `suffixes` (array of 1-2 letter uppercase strings): allowed suffix forms for this expiration (must be 1 or 2 letters). Example: `["O","OC"]`.
- `decimals` (integer, 0..4): expiration-specific default decimals.
- `overrides` (array): list of StrikeOverride objects.

1. StrikeOverride

```json
{
  "raw": "47343",
  "formatted": "4734.3",
  "skipDecimalFormatting": false
}
```

Fields

- `raw` (string of digits): the raw numeric token to match; uniqueness required within an expiration.
- `formatted` (string): the desired formatted strike representation (must respect decimals constraints).
- `skipDecimalFormatting` (boolean, optional): when `true`, the system uses the `formatted` value directly without applying any decimal operations. Useful for strikes that should be treated as-is (e.g., "10177" → "10177" instead of "1.0177"). Defaults to `false` when omitted.

## Storage Schema & Key Patterns

- Per-symbol key: `po:settings:<SYMBOL>` → JSON string of `SymbolConfiguration`.
- Use `updatedAt` to implement last-write-wins: when applying an incoming write, compare timestamps and accept the write if `incoming.updatedAt >= stored.updatedAt` (ties resolved by incoming wins).

## Validation Rules

- `symbol`: uppercase letters/numbers only, non-empty. Reject duplicates at UI validation.
- `prefix`: non-empty string, uppercase normalization recommended. Use `validatePrefix` to assert allowed characters.
- `defaultDecimals` / `decimals`: integer between 0 and 4 inclusive.
- `suffixes`: each entry MUST be exactly 1 or 2 letters (A-Z); reject longer inputs. Persist uppercased.
- `overrides`: `raw` must be numeric string, trimmed of whitespace; `raw` values must be unique within the expiration. `formatted` must match numeric format compatible with the expiration's decimals.

## Concurrency & Merge Policy

- Policy: last-write-wins guided by `updatedAt`. UIs may show a non-blocking "settings updated in another tab" notification when a newer persisted timestamp is observed.
- Provide `Reset to saved` control to reload the stored configuration.

## Migration & Versioning

- If shape changes are required in future (e.g., adding a `version` field), implement a simple migration step when reading keys: detect legacy shape and convert to new shape on first read, then persist updated shape.

## Examples

- Example key: `po:settings:GGAL` → value: JSON.stringify(SymbolConfiguration)

## Notes

- Keep payloads small. Avoid embedding large arrays or logs; store only necessary mapping data for overrides.
- Tests: utilities that parse/format/validate tokens should be unit tested per repository constitution when logic is changed.
