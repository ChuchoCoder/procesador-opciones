import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

const ProcessorActions = ({
  strings,
  disabled,
  hasCalls,
  hasPuts,
  hasData,
  onCopyCalls,
  onCopyPuts,
  onCopyCombined,
  onDownloadCalls,
  onDownloadPuts,
  onDownloadCombined,
}) => (
  <Paper elevation={2} sx={{ p: 3 }}>
    <Stack spacing={2}>
      <Typography variant="h6" component="h2">
        {strings.actions.title}
      </Typography>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <Button
          variant="outlined"
          onClick={onCopyCalls}
          disabled={disabled || !hasCalls}
          data-testid="copy-calls-button"
        >
          {strings.actions.copyCalls}
        </Button>
        <Button
          variant="outlined"
          onClick={onCopyPuts}
          disabled={disabled || !hasPuts}
          data-testid="copy-puts-button"
        >
          {strings.actions.copyPuts}
        </Button>
        <Button
          variant="outlined"
          onClick={onCopyCombined}
          disabled={disabled || !hasData}
          data-testid="copy-combined-button"
        >
          {strings.actions.copyCombined}
        </Button>
      </Stack>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <Button
          variant="contained"
          onClick={onDownloadCalls}
          disabled={disabled || !hasCalls}
          data-testid="download-calls-button"
        >
          {strings.actions.downloadCalls}
        </Button>
        <Button
          variant="contained"
          onClick={onDownloadPuts}
          disabled={disabled || !hasPuts}
          data-testid="download-puts-button"
        >
          {strings.actions.downloadPuts}
        </Button>
        <Button
          variant="contained"
          onClick={onDownloadCombined}
          disabled={disabled || !hasData}
          data-testid="download-combined-button"
        >
          {strings.actions.downloadCombined}
        </Button>
      </Stack>
    </Stack>
  </Paper>
);

export default ProcessorActions;
