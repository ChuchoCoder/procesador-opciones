import { useEffect, useMemo, useState } from 'react';

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

import { useConfig } from '../../state/index.js';
import { useStrings } from '../../strings/index.js';

const clampDecimals = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.max(0, Math.min(6, Math.round(parsed)));
};

const cloneRule = (rule) => ({
  symbol: rule?.symbol ?? '',
  defaultDecimals: rule?.defaultDecimals ?? 0,
  strikeOverrides: { ...(rule?.strikeOverrides ?? {}) },
  expirationOverrides: Object.fromEntries(
    Object.entries(rule?.expirationOverrides ?? {}).map(([code, config]) => [
      code,
      {
        defaultDecimals: config?.defaultDecimals ?? 0,
        strikeOverrides: { ...(config?.strikeOverrides ?? {}) },
      },
    ]),
  ),
});

const toUpper = (value) => (typeof value === 'string' ? value.trim().toUpperCase() : '');

const PrefixRuleCard = ({
  prefix,
  rule,
  strings,
  availableExpirationCodes,
  onChange,
  onRemove,
}) => {
  const [symbolValue, setSymbolValue] = useState(rule.symbol ?? '');
  const [defaultDecimalsValue, setDefaultDecimalsValue] = useState(String(rule.defaultDecimals ?? 0));
  const [newExpirationCode, setNewExpirationCode] = useState('');
  const [newExpirationDecimals, setNewExpirationDecimals] = useState('1');
  const [newStrikeForms, setNewStrikeForms] = useState({});

  useEffect(() => {
    setSymbolValue(rule.symbol ?? '');
  }, [rule.symbol]);

  useEffect(() => {
    setDefaultDecimalsValue(String(rule.defaultDecimals ?? 0));
  }, [rule.defaultDecimals]);

  const handleCommitSymbol = () => {
    const nextSymbol = toUpper(symbolValue);
    const draft = cloneRule(rule);
    draft.symbol = nextSymbol;
    onChange(prefix, draft);
  };

  const handleCommitDefaultDecimals = () => {
    const draft = cloneRule(rule);
    draft.defaultDecimals = clampDecimals(defaultDecimalsValue);
    onChange(prefix, draft);
  };

  const handleRemove = () => {
    onRemove(prefix);
  };

  const handleAddExpirationOverride = (event) => {
    event.preventDefault();
    const code = toUpper(newExpirationCode);
    if (!code) {
      return;
    }

    const draft = cloneRule(rule);
    draft.expirationOverrides[code] = {
      defaultDecimals: clampDecimals(newExpirationDecimals),
      strikeOverrides: draft.expirationOverrides[code]?.strikeOverrides ?? {},
    };
    onChange(prefix, draft);
    setNewExpirationCode('');
    setNewExpirationDecimals('1');
  };

  const handleExpirationDefaultDecimalsChange = (code, value) => {
    const draft = cloneRule(rule);
    if (!draft.expirationOverrides[code]) {
      draft.expirationOverrides[code] = { defaultDecimals: 0, strikeOverrides: {} };
    }
    draft.expirationOverrides[code].defaultDecimals = clampDecimals(value);
    onChange(prefix, draft);
  };

  const handleRemoveExpirationOverride = (code) => {
    const draft = cloneRule(rule);
    delete draft.expirationOverrides[code];
    onChange(prefix, draft);
  };

  const handleStrikeOverrideChange = (code, strikeToken, decimals) => {
    const token = toUpper(strikeToken);
    if (!token) {
      return;
    }
    const draft = cloneRule(rule);
    if (!draft.expirationOverrides[code]) {
      draft.expirationOverrides[code] = { defaultDecimals: 0, strikeOverrides: {} };
    }
    draft.expirationOverrides[code].strikeOverrides[token] = clampDecimals(decimals);
    onChange(prefix, draft);
  };

  const handleRemoveStrikeOverride = (code, strikeToken) => {
    const draft = cloneRule(rule);
    if (!draft.expirationOverrides[code]) {
      return;
    }
    delete draft.expirationOverrides[code].strikeOverrides[strikeToken];
    onChange(prefix, draft);
  };

  const expirationEntries = Object.entries(rule.expirationOverrides ?? {});

  return (
    <Card variant="outlined">
      <CardHeader
        title={strings.ruleTitle.replace('{prefix}', prefix)}
        subheader={strings.ruleSubtitle.replace('{count}', String(expirationEntries.length))}
        action={(
          <Tooltip title={strings.removeRule}>
            <span>
              <IconButton onClick={handleRemove} size="small" aria-label={strings.removeRule}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        )}
      />
      <CardContent>
        <Stack spacing={3}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'flex-end' }}>
            <TextField
              label={strings.symbolLabel}
              value={symbolValue}
              onChange={(event) => setSymbolValue(event.target.value)}
              onBlur={handleCommitSymbol}
              inputProps={{ 'data-testid': `prefix-symbol-${prefix}` }}
              helperText={strings.symbolHelper}
              fullWidth
            />
            <TextField
              label={strings.defaultDecimalsLabel}
              type="number"
              value={defaultDecimalsValue}
              onChange={(event) => setDefaultDecimalsValue(event.target.value)}
              onBlur={handleCommitDefaultDecimals}
              inputProps={{ min: 0, max: 6, step: 1, 'data-testid': `prefix-default-decimals-${prefix}` }}
              sx={{ width: { xs: '100%', sm: 160 } }}
              helperText={strings.decimalsHelper}
            />
          </Stack>

          <Box component="form" onSubmit={handleAddExpirationOverride} noValidate>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'flex-end' }}>
              <TextField
                label={strings.expirationCodeLabel}
                value={newExpirationCode}
                onChange={(event) => setNewExpirationCode(event.target.value)}
                helperText={strings.expirationCodeHelper}
                inputProps={{ 'data-testid': `prefix-expiration-code-${prefix}` }}
              />
              <TextField
                label={strings.expirationDecimalsLabel}
                type="number"
                value={newExpirationDecimals}
                onChange={(event) => setNewExpirationDecimals(event.target.value)}
                inputProps={{
                  min: 0,
                  max: 6,
                  step: 1,
                  'data-testid': `prefix-expiration-decimals-input-${prefix}`,
                }}
                sx={{ width: { xs: '100%', sm: 160 } }}
              />
              <Button
                variant="contained"
                color="primary"
                type="submit"
                data-testid={`prefix-add-expiration-${prefix}`}
              >
                {strings.addExpirationOverride}
              </Button>
            </Stack>
          </Box>

          {availableExpirationCodes.length > 0 && (
            <Typography variant="caption" color="text.secondary">
              {strings.availableExpirationCodes.replace(
                '{codes}',
                availableExpirationCodes.join(', '),
              )}
            </Typography>
          )}

          {expirationEntries.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {strings.noExpirationOverrides}
            </Typography>
          ) : (
            <Stack spacing={2}>
              {expirationEntries.map(([code, config]) => {
                const strikeEntries = Object.entries(config?.strikeOverrides ?? {});
                const strikeForm = newStrikeForms[code] ?? { token: '', decimals: '1' };

                const handleStrikeFormChange = (field, value) => {
                  setNewStrikeForms((prev) => ({
                    ...prev,
                    [code]: {
                      ...(prev[code] ?? { token: '', decimals: '1' }),
                      [field]: value,
                    },
                  }));
                };

                const handleAddStrikeOverride = (event) => {
                  event.preventDefault();
                  const token = toUpper(strikeForm.token);
                  if (!token) {
                    return;
                  }
                  handleStrikeOverrideChange(code, token, strikeForm.decimals);
                  setNewStrikeForms((prev) => ({
                    ...prev,
                    [code]: { token: '', decimals: '1' },
                  }));
                };

                return (
                  <Card key={`${prefix}-${code}`} variant="outlined">
                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                      <Stack spacing={2}>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'flex-end' }}>
                          <TextField
                            label={strings.expirationEntryLabel.replace('{code}', code)}
                            value={config?.defaultDecimals ?? 0}
                            type="number"
                            onChange={(event) => {
                              const value = event.target.value;
                              handleExpirationDefaultDecimalsChange(code, value);
                            }}
                            inputProps={{ min: 0, max: 6, step: 1, 'data-testid': `prefix-expiration-decimals-${prefix}-${code}` }}
                            sx={{ width: { xs: '100%', sm: 200 } }}
                            helperText={strings.decimalsHelper}
                          />
                          <Button
                            variant="text"
                            color="error"
                            onClick={() => handleRemoveExpirationOverride(code)}
                            data-testid={`prefix-remove-expiration-${prefix}-${code}`}
                          >
                            {strings.removeExpirationOverride}
                          </Button>
                        </Stack>

                        <Box component="form" onSubmit={handleAddStrikeOverride} noValidate>
                          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'flex-end' }}>
                            <TextField
                              label={strings.strikeTokenLabel}
                              value={strikeForm.token}
                              onChange={(event) => handleStrikeFormChange('token', event.target.value)}
                              inputProps={{ 'data-testid': `prefix-strike-token-${prefix}-${code}` }}
                              helperText={strings.strikeTokenHelper}
                            />
                            <TextField
                              label={strings.strikeDecimalsLabel}
                              type="number"
                              value={strikeForm.decimals}
                              onChange={(event) => handleStrikeFormChange('decimals', event.target.value)}
                              inputProps={{
                                min: 0,
                                max: 6,
                                step: 1,
                                'data-testid': `prefix-strike-decimals-${prefix}-${code}`,
                              }}
                              sx={{ width: { xs: '100%', sm: 160 } }}
                            />
                            <Button
                              variant="outlined"
                              color="primary"
                              type="submit"
                              data-testid={`prefix-add-strike-${prefix}-${code}`}
                            >
                              {strings.addStrikeOverride}
                            </Button>
                          </Stack>
                        </Box>

                        {strikeEntries.length === 0 ? (
                          <Typography variant="body2" color="text.secondary">
                            {strings.noStrikeOverrides}
                          </Typography>
                        ) : (
                          <List dense>
                            {strikeEntries.map(([token, decimals]) => (
                              <ListItem
                                key={`${code}-${token}`}
                                secondaryAction={(
                                  <Tooltip title={strings.removeStrikeOverride}>
                                    <span>
                                      <IconButton
                                        edge="end"
                                        aria-label={strings.removeStrikeOverride}
                                        onClick={() => handleRemoveStrikeOverride(code, token)}
                                        size="small"
                                      >
                                        <DeleteIcon fontSize="small" />
                                      </IconButton>
                                    </span>
                                  </Tooltip>
                                )}
                              >
                                <ListItemText
                                  primary={`${token}`}
                                  secondary={strings.decimalsDisplay.replace('{value}', String(decimals))}
                                />
                              </ListItem>
                            ))}
                          </List>
                        )}
                      </Stack>
                    </CardContent>
                  </Card>
                );
              })}
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};

const PrefixManager = () => {
  const { prefixRules, expirations, upsertPrefixRule, removePrefixRule } = useConfig();
  const strings = useStrings();
  const prefixStrings = strings.settings.prefixes;

  const [prefixInput, setPrefixInput] = useState('');
  const [symbolInput, setSymbolInput] = useState('');
  const [defaultDecimalsInput, setDefaultDecimalsInput] = useState('0');
  const [errorMessage, setErrorMessage] = useState('');

  const availableExpirationCodes = useMemo(() => {
    const codes = new Set();
    Object.values(expirations ?? {}).forEach((config) => {
      (config?.suffixes ?? []).forEach((suffix) => {
        const normalized = toUpper(suffix);
        if (normalized) {
          codes.add(normalized);
        }
      });
    });
    return Array.from(codes).sort();
  }, [expirations]);

  const sortedRules = useMemo(
    () => Object.entries(prefixRules ?? {}).sort(([a], [b]) => a.localeCompare(b)),
    [prefixRules],
  );

  const resetForm = () => {
    setPrefixInput('');
    setSymbolInput('');
    setDefaultDecimalsInput('0');
    setErrorMessage('');
  };

  const handleAddRule = (event) => {
    event.preventDefault();
    const prefix = toUpper(prefixInput);
    const symbol = toUpper(symbolInput);
    if (!prefix || !symbol) {
      setErrorMessage(prefixStrings.errorRequired);
      return;
    }

    const rule = {
      symbol,
      defaultDecimals: clampDecimals(defaultDecimalsInput),
      strikeOverrides: {},
      expirationOverrides: {},
    };

    upsertPrefixRule(prefix, rule);
    resetForm();
  };

  const handleUpdateRule = (prefix, nextRule) => {
    upsertPrefixRule(prefix, nextRule);
  };

  const handleRemoveRule = (prefix) => {
    removePrefixRule(prefix);
  };

  return (
    <Card variant="outlined">
      <CardHeader title={prefixStrings.title} subheader={prefixStrings.description} />
      <CardContent>
        <Stack spacing={3}>
          <Box component="form" onSubmit={handleAddRule} noValidate>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'flex-end' }}>
              <TextField
                label={prefixStrings.prefixLabel}
                placeholder={prefixStrings.prefixPlaceholder}
                value={prefixInput}
                onChange={(event) => setPrefixInput(event.target.value)}
                inputProps={{ 'data-testid': 'settings-prefix-input' }}
              />
              <TextField
                label={prefixStrings.symbolLabel}
                placeholder={prefixStrings.symbolPlaceholder}
                value={symbolInput}
                onChange={(event) => setSymbolInput(event.target.value)}
                inputProps={{ 'data-testid': 'settings-prefix-symbol-input' }}
              />
              <TextField
                label={prefixStrings.defaultDecimalsLabel}
                type="number"
                value={defaultDecimalsInput}
                onChange={(event) => setDefaultDecimalsInput(event.target.value)}
                inputProps={{ min: 0, max: 6, step: 1, 'data-testid': 'settings-prefix-decimals-input' }}
                sx={{ width: { xs: '100%', md: 160 } }}
              />
              <Button
                variant="contained"
                color="primary"
                type="submit"
                data-testid="settings-add-prefix"
              >
                {prefixStrings.addButton}
              </Button>
            </Stack>
            {errorMessage && (
              <Typography variant="body2" color="error" sx={{ mt: 1 }}>
                {errorMessage}
              </Typography>
            )}
          </Box>

          {sortedRules.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {prefixStrings.emptyState}
            </Typography>
          ) : (
            <Stack spacing={3} data-testid="settings-prefix-list">
              {sortedRules.map(([prefix, rule]) => (
                <PrefixRuleCard
                  key={prefix}
                  prefix={prefix}
                  rule={rule}
                  strings={prefixStrings.rule}
                  availableExpirationCodes={availableExpirationCodes}
                  onChange={handleUpdateRule}
                  onRemove={handleRemoveRule}
                />
              ))}
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};

export default PrefixManager;
