import React, { useState } from 'react';
import { Box, Paper, Typography, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { getUserLocale, saveUserLocale, AVAILABLE_LOCALES } from '../../../services/locale.js';

const PreferencesScreen = () => {
  const [currentLocale, setCurrentLocale] = useState(getUserLocale());

  const handleLocaleChange = (event) => {
    const newLocale = event.target.value;
    saveUserLocale(newLocale);
    setCurrentLocale(newLocale);
    window.location.reload();
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Preferencias
      </Typography>
      
      <Paper sx={{ p: 3, maxWidth: 600 }} elevation={1}>
        <Typography variant="h6" gutterBottom>
          Formato Regional
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Define cómo se muestran los números (separadores de miles y decimales).
        </Typography>
        <FormControl fullWidth size="small">
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
          La aplicación se recargará automáticamente al cambiar esta configuración.
        </Typography>
      </Paper>
    </Box>
  );
};

export default PreferencesScreen;
