import React, { useState } from 'react';
import { Box, Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions, Alert } from '@mui/material';
import { validateSymbol } from '../../../services/settings-utils.js';
import { createDefaultSymbolConfigWithOverrides } from '../../../services/settings-types.js';
import { saveSymbolConfig, symbolExists } from '../../../services/storage-settings.js';
import strings from '../../../strings/es-AR.js';

const s = strings.settings.symbolSettings;

export default function AddSymbol({ onSymbolAdded }) {
  const [open, setOpen] = useState(false);
  const [symbol, setSymbol] = useState('');
  const [error, setError] = useState('');

  const handleOpen = () => {
    setOpen(true);
    setSymbol('');
    setError('');
  };

  const handleClose = () => {
    setOpen(false);
    setSymbol('');
    setError('');
  };

  const handleAdd = async () => {
    // Validate symbol
    const validation = validateSymbol(symbol);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }

    const normalized = validation.normalized;

    // Check uniqueness
    if (await symbolExists(normalized)) {
      setError(s.errorSymbolDuplicate);
      return;
    }

  // Create and save default config (apply any symbol-specific overrides)
  const config = createDefaultSymbolConfigWithOverrides(normalized);
    const saved = await saveSymbolConfig(config);

    if (saved) {
      handleClose();
      if (onSymbolAdded) {
        onSymbolAdded(normalized);
      }
    } else {
      setError('Error al guardar el símbolo.');
    }
  };

  return (
    <>
      <Button variant="contained" onClick={handleOpen}>
        {s.addSymbolButton}
      </Button>

      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>{s.addSymbolTitle}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            <TextField
              autoFocus
              fullWidth
              label={s.symbolLabel}
              placeholder={s.symbolPlaceholder}
              value={symbol}
              onChange={(e) => {
                setSymbol(e.target.value);
                setError('');
              }}
              helperText={s.symbolHelper}
              inputProps={{ 'aria-label': s.symbolLabel }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancelar</Button>
          <Button onClick={handleAdd} variant="contained">
            Agregar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
