// BrokerLogin.jsx - Broker authentication UI component (T017)
import { useState, useEffect } from 'react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';

// Broker API URL options
const BROKER_OPTIONS = [
  { label: 'Cocos Capital 🥥 (Plan Pro)', value: 'https://api.cocos.xoms.com.ar' },
  { label: 'Eco Valores', value: 'https://api.eco.xoms.com.ar' },
  { label: 'Veta Capital', value: 'https://api.veta.xoms.com.ar' },
  { label: 'Bull Market Brokers', value: 'https://api.bull.xoms.com.ar' },
  { label: 'Cohen', value: 'https://api.cohen.xoms.com.ar' },
  { label: 'Adcap', value: 'https://api.adcap.xoms.com.ar' },
  { label: 'BCCH', value: 'https://api.bcch.xoms.com.ar' },
];

const CUSTOM_URL_VALUE = '__custom__';

/**
 * Broker login form component.
 * 
 * @param {Object} props
 * @param {Object} props.strings - Localized strings (es-AR)
 * @param {Function} props.onLogin - Callback when login submitted: (username, password, apiUrl) => Promise<void>
 * @param {boolean} props.isLoading - True if login in progress
 * @param {string|null} props.error - Error message to display, or null
 * @param {boolean} props.disabled - True to disable form (e.g., during sync)
 * @param {string} props.defaultApiUrl - Default API URL from config
 */
const BrokerLogin = ({ strings, onLogin, isLoading = false, error = null, disabled = false, defaultApiUrl = 'https://api.remarkets.primary.com.ar' }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  // Determine if defaultApiUrl is a preset or custom
  const findPresetOption = (urlValue) => {
    return BROKER_OPTIONS.find(opt => opt.value === urlValue);
  };

  const initialIsCustom = defaultApiUrl ? !findPresetOption(defaultApiUrl) : false;
  
  const [selectedBroker, setSelectedBroker] = useState(
    initialIsCustom ? CUSTOM_URL_VALUE : (defaultApiUrl || BROKER_OPTIONS[0].value)
  );
  const [customUrl, setCustomUrl] = useState(initialIsCustom ? defaultApiUrl : '');
  
  // Update when defaultApiUrl changes from parent
  useEffect(() => {
    if (defaultApiUrl) {
      const preset = findPresetOption(defaultApiUrl);
      if (preset) {
        setSelectedBroker(defaultApiUrl);
        setCustomUrl('');
      } else {
        setSelectedBroker(CUSTOM_URL_VALUE);
        setCustomUrl(defaultApiUrl);
      }
    }
  }, [defaultApiUrl]);
  
  // Get current effective URL
  const getCurrentUrl = () => {
    if (selectedBroker === CUSTOM_URL_VALUE) {
      return customUrl.trim();
    }
    return selectedBroker;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    
    const apiUrl = getCurrentUrl();
    
    if (!username.trim() || !password.trim() || !apiUrl.trim()) {
      return; // Form validation
    }

    // Validate URL format
    try {
      new URL(apiUrl.trim());
    } catch {
      return; // Invalid URL
    }

    await onLogin(username.trim(), password, apiUrl.trim());
  };

  const isValidUrl = () => {
    const apiUrl = getCurrentUrl();
    try {
      new URL(apiUrl.trim());
      return true;
    } catch {
      return false;
    }
  };

  const canSubmit = username.trim() && password.trim() && getCurrentUrl().trim() && isValidUrl() && !isLoading && !disabled;

  return (
    <Box>
      <Box component="form" onSubmit={handleSubmit} noValidate>
          <Stack spacing={2}>
            <TextField
              select
              label="Broker"
              value={selectedBroker}
              onChange={(e) => setSelectedBroker(e.target.value)}
              disabled={isLoading || disabled}
              required
              fullWidth
              helperText="Seleccioná tu broker o usá una URL personalizada"
              data-testid="broker-login-broker-select"
            >
              {BROKER_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
              <MenuItem value={CUSTOM_URL_VALUE}>
                URL Personalizada
              </MenuItem>
            </TextField>
            
            {selectedBroker === CUSTOM_URL_VALUE && (
              <TextField
                label="URL de la API del Broker"
                type="url"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                disabled={isLoading || disabled}
                required
                fullWidth
                placeholder="https://api.tu-broker.com.ar"
                error={customUrl.trim() !== '' && !isValidUrl()}
                helperText={customUrl.trim() !== '' && !isValidUrl() ? 'URL inválida' : 'Ingresá la URL completa de la API'}
                data-testid="broker-login-custom-url"
              />
            )}
            
            <TextField
              label="Usuario"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading || disabled}
              required
              fullWidth
              autoComplete="username"
              data-testid="broker-login-username"
            />
            
            <TextField
              label="Contraseña"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading || disabled}
              required
              fullWidth
              autoComplete="current-password"
              data-testid="broker-login-password"
            />

            {error && (
              <Alert severity="error" data-testid="broker-login-error">
                {error}
              </Alert>
            )}

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Button
                type="submit"
                variant="contained"
                disabled={!canSubmit}
                data-testid="broker-login-submit"
              >
                {strings.brokerSync.loginButton}
              </Button>
              
              {isLoading && (
                <CircularProgress size={24} data-testid="broker-login-loading" />
              )}
            </Box>
          </Stack>
        </Box>
    </Box>
  );
};

export default BrokerLogin;
