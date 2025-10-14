import Stack from '@mui/material/Stack';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import ArrowCircleUpIcon from '@mui/icons-material/ArrowCircleUp';
import ArrowCircleDownIcon from '@mui/icons-material/ArrowCircleDown';
import SettingsIcon from '@mui/icons-material/Settings';

const ProcessorTabs = ({ strings, activePreview, onPreviewChange, onNavigateSettings }) => {
  const previewLabel = strings?.previewLabel ?? '';
  const callsLabel = strings?.callsTab ?? 'CALLS';
  const putsLabel = strings?.putsTab ?? 'PUTS';
  const settingsLabel = strings?.settingsButton ?? 'Configuración';
  const previewAriaLabel = strings?.previewAriaLabel ?? 'Seleccionar vista de resultados';

  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      spacing={2}
      alignItems={{ xs: 'flex-start', md: 'center' }}
      justifyContent="space-between"
    >
      <Stack spacing={1} alignItems={{ xs: 'flex-start', md: 'center' }}>
        {previewLabel && (
          <Typography variant="subtitle2" color="text.secondary">
            {previewLabel}
          </Typography>
        )}
        <Tabs
          value={activePreview}
          onChange={onPreviewChange}
          aria-label={previewAriaLabel}
        >
          <Tab 
            label={callsLabel} 
            value="CALLS"
            icon={<ArrowCircleUpIcon />}
            iconPosition="start"
            sx={{
              '&.Mui-selected': {
                color: 'calls.main',
              },
            }}
          />
          <Tab 
            label={putsLabel} 
            value="PUTS"
            icon={<ArrowCircleDownIcon />}
            iconPosition="start"
            sx={{
              '&.Mui-selected': {
                color: 'puts.main',
              },
            }}
          />
        </Tabs>
      </Stack>
      <Button
        variant="outlined"
        startIcon={<SettingsIcon />}
        onClick={onNavigateSettings}
        data-testid="processor-settings-tab"
      >
        {settingsLabel}
      </Button>
    </Stack>
  );
};

export default ProcessorTabs;
