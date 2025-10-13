import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Outlet } from 'react-router-dom';

import { useConfig } from '../../state/index.js';
import { useStrings } from '../../strings/index.js';

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
      <Box width="100%" data-testid="settings-content">
        <Outlet />
      </Box>

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
