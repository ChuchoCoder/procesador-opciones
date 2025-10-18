import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import TimelineIcon from '@mui/icons-material/Timeline';
import { OPERATION_TYPES } from './operation-types.js';

const OperationTypeTabs = ({ 
  strings, 
  activeTab, 
  onTabChange, 
  onClose, 
  fileName, 
  dataSourcesPanel,
  fileMenuSlot,
}) => {
  const opcionesLabel = strings?.operationTypeTabs?.opciones ?? 'Opciones';
  const compraVentaLabel = strings?.operationTypeTabs?.compraVenta ?? 'Compra y Venta';
  const arbitrajesLabel = strings?.operationTypeTabs?.arbitrajes ?? 'Arbitrajes de Plazo';
  const ariaLabel = strings?.operationTypeTabs?.ariaLabel ?? 'Seleccionar tipo de operación';

  const handleChange = (event, newValue) => {
    if (onTabChange) {
      onTabChange(newValue);
    }
  };

  return (
    <Box 
      sx={{ 
        borderBottom: 1, 
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: 2,
      }}
    >
      <Tabs
        value={activeTab}
        onChange={handleChange}
        aria-label={ariaLabel}
        variant="standard"
        sx={{ flex: 1 }}
      >
        <Tab 
          label={opcionesLabel} 
          value={OPERATION_TYPES.OPCIONES} 
          icon={<ShowChartIcon />}
          iconPosition="start"
          data-testid="tab-opciones"
        />
        <Tab 
          label={compraVentaLabel} 
          value={OPERATION_TYPES.COMPRA_VENTA}
          icon={<SwapHorizIcon />}
          iconPosition="start"
          data-testid="tab-compra-venta"
        />
        <Tab 
          label={arbitrajesLabel} 
          value={OPERATION_TYPES.ARBITRAJES}
          icon={<TimelineIcon />}
          iconPosition="start"
          data-testid="tab-arbitrajes"
        />
      </Tabs>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 2 }}>
        {dataSourcesPanel || (fileName && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <InsertDriveFileIcon fontSize="small" color="action" />
            <Typography 
              variant="body2" 
              color="text.secondary"
              sx={{ 
                maxWidth: 300,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {fileName}
            </Typography>
          </Box>
        ))}
        {fileMenuSlot}
        {onClose && (
          <IconButton
            size="small"
            onClick={onClose}
            aria-label="Cerrar y volver"
            data-testid="operation-tabs-close-button"
            sx={{ ml: 1 }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        )}
      </Box>
    </Box>
  );
};

export default OperationTypeTabs;

// If other modules need OPERATION_TYPES, they should import from a dedicated constants file
