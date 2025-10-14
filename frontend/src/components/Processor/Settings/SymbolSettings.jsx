import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  Divider,
  Tooltip,
  IconButton,
  InputAdornment,
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { validatePrefix, validateDecimals } from '../../../services/settings-utils';
import { loadSymbolConfig, saveSymbolConfig } from '../../../services/storage-settings';
import { DECIMALS_MIN, DECIMALS_MAX, EXPIRATION_CODES } from '../../../services/settings-types';
import ExpirationTabs from './ExpirationTabs.jsx';
import ExpirationDetail from './ExpirationDetail.jsx';
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
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [activeExpiration, setActiveExpiration] = useState(null);

  // Initialize local state from config
  useEffect(() => {
    if (config) {
      setPrefix(config.prefix || '');
      setDecimals(config.defaultDecimals !== undefined ? config.defaultDecimals : 2);
      setPrefixError('');
      setDecimalsError('');
      setSaveSuccess(false);
      
      // Set first expiration as active if none selected
      if (!activeExpiration && EXPIRATION_CODES.length > 0) {
        setActiveExpiration(EXPIRATION_CODES[0]);
      }
    }
  }, [config]);

  const handlePrefixChange = (e) => {
    setPrefix(e.target.value);
    setSaveSuccess(false);
    setPrefixError('');
  };

  const handleDecimalsChange = (e) => {
    setDecimals(e.target.value);
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

  const saveField = async (fieldName, value) => {
    try {
      const updatedConfig = {
        ...config,
        [fieldName]: value,
      };

      await saveSymbolConfig(updatedConfig);
      
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

  const handleExpirationUpdate = async (expirationCode, updatedExpiration) => {
    try {
      const updatedConfig = {
        ...config,
        expirations: {
          ...config.expirations,
          [expirationCode]: updatedExpiration,
        },
      };

      await saveSymbolConfig(updatedConfig);
      
      // Notify parent
      if (onConfigUpdate) {
        onConfigUpdate(updatedConfig);
      }
    } catch (error) {
      console.error('PO: Error saving expiration update:', error);
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

      <Box sx={{ display: 'flex', gap: 2, maxWidth: 600 }}>
        <TextField
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {strings.settings.symbolSettings.prefixLabel}
              <Tooltip title={strings.settings.symbolSettings.prefixHelperText} arrow placement="top">
                <InfoOutlinedIcon sx={{ fontSize: 18, color: 'info.main', cursor: 'help' }} />
              </Tooltip>
            </Box>
          }
          value={prefix}
          onChange={handlePrefixChange}
          onBlur={handlePrefixBlur}
          error={!!prefixError}
          helperText={prefixError}
          sx={{ flex: 1 }}
          inputProps={{ maxLength: 10 }}
          InputLabelProps={{ shrink: true }}
        />

        <TextField
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {strings.settings.symbolSettings.defaultDecimalsLabel}
              <Tooltip title={strings.settings.symbolSettings.decimalsHelperText} arrow placement="top">
                <InfoOutlinedIcon sx={{ fontSize: 18, color: 'info.main', cursor: 'help' }} />
              </Tooltip>
            </Box>
          }
          type="number"
          value={decimals}
          onChange={handleDecimalsChange}
          onBlur={handleDecimalsBlur}
          error={!!decimalsError}
          helperText={decimalsError}
          sx={{ width: 280 }}
          inputProps={{
            min: DECIMALS_MIN,
            max: DECIMALS_MAX,
            step: 1,
          }}
          InputLabelProps={{ shrink: true }}
        />
      </Box>

      {/* Expiration Management Section */}
      <Divider sx={{ my: 4 }} />

      <Typography variant="h6" gutterBottom>
        {strings.settings.symbolSettings.expirationTabs.title}
      </Typography>

      <Box sx={{ display: 'flex', gap: 3, mt: 2 }}>
        <ExpirationTabs
          expirationCodes={EXPIRATION_CODES}
          activeExpiration={activeExpiration}
          onExpirationChange={setActiveExpiration}
        />
        
        <Box sx={{ flex: 1 }}>
          <ExpirationDetail
            symbol={symbol}
            expirationCode={activeExpiration}
            expiration={config?.expirations?.[activeExpiration]}
            onExpirationUpdate={handleExpirationUpdate}
          />
        </Box>
      </Box>
    </Box>
  );
}
