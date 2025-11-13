import { useState, useEffect } from 'react';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';

import { loadSymbolConfig, saveSymbolConfig } from '../../services/storage-settings.js';
import { showToast } from '../../services/toastService.js';

/**
 * Quick action button to add a strike as an exception directly from the operations table.
 * Extracts metadata from the operation and pre-fills the exception form.
 * 
 * @param {Object} props
 * @param {Object} props.operation - Operation object with symbol, expiration, strike, and metadata
 * @param {Object} props.strings - Localization strings
 */
export default function AddStrikeExceptionButton({ operation, strings }) {
  const [open, setOpen] = useState(false);
  const [rawToken, setRawToken] = useState('');
  const [formatted, setFormatted] = useState('');
  const [skipFormatting, setSkipFormatting] = useState(true); // Default to true for exceptions
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [hasException, setHasException] = useState(false);

  const s = strings?.addStrikeException || {};

  // Check if this strike already has an exception configured
  useEffect(() => {
    const checkException = async () => {
      const firstLeg = operation?.legs?.[0];
      const symbol = operation?.matchedSymbol || operation?.symbol || firstLeg?.symbol;
      const expiration = operation?.expiration || firstLeg?.expiration;
      const strikeValue = operation?.strike;

      if (!symbol || !expiration || strikeValue == null) {
        return;
      }

      try {
        const config = await loadSymbolConfig(symbol);
        
        // Find the matching expiration key - might be abbreviated (D vs DIC)
        let expirationKey = expiration;
        const availableKeys = Object.keys(config?.expirations || {});
        
        if (!config?.expirations?.[expiration]) {
          // Try to find a key that starts with the expiration letter
          const matchingKey = availableKeys.find(key => 
            key.toUpperCase().startsWith(expiration.toUpperCase())
          );
          if (matchingKey) {
            expirationKey = matchingKey;
          }
        }
        
        if (!config?.expirations?.[expirationKey]?.overrides) {
          return;
        }

        const overrides = config.expirations[expirationKey].overrides;

        // Check if any override matches this strike
        // Try multiple comparison strategies
        const strikeStr = String(strikeValue).replace(/\./g, '').replace(/,/g, '');
        const strikeFormatted = String(strikeValue);
        const strikeNum = Number(strikeValue);
        
        const exists = overrides.some(override => {
          const rawMatch = override.raw === strikeStr;
          const formattedMatch = override.formatted === strikeFormatted;
          const numMatch = Number(override.formatted) === strikeNum;
          
          return rawMatch || formattedMatch || numMatch;
        });
        
        setHasException(exists);
      } catch (err) {
        console.error('Error checking strike exception:', err);
      }
    };

    checkException();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operation]);

  const handleOpen = () => {
    // Extract strike token from operation metadata
    // Try to get metadata from the first leg if available
    const firstLeg = operation?.legs?.[0];
    const strikeToken = firstLeg?.meta?.sourceToken || operation?.meta?.sourceToken || '';
    const strikeValue = operation?.strike;
    
    // Extract raw numeric token from the sourceToken if available
    // Format: SYMBOLC/V[DIGITS]SUFFIX (e.g., "GFGC10177D")
    const tokenMatch = strikeToken.match(/[CV](\d+)/i);
    const extractedRaw = tokenMatch ? tokenMatch[1] : '';

    setRawToken(extractedRaw || String(strikeValue || '').replace(/\./g, ''));
    setFormatted(String(strikeValue || ''));
    setSkipFormatting(true);
    setError('');
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setError('');
  };

  const handleSave = async () => {
    setError('');

    // Validate inputs
    if (!rawToken.trim()) {
      setError(s.errorRawRequired || 'Ingresá el valor sin formato');
      return;
    }

    if (!/^\d+$/.test(rawToken.trim())) {
      setError(s.errorRawInvalid || 'El valor debe ser numérico');
      return;
    }

    if (!formatted.trim()) {
      setError(s.errorFormattedRequired || 'Ingresá el valor formateado');
      return;
    }

    // Try to get symbol and expiration from operation or first leg
    const firstLeg = operation?.legs?.[0];
    const symbol = operation?.matchedSymbol || operation?.symbol || firstLeg?.symbol;
    const expiration = operation?.expiration || firstLeg?.expiration;

    if (!symbol || !expiration) {
      setError(s.errorMissingMetadata || 'No se puede determinar el símbolo o vencimiento');
      return;
    }

    setSaving(true);

    try {
      // Load existing configuration
      let config = await loadSymbolConfig(symbol);

      if (!config) {
        // Create new configuration if doesn't exist
        config = {
          symbol,
          prefix: symbol.substring(0, 3).toUpperCase(), // Default prefix
          defaultDecimals: 1,
          strikeDefaultDecimals: 1,
          expirations: {},
          updatedAt: Date.now(),
        };
      }

      // Find the matching expiration key - might be abbreviated (D vs DIC)
      let expirationKey = expiration;
      const availableKeys = Object.keys(config.expirations || {});
      
      if (!config.expirations[expiration]) {
        // Try to find a key that starts with the expiration letter
        const matchingKey = availableKeys.find(key => 
          key.toUpperCase().startsWith(expiration.toUpperCase())
        );
        if (matchingKey) {
          expirationKey = matchingKey;
        }
      }

      // Ensure expiration exists
      if (!config.expirations[expirationKey]) {
        config.expirations[expirationKey] = {
          suffixes: [expirationKey],
          decimals: config.defaultDecimals || 1,
          overrides: [],
        };
      }

      // Check for duplicate
      const existingOverride = config.expirations[expirationKey].overrides?.find(
        o => o.raw === rawToken.trim()
      );

      if (existingOverride) {
        setError(s.errorDuplicate || 'Ya existe un ajuste para este valor');
        setSaving(false);
        return;
      }

      // Add the new override
      const newOverride = {
        raw: rawToken.trim(),
        formatted: formatted.trim(),
        ...(skipFormatting && { skipDecimalFormatting: true }),
      };

      if (!Array.isArray(config.expirations[expirationKey].overrides)) {
        config.expirations[expirationKey].overrides = [];
      }

      config.expirations[expirationKey].overrides.push(newOverride);
      config.updatedAt = Date.now();

      // Save configuration
      await saveSymbolConfig(config);

      showToast(
        s.successMessage || `Excepción agregada: ${rawToken} → ${formatted}`,
        'success'
      );

      setHasException(true);
      handleClose();
    } catch (err) {
      console.error('Error saving strike exception:', err);
      setError(s.errorSaving || 'Error al guardar la excepción');
    } finally {
      setSaving(false);
    }
  };

  // Check if we have essential data (from operation or legs)
  const firstLeg = operation?.legs?.[0];
  const hasSymbol = operation?.symbol || operation?.matchedSymbol || firstLeg?.symbol;
  const hasExpiration = operation?.expiration || firstLeg?.expiration;
  const hasStrike = operation?.strike != null;

  // Don't show button if essential metadata is missing
  if (!hasSymbol || !hasExpiration || !hasStrike) {
    return null;
  }

  return (
    <>
      <Tooltip 
        title={hasException ? 'Strike con excepción configurada' : (s.buttonTooltip || 'Agregar como excepción')}
        placement="right"
      >
        <IconButton
          size="small"
          onClick={handleOpen}
          className="strike-exception-button"
          sx={{ 
            ml: 0.5,
            opacity: hasException ? 0.7 : 0,
            visibility: hasException ? 'visible' : 'hidden',
            transition: 'opacity 0.2s, visibility 0.2s',
            '&:hover': { opacity: 1 },
            padding: '2px',
            color: hasException ? 'success.main' : 'action.active',
          }}
        >
          <AddCircleOutlineIcon sx={{ fontSize: '1.1rem' }} />
        </IconButton>
      </Tooltip>

      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>{s.dialogTitle || 'Agregar Excepción de Strike'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="info" sx={{ fontSize: '0.875rem' }}>
              {s.dialogInfo || 'Esta excepción se aplicará al símbolo'} <strong>{operation.symbol}</strong>{' '}
              {s.dialogInfoExpiration || 'vencimiento'} <strong>{operation.expiration}</strong>
            </Alert>

            {error && <Alert severity="error">{error}</Alert>}

            <TextField
              label={s.rawTokenLabel || 'Valor sin formato'}
              value={rawToken}
              onChange={(e) => setRawToken(e.target.value)}
              placeholder="Ej. 10177"
              fullWidth
              size="small"
              helperText={s.rawTokenHelper || 'Token numérico extraído del símbolo'}
            />

            <TextField
              label={s.formattedLabel || 'Valor formateado'}
              value={formatted}
              onChange={(e) => setFormatted(e.target.value)}
              placeholder="Ej. 10177"
              fullWidth
              size="small"
              helperText={s.formattedHelper || 'Valor que se mostrará en las operaciones'}
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={skipFormatting}
                  onChange={(e) => setSkipFormatting(e.target.checked)}
                  size="small"
                />
              }
              label={s.skipFormattingLabel || 'Usar valor exacto (sin operación decimal)'}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={saving}>
            {s.cancelButton || 'Cancelar'}
          </Button>
          <Button onClick={handleSave} variant="contained" disabled={saving}>
            {saving ? (s.savingButton || 'Guardando...') : (s.saveButton || 'Guardar')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
