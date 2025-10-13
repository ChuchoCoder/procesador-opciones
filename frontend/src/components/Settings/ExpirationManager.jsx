import { useMemo, useState } from 'react';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Chip from '@mui/material/Chip';
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

const normalizeName = (value) => (typeof value === 'string' ? value.trim() : '');
const normalizeSuffix = (value) => (typeof value === 'string' ? value.trim().toUpperCase() : '');

const ExpirationManager = () => {
  const {
    expirations,
    activeExpiration,
    addExpiration,
    removeExpiration,
    addSuffix,
    removeSuffix,
    setActiveExpiration,
  } = useConfig();
  const strings = useStrings();
  const expirationStrings = strings.settings.expirations;

  const [nameInput, setNameInput] = useState('');
  const [suffixInput, setSuffixInput] = useState('');
  const [nameError, setNameError] = useState('');
  const [suffixError, setSuffixError] = useState('');

  const expirationEntries = useMemo(
    () => Object.entries(expirations ?? {}),
    [expirations],
  );

  const canSubmit = useMemo(() => {
    const normalizedName = normalizeName(nameInput);
    const normalizedSuffix = normalizeSuffix(suffixInput);
    return Boolean(normalizedName && normalizedSuffix);
  }, [nameInput, suffixInput]);

  const findExistingKey = (candidateName) => {
    const normalizedCandidate = candidateName.toLowerCase();
    const existing = expirationEntries.find(([name]) => name.toLowerCase() === normalizedCandidate);
    return existing?.[0] ?? null;
  };

  const handleNameChange = (event) => {
    setNameInput(event.target.value);
    if (nameError) {
      setNameError('');
    }
  };

  const handleSuffixChange = (event) => {
    setSuffixInput(event.target.value);
    if (suffixError) {
      setSuffixError('');
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const normalizedName = normalizeName(nameInput);
    const normalizedSuffix = normalizeSuffix(suffixInput);

    if (!normalizedName) {
      setNameError(expirationStrings.errorNameRequired);
      return;
    }

    if (!normalizedSuffix) {
      setSuffixError(expirationStrings.errorSuffixRequired);
      return;
    }

    const existingKey = findExistingKey(normalizedName);

    if (existingKey) {
      const currentSuffixes = expirations[existingKey]?.suffixes ?? [];
      if (currentSuffixes.includes(normalizedSuffix)) {
        setSuffixError(expirationStrings.errorSuffixDuplicate);
        return;
      }

      addSuffix(existingKey, normalizedSuffix);
      setSuffixInput('');
      setNameError('');
      setSuffixError('');
      return;
    }

    addExpiration({ name: normalizedName, suffixes: [normalizedSuffix] });
    setNameInput('');
    setSuffixInput('');
    setNameError('');
    setSuffixError('');
  };

  const handleRemoveExpiration = (name) => () => {
    removeExpiration(name);
  };

  const handleRemoveSuffix = (name, suffix) => () => {
    removeSuffix(name, suffix);
  };

  const handleActiveChange = (event) => {
    const { value } = event.target;
    if (!value) {
      return;
    }
    setActiveExpiration(value);
  };

  return (
    <Card variant="outlined">
      <CardHeader title={expirationStrings.title} subheader={expirationStrings.description} />
      <CardContent>
        <Stack spacing={3}>
          <Box component="form" noValidate onSubmit={handleSubmit}>
            <Stack
              spacing={2}
              direction={{ xs: 'column', md: 'row' }}
              alignItems={{ md: 'flex-end' }}
            >
              <TextField
                label={expirationStrings.nameLabel}
                placeholder={expirationStrings.namePlaceholder}
                value={nameInput}
                onChange={handleNameChange}
                fullWidth
                inputProps={{ 'data-testid': 'settings-expiration-name' }}
                error={Boolean(nameError)}
                helperText={nameError || expirationStrings.helper}
              />
              <TextField
                label={expirationStrings.suffixLabel}
                placeholder={expirationStrings.suffixPlaceholder}
                value={suffixInput}
                onChange={handleSuffixChange}
                fullWidth
                inputProps={{ 'data-testid': 'settings-expiration-suffix' }}
                error={Boolean(suffixError)}
                helperText={suffixError || expirationStrings.suffixHelper}
              />
              <Button
                variant="contained"
                color="primary"
                type="submit"
                disabled={!canSubmit}
                data-testid="settings-add-expiration"
              >
                {expirationStrings.addButton}
              </Button>
            </Stack>
          </Box>

          <TextField
            select
            fullWidth
            label={expirationStrings.activeLabel}
            value={activeExpiration ?? ''}
            onChange={handleActiveChange}
            SelectProps={{ native: true }}
            inputProps={{ 'data-testid': 'settings-active-expiration' }}
            disabled={expirationEntries.length === 0}
          >
            {expirationEntries.length === 0 ? (
              <option value="" />
            ) : (
              expirationEntries.map(([name]) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))
            )}
          </TextField>

          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="subtitle1">{expirationStrings.listLabel}</Typography>
              <Typography variant="caption" color="text.secondary">
                {expirationEntries.length}
              </Typography>
            </Stack>
            {expirationEntries.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                {expirationStrings.emptyState}
              </Typography>
            ) : (
              <List dense data-testid="settings-expirations-list">
                {expirationEntries.map(([name, config]) => (
                  <ListItem
                    key={name}
                    alignItems="flex-start"
                    secondaryAction={
                      <Tooltip title={expirationStrings.removeLabel}>
                        <span>
                          <IconButton
                            edge="end"
                            aria-label={expirationStrings.removeLabel}
                            onClick={handleRemoveExpiration(name)}
                            size="small"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    }
                  >
                    <ListItemText
                      primary={
                        <Typography variant="subtitle2" component="span">
                          {name}
                        </Typography>
                      }
                      secondaryTypographyProps={{ component: 'div' }}
                      secondary={
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                          {(config?.suffixes ?? []).map((suffix) => (
                            <Chip
                              key={`${name}-${suffix}`}
                              label={suffix}
                              onDelete={handleRemoveSuffix(name, suffix)}
                              deleteIcon={<DeleteIcon fontSize="small" />}
                              size="small"
                              sx={{ textTransform: 'uppercase' }}
                            />
                          ))}
                        </Box>
                      }
                    />
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

export default ExpirationManager;
