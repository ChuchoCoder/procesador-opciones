import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Chip,
  Alert,
  Button,
  IconButton,
  Stack,
} from '@mui/material';
import { Add as AddIcon, Close as CloseIcon } from '@mui/icons-material';
import { validateSuffix, validateDecimals } from '../../../services/settings-utils';
import { DECIMALS_MIN, DECIMALS_MAX } from '../../../services/settings-types';
import OverrideRow from './OverrideRow.jsx';
import strings from '../../../strings';

/**
 * ExpirationDetail panel showing suffix options, decimals, and strike overrides.
 * Implements write-on-blur persistence for expiration settings.
 * 
 * @param {Object} props
 * @param {string} props.symbol - Symbol identifier
 * @param {string} props.expirationCode - Current expiration code (e.g., "DIC")
 * @param {Object} props.expiration - ExpirationSetting object
 * @param {Function} props.onExpirationUpdate - Callback when expiration is updated
 */
export default function ExpirationDetail({ symbol, expirationCode, expiration, onExpirationUpdate }) {
  const s = strings.settings.symbolSettings.expirationTabs;

  const [suffixes, setSuffixes] = useState([]);
  const [decimals, setDecimals] = useState(2);
  const [newSuffix, setNewSuffix] = useState('');
  const [suffixError, setSuffixError] = useState('');
  const [decimalsError, setDecimalsError] = useState('');
  const [overrides, setOverrides] = useState([]);

  // Initialize from expiration object
  useEffect(() => {
    if (expiration) {
      setSuffixes(expiration.suffixes || []);
      setDecimals(expiration.decimals !== undefined ? expiration.decimals : 2);
      setOverrides(expiration.overrides || []);
      setSuffixError('');
      setDecimalsError('');
    }
  }, [expiration, expirationCode]);

  const handleAddSuffix = () => {
    if (!newSuffix.trim()) {
      setSuffixError(s.errorSuffixRequired || 'Suffix is required');
      return;
    }

    const validation = validateSuffix(newSuffix);
    if (!validation.valid) {
      setSuffixError(validation.error);
      return;
    }

    const normalized = validation.normalized;

    // Check for duplicate
    if (suffixes.includes(normalized)) {
      setSuffixError(s.errorSuffixDuplicate || 'Suffix already exists');
      return;
    }

    const updated = [...suffixes, normalized];
    setSuffixes(updated);
    setNewSuffix('');
    setSuffixError('');

    // Persist change
    saveExpirationUpdate({ suffixes: updated });
  };

  const handleRemoveSuffix = (suffixToRemove) => {
    const updated = suffixes.filter((s) => s !== suffixToRemove);
    setSuffixes(updated);
    saveExpirationUpdate({ suffixes: updated });
  };

  const handleDecimalsChange = (e) => {
    setDecimals(e.target.value);
    setDecimalsError('');
  };

  const handleDecimalsBlur = () => {
    const validation = validateDecimals(decimals);
    if (!validation.valid) {
      setDecimalsError(validation.error);
      return;
    }

    setDecimals(validation.value);
    setDecimalsError('');
    saveExpirationUpdate({ decimals: validation.value });
  };

  const handleOverrideAdd = (override) => {
    const updated = [...overrides, override];
    setOverrides(updated);
    saveExpirationUpdate({ overrides: updated });
  };

  const handleOverrideRemove = (rawToken) => {
    const updated = overrides.filter((o) => o.raw !== rawToken);
    setOverrides(updated);
    saveExpirationUpdate({ overrides: updated });
  };

  const saveExpirationUpdate = (updates) => {
    const updatedExpiration = {
      ...expiration,
      ...updates,
    };
    
    if (onExpirationUpdate) {
      onExpirationUpdate(expirationCode, updatedExpiration);
    }
  };

  if (!expiration) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="body2" color="text.secondary">
          {s.noExpirationSelected || 'Select an expiration to configure'}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        {expirationCode}
      </Typography>

      {/* Decimals Section */}
      <Box sx={{ mb: 3 }}>
        <TextField
          label={s.decimalsLabel}
          type="number"
          size="small"
          value={decimals}
          onChange={handleDecimalsChange}
          onBlur={handleDecimalsBlur}
          error={!!decimalsError}
          helperText={decimalsError}
          inputProps={{
            min: DECIMALS_MIN,
            max: DECIMALS_MAX,
            step: 1,
          }}
          sx={{ width: 200 }}
        />
      </Box>

      {/* Suffixes Section */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" gutterBottom>
          {s.suffixLabel}
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
          {s.suffixHelper}
        </Typography>

        <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
          {suffixes.map((suffix) => (
            <Chip
              key={suffix}
              label={suffix}
              onDelete={() => handleRemoveSuffix(suffix)}
              size="small"
            />
          ))}
        </Stack>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
          <TextField
            size="small"
            value={newSuffix}
            onChange={(e) => setNewSuffix(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddSuffix()}
            placeholder="Ej. O, OC"
            error={!!suffixError}
            helperText={suffixError}
            inputProps={{ maxLength: 2 }}
            sx={{ width: 120 }}
          />
          <Button
            variant="outlined"
            size="small"
            startIcon={<AddIcon />}
            onClick={handleAddSuffix}
          >
            Agregar
          </Button>
        </Box>
      </Box>

      {/* Strike Overrides Section */}
      <Box>
        <Typography variant="subtitle2" gutterBottom>
          {s.overridesTitle}
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
          {s.overridesDescription}
        </Typography>

        {overrides.length === 0 ? (
          <Alert severity="info" sx={{ mb: 2 }}>
            {s.noOverrides || 'No hay overrides configurados para este vencimiento.'}
          </Alert>
        ) : (
          <Box sx={{ mb: 2 }}>
            {overrides.map((override) => (
              <OverrideRow
                key={override.raw}
                override={override}
                onRemove={handleOverrideRemove}
              />
            ))}
          </Box>
        )}

        <OverrideRow
          isNew
          existingRawTokens={overrides.map((o) => o.raw)}
          onAdd={handleOverrideAdd}
        />
      </Box>
    </Box>
  );
}
