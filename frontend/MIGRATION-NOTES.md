# UI Migration Notes

## 2025-10-12: Remove deprecated MUI Grid v1 props

Replaced the `Grid` usage in `src/components/Processor/SummaryPanel.jsx` that produced runtime warnings:

```text
MUI Grid: The `item` prop has been removed and is no longer necessary.
MUI Grid: The `xs` prop has been removed.
MUI Grid: The `sm` prop has been removed.
```

Instead of migrating to the new Grid v2 API (which would require additional dependency alignment), we opted for a lightweight CSS Grid via `Box`:

```jsx
<Box
  sx={{
    display: 'grid',
    gap: 2,
    gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
  }}
>
  {/* SummaryMetric cards */}
</Box>
```

Benefits:

1. Eliminates deprecation warnings in integration tests.
2. Reduces dependency on MUI Grid abstraction for a simple equal-column layout.
3. Keeps responsive behavior (single column on small screens, 3 columns on >= `sm`).

If future, more complex, responsive layouts are needed, consider re-introducing MUI Grid v2 or `Unstable_Grid2` once the project standardizes on the upgraded API.

No behavioral or test selector changes were required (all `data-testid` attributes preserved).
