// SyncStatus.jsx - Broker sync status display (T018)
import { useMemo } from 'react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import RefreshIcon from '@mui/icons-material/Refresh';
import CancelIcon from '@mui/icons-material/Cancel';

/**
 * Format timestamp as localized date/time string.
 * @param {number|null} timestamp - Epoch milliseconds
 * @returns {string} Formatted date/time or empty string
 */
const formatTimestamp = (timestamp) => {
  if (!timestamp) return '';
  
  try {
    return new Date(timestamp).toLocaleString('es-AR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '';
  }
};

/**
 * Sync status display component showing sync state, progress, and actions.
 * 
 * @param {Object} props
 * @param {Object} props.strings - Localized strings (es-AR)
 * @param {Object} props.syncState - Sync state from config context
 * @param {string} props.syncState.status - 'idle'|'in-progress'|'success'|'failed'|'canceled'
 * @param {boolean} props.syncState.inProgress - True if sync currently running
 * @param {number|null} props.syncState.lastSyncTimestamp - Last successful sync timestamp (epoch ms)
 * @param {number} props.syncState.pagesFetched - Number of pages fetched in current sync
 * @param {number} props.syncState.operationsImportedCount - Operations staged in current sync
 * @param {string|null} props.syncState.error - Error message if status === 'failed'
 * @param {Function} props.onRefresh - Callback to trigger manual refresh
 * @param {Function} props.onCancel - Callback to cancel in-progress sync
 * @param {boolean} props.canRefresh - True if refresh is allowed
 * @param {boolean} props.isAuthenticated - True if user is logged in
 */
const SyncStatus = ({
  strings,
  syncState,
  onRefresh,
  onCancel,
  canRefresh = true,
  isAuthenticated = false,
  sourceCounts = null,
}) => {
  const {
    status = 'idle',
    inProgress = false,
    lastSyncTimestamp = null,
    pagesFetched = 0,
    operationsImportedCount = 0,
    error = null,
    mode = 'daily',
  } = syncState || {};

  const lastSyncDisplay = useMemo(() => {
    if (!lastSyncTimestamp) return null;
    return formatTimestamp(lastSyncTimestamp);
  }, [lastSyncTimestamp]);

  const showProgress = inProgress && status === 'in-progress';
  const showError = status === 'failed' && error;
  const showCanceled = status === 'canceled';
  const showSuccess = status === 'success';
  const brokerStrings = strings.brokerSync ?? {};

  const shouldShowSourceCounts = Boolean(
    sourceCounts && (sourceCounts.total ?? 0) > 0,
  );

  const importedLabel = (brokerStrings.importedCount ?? 'Operaciones nuevas: {count}')
    .replace('{count}', operationsImportedCount);

  const sourceLabels = brokerStrings.sources ?? {};
  const modeLabel = brokerStrings.modes?.[mode] ?? null;

  // Don't render if user not authenticated
  if (!isAuthenticated) {
    return null;
  }

  return (
    <Paper elevation={1} sx={{ p: 2 }}>
      <Stack spacing={2}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle2" component="h3">
            Estado de sincronización
          </Typography>
          
          {!inProgress && canRefresh && (
            <Button
              size="small"
              startIcon={<RefreshIcon />}
              onClick={onRefresh}
              data-testid="sync-status-refresh-button"
            >
              {brokerStrings.refresh}
            </Button>
          )}
          
          {inProgress && (
            <Button
              size="small"
              color="error"
              startIcon={<CancelIcon />}
              onClick={onCancel}
              data-testid="sync-status-cancel-button"
            >
              {brokerStrings.cancel}
            </Button>
          )}
        </Box>

        {/* Progress indicator */}
        {showProgress && (
          <Box data-testid="sync-status-progress">
            <LinearProgress />
            <Stack direction="row" spacing={1} sx={{ mt: 1 }} alignItems="center">
              <CircularProgress size={16} />
              <Typography variant="body2" color="text.secondary">
                {brokerStrings.inProgress}
              </Typography>
              {pagesFetched > 0 && (
                <Chip 
                  label={`${operationsImportedCount} ops (${pagesFetched} páginas)`}
                  size="small"
                  data-testid="sync-status-progress-count"
                />
              )}
            </Stack>
          </Box>
        )}

        {/* Success message */}
        {showSuccess && !inProgress && (
          <Alert severity="success" data-testid="sync-status-success">
            {modeLabel || 'Sincronización completada'}
          </Alert>
        )}

        {/* Error message */}
        {showError && (
          <Alert severity="error" data-testid="sync-status-error">
            {error}
          </Alert>
        )}

        {/* Canceled message */}
        {showCanceled && (
          <Alert severity="info" data-testid="sync-status-canceled">
            {brokerStrings.canceled}
          </Alert>
        )}

        {/* Imported summary */}
        {showSuccess && !inProgress && (
          <Stack direction="row" spacing={1} data-testid="sync-status-imported">
            <Chip label={importedLabel} size="small" />
          </Stack>
        )}

        {/* Source breakdown */}
        {shouldShowSourceCounts && (
          <Stack
            direction="row"
            spacing={1}
            flexWrap="wrap"
            data-testid="sync-status-source-counts"
          >
            <Chip
              label={`${sourceLabels.broker ?? 'Broker'}: ${sourceCounts.broker ?? 0}`}
              size="small"
            />
            <Chip
              label={`${sourceLabels.csv ?? 'CSV'}: ${sourceCounts.csv ?? 0}`}
              size="small"
            />
            <Chip
              label={`${sourceLabels.total ?? 'Total'}: ${sourceCounts.total ?? 0}`}
              size="small"
            />
            {sourceCounts.other > 0 && (
              <Chip
                label={`${sourceLabels.other ?? 'Otros'}: ${sourceCounts.other}`}
                size="small"
              />
            )}
          </Stack>
        )}

        {/* Last sync timestamp */}
        {lastSyncDisplay && (
          <Typography variant="caption" color="text.secondary" data-testid="sync-status-last-sync">
            {brokerStrings.lastSync}: {lastSyncDisplay}
          </Typography>
        )}
      </Stack>
    </Paper>
  );
};

export default SyncStatus;
