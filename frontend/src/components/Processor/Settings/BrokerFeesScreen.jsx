import { useEffect, useMemo, useState } from 'react';
import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';

import strings from '../../../strings/es-AR.js';
import {
  loadBrokerFees,
  saveBrokerFees,
  clearBrokerFees,
  getRepoFeeConfig,
  setRepoFeeConfig,
  clearRepoFeeConfig,
} from '../../../services/fees/broker-fees-storage.js';
import { refreshFeeServices } from '../../../services/bootstrap-defaults.js';
import { showToast } from '../../../services/toastService.js';

const brokerStrings = strings.settings.brokerFees;

const normalizeInputNumber = (value) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return Number.NaN;
  }

  const normalized = trimmed.replace(',', '.');
  return Number(normalized);
};

const formatPercentage = (value) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '';
  }
  return String(value);
};

const EMPTY_FORM = Object.freeze({
  commission: '',
  arancelColocadoraArs: '',
  arancelColocadoraUsd: '',
  arancelTomadoraArs: '',
  arancelTomadoraUsd: '',
});

const mapToFormState = (brokerFees, repoFeeConfig) => ({
  commission: formatPercentage(brokerFees?.commission),
  arancelColocadoraArs: formatPercentage(repoFeeConfig?.arancelCaucionColocadora?.ARS),
  arancelColocadoraUsd: formatPercentage(repoFeeConfig?.arancelCaucionColocadora?.USD),
  arancelTomadoraArs: formatPercentage(repoFeeConfig?.arancelCaucionTomadora?.ARS),
  arancelTomadoraUsd: formatPercentage(repoFeeConfig?.arancelCaucionTomadora?.USD),
});

const parseFormValues = (formValues) => ({
  commission: normalizeInputNumber(formValues.commission),
  arancelColocadoraArs: normalizeInputNumber(formValues.arancelColocadoraArs),
  arancelColocadoraUsd: normalizeInputNumber(formValues.arancelColocadoraUsd),
  arancelTomadoraArs: normalizeInputNumber(formValues.arancelTomadoraArs),
  arancelTomadoraUsd: normalizeInputNumber(formValues.arancelTomadoraUsd),
});

const isValidPayload = (parsed) => (
  Object.values(parsed).every((value) => Number.isFinite(value) && value >= 0)
);

const toRepoFeeOverrides = (parsed) => ({
  arancelCaucionColocadora: {
    ARS: parsed.arancelColocadoraArs,
    USD: parsed.arancelColocadoraUsd,
  },
  arancelCaucionTomadora: {
    ARS: parsed.arancelTomadoraArs,
    USD: parsed.arancelTomadoraUsd,
  },
});

export default function BrokerFeesScreen() {
  const [formValues, setFormValues] = useState(EMPTY_FORM);
  const [initialValues, setInitialValues] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      try {
        const [brokerFees, repoFeeConfig] = await Promise.all([
          loadBrokerFees(),
          getRepoFeeConfig(),
        ]);
        if (!mounted) return;
        const mapped = mapToFormState(brokerFees, repoFeeConfig);
        setFormValues(mapped);
        setInitialValues(parseFormValues(mapped));
      } catch (error) {

        console.error('PO: loadBrokerFees failed', error);
        if (mounted) {
          setErrorMessage(brokerStrings.errorMessage);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      mounted = false;
    };
  }, []);

  const parsedValues = useMemo(() => parseFormValues(formValues), [formValues]);
  const hasValidationError = useMemo(() => !isValidPayload(parsedValues), [parsedValues]);

  const isPristine = useMemo(() => {
    if (!initialValues) {
      return true;
    }

    return Object.keys(initialValues).every(
      (key) => parsedValues[key] === initialValues[key],
    );
  }, [initialValues, parsedValues]);

  const handleChange = (field) => (event) => {
    setFormValues((current) => ({
      ...current,
      [field]: event.target.value,
    }));
  };

  const applyLoadedState = (brokerFees, repoFeeConfig) => {
    const mapped = mapToFormState(brokerFees, repoFeeConfig);
    setFormValues(mapped);
    setInitialValues(parseFormValues(mapped));
  };

  // no local snackbar: using global toast service

  const handleSave = async () => {
    if (hasValidationError) {
      setErrorMessage(brokerStrings.validationError);
      return;
    }

    setSaving(true);
    setErrorMessage('');

    try {
      const [sanitizedBroker, sanitizedRepo] = await Promise.all([
        saveBrokerFees({ commission: parsedValues.commission }),
        setRepoFeeConfig(toRepoFeeOverrides(parsedValues)),
      ]);
      await refreshFeeServices();
      applyLoadedState(sanitizedBroker, sanitizedRepo);
      showToast({ message: brokerStrings.successMessage, severity: 'success' });
    } catch (error) {

      console.error('PO: saveBrokerFees failed', error);
      setErrorMessage(brokerStrings.errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    setErrorMessage('');

    try {
      const [brokerDefaults, repoDefaults] = await Promise.all([
        clearBrokerFees(),
        clearRepoFeeConfig(),
      ]);
      await refreshFeeServices();
      applyLoadedState(brokerDefaults, repoDefaults);
      showToast({ message: brokerStrings.resetMessage, severity: 'info' });
    } catch (error) {

      console.error('PO: clearBrokerFees failed', error);
      setErrorMessage(brokerStrings.errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const fieldError = (field) => hasValidationError && !Number.isFinite(parsedValues[field]);

  return (
    <Container maxWidth={false} sx={{ py: 3, px: 4 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {brokerStrings.title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {brokerStrings.description}
        </Typography>
      </Box>

      {errorMessage && (
        <Box sx={{ mb: 2 }}>
          <Alert severity="error" onClose={() => setErrorMessage('')}>
            {errorMessage}
          </Alert>
        </Box>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={32} />
        </Box>
      ) : (
        <Stack spacing={3} sx={{ maxWidth: 480 }}>
          <TextField
            label={brokerStrings.commissionLabel}
            value={formValues.commission}
            onChange={handleChange('commission')}
            type="number"
            inputProps={{ min: 0, step: '0.01' }}
            helperText={brokerStrings.commissionHelper}
            disabled={saving}
            error={fieldError('commission')}
          />

          <Divider />

          <Box>
            <Typography variant="h6" component="h2">
              {brokerStrings.repoSectionTitle}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {brokerStrings.repoSectionDescription}
            </Typography>
          </Box>

          <TextField
            label={brokerStrings.arancelColocadoraArsLabel}
            value={formValues.arancelColocadoraArs}
            onChange={handleChange('arancelColocadoraArs')}
            type="number"
            inputProps={{ min: 0, step: '0.01' }}
            helperText={brokerStrings.arancelColocadoraHelper}
            disabled={saving}
            error={fieldError('arancelColocadoraArs')}
          />
          <TextField
            label={brokerStrings.arancelColocadoraUsdLabel}
            value={formValues.arancelColocadoraUsd}
            onChange={handleChange('arancelColocadoraUsd')}
            type="number"
            inputProps={{ min: 0, step: '0.01' }}
            helperText={brokerStrings.arancelColocadoraHelper}
            disabled={saving}
            error={fieldError('arancelColocadoraUsd')}
          />
          <TextField
            label={brokerStrings.arancelTomadoraArsLabel}
            value={formValues.arancelTomadoraArs}
            onChange={handleChange('arancelTomadoraArs')}
            type="number"
            inputProps={{ min: 0, step: '0.01' }}
            helperText={brokerStrings.arancelTomadoraHelper}
            disabled={saving}
            error={fieldError('arancelTomadoraArs')}
          />
          <TextField
            label={brokerStrings.arancelTomadoraUsdLabel}
            value={formValues.arancelTomadoraUsd}
            onChange={handleChange('arancelTomadoraUsd')}
            type="number"
            inputProps={{ min: 0, step: '0.01' }}
            helperText={brokerStrings.arancelTomadoraHelper}
            disabled={saving}
            error={fieldError('arancelTomadoraUsd')}
          />

          <Stack direction="row" spacing={2}>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={saving || hasValidationError || isPristine}
            >
              {saving ? `${brokerStrings.saveButton}...` : brokerStrings.saveButton}
            </Button>
            <Button
              variant="outlined"
              color="secondary"
              onClick={handleReset}
              disabled={saving}
            >
              {brokerStrings.resetButton}
            </Button>
          </Stack>
        </Stack>
      )}

      {/* Toasts are handled by the global ToastContainer */}
    </Container>
  );
}
