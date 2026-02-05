import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Outlet } from 'react-router-dom';

import { useConfig } from '../../state/index.js';
import { useStrings } from '../../strings/index.js';
import { getUserLocale, saveUserLocale, AVAILABLE_LOCALES } from '../../services/locale.js';

const SettingsScreen = () => {
  const settingsStrings = useStrings().settings;
  const { resetDefaults, storageEnabled, hydrated } = useConfig();
  const [currentLocale, setCurrentLocale] = useState(getUserLocale());

  const handleLocaleChange = (event) => {
    const newLocale = event.target.value;
    saveUserLocale(newLocale);
    setCurrentLocale(newLocale);
    window.location.reload();
  };

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4" component="h1" gutterBottom>
          {settingsStrings.title}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {settingsStrings.description}
        </Typography>
      </Box>

      {storageEnabled === false && (
        <Alert severity="warning">{settingsStrings.storageDisabled}</Alert>
      )}

      {!hydrated && <LinearProgress />}

      <Paper sx={{ p: 3 }} elevation={1}>
        <Typography variant="h6" gutterBottom>
          Formato Regional
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
            Define cómo se muestran los números (decimales y miles).
        </Typography>
        <FormControl fullWidth size="small" sx={{ maxWidth: 400 }}>
          <InputLabel id="locale-select-label">Formato de Números</InputLabel>
          <Select
            labelId="locale-select-label"
            value={currentLocale}
            label="Formato de Números"
            onChange={handleLocaleChange}
          >
            {AVAILABLE_LOCALES.map((loc) => (
              <MenuItem key={loc.code} value={loc.code}>
                {loc.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Typography variant="caption" display="block" sx={{ mt: 1, color: 'text.secondary' }}>
            La página se recargará automáticamente al cambiar esta configuración.
        </Typography>
      </Paper>

      <Box width="100%" data-testid="settings-content">
        <Outlet />
      </Box>

      <Box
        display="flex"
        flexDirection={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'center' }}
        gap={2}
      >
        <Typography variant="body2" color="text.secondary">
          {settingsStrings.resetDescription}
        </Typography>
        <Button
          variant="outlined"
          color="primary"
          onClick={resetDefaults}
          data-testid="settings-restore-defaults"
        >
          {settingsStrings.resetButton}
        </Button>
      </Box>
    </Stack>
  );
};

export default SettingsScreen;
