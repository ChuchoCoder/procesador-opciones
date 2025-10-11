import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { useConfig } from '../../state/config-context.jsx';
import { useStrings } from '../../strings/index.js';
import SymbolManager from './SymbolManager.jsx';
import ExpirationManager from './ExpirationManager.jsx';

const SettingsScreen = () => {
  const strings = useStrings();
  const settingsStrings = strings.settings;
  const { resetDefaults, storageEnabled, hydrated } = useConfig();

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4" component="h1" gutterBottom>
          {settingsStrings.title}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {settingsStrings.description}
        </Typography>
      </Box>

      {storageEnabled === false && (
        <Alert severity="warning">{settingsStrings.storageDisabled}</Alert>
      )}

      {!hydrated && <LinearProgress />}

      <Grid container spacing={3}>
        <Grid item xs={12} lg={6}>
          <SymbolManager />
        </Grid>
        <Grid item xs={12} lg={6}>
          <ExpirationManager />
        </Grid>
      </Grid>

      <Box
        display="flex"
        flexDirection={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'center' }}
        gap={2}
      >
        <Typography variant="body2" color="text.secondary">
          {settingsStrings.resetDescription}
        </Typography>
        <Button
          variant="outlined"
          color="primary"
          onClick={resetDefaults}
          data-testid="settings-restore-defaults"
        >
          {settingsStrings.resetButton}
        </Button>
      </Box>
    </Stack>
  );
};

export default SettingsScreen;
