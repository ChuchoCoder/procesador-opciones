import { useRef } from 'react';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';

const FilePicker = ({
  strings,
  useAveraging,
  onToggleAveraging,
  isProcessing,
  onProcess,
  onFileSelected,
  selectedFileName,
  canProcess,
}) => {
  const inputRef = useRef(null);

  const handleFileChange = (event) => {
    const file = event.target.files?.[0] ?? null;
    if (inputRef.current) {
      inputRef.current.value = '';
    }
    onFileSelected(file);
  };

  return (
    <Paper elevation={2} sx={{ p: 3 }}>
      <Stack spacing={3}>
        <Stack spacing={1}>
          <Typography variant="h6" component="h2">
            {strings.upload.title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {strings.upload.description}
          </Typography>
        </Stack>

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
          <Button variant="outlined" component="label" disabled={isProcessing}>
            {strings.upload.selectButton}
            <input
              ref={inputRef}
              hidden
              accept=".csv"
              type="file"
              onChange={handleFileChange}
              data-testid="processor-file-input"
            />
          </Button>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="body2">
              {selectedFileName ? (
                <strong>{selectedFileName}</strong>
              ) : (
                <span>{strings.upload.noFileSelected}</span>
              )}
            </Typography>
          </Box>
          <FormControlLabel
            control={
              <Switch
                checked={useAveraging}
                onChange={(event) => onToggleAveraging(event.target.checked)}
                color="primary"
                disabled={isProcessing}
                data-testid="processor-averaging-switch"
              />
            }
            label={strings.upload.averagingSwitch}
          />
          <Button
            variant="contained"
            onClick={onProcess}
            disabled={!canProcess || isProcessing}
            data-testid="processor-process-button"
          >
            {isProcessing ? strings.upload.processing : strings.upload.processButton}
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
};

export default FilePicker;
