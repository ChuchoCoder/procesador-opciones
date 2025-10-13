# Test Migration Guide

## Overview
The UI modernization introduced a new `SecondaryToolbar` component that replaces the old `ProcessorActions` component. Action buttons are now consolidated into icon menus, which requires test updates.

## Breaking Changes

### Old Structure (ProcessorActions)
```jsx
<ProcessorActions>
  <Button data-testid="copy-active-button" />
  <Button data-testid="download-active-button" />
  <Button data-testid="copy-calls-button" />
  <Button data-testid="copy-puts-button" />
  <Button data-testid="copy-combined-button" />
  <Button data-testid="download-calls-button" />
  <Button data-testid="download-puts-button" />
  <Button data-testid="download-combined-button" />
  <Button data-testid="download-all-button" />
</ProcessorActions>
```

### New Structure (SecondaryToolbar)
```jsx
<SecondaryToolbar>
  <IconButton data-testid="toolbar-copy-menu-button" />
    <Menu>
      <MenuItem data-testid="copy-active-menu-item" />
      <MenuItem data-testid="copy-calls-menu-item" />
      <MenuItem data-testid="copy-puts-menu-item" />
      <MenuItem data-testid="copy-combined-menu-item" />
    </Menu>
  <IconButton data-testid="toolbar-download-menu-button" />
    <Menu>
      <MenuItem data-testid="download-active-menu-item" />
      <MenuItem data-testid="download-calls-menu-item" />
      <MenuItem data-testid="download-puts-menu-item" />
      <MenuItem data-testid="download-combined-menu-item" />
      <MenuItem data-testid="download-all-menu-item" />
    </Menu>
  <IconButton data-testid="toolbar-filters-button" />
  <IconButton data-testid="toolbar-settings-button" />
</SecondaryToolbar>
```

## Test Selector Mapping

| Old Test ID | New Test IDs (Two-Step) |
|-------------|-------------------------|
| `copy-active-button` | 1. `toolbar-copy-menu-button`<br>2. `copy-active-menu-item` |
| `download-active-button` | 1. `toolbar-download-menu-button`<br>2. `download-active-menu-item` |
| `copy-calls-button` | 1. `toolbar-copy-menu-button`<br>2. `copy-calls-menu-item` |
| `copy-puts-button` | 1. `toolbar-copy-menu-button`<br>2. `copy-puts-menu-item` |
| `copy-combined-button` | 1. `toolbar-copy-menu-button`<br>2. `copy-combined-menu-item` |
| `download-calls-button` | 1. `toolbar-download-menu-button`<br>2. `download-calls-menu-item` |
| `download-puts-button` | 1. `toolbar-download-menu-button`<br>2. `download-puts-menu-item` |
| `download-combined-button` | 1. `toolbar-download-menu-button`<br>2. `download-combined-menu-item` |
| `download-all-button` | 1. `toolbar-download-menu-button`<br>2. `download-all-menu-item` |

## Migration Examples

### Example 1: Copy Active Test (Before)
```javascript
test('should copy active view', async () => {
  const { getByTestId } = render(<ProcessorScreen />);
  const user = userEvent.setup();
  
  // Old direct button click
  const copyButton = getByTestId('copy-active-button');
  await user.click(copyButton);
  
  expect(mockClipboard.writeText).toHaveBeenCalled();
});
```

### Example 1: Copy Active Test (After)
```javascript
test('should copy active view', async () => {
  const { getByTestId } = render(<ProcessorScreen />);
  const user = userEvent.setup();
  
  // New: Open menu first, then click menu item
  const copyMenuButton = getByTestId('toolbar-copy-menu-button');
  await user.click(copyMenuButton);
  
  const copyActiveItem = await screen.findByTestId('copy-active-menu-item');
  await user.click(copyActiveItem);
  
  expect(mockClipboard.writeText).toHaveBeenCalled();
});
```

### Example 2: Download Calls Test (Before)
```javascript
test('downloads calls when download calls button clicked', async () => {
  render(<ProcessorScreen />);
  const user = userEvent.setup();
  
  const downloadButton = screen.getByTestId('download-calls-button');
  await user.click(downloadButton);
  
  await waitFor(() => {
    expect(mockExport).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'CALLS' })
    );
  });
});
```

### Example 2: Download Calls Test (After)
```javascript
test('downloads calls when download calls button clicked', async () => {
  render(<ProcessorScreen />);
  const user = userEvent.setup();
  
  // Open download menu
  const downloadMenuButton = screen.getByTestId('toolbar-download-menu-button');
  await user.click(downloadMenuButton);
  
  // Click the specific menu item
  const downloadCallsItem = await screen.findByTestId('download-calls-menu-item');
  await user.click(downloadCallsItem);
  
  await waitFor(() => {
    expect(mockExport).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'CALLS' })
    );
  });
});
```

### Example 3: Testing Disabled States (Before)
```javascript
test('disables buttons when processing', () => {
  const { getByTestId } = render(<ProcessorScreen />);
  
  // Simulate processing state
  act(() => {
    // trigger processing...
  });
  
  expect(getByTestId('copy-active-button')).toBeDisabled();
  expect(getByTestId('download-active-button')).toBeDisabled();
});
```

### Example 3: Testing Disabled States (After)
```javascript
test('disables menu buttons when processing', () => {
  const { getByTestId } = render(<ProcessorScreen />);
  
  // Simulate processing state
  act(() => {
    // trigger processing...
  });
  
  // Menu buttons themselves are disabled (can't open menu)
  expect(getByTestId('toolbar-copy-menu-button')).toBeDisabled();
  expect(getByTestId('toolbar-download-menu-button')).toBeDisabled();
});
```

### Example 4: Testing Individual Menu Item States (New)
```javascript
test('disables menu items based on data availability', async () => {
  const { getByTestId } = render(<ProcessorScreen />);
  const user = userEvent.setup();
  
  // Process data with only PUTS
  // ... process logic ...
  
  // Open copy menu
  await user.click(getByTestId('toolbar-copy-menu-button'));
  
  // Verify specific items are enabled/disabled
  const copyCallsItem = await screen.findByTestId('copy-calls-menu-item');
  const copyPutsItem = await screen.findByTestId('copy-puts-menu-item');
  
  expect(copyCallsItem).toHaveAttribute('aria-disabled', 'true');
  expect(copyPutsItem).not.toHaveAttribute('aria-disabled', 'true');
});
```

## Helper Functions (Recommended)

Create test utilities to simplify menu interactions:

```javascript
// tests/helpers/toolbar-actions.js

export async function openCopyMenu(user, screen) {
  const menuButton = screen.getByTestId('toolbar-copy-menu-button');
  await user.click(menuButton);
  return screen;
}

export async function openDownloadMenu(user, screen) {
  const menuButton = screen.getByTestId('toolbar-download-menu-button');
  await user.click(menuButton);
  return screen;
}

export async function clickCopyAction(user, screen, action) {
  await openCopyMenu(user, screen);
  const menuItem = await screen.findByTestId(`copy-${action}-menu-item`);
  await user.click(menuItem);
}

export async function clickDownloadAction(user, screen, action) {
  await openDownloadMenu(user, screen);
  const menuItem = await screen.findByTestId(`download-${action}-menu-item`);
  await user.click(menuItem);
}
```

Usage:
```javascript
import { clickCopyAction, clickDownloadAction } from './helpers/toolbar-actions';

test('copies active view', async () => {
  render(<ProcessorScreen />);
  const user = userEvent.setup();
  
  await clickCopyAction(user, screen, 'active');
  
  expect(mockClipboard.writeText).toHaveBeenCalled();
});

test('downloads puts', async () => {
  render(<ProcessorScreen />);
  const user = userEvent.setup();
  
  await clickDownloadAction(user, screen, 'puts');
  
  expect(mockExport).toHaveBeenCalledWith(
    expect.objectContaining({ scope: 'PUTS' })
  );
});
```

## Additional New Test IDs

### Toolbar Actions
- `toolbar-copy-menu-button` - Copy menu trigger
- `toolbar-download-menu-button` - Download menu trigger
- `toolbar-filters-button` - Toggle filters visibility
- `toolbar-settings-button` - Navigate to settings

### Menu Items
- `copy-active-menu-item`
- `copy-calls-menu-item`
- `copy-puts-menu-item`
- `copy-combined-menu-item`
- `download-active-menu-item`
- `download-calls-menu-item`
- `download-puts-menu-item`
- `download-combined-menu-item`
- `download-all-menu-item`

### Group Filter (Changed from ToggleButton to Chip)
- `group-filter` - Container (unchanged)
- `group-filter-option-{id}` - Individual filter chips (unchanged, but now Chips instead of ToggleButtons)

## Testing Menu Behavior

### Test Menu Opens and Closes
```javascript
test('copy menu opens and closes', async () => {
  render(<ProcessorScreen />);
  const user = userEvent.setup();
  
  const menuButton = screen.getByTestId('toolbar-copy-menu-button');
  
  // Menu should not be visible initially
  expect(screen.queryByTestId('copy-active-menu-item')).not.toBeInTheDocument();
  
  // Click to open
  await user.click(menuButton);
  expect(await screen.findByTestId('copy-active-menu-item')).toBeInTheDocument();
  
  // Click outside or press Escape to close
  await user.keyboard('{Escape}');
  await waitFor(() => {
    expect(screen.queryByTestId('copy-active-menu-item')).not.toBeInTheDocument();
  });
});
```

### Test Menu Auto-Closes After Action
```javascript
test('menu closes after action', async () => {
  render(<ProcessorScreen />);
  const user = userEvent.setup();
  
  // Open menu
  await user.click(screen.getByTestId('toolbar-copy-menu-button'));
  
  // Click an action
  const copyActiveItem = await screen.findByTestId('copy-active-menu-item');
  await user.click(copyActiveItem);
  
  // Menu should close automatically
  await waitFor(() => {
    expect(screen.queryByTestId('copy-active-menu-item')).not.toBeInTheDocument();
  });
});
```

## Files That Need Updates

Based on test failures, these files need migration:

1. `tests/integration/processor-flow.spec.jsx` - Update all action button references
2. `tests/integration/view-toggle.spec.jsx` - Update copy/download button tests
3. `tests/integration/processor-puts.spec.jsx` - Update action tests
4. Any other test files using old test IDs

## Migration Checklist

- [ ] Replace direct button clicks with menu open → menu item click
- [ ] Update test IDs from old format to new format
- [ ] Add `await screen.findByTestId()` for menu items (async appearance)
- [ ] Test disabled states on menu buttons (not individual items in all cases)
- [ ] Consider creating helper functions for common menu interactions
- [ ] Update snapshot tests if any exist
- [ ] Verify menu accessibility (keyboard navigation, escape to close)

## Notes

- Menu items are not in the DOM until the menu is opened
- Use `findByTestId` (async) for menu items, not `getByTestId`
- Menu auto-closes after clicking an item (test this behavior)
- Toolbar only renders when `report` exists (after processing)
- Filter toggle button is new - add tests for show/hide filters functionality
