import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Popover from '@mui/material/Popover';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CloudIcon from '@mui/icons-material/Cloud';
import DescriptionIcon from '@mui/icons-material/Description';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

/**
 * Format timestamp as "hace X minutos/horas"
 * @param {number|null} timestamp - Epoch milliseconds
 * @returns {string|null} Formatted relative time
 */
const formatLastSync = (timestamp) => {
  if (!timestamp) return null;
  
  try {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'hace menos de 1 minuto';
    if (minutes < 60) return `hace ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`;
    if (hours < 24) return `hace ${hours} ${hours === 1 ? 'hora' : 'horas'}`;
    return `hace ${days} ${days === 1 ? 'día' : 'días'}`;
  } catch {
    return null;
  }
};

/**
 * Data Sources Panel - Shows all active data sources (Broker + CSV files) as a popover
 * 
 * @param {Object} props
 * @param {Object} props.brokerSource - Broker connection info
 * @param {boolean} props.brokerSource.connected - Is broker connected
 * @param {string} props.brokerSource.accountId - Account identifier
 * @param {number} props.brokerSource.operationCount - Operations from broker
 * @param {number|null} props.brokerSource.lastSyncTimestamp - Last sync time
 * @param {boolean} props.brokerSource.syncing - Currently syncing
 * @param {Object} props.csvSource - CSV file info
 * @param {string|null} props.csvSource.fileName - CSV file name
 * @param {number} props.csvSource.operationCount - Operations from CSV
 * @param {Function} props.onRefreshBroker - Callback to refresh broker data
 * @param {Function} props.onProcessBroker - Callback to process broker operations through pipeline
 * @param {Function} props.onRemoveCsv - Callback to remove CSV file
 */
const DataSourcesPanel = ({
  brokerSource = null,
  csvSource = null,
  onRefreshBroker,
  onProcessBroker,
  onRemoveCsv,
}) => {
  const [anchorEl, setAnchorEl] = useState(null);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);

  const totalSources = [brokerSource?.connected, csvSource?.fileName].filter(Boolean).length;
  const totalOperations = (brokerSource?.operationCount || 0) + (csvSource?.operationCount || 0);

  if (totalSources === 0) {
    return null; // Don't show if no data sources
  }

  return (
    <>
      {/* Clickable Chip with Sync Button */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Chip
          icon={<ExpandMoreIcon />}
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography variant="body2" component="span">
                📊 Fuentes de Datos
              </Typography>
              <Typography variant="caption" component="span" sx={{ opacity: 0.7 }}>
                ({totalSources} {totalSources === 1 ? 'fuente' : 'fuentes'})
              </Typography>
              {totalOperations > 0 && (
                <Typography variant="caption" component="span" sx={{ ml: 0.5, opacity: 0.7 }}>
                  · {totalOperations} ops
                </Typography>
              )}
            </Box>
          }
          onClick={handleClick}
          sx={{
            cursor: 'pointer',
            '&:hover': {
              bgcolor: 'action.hover',
            },
          }}
        />
        
        {/* Sync Button (only if broker is connected) */}
        {brokerSource?.connected && (
          <IconButton
            size="small"
            onClick={onRefreshBroker}
            disabled={brokerSource.syncing}
            title="Sincronizar con el broker"
            sx={{
              animation: brokerSource.syncing ? 'spin 1s linear infinite' : 'none',
              '@keyframes spin': {
                '0%': { transform: 'rotate(0deg)' },
                '100%': { transform: 'rotate(360deg)' },
              },
            }}
          >
            <RefreshIcon fontSize="small" />
          </IconButton>
        )}
      </Box>

      {/* Popover with Details */}
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        PaperProps={{
          sx: {
            mt: 1,
            minWidth: 320,
            maxWidth: 450,
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Stack spacing={2} divider={<Divider />}>
          {/* Broker Source */}
          {brokerSource?.connected && (
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <CloudIcon
                  fontSize="small"
                  color={brokerSource.syncing ? 'action' : 'success'}
                  sx={{
                    animation: brokerSource.syncing ? 'pulse 1.5s ease-in-out infinite' : 'none',
                    '@keyframes pulse': {
                      '0%, 100%': { opacity: 1 },
                      '50%': { opacity: 0.5 },
                    },
                  }}
                />
                <Typography variant="body2" fontWeight="medium">
                  Broker
                </Typography>
                <Chip
                  label={`Cuenta: ${brokerSource.accountId}`}
                  size="small"
                  variant="outlined"
                />
              </Stack>

              <Stack spacing={0.5} sx={{ pl: 3.5 }}>
                <Typography variant="caption" color="text.secondary">
                  {brokerSource.operationCount || 0} operaciones
                  {brokerSource.lastSyncTimestamp && (
                    <> · Última sync: {formatLastSync(brokerSource.lastSyncTimestamp)}</>
                  )}
                </Typography>

                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    size="small"
                    startIcon={<RefreshIcon />}
                    onClick={onRefreshBroker}
                    disabled={brokerSource.syncing}
                  >
                    Actualizar
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<PlayArrowIcon />}
                    onClick={onProcessBroker}
                    disabled={brokerSource.syncing || !brokerSource.operationCount}
                  >
                    Procesar
                  </Button>
                </Box>
              </Stack>
            </Box>
          )}

          {/* CSV Source */}
          {csvSource?.fileName && (
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <DescriptionIcon fontSize="small" color="primary" />
                <Typography
                  variant="body2"
                  fontWeight="medium"
                  sx={{
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={csvSource.fileName}
                >
                  {csvSource.fileName}
                </Typography>
                <IconButton
                  size="small"
                  onClick={onRemoveCsv}
                  title="Eliminar archivo CSV"
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Stack>

              <Stack spacing={0.5} sx={{ pl: 3.5 }}>
                <Typography variant="caption" color="text.secondary">
                  {csvSource.operationCount || 0} operaciones
                </Typography>
              </Stack>
            </Box>
          )}
          </Stack>
        </Box>
      </Popover>
    </>
  );
};

export default DataSourcesPanel;
