import { useEffect, useMemo, useState } from 'react';
import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';

import strings from '../../../strings/es-AR.js';
import {
  loadBrokerFees,
  saveBrokerFees,
  clearBrokerFees,
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

const mapToFormState = (fees) => ({
  commission: formatPercentage(fees.commission),
  arancelCaucionColocadora: formatPercentage(fees.arancelCaucionColocadora),
  arancelCaucionTomadora: formatPercentage(fees.arancelCaucionTomadora),
});

const parseFormValues = (formValues) => ({
  commission: normalizeInputNumber(formValues.commission),
  arancelCaucionColocadora: normalizeInputNumber(formValues.arancelCaucionColocadora),
  arancelCaucionTomadora: normalizeInputNumber(formValues.arancelCaucionTomadora),
});

const isValidPayload = (parsed) => (
  Object.values(parsed).every((value) => Number.isFinite(value) && value >= 0)
);

export default function BrokerFeesScreen() {
  const [formValues, setFormValues] = useState({
    commission: '',
    arancelCaucionColocadora: '',
    arancelCaucionTomadora: '',
  });
  const [initialValues, setInitialValues] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      try {
        const fees = await loadBrokerFees();
        if (!mounted) return;
        setFormValues(mapToFormState(fees));
        setInitialValues(fees);
      } catch (error) {
        // eslint-disable-next-line no-console
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

    return (
      parsedValues.commission === initialValues.commission
      && parsedValues.arancelCaucionColocadora === initialValues.arancelCaucionColocadora
      && parsedValues.arancelCaucionTomadora === initialValues.arancelCaucionTomadora
    );
  }, [initialValues, parsedValues]);

  const handleChange = (field) => (event) => {
    setFormValues((current) => ({
      ...current,
      [field]: event.target.value,
    }));
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
      const sanitized = await saveBrokerFees(parsedValues);
      await refreshFeeServices();
      setInitialValues(sanitized);
      setFormValues(mapToFormState(sanitized));
  showToast({ message: brokerStrings.successMessage, severity: 'success' });
    } catch (error) {
      // eslint-disable-next-line no-console
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
      const defaults = await clearBrokerFees();
      await refreshFeeServices();
      setInitialValues(defaults);
      setFormValues(mapToFormState(defaults));
  showToast({ message: brokerStrings.resetMessage, severity: 'info' });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('PO: clearBrokerFees failed', error);
  setErrorMessage(brokerStrings.errorMessage);
    } finally {
      setSaving(false);
    }
  };

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
            error={hasValidationError && !Number.isFinite(parsedValues.commission)}
          />
          <TextField
            label={brokerStrings.arancelColocadoraLabel}
            value={formValues.arancelCaucionColocadora}
            onChange={handleChange('arancelCaucionColocadora')}
            type="number"
            inputProps={{ min: 0, step: '0.01' }}
            helperText={brokerStrings.arancelCaucionColocadoraHelper}
            disabled={saving}
            error={hasValidationError && !Number.isFinite(parsedValues.arancelCaucionColocadora)}
          />
          <TextField
            label={brokerStrings.arancelTomadoraLabel}
            value={formValues.arancelCaucionTomadora}
            onChange={handleChange('arancelCaucionTomadora')}
            type="number"
            inputProps={{ min: 0, step: '0.01' }}
            helperText={brokerStrings.arancelTomadoraHelper}
            disabled={saving}
            error={hasValidationError && !Number.isFinite(parsedValues.arancelCaucionTomadora)}
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
