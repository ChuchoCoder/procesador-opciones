# UI Integration Analysis: JSON Data Source Support

## Current Architecture

### Data Flow Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     CURRENT STATE                            │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐              ┌──────────────┐            │
│  │   CSV File   │              │ Broker API   │            │
│  │   Upload     │              │   Sync       │            │
│  └──────┬───────┘              └──────┬───────┘            │
│         │                              │                     │
│         │ CsvDataSource                │ (Raw Operations)    │
│         │ → processOperations()        │ → mergeBrokerBatch()│
│         │                              │                     │
│         ▼                              ▼                     │
│  ┌─────────────────────────────────────────────┐            │
│  │        Global State (operations)            │            │
│  │  - Broker ops (source: 'broker')           │            │
│  │  - CSV ops (source: 'csv')                 │            │
│  └─────────────────────────────────────────────┘            │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Key Components

#### 1. **DataSourceSelector** (`frontend/src/components/Processor/DataSourceSelector.jsx`)
- Shows **two options side-by-side**: CSV Upload vs Broker Login
- Only shown when `!selectedFile` (empty state)
- Current behavior:
  - **Broker connected** → Auto-syncs operations → Stores in global state
  - **CSV selected** → Triggers `handleFileSelected()` → Processes immediately

#### 2. **ProcessorScreen** (`frontend/src/components/Processor/ProcessorScreen.jsx`)

**State Management:**
```javascript
const { operations: syncedOperations } = useConfig(); // Broker operations
const [selectedFile, setSelectedFile] = useState(null); // CSV file
const [report, setReport] = useState(null); // Processing result
```

**Critical Discovery - TWO SEPARATE FLOWS:**

##### Flow A: Broker Operations (Auto-sync)
```javascript
// Line 663: triggerSync callback
const triggerSync = useCallback(async ({ mode, authOverride }) => {
  // ...
  await startDailySync({
    brokerAuth,
    existingOperations,
    commitSync,  // ← Stores in global state
    // ...
  });
}, [/* ... */]);

// Line 801: Auto-trigger on login
useEffect(() => {
  if (isAuthenticated && !syncInProgress) {
    triggerSync({ mode: 'daily' });
  }
}, [brokerAuth, isAuthenticated]);
```

**Result:** Broker operations → `syncedOperations` (global state) → **NOT PROCESSED through processOperations()**

##### Flow B: CSV File Upload
```javascript
// Line 576: runProcessing callback
const runProcessing = useCallback(async (file) => {
  const dataSource = new CsvDataSource();
  const result = await processOperations({
    dataSource,
    file,
    configuration,
  });
  
  setReport(result); // ← Local state
  
  // Merge into global state
  const incomingCsv = dedupeOperations(existingOperations, result.normalizedOperations);
  if (incomingCsv.length > 0) {
    const { mergedOps } = mergeBrokerBatch(existingOperations, incomingCsv);
    setOperations(mergedOps);
  }
}, [/* ... */]);

// Line 845: Auto-process on file selection
useEffect(() => {
  if (selectedFile && !report && !isProcessing) {
    runProcessing(selectedFile);
  }
}, [selectedFile, report, isProcessing]);
```

**Result:** CSV file → `processOperations()` → `report` (local state) → Also merged into `syncedOperations`

### The Problem

**BROKER OPERATIONS ARE NOT PROCESSED!**

Current flow:
1. User logs into broker
2. `startDailySync()` fetches raw operations from API
3. Operations normalized with `normalizeOperation()` (basic transformation)
4. Stored directly in `syncedOperations` global state
5. **NEVER passed through `processOperations()`**
   - No grouping/consolidation
   - No strike/expiration parsing
   - No fee calculations
   - No views (averaged/raw)
   - **No unified processing pipeline!**

Meanwhile, CSV operations:
1. User selects file
2. `processOperations()` with `CsvDataSource`
3. Full processing pipeline applied
4. Results shown in UI (`report` state)

## Solution: Unified Processing

### Option 1: Process Broker Operations On-Demand ✅ RECOMMENDED

**Concept:** Treat broker operations like a "virtual JSON file"

```javascript
// New approach
const handleViewBrokerOperations = async () => {
  const dataSource = new JsonDataSource();
  const result = await processOperations({
    dataSource,
    file: syncedOperations, // ← Pass raw operations as "file"
    fileName: `Broker-${brokerAuth.accountId}.json`,
    configuration,
  });
  
  setReport(result);
  setSelectedFile({ name: `Broker-${brokerAuth.accountId}`, isBrokerData: true });
};
```

**Benefits:**
- ✅ Reuses entire processing pipeline
- ✅ JsonDataSource already implemented
- ✅ No changes to sync-service.js
- ✅ Minimal UI changes
- ✅ User can switch between broker JSON and CSV without disconnecting

**Changes Required:**
1. Add "View Broker Operations" button when authenticated
2. Modify `DataSourceSelector` to show both options when broker connected
3. Update `selectedFile` state to support virtual "broker file"
4. Update `FileMenu` to handle broker data source

### Option 2: Auto-Process Broker Operations (More Invasive)

**Concept:** Process broker operations immediately after sync

```javascript
// In ProcessorScreen
useEffect(() => {
  if (syncedOperations.length > 0 && !selectedFile) {
    // Auto-process broker operations
    const dataSource = new JsonDataSource();
    processOperations({
      dataSource,
      file: syncedOperations,
      configuration,
    }).then(setReport);
  }
}, [syncedOperations]);
```

**Issues:**
- ❌ Auto-processes without user intent
- ❌ What if user wants to upload CSV?
- ❌ Confusing UX (operations appear automatically)
- ❌ Harder to switch between sources

## Recommended Implementation

### Phase 1: Add Broker Data Processing (No Breaking Changes)

#### 1.1 Update DataSourceSelector

**Current state:**
```jsx
{!selectedFile ? (
  <DataSourceSelector onSelectFile={...} onBrokerLogin={...} />
) : (
  <ProcessedReport report={report} />
)}
```

**New state:**
```jsx
{!selectedDataSource ? (
  <DataSourceSelector 
    onSelectFile={handleCsvSelected}
    onSelectBroker={handleBrokerSelected}
    onBrokerLogin={handleBrokerLogin}
    isAuthenticated={isAuthenticated}
    brokerOperationCount={syncedOperations.length}
  />
) : (
  <ProcessedReport report={report} dataSource={selectedDataSource} />
)}
```

#### 1.2 Add Data Source State

```javascript
const [selectedDataSource, setSelectedDataSource] = useState(null);
// Shape: { type: 'csv' | 'broker', file?: File, name: string }

const handleCsvSelected = (file) => {
  setSelectedDataSource({ type: 'csv', file, name: file.name });
  setReport(null);
};

const handleBrokerSelected = () => {
  setSelectedDataSource({ 
    type: 'broker', 
    name: `Broker-${brokerAuth.accountId}`,
    data: syncedOperations
  });
  setReport(null);
};
```

#### 1.3 Update runProcessing

```javascript
const runProcessing = useCallback(async (dataSourceConfig) => {
  setIsProcessing(true);
  
  const { type, file, data } = dataSourceConfig;
  const dataSource = type === 'csv' ? new CsvDataSource() : new JsonDataSource();
  const input = type === 'csv' ? file : data;
  
  const result = await processOperations({
    dataSource,
    file: input,
    fileName: dataSourceConfig.name,
    configuration,
  });
  
  setReport(result);
  // ... rest of logic
}, [/* ... */]);
```

#### 1.4 Add Data Source Switcher UI

```jsx
{selectedDataSource && (
  <Stack direction="row" spacing={2} sx={{ p: 2 }}>
    <Chip 
      label={`Fuente: ${selectedDataSource.type === 'csv' ? 'CSV' : 'Broker'}`}
      color="primary"
      onDelete={() => setSelectedDataSource(null)}
    />
    
    {isAuthenticated && selectedDataSource.type === 'csv' && (
      <Button size="small" onClick={handleBrokerSelected}>
        Ver operaciones del broker
      </Button>
    )}
    
    {isAuthenticated && selectedDataSource.type === 'broker' && (
      <label>
        <input type="file" hidden accept=".csv" onChange={handleCsvFileChange} />
        <Button size="small" component="span">
          Cargar archivo CSV
        </Button>
      </label>
    )}
  </Stack>
)}
```

### Phase 2: Enhanced DataSourcesPanel

Update `DataSourcesPanel` to show:
- ✓ Active data source being viewed
- ✓ Switch between sources button
- ✓ Sync status for broker
- ✓ Metadata from both sources

```jsx
<DataSourcesPanel
  activeSource={selectedDataSource?.type}
  brokerSource={{ 
    available: isAuthenticated,
    operationCount: syncedOperations.length,
    lastSync: syncState.lastSyncTimestamp,
  }}
  csvSource={{ 
    available: !!selectedFile,
    fileName: selectedFile?.name,
  }}
  onSwitchToSource={(type) => {
    if (type === 'broker') handleBrokerSelected();
    else handleCsvSelected();
  }}
/>
```

## Migration Strategy

### Step 1: Minimal Changes (This PR)
- ✅ Add `handleBrokerSelected()` function
- ✅ Add "View Broker Operations" button to DataSourceSelector
- ✅ Update `runProcessing()` to accept broker data
- ✅ Test: Login → Sync → Click "View" → See processed operations

### Step 2: Enhanced UX (Next PR)
- Add data source switcher UI
- Update DataSourcesPanel
- Add breadcrumbs showing active source
- Persist last selected source in localStorage

### Step 3: Polish (Future)
- Add source comparison view
- Export with source metadata
- Source-specific warnings/validations

## Key Decisions

### ✅ DO:
1. Use `JsonDataSource` for broker operations
2. Keep broker sync separate from processing
3. Allow switching without disconnecting
4. Show clear indication of active source

### ❌ DON'T:
1. Auto-process broker operations without user intent
2. Remove CSV upload capability
3. Mix broker sync with file processing logic
4. Change existing broker sync behavior

## Testing Checklist

- [ ] Login to broker → Sync completes → Operations in global state
- [ ] Click "View Broker Operations" → Processed through pipeline → Report shows
- [ ] Upload CSV → Switch to broker → Back to CSV → Data preserved
- [ ] Logout from broker while viewing broker data → Graceful handling
- [ ] Refresh broker data while viewing → Update report
- [ ] Compare CSV vs Broker for same day → Same operations, same results

## Files to Modify

### New Files
- None (JsonDataSource already exists!)

### Modified Files
1. `frontend/src/components/Processor/ProcessorScreen.jsx`
   - Add `selectedDataSource` state
   - Add `handleBrokerSelected()` callback
   - Update `runProcessing()` to handle both sources
   
2. `frontend/src/components/Processor/DataSourceSelector.jsx`
   - Add "View Broker Operations" button when authenticated
   - Show broker operation count
   - Update props interface

3. `frontend/src/components/Processor/DataSourcesPanel.jsx`
   - Add active source indicator
   - Add source switcher buttons

4. `frontend/src/strings/es.js`
   - Add new UI strings for source selection

## Example User Flow

```
1. User opens app
   └─> DataSourceSelector shows: [CSV Upload] [Broker Login]

2. User logs into broker
   └─> Broker syncs 166 operations
   └─> DataSourceSelector now shows: 
       [CSV Upload] [View Broker Operations (166 ops)] [Logout]

3. User clicks "View Broker Operations"
   └─> JsonDataSource processes 166 operations
   └─> Filters to 128 valid (38 excluded)
   └─> Shows processed report with groups, fees, etc.
   └─> Top bar shows: "Fuente: Broker (128 ops) [x] [Switch to CSV]"

4. User clicks "Switch to CSV"
   └─> Shows file upload dialog
   └─> User selects Operations.csv
   └─> CsvDataSource processes file
   └─> Top bar shows: "Fuente: CSV (120 ops) [x] [View Broker Operations]"

5. User clicks "View Broker Operations" again
   └─> Switches back to broker data (no re-sync needed)
   └─> Same report as step 3
```

## Next Steps

1. Implement Phase 1 changes
2. Add unit tests for data source switching
3. Update user documentation
4. Consider adding source metadata to exports
