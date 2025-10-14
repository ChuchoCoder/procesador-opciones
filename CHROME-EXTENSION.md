# Chrome Extension Build Guide

## Overview

This project packages the web application as a Chrome Extension with dual storage layer support:
- **Web Application**: Uses `localStorage` 
- **Chrome Extension**: Uses `chrome.storage.local`

The storage adapter automatically detects the environment and uses the appropriate storage backend.

## Building the Extension

### Quick Build

```bash
npm run build
```

Or use the explicit command:

```bash
npm run build:extension
```

### What Happens During Build

1. **Frontend Compilation**: Vite builds and minifies the React application
2. **Output Cleaning**: Clears the `extension-dist/` directory
3. **Asset Copying**: Copies manifest and icons
4. **Bundle Creation**: Copies minified JavaScript and CSS to extension directory
5. **HTML Renaming**: Renames `index.html` to `popup.html` for Chrome Extension
6. **Manifest Update**: Ensures manifest has correct popup path and storage permissions

### Build Output

The extension is built to: `extension-dist/`

```
extension-dist/
├── manifest.json          # Chrome Extension manifest
├── popup.html            # Extension popup (renamed from index.html)
├── icon16.png           # Extension icons
├── icon48.png
├── icon128.png
└── assets/              # Minified and bundled JS/CSS
    ├── index-[hash].js
    └── index-[hash].css
```

## Loading the Extension in Chrome

1. Open Chrome and navigate to: `chrome://extensions`
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **Load unpacked**
4. Select the `extension-dist/` folder
5. The extension will appear in your toolbar

## Storage Architecture

### Dual-Layer Storage System

The application uses a storage adapter (`storage-adapter.js`) that provides a unified async API:

```javascript
import { storageAdapter } from './services/storage/storage-adapter.js';

// All methods return Promises
await storageAdapter.getItem(key);
await storageAdapter.setItem(key, value);
await storageAdapter.removeItem(key);
await storageAdapter.getAllKeys(prefix);
await storageAdapter.clear(prefix);
```

### Storage Detection

The adapter automatically detects the environment:
- **Chrome Extension**: Uses `chrome.storage.local` API
- **Web Application**: Falls back to `localStorage`

### Storage Namespaces

- **Settings**: `po:settings:<SYMBOL>` - Symbol-specific configurations
- **App Data**: `po.<key>` - Application state (expirations, reports, etc.)

### Updated Services

The following services now use the async storage adapter:

1. **`storage-settings.js`**: Symbol configuration persistence
   - `getAllSymbols()` → `Promise<string[]>`
   - `loadSymbolConfig(symbol)` → `Promise<Object|null>`
   - `saveSymbolConfig(config)` → `Promise<boolean>`
   - `deleteSymbolConfig(symbol)` → `Promise<boolean>`
   - `symbolExists(symbol)` → `Promise<boolean>`

2. **`local-storage.js`**: Application data storage
   - `readItem(key)` → `Promise<any|null>`
   - `writeItem(key, value)` → `Promise<boolean>`
   - `removeItem(key)` → `Promise<boolean>`
   - `clearAll()` → `Promise<boolean>`

## Development Scripts

```bash
# Start development server (web app)
npm run dev

# Build extension
npm run build

# Build just the frontend
npm run build:spa

# Run tests
npm run test

# Run linter
npm run lint
```

## Vite Configuration

The build is optimized for Chrome Extensions:

- **Minification**: Enabled with Terser
- **Source Maps**: Generated for debugging
- **Console Logs**: Preserved for extension debugging
- **Chunk Splitting**: Disabled for simpler extension structure
- **Asset Naming**: Clean, hashed filenames

## Manifest Configuration

Key manifest settings (`manifest.json`):

```json
{
  "manifest_version": 3,
  "name": "Procesador de opciones",
  "version": "1.0.2",
  "permissions": ["storage"],
  "action": {
    "default_popup": "popup.html"
  }
}
```

## Debugging

### Chrome Extension Debugging

1. Right-click the extension icon → **Inspect popup**
2. Open DevTools for the popup
3. Check Console for logs prefixed with `[StorageAdapter]`
4. Storage type is logged on initialization

### Storage Inspection

**Chrome Extension:**
```javascript
// In popup DevTools console:
chrome.storage.local.get(null, (items) => console.log(items));
```

**Web Application:**
```javascript
// In browser DevTools console:
console.log(localStorage);
```

## Migration Notes

### Code Changes Required

All storage operations are now **async**. Update your code:

**Before:**
```javascript
const symbols = getAllSymbols();
const config = loadSymbolConfig(symbol);
saveSymbolConfig(config);
```

**After:**
```javascript
const symbols = await getAllSymbols();
const config = await loadSymbolConfig(symbol);
await saveSymbolConfig(config);
```

### React Components

Use async handlers or `useEffect`:

```javascript
// In event handlers
const handleSave = async () => {
  await saveSymbolConfig(config);
};

// In useEffect
useEffect(() => {
  loadSymbolConfig(symbol).then(setConfig);
}, [symbol]);
```

## Troubleshooting

### Build Fails

- Ensure all dependencies are installed: `npm install`
- Check that `frontend/` has its own `node_modules`
- Verify Node.js version (requires v14+)

### Storage Not Working

- Check browser console for `[StorageAdapter]` initialization log
- Verify `storage` permission in manifest
- For web app, check if localStorage is enabled in browser

### Extension Won't Load

- Verify `extension-dist/popup.html` exists
- Check manifest.json syntax
- Look for errors in `chrome://extensions` page
- Ensure all icons are present

## Files Modified

The following files were updated to support dual storage:

- `frontend/src/services/storage/storage-adapter.js` (NEW)
- `frontend/src/services/storage-settings.js`
- `frontend/src/services/storage/local-storage.js`
- `frontend/src/services/csv/process-operations.js`
- `frontend/src/components/Processor/Settings/SymbolSettings.jsx`
- `frontend/src/components/Processor/Settings/AddSymbol.jsx`
- `frontend/src/components/Processor/Settings/SettingsScreen.jsx`
- `frontend/vite.config.js`
- `scripts/build-extension.mjs`
- `package.json`
- `manifest.json`
