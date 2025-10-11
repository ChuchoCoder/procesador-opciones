import { useMemo, useState } from 'react';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import DeleteIcon from '@mui/icons-material/Delete';

import { useConfig } from '../../state/config-context.jsx';
import { useStrings } from '../../strings/index.js';

const normalizeSymbol = (value) => (typeof value === 'string' ? value.trim().toUpperCase() : '');

const SymbolManager = () => {
  const { symbols, activeSymbol, addSymbol, removeSymbol, setActiveSymbol } = useConfig();
  const strings = useStrings();
  const symbolStrings = strings.settings.symbols;

  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');

  const handleChange = (event) => {
    setInputValue(event.target.value);
    if (error) {
      setError('');
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const normalized = normalizeSymbol(inputValue);

    if (!normalized) {
      setError(symbolStrings.errorRequired);
      return;
    }

    if (symbols.some((symbol) => symbol === normalized)) {
      setError(symbolStrings.errorDuplicate);
      return;
    }

    addSymbol(normalized);
    setInputValue('');
  };

  const handleRemove = (symbol) => () => {
    removeSymbol(symbol);
  };

  const handleActiveChange = (event) => {
    const { value } = event.target;
    if (!value) {
      return;
    }
    setActiveSymbol(value);
  };

  const canSubmit = useMemo(() => {
    const normalized = normalizeSymbol(inputValue);
    if (!normalized) {
      return false;
    }

    return !symbols.includes(normalized);
  }, [inputValue, symbols]);

  return (
    <Card variant="outlined">
      <CardHeader title={symbolStrings.title} subheader={symbolStrings.description} />
      <CardContent>
        <Stack spacing={3}>
          <Box component="form" noValidate onSubmit={handleSubmit}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'flex-end' }}>
              <TextField
                label={symbolStrings.inputLabel}
                placeholder={symbolStrings.inputPlaceholder}
                value={inputValue}
                onChange={handleChange}
                fullWidth
                inputProps={{ 'data-testid': 'settings-symbol-input' }}
                error={Boolean(error)}
                helperText={error || symbolStrings.inputHelper}
              />
              <Button
                variant="contained"
                color="primary"
                type="submit"
                disabled={!canSubmit}
                data-testid="settings-add-symbol"
              >
                {symbolStrings.addButton}
              </Button>
            </Stack>
          </Box>

          <TextField
            select
            fullWidth
            label={symbolStrings.activeLabel}
            value={activeSymbol ?? ''}
            onChange={handleActiveChange}
            SelectProps={{
              native: true,
            }}
            inputProps={{ 'data-testid': 'settings-active-symbol' }}
            disabled={symbols.length === 0}
          >
            {symbols.length === 0 ? (
              <option value="" />
            ) : (
              symbols.map((symbol) => (
                <option value={symbol} key={symbol}>
                  {symbol}
                </option>
              ))
            )}
          </TextField>

          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="subtitle1">{symbolStrings.listLabel}</Typography>
              <Typography variant="caption" color="text.secondary">
                {symbols.length}
              </Typography>
            </Stack>
            {symbols.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                {symbolStrings.emptyState}
              </Typography>
            ) : (
              <List dense data-testid="settings-symbols-list">
                {symbols.map((symbol) => (
                  <ListItem
                    key={symbol}
                    secondaryAction={
                      <Tooltip title={symbolStrings.removeLabel}>
                        <span>
                          <IconButton
                            edge="end"
                            aria-label={symbolStrings.removeLabel}
                            onClick={handleRemove(symbol)}
                            size="small"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    }
                  >
                    <ListItemText primary={symbol} />
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
};

export default SymbolManager;
