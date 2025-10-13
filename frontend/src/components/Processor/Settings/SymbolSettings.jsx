import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
} from '@mui/material';
import { validatePrefix, validateDecimals } from '../../../services/settings-utils';
import { loadSymbolConfig, saveSymbolConfig } from '../../../services/storage-settings';
import { DECIMALS_MIN, DECIMALS_MAX } from '../../../services/settings-types';
import strings from '../../../strings';

/**
 * SymbolSettings panel component for editing symbol-level defaults.
 * Implements write-on-blur persistence per FR-010.
 * 
 * @param {Object} props
 * @param {string} props.symbol - Current active symbol
 * @param {Object} props.config - Current symbol configuration
 * @param {Function} props.onConfigUpdate - Callback when config is updated
 */
export default function SymbolSettings({ symbol, config, onConfigUpdate }) {
  const [prefix, setPrefix] = useState('');
  const [decimals, setDecimals] = useState(2);
  const [prefixError, setPrefixError] = useState('');
  const [decimalsError, setDecimalsError] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Initialize local state from config
  useEffect(() => {
    if (config) {
      setPrefix(config.prefix || '');
      setDecimals(config.defaultDecimals || 2);
      setHasUnsavedChanges(false);
      setPrefixError('');
      setDecimalsError('');
      setSaveSuccess(false);
    }
  }, [config]);

  const handlePrefixChange = (e) => {
    setPrefix(e.target.value);
    setHasUnsavedChanges(true);
    setSaveSuccess(false);
    setPrefixError('');
  };

  const handleDecimalsChange = (e) => {
    setDecimals(e.target.value);
    setHasUnsavedChanges(true);
    setSaveSuccess(false);
    setDecimalsError('');
  };

  const handlePrefixBlur = () => {
    if (!prefix.trim()) {
      // Empty prefix is valid - clear error and save
      setPrefixError('');
      saveField('prefix', '');
      return;
    }

    const validation = validatePrefix(prefix);
    if (!validation.valid) {
      setPrefixError(validation.error);
      return;
    }

    // Save normalized value
    saveField('prefix', validation.value);
  };

  const handleDecimalsBlur = () => {
    const validation = validateDecimals(decimals);
    if (!validation.valid) {
      setDecimalsError(validation.error);
      return;
    }

    // Save normalized value
    saveField('defaultDecimals', validation.value);
  };

  const saveField = (fieldName, value) => {
    try {
      const updatedConfig = {
        ...config,
        [fieldName]: value,
      };

      saveSymbolConfig(updatedConfig);
      setHasUnsavedChanges(false);
      setSaveSuccess(true);
      
      // Call parent callback to refresh config
      if (onConfigUpdate) {
        onConfigUpdate(updatedConfig);
      }

      // Clear success message after 2 seconds
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error('PO: Error saving symbol config:', error);
      if (fieldName === 'prefix') {
        setPrefixError(strings.settings.symbolSettings.errorSaveFailed);
      } else {
        setDecimalsError(strings.settings.symbolSettings.errorSaveFailed);
      }
    }
  };

  const handleReset = () => {
    try {
      // Reload config from storage
      const savedConfig = loadSymbolConfig(symbol);
      if (savedConfig) {
        setPrefix(savedConfig.prefix || '');
        setDecimals(savedConfig.defaultDecimals || 2);
        setHasUnsavedChanges(false);
        setPrefixError('');
        setDecimalsError('');
        setSaveSuccess(false);
        
        // Notify parent
        if (onConfigUpdate) {
          onConfigUpdate(savedConfig);
        }
      }
    } catch (error) {
      console.error('PO: Error reloading symbol config:', error);
    }
  };

  if (!config) {
    return null;
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        {strings.settings.symbolSettings.symbolDefaultsTitle}
      </Typography>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {strings.settings.symbolSettings.symbolDefaultsDescription}
      </Typography>

      {saveSuccess && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {strings.settings.symbolSettings.saveSuccess}
        </Alert>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 400 }}>
        <TextField
          label={strings.settings.symbolSettings.prefixLabel}
          value={prefix}
          onChange={handlePrefixChange}
          onBlur={handlePrefixBlur}
          error={!!prefixError}
          helperText={prefixError || strings.settings.symbolSettings.prefixHelperText}
          fullWidth
          inputProps={{ maxLength: 10 }}
        />

        <TextField
          label={strings.settings.symbolSettings.defaultDecimalsLabel}
          type="number"
          value={decimals}
          onChange={handleDecimalsChange}
          onBlur={handleDecimalsBlur}
          error={!!decimalsError}
          helperText={decimalsError || strings.settings.symbolSettings.decimalsHelperText}
          fullWidth
          inputProps={{
            min: DECIMALS_MIN,
            max: DECIMALS_MAX,
            step: 1,
          }}
        />

        <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
          <Button
            variant="outlined"
            onClick={handleReset}
            disabled={!hasUnsavedChanges}
          >
            {strings.settings.symbolSettings.resetButton}
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
