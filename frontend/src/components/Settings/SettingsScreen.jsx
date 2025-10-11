import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { useConfig } from '../../state/config-context.jsx';
import { useStrings } from '../../strings/index.js';
import SymbolManager from './SymbolManager.jsx';
import ExpirationManager from './ExpirationManager.jsx';

const SettingsScreen = () => {
  const settingsStrings = useStrings().settings;
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

      <Stack
        direction={{ xs: 'column', lg: 'row' }}
        spacing={3}
        alignItems="stretch"
        data-testid="settings-layout"
      >
        <Box flex={1}>
          <SymbolManager />
        </Box>
        <Box flex={1}>
          <ExpirationManager />
        </Box>
      </Stack>

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
