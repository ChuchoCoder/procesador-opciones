import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useStrings } from '../../strings/index.js';

const SettingsScreen = () => {
  const strings = useStrings();
  return (
    <Box data-testid="settings-placeholder">
      <Typography variant="h4" component="h1" gutterBottom>
        {strings.settings.placeholderTitle}
      </Typography>
      <Typography variant="body1">{strings.settings.placeholderBody}</Typography>
    </Box>
  );
};

export default SettingsScreen;
