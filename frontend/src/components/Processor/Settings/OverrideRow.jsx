import React, { useState } from 'react';
import {
  Box,
  TextField,
  IconButton,
  Button,
  Alert,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import { Delete as DeleteIcon, Add as AddIcon } from '@mui/icons-material';
import strings from '../../../strings';

/**
 * OverrideRow component for displaying or adding strike token overrides.
 * Can render in two modes:
 * - Display mode: shows existing override with delete button
 * - Add mode: shows input fields with add button
 * 
 * @param {Object} props
 * @param {Object} props.override - Override object { raw, formatted } (display mode)
 * @param {Function} props.onRemove - Callback when delete clicked (display mode)
 * @param {boolean} props.isNew - True for add mode, false for display mode
 * @param {Array<string>} props.existingRawTokens - List of existing raw tokens (add mode)
 * @param {Function} props.onAdd - Callback when add clicked (add mode)
 */
export default function OverrideRow({ override, onRemove, isNew, existingRawTokens, onAdd }) {
  const s = strings.settings.symbolSettings.expirationTabs;

  const [rawToken, setRawToken] = useState('');
  const [formatted, setFormatted] = useState('');
  const [skipFormatting, setSkipFormatting] = useState(false);
  const [error, setError] = useState('');

  if (isNew) {
    // Add mode
    const handleAdd = () => {
      setError('');

      // Validate raw token
      if (!rawToken.trim()) {
        setError(s.errorRawRequired || 'Raw token is required');
        return;
      }

      // Check numeric
      if (!/^\d+$/.test(rawToken.trim())) {
        setError(s.errorRawInvalid || 'Raw token must be numeric');
        return;
      }

      // Check for duplicate
      if (existingRawTokens && existingRawTokens.includes(rawToken.trim())) {
        setError(s.errorRawDuplicate || 'This raw token already has an override');
        return;
      }

      // Validate formatted
      if (!formatted.trim()) {
        setError(s.errorFormattedRequired || 'Formatted value is required');
        return;
      }

      // Create override
      const newOverride = {
        raw: rawToken.trim(),
        formatted: formatted.trim(),
        ...(skipFormatting && { skipDecimalFormatting: true }),
      };

      if (onAdd) {
        onAdd(newOverride);
      }

      // Clear inputs
      setRawToken('');
      setFormatted('');
      setSkipFormatting(false);
      setError('');
    };

    return (
      <Box>
        {error && (
          <Alert severity="error" sx={{ mb: 1 }}>
            {error}
          </Alert>
        )}
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1, flexWrap: 'wrap' }}>
          <TextField
            size="small"
            label={s.rawTokenLabel}
            placeholder={s.rawTokenPlaceholder}
            value={rawToken}
            onChange={(e) => setRawToken(e.target.value)}
            sx={{ width: 150 }}
          />
          <TextField
            size="small"
            label={s.formattedLabel}
            placeholder={s.formattedPlaceholder}
            value={formatted}
            onChange={(e) => setFormatted(e.target.value)}
            sx={{ width: 150 }}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={skipFormatting}
                onChange={(e) => setSkipFormatting(e.target.checked)}
                size="small"
              />
            }
            label={s.skipFormattingLabel || 'Usar valor exacto'}
            sx={{ ml: 1 }}
          />
          <Button
            variant="outlined"
            size="small"
            startIcon={<AddIcon />}
            onClick={handleAdd}
          >
            {s.addOverrideButton}
          </Button>
        </Box>
      </Box>
    );
  }

  // Display mode
  const handleRemove = () => {
    if (onRemove && override) {
      onRemove(override.raw);
    }
  };

  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1, flexWrap: 'wrap' }}>
      <TextField
        size="small"
        label={s.rawTokenLabel}
        value={override.raw}
        InputProps={{ readOnly: true }}
        sx={{ width: 150 }}
      />
      <TextField
        size="small"
        label={s.formattedLabel}
        value={override.formatted}
        InputProps={{ readOnly: true }}
        sx={{ width: 150 }}
      />
      {override.skipDecimalFormatting && (
        <FormControlLabel
          control={<Checkbox checked disabled size="small" />}
          label={s.skipFormattingLabel || 'Usar valor exacto'}
          disabled
          sx={{ ml: 1 }}
        />
      )}
      <IconButton
        size="small"
        color="error"
        onClick={handleRemove}
        aria-label={s.removeOverrideLabel}
      >
        <DeleteIcon />
      </IconButton>
    </Box>
  );
}
