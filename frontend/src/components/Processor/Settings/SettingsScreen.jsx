import React, { useState, useEffect, useCallback } from 'react';
import { Container, Box, Typography, Button, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Stack, Alert } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import RestoreIcon from '@mui/icons-material/Restore';
import AddSymbol from './AddSymbol.jsx';
import SymbolTabs from './SymbolTabs.jsx';
import SymbolSettings from './SymbolSettings.jsx';
import { getAllSymbols, loadSymbolConfig, deleteSymbolConfig, clearAllSymbols } from '../../../services/storage-settings.js';
import { seedDefaultSymbols } from '../../../services/bootstrap-defaults.js';
import strings from '../../../strings/es-AR.js';
import { showToast } from '../../../services/toastService.js';

const s = strings.settings.symbolSettings;

export default function SettingsScreen() {
  const [symbols, setSymbols] = useState([]);
  const [activeSymbol, setActiveSymbol] = useState(null);
  const [config, setConfig] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);

  const refreshSymbols = useCallback(async () => {
    const allSymbols = await getAllSymbols();
    setSymbols(allSymbols);
    if (allSymbols.length > 0 && !activeSymbol) {
      setActiveSymbol(allSymbols[0]);
    }
  }, [activeSymbol]);

  // Load symbols on mount
  useEffect(() => {
    (async () => {
      await seedDefaultSymbols();
      await refreshSymbols();
    })();
  }, [refreshSymbols]);

  // Load config when active symbol changes
  useEffect(() => {
    if (activeSymbol) {
      loadSymbolConfig(activeSymbol).then(loaded => setConfig(loaded));
    } else {
      setConfig(null);
    }
  }, [activeSymbol]);

  const handleSymbolAdded = (symbol) => {
    refreshSymbols();
    setActiveSymbol(symbol);
  };

  const handleConfigUpdate = (updatedConfig) => {
    setConfig(updatedConfig);
  };

  const handleDeleteSymbol = async () => {
    if (!activeSymbol) return;

    const success = await deleteSymbolConfig(activeSymbol);
    if (success) {
      showToast({ message: s.deleteSymbolSuccess, severity: 'success' });
      setDeleteDialogOpen(false);
      
      // Refresh symbols list and select a different symbol
      const allSymbols = await getAllSymbols();
      setSymbols(allSymbols);
      
      if (allSymbols.length > 0) {
        // Select the first symbol that's not the deleted one
        const newActive = allSymbols[0];
        setActiveSymbol(newActive);
      } else {
        setActiveSymbol(null);
        setConfig(null);
      }
    } else {
      showToast({ message: s.errorSaveFailed, severity: 'error' });
    }
  };

  const handleRestoreDefaults = async () => {
    const success = await clearAllSymbols();
    if (success) {
      showToast({ message: s.restoreDefaultsSuccess, severity: 'success' });
      setRestoreDialogOpen(false);
      
      // Re-seed defaults and refresh
      await seedDefaultSymbols();
      const allSymbols = await getAllSymbols();
      setSymbols(allSymbols);
      
      if (allSymbols.length > 0) {
        setActiveSymbol(allSymbols[0]);
      } else {
        setActiveSymbol(null);
        setConfig(null);
      }
    } else {
      showToast({ message: s.errorSaveFailed, severity: 'error' });
    }
  };

  // using global toast service; no local snackbar state

  return (
    <Container maxWidth={false} sx={{ py: 3, px: 4 }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            {s.title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {s.description}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button 
            variant="outlined" 
            color="warning"
            startIcon={<RestoreIcon />}
            onClick={() => setRestoreDialogOpen(true)}
          >
            {s.restoreDefaultsButton}
          </Button>
          <AddSymbol onSymbolAdded={handleSymbolAdded} />
        </Stack>
      </Box>

      {symbols.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="body1" color="text.secondary">
            {s.noSymbolsState}
          </Typography>
        </Box>
      ) : (
        <>
          <SymbolTabs
            symbols={symbols}
            activeSymbol={activeSymbol}
            onSymbolChange={setActiveSymbol}
          />

          {config && (
            <>
              <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  startIcon={<DeleteIcon />}
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  {s.deleteSymbolButton}
                </Button>
              </Box>
              
              <SymbolSettings
                symbol={activeSymbol}
                config={config}
                onConfigUpdate={handleConfigUpdate}
              />
            </>
          )}
        </>
      )}

      {/* Delete Symbol Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>{s.deleteSymbolTitle}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {s.deleteSymbolConfirm.replace('{symbol}', activeSymbol || '')}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleDeleteSymbol} color="error" variant="contained">
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Restore Defaults Confirmation Dialog */}
      <Dialog
        open={restoreDialogOpen}
        onClose={() => setRestoreDialogOpen(false)}
      >
        <DialogTitle>{s.restoreDefaultsTitle}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {s.restoreDefaultsConfirm}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRestoreDialogOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleRestoreDefaults} color="warning" variant="contained">
            Restaurar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Toasts are handled by the global ToastContainer */}
    </Container>
  );
}
