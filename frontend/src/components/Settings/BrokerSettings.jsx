import { useState, useEffect, useCallback } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useConfig } from '../../state/index.js';
import { useStrings } from '../../strings/index.js';

// Broker API URL options
const BROKER_OPTIONS = [
  { label: 'Primary reMarkets (Demo)', value: 'https://api.remarkets.primary.com.ar' },
  { label: 'Primary (Producción)', value: 'https://api.primary.com.ar' },
  { label: 'Cocos Capital (requiere plan 🥥 Cocos Pro)', value: 'https://api.cocos.xoms.com.ar' },
  { label: 'Eco Valores', value: 'https://api.eco.xoms.com.ar' },
  { label: 'Veta Capital', value: 'https://api.veta.xoms.com.ar' },
  { label: 'Bull Market Brokers', value: 'https://api.bull.xoms.com.ar' },
  { label: 'Cohen', value: 'https://api.cohen.xoms.com.ar' },
  { label: 'Adcap', value: 'https://api.adcap.xoms.com.ar' },
  { label: 'BCCH', value: 'https://api.bcch.xoms.com.ar' },
];

const CUSTOM_URL_VALUE = '__custom__';

const BrokerSettings = () => {
  const { brokerApiUrl, applyChanges, storageEnabled } = useConfig();
  const strings = useStrings();
  const brokerStrings = strings.settings.broker;

  // Determine if current URL is a preset or custom
  const findPresetOption = (urlValue) => {
    return BROKER_OPTIONS.find(opt => opt.value === urlValue);
  };

  const initialIsCustom = brokerApiUrl ? !findPresetOption(brokerApiUrl) : false;
  
  const [selectedOption, setSelectedOption] = useState(
    initialIsCustom ? CUSTOM_URL_VALUE : (brokerApiUrl || BROKER_OPTIONS[0].value)
  );
  const [customUrl, setCustomUrl] = useState(initialIsCustom ? brokerApiUrl : '');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Sync state when brokerApiUrl changes externally
  useEffect(() => {
    if (brokerApiUrl) {
      const preset = findPresetOption(brokerApiUrl);
      if (preset) {
        setSelectedOption(brokerApiUrl);
        setCustomUrl('');
      } else {
        setSelectedOption(CUSTOM_URL_VALUE);
        setCustomUrl(brokerApiUrl);
      }
    }
  }, [brokerApiUrl]);

  // Calculate current effective URL
  const getCurrentUrl = useCallback(() => {
    if (selectedOption === CUSTOM_URL_VALUE) {
      return customUrl.trim();
    }
    return selectedOption;
  }, [selectedOption, customUrl]);

  // Check if there are unsaved changes
  useEffect(() => {
    const currentUrl = getCurrentUrl();
    setHasChanges(currentUrl !== brokerApiUrl);
  }, [selectedOption, customUrl, brokerApiUrl, getCurrentUrl]);

  const validateUrl = (urlString) => {
    if (!urlString.trim()) {
      return brokerStrings.errorUrlRequired;
    }

    try {
      const parsed = new URL(urlString.trim());
      if (!parsed.protocol.startsWith('http')) {
        return brokerStrings.errorUrlInvalid;
      }
      return null;
    } catch {
      return brokerStrings.errorUrlInvalid;
    }
  };

  const handleSave = () => {
    setSuccess(false);
    const urlToSave = getCurrentUrl();
    const validationError = validateUrl(urlToSave);
    
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    
    try {
      applyChanges({ brokerApiUrl: urlToSave });
      setSuccess(true);
      setHasChanges(false);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError(brokerStrings.saveError);
    }
  };

  const handleOptionChange = (e) => {
    const newValue = e.target.value;
    setSelectedOption(newValue);
    setError('');
    setSuccess(false);
    
    // If switching away from custom, clear custom URL
    if (newValue !== CUSTOM_URL_VALUE) {
      setCustomUrl('');
    }
  };

  const handleCustomUrlChange = (e) => {
    setCustomUrl(e.target.value);
    setError('');
    setSuccess(false);
  };

  const handleReset = () => {
    if (brokerApiUrl) {
      const preset = findPresetOption(brokerApiUrl);
      if (preset) {
        setSelectedOption(brokerApiUrl);
        setCustomUrl('');
      } else {
        setSelectedOption(CUSTOM_URL_VALUE);
        setCustomUrl(brokerApiUrl);
      }
    } else {
      setSelectedOption(BROKER_OPTIONS[0].value);
      setCustomUrl('');
    }
    setError('');
    setSuccess(false);
    setHasChanges(false);
  };

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5" component="h2" gutterBottom>
          {brokerStrings.title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {brokerStrings.description}
        </Typography>
      </Box>

      {storageEnabled === false && (
        <Alert severity="warning">{strings.settings.storageDisabled}</Alert>
      )}

      {success && (
        <Alert severity="success">{brokerStrings.saveSuccess}</Alert>
      )}

      {error && (
        <Alert severity="error">{error}</Alert>
      )}

      <Box>
        <TextField
          select
          fullWidth
          label={brokerStrings.brokerSelectLabel}
          value={selectedOption}
          onChange={handleOptionChange}
          helperText={brokerStrings.apiUrlHelper}
          data-testid="broker-select-dropdown"
        >
          {BROKER_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
          <MenuItem value={CUSTOM_URL_VALUE}>
            {brokerStrings.customUrlOption}
          </MenuItem>
        </TextField>
      </Box>

      {selectedOption === CUSTOM_URL_VALUE && (
        <Box>
          <TextField
            fullWidth
            label={brokerStrings.apiUrlLabel}
            placeholder={brokerStrings.apiUrlPlaceholder}
            value={customUrl}
            onChange={handleCustomUrlChange}
            helperText="Ingresá la URL completa de la API de tu broker"
            error={Boolean(error)}
            data-testid="broker-custom-url-input"
          />
        </Box>
      )}

      <Box
        display="flex"
        flexDirection={{ xs: 'column', sm: 'row' }}
        gap={2}
        justifyContent="flex-start"
      >
        <Button
          variant="contained"
          color="primary"
          onClick={handleSave}
          disabled={!hasChanges || Boolean(error)}
          data-testid="broker-save-button"
        >
          {brokerStrings.saveButton}
        </Button>
        
        {hasChanges && (
          <Button
            variant="outlined"
            color="secondary"
            onClick={handleReset}
            data-testid="broker-reset-button"
          >
            Descartar cambios
          </Button>
        )}
      </Box>

      <Box>
        <Typography variant="caption" color="text.secondary" component="div">
          URL actual: <strong>{brokerApiUrl || BROKER_OPTIONS[0].value}</strong>
        </Typography>
      </Box>
    </Stack>
  );
};

export default BrokerSettings;
