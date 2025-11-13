// InstrumentsSync.jsx - Instruments sync status and manual refresh control (Phase 4 - T021, T022, T023)
import { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import CircularProgress from '@mui/material/CircularProgress';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';

import instrumentsSyncService from '../../services/instrumentsSyncService.js';
import instrumentsSyncStorage from '../../services/instrumentsSyncStorage.js';

/**
 * Format ISO8601 timestamp as localized date/time string.
 * @param {string|null} isoTimestamp - ISO8601 timestamp
 * @returns {string} Formatted date/time or empty string
 */
const formatTimestamp = (isoTimestamp) => {
  if (!isoTimestamp) return '';
  
  try {
    return new Date(isoTimestamp).toLocaleString('es-AR', {
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
 * Instruments sync status and manual refresh component for web application.
 * Shows last sync timestamp, source, and provides manual refresh button.
 * 
 * **Note**: This component is for the web application ONLY, not the Chrome extension.
 * The Chrome extension uses automatic background sync via alarms.
 * 
 * @param {Object} props
 * @param {Object} props.strings - Localized strings (es-AR.brokerSync)
 */
export default function InstrumentsSync({ strings }) {
  const [syncState, setSyncState] = useState({
    status: 'idle', // 'idle' | 'syncing' | 'success' | 'error'
    lastSync: null, // { fetchedAt: string, source: string, instrumentsCount: number, versionHash: string }
    error: null,
  });

  /**
   * Load last sync metadata from storage on mount and after successful sync.
   */
  const loadLastSync = useCallback(async () => {
    try {
      const result = await instrumentsSyncStorage.readRecord();
      if (result && result.meta && result.record) {
        setSyncState(prev => ({
          ...prev,
          lastSync: {
            fetchedAt: result.meta.fetchedAt,
            source: result.meta.source || 'unknown',
            instrumentsCount: result.record.instruments?.length || 0,
            versionHash: result.meta.versionHash || '',
          },
        }));
      }
    } catch (error) {
      console.error('PO:instruments-sync [ERROR] loadLastSync failed', error);
    }
  }, []);

  useEffect(() => {
    loadLastSync();
  }, [loadLastSync]);

  /**
   * Handle manual refresh button click.
   * Calls instrumentsSyncService.syncNow() and updates UI state.
   */
  const handleManualRefresh = useCallback(async () => {
    setSyncState(prev => ({ ...prev, status: 'syncing', error: null }));

    try {
      const result = await instrumentsSyncService.syncNow();
      
      if (result.ok) {
        // Reload from storage to get complete metadata
        await loadLastSync();
        setSyncState(prev => ({
          ...prev,
          status: 'success',
          error: null,
        }));
      } else {
        setSyncState({
          status: 'error',
          lastSync: null,
          error: result.reason || 'Unknown error',
        });
      }
    } catch (error) {
      console.error('PO:instruments-sync [ERROR] handleManualRefresh failed', error);
      setSyncState({
        status: 'error',
        lastSync: null,
        error: error?.message || 'Sync failed',
      });
    }
  }, [loadLastSync]);

  const isLoading = syncState.status === 'syncing';
  const hasError = syncState.status === 'error';
  const hasSuccess = syncState.status === 'success';

  return (
    <Card>
      <CardHeader
        title="Sincronización de Instrumentos"
        subheader="Actualizar catálogo de instrumentos desde el broker"
      />
      <CardContent>
        <Stack spacing={3}>
          {/* Last Sync Display */}
          {syncState.lastSync && (
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {strings.lastSync || 'Última sincronización'}
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <CheckCircleIcon fontSize="small" color="success" />
                <Typography variant="body1">
                  {formatTimestamp(syncState.lastSync.fetchedAt)}
                </Typography>
              </Stack>
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <Chip
                  label={syncState.lastSync.source === 'broker-api' ? 'Broker API' : 'Archivo de respaldo'}
                  size="small"
                  color={syncState.lastSync.source === 'broker-api' ? 'primary' : 'default'}
                  icon={<CloudDownloadIcon />}
                />
                <Chip
                  label={`${syncState.lastSync.instrumentsCount} instrumentos`}
                  size="small"
                  variant="outlined"
                />
              </Stack>
            </Box>
          )}

          {/* Error Display */}
          {hasError && (
            <Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <ErrorIcon fontSize="small" color="error" />
                <Typography variant="body2" color="error">
                  Error: {syncState.error}
                </Typography>
              </Stack>
            </Box>
          )}

          {/* Success Message */}
          {hasSuccess && (
            <Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <CheckCircleIcon fontSize="small" color="success" />
                <Typography variant="body2" color="success.main">
                  {strings.refreshSuccess?.replace('{count}', syncState.lastSync?.instrumentsCount || 0) || 
                   'Sincronización completada exitosamente'}
                </Typography>
              </Stack>
            </Box>
          )}

          {/* Manual Refresh Button */}
          <Box>
            <Button
              variant="contained"
              color="primary"
              startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : <RefreshIcon />}
              onClick={handleManualRefresh}
              disabled={isLoading}
              aria-label={strings.manualTrigger || 'Sincronizar instrumentos ahora'}
              fullWidth
            >
              {isLoading 
                ? (strings.inProgress || 'Sincronizando...') 
                : (strings.manualTrigger || 'Sincronizar ahora')}
            </Button>
          </Box>

          {/* Info Text */}
          <Typography variant="caption" color="text.secondary">
            La sincronización descarga el catálogo actualizado de instrumentos desde el broker.
            Esto permite tener información precisa sobre opciones, bonos, acciones y cauciones disponibles.
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}
