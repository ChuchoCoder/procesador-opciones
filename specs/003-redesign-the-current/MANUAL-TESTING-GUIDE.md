# Manual Acceptance Testing Guide
## Feature 003: Redesigned Options Configuration Settings

**Test Date**: 2025-10-13  
**Dev Server**: http://localhost:5174/  
**Branch**: 003-redesign-the-current

---

## Pre-Testing Setup

1. ✅ Dev server running on http://localhost:5174/
2. Clear localStorage (DevTools → Application → Storage → Clear site data)
3. Navigate to Settings via sidebar menu

---

## Test Suite 1: User Story 1 - Create Symbol Configuration (P1)

### TC1.1: Add First Symbol
**Steps:**
1. Click "Agregar Símbolo" button
2. Enter "GGAL" in symbol field
3. Click "Agregar"

**Expected:**
- ✅ Symbol tab appears with "GGAL" label
- ✅ Tab is automatically selected
- ✅ Configuration panel shows empty/default values

### TC1.2: Symbol Persistence
**Steps:**
1. After adding GGAL, refresh page (F5)

**Expected:**
- ✅ GGAL tab still visible
- ✅ GGAL tab is selected by default

### TC1.3: Add Multiple Symbols
**Steps:**
1. Add "YPFD" symbol
2. Add "PAMP" symbol

**Expected:**
- ✅ Three tabs visible: GGAL, YPFD, PAMP
- ✅ Can switch between tabs
- ✅ Each tab loads its own configuration

### TC1.4: Duplicate Symbol Validation
**Steps:**
1. Click "Agregar Símbolo"
2. Enter "GGAL" (existing symbol)
3. Click "Agregar"

**Expected:**
- ✅ Error message: "Ese símbolo ya existe."
- ✅ Symbol not added
- ✅ Dialog remains open

### TC1.5: Invalid Symbol Validation
**Steps:**
1. Try adding symbol with special characters: "GG-AL"
2. Try adding empty symbol

**Expected:**
- ✅ Error for special characters: "El símbolo debe contener solo letras y números."
- ✅ Error for empty: "Ingresá un símbolo."

---

## Test Suite 2: User Story 2 - Symbol Defaults (P2)

### TC2.1: Edit Prefix (Write-on-Blur)
**Steps:**
1. Select GGAL tab
2. Enter "GFG" in "Prefijo de opciones" field
3. Click outside field (blur)

**Expected:**
- ✅ Green success message appears briefly
- ✅ Value persists after refresh
- ✅ Other symbols unaffected

### TC2.2: Edit Default Decimals
**Steps:**
1. Change "Decimales predeterminados" to 3
2. Blur field

**Expected:**
- ✅ Success message appears
- ✅ Value persists after refresh

### TC2.3: Empty Prefix (Valid)
**Steps:**
1. Clear prefix field (leave empty)
2. Blur field

**Expected:**
- ✅ No error (empty prefix is valid)
- ✅ Saves successfully

### TC2.4: Invalid Prefix
**Steps:**
1. Enter prefix with special chars: "GF@G"
2. Blur field

**Expected:**
- ✅ Error: "El prefijo debe contener solo letras y números."
- ✅ Value not saved

### TC2.5: Invalid Decimals
**Steps:**
1. Enter decimals = 5 (out of range)
2. Blur field

**Expected:**
- ✅ Error: "Los decimales deben estar entre 0 y 4."
- ✅ Value not saved

### TC2.6: Reset to Saved
**Steps:**
1. Change prefix to "TEST" but DON'T blur
2. Change decimals to 1 but DON'T blur
3. Click "Restablecer a guardado"

**Expected:**
- ✅ Fields revert to last saved values
- ✅ No unsaved changes indicator

---

## Test Suite 3: User Story 3 - Expirations & Overrides (P3)

### TC3.1: Expiration Navigation
**Steps:**
1. Select GGAL tab
2. Scroll to "Vencimientos" section

**Expected:**
- ✅ Vertical tabs visible: DIC, FEB, ABR, JUN, AGO, OCT
- ✅ First expiration (DIC) selected by default
- ✅ Right panel shows DIC configuration

### TC3.2: Default Suffixes
**Steps:**
1. Select DIC expiration

**Expected:**
- ✅ Default suffixes shown as chips: "D", "DI"
- ✅ Can be removed by clicking X

### TC3.3: Add Custom Suffix
**Steps:**
1. Enter "DIC" in suffix input (3 letters)
2. Click "Agregar"

**Expected:**
- ✅ Error: suffix must be 1-2 letters
- ✅ Suffix not added

### TC3.4: Add Valid Suffix
**Steps:**
1. Enter "DC" in suffix input
2. Click "Agregar"

**Expected:**
- ✅ "DC" chip appears
- ✅ Persists after refresh
- ✅ Input clears

### TC3.5: Duplicate Suffix
**Steps:**
1. Try adding "D" again (already exists)

**Expected:**
- ✅ Error: "Ese sufijo ya existe."
- ✅ Suffix not added

### TC3.6: Expiration Decimals
**Steps:**
1. Change decimals for DIC to 1
2. Blur field

**Expected:**
- ✅ Saves successfully
- ✅ Other expirations unaffected
- ✅ Persists after refresh

### TC3.7: Add Strike Override
**Steps:**
1. In "Ajustes de strike" section
2. Enter raw: "47343"
3. Enter formatted: "4734.3"
4. Click "Agregar ajuste"

**Expected:**
- ✅ Override appears in list
- ✅ Shows read-only fields with delete button
- ✅ Persists after refresh

### TC3.8: Multiple Overrides
**Steps:**
1. Add override: 12345 → 123.45
2. Add override: 98765 → 9876.5

**Expected:**
- ✅ All three overrides visible
- ✅ Can be removed individually

### TC3.9: Duplicate Raw Token
**Steps:**
1. Try adding override with raw="47343" (already exists)

**Expected:**
- ✅ Error: "Ese valor ya tiene un ajuste."
- ✅ Override not added

### TC3.10: Invalid Raw Token
**Steps:**
1. Enter raw="ABC123" (non-numeric)

**Expected:**
- ✅ Error: "El valor debe ser numérico."

### TC3.11: Remove Override
**Steps:**
1. Click delete button on 47343 override

**Expected:**
- ✅ Override removed
- ✅ Change persists
- ✅ Other overrides remain

### TC3.12: Cross-Expiration Overrides
**Steps:**
1. Add override 47343 → "4734.3" to DIC
2. Switch to FEB expiration
3. Add override 47343 → "47343" to FEB

**Expected:**
- ✅ Same raw token allowed in different expirations
- ✅ Different formatted values stored correctly

---

## Test Suite 4: Cross-Cutting Concerns

### TC4.1: Multi-Tab Consistency (Last-Write-Wins)
**Steps:**
1. Open app in two browser tabs
2. In Tab 1: change GGAL prefix to "GFG1"
3. In Tab 2: change GGAL prefix to "GFG2"
4. Click Reset in Tab 1

**Expected:**
- ✅ Tab 1 shows "GFG2" (last write wins)

### TC4.2: Spanish Localization
**Steps:**
1. Review all UI text

**Expected:**
- ✅ All labels, buttons, errors in Spanish (es-AR)
- ✅ No English text visible

### TC4.3: Empty State
**Steps:**
1. Clear localStorage
2. Navigate to Settings

**Expected:**
- ✅ Message: "Agregá un símbolo para comenzar."
- ✅ Only "Agregar Símbolo" button visible

### TC4.4: Full Configuration Flow
**Steps:**
1. Add symbol GGAL
2. Set prefix: GFG, decimals: 2
3. Configure DIC: suffixes [D, DI], decimals: 1
4. Add overrides: 47343 → 4734.3
5. Refresh page

**Expected:**
- ✅ All values persist
- ✅ No data loss
- ✅ Can navigate between all sections

---

## Performance Checks

### P1: localStorage Size
**Steps:**
1. After full configuration, check localStorage size (DevTools)

**Expected:**
- ✅ Payload < 10KB per symbol

### P2: Save Latency
**Steps:**
1. Edit field and blur
2. Observe delay until success message

**Expected:**
- ✅ Save completes in < 50ms (imperceptible)

---

## Test Results Summary

**Date**: ___________  
**Tester**: ___________

| Test Suite | Passed | Failed | Notes |
|------------|--------|--------|-------|
| TS1: Create Symbol | __ / 5 | __ / 5 | |
| TS2: Symbol Defaults | __ / 6 | __ / 6 | |
| TS3: Expirations | __ / 12 | __ / 12 | |
| TS4: Cross-Cutting | __ / 4 | __ / 4 | |
| Performance | __ / 2 | __ / 2 | |
| **TOTAL** | **__ / 29** | **__ / 29** | |

---

## Known Issues / Bugs Found

1. 
2. 
3. 

---

## Acceptance Decision

- [ ] **APPROVED** - All critical tests passed, ready for production
- [ ] **APPROVED WITH NOTES** - Minor issues found, document and monitor
- [ ] **REJECTED** - Critical bugs found, requires fixes before deployment

**Signature**: ___________  
**Date**: ___________
