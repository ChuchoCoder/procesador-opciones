import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useStrings } from '../../strings/index.js';

const ProcessorScreen = () => {
  const strings = useStrings();
  return (
    <Box data-testid="processor-placeholder">
      <Typography variant="h4" component="h1" gutterBottom>
        {strings.processor.placeholderTitle}
      </Typography>
      <Typography variant="body1">{strings.processor.placeholderBody}</Typography>
    </Box>
  );
};

export default ProcessorScreen;
