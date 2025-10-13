import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Tooltip from '@mui/material/Tooltip';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import FilterListIcon from '@mui/icons-material/FilterList';

const SecondaryToolbar = ({
  strings,
  filtersVisible,
  averagingEnabled,
  onToggleFilters,
  onToggleAveraging,
  fileMenuSlot,
}) => {
  return (
    <Toolbar
      variant="dense"
      sx={{
        gap: 1,
        borderBottom: 1,
        borderColor: 'divider',
        backgroundColor: 'background.paper',
        minHeight: 48,
        px: 2,
      }}
    >
      {/* Left side: file menu + averaging toggle */}
      <Box sx={{ display:'flex', alignItems:'center', gap: 0.5 }}>
        {fileMenuSlot}
        <Tooltip title={strings?.processor?.upload?.averagingSwitch || 'Promediar por strike'}>
          <FormControlLabel
            sx={{ ml:0, mr:1, '& .MuiFormControlLabel-label': { display:'none' } }}
            control={(
              <Switch
                size="small"
                checked={averagingEnabled}
                onChange={(e) => onToggleAveraging?.(e.target.checked)}
                color="primary"
                data-testid="averaging-switch"
                inputProps={{ 'aria-label': 'Promediar por strike', 'data-testid': 'averaging-switch' }}
              />
            )}
          />
        </Tooltip>
      </Box>
      
      {/* Right side: filters toggle */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml:'auto' }}>
        <Tooltip title={filtersVisible ? (strings?.actions?.hideFilters || 'Ocultar filtros') : (strings?.actions?.showFilters || 'Mostrar filtros')}>
          <IconButton
            aria-label={filtersVisible ? 'Ocultar filtros' : 'Mostrar filtros'}
            onClick={onToggleFilters}
            size="small"
            color={filtersVisible ? 'primary' : 'default'}
            data-testid="toolbar-filter-toggle"
          >
            <FilterListIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </Toolbar>
  );
};

export default SecondaryToolbar;
