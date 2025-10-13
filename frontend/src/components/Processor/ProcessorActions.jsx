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
  hasAnyData,
  activeScope,
  activeScopeLabel,
  activeHasData,
  onCopyActive,
  onDownloadActive,
  onCopyCalls,
  onCopyPuts,
  onCopyCombined,
  onDownloadCalls,
  onDownloadPuts,
  onDownloadCombined,
  onDownloadAll,
}) => {
  const actionStrings = strings.actions;
  const viewName = actionStrings?.viewNames?.[activeScope] ?? activeScopeLabel ?? activeScope;

  return (
    <Paper elevation={2} sx={{ p: 3 }}>
      <Stack spacing={3}>
        <Typography variant="h6" component="h2">
          {actionStrings.title}
        </Typography>

        <Stack spacing={1}>
          <Typography variant="subtitle2" color="text.secondary">
            {`${actionStrings.currentViewPrefix} ${viewName}`}
          </Typography>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <Button
              variant="contained"
              onClick={onCopyActive}
              disabled={disabled || !activeHasData}
              data-testid="copy-active-button"
            >
              {actionStrings.copyActive}
            </Button>
            <Button
              variant="contained"
              onClick={onDownloadActive}
              disabled={disabled || !activeHasData}
              data-testid="download-active-button"
            >
              {actionStrings.downloadActive}
            </Button>
          </Stack>
        </Stack>

        {actionStrings.scopeSection && (
          <Typography variant="subtitle2" color="text.secondary">
            {actionStrings.scopeSection}
          </Typography>
        )}

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <Button
            variant="outlined"
            onClick={onCopyCalls}
            disabled={disabled || !hasCalls}
            data-testid="copy-calls-button"
          >
            {actionStrings.copyCalls}
          </Button>
          <Button
            variant="outlined"
            onClick={onCopyPuts}
            disabled={disabled || !hasPuts}
            data-testid="copy-puts-button"
          >
            {actionStrings.copyPuts}
          </Button>
          <Button
            variant="outlined"
            onClick={onCopyCombined}
            disabled={disabled || !hasData}
            data-testid="copy-combined-button"
          >
            {actionStrings.copyCombined}
          </Button>
        </Stack>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <Button
            variant="contained"
            onClick={onDownloadCalls}
            disabled={disabled || !hasCalls}
            data-testid="download-calls-button"
          >
            {actionStrings.downloadCalls}
          </Button>
          <Button
            variant="contained"
            onClick={onDownloadPuts}
            disabled={disabled || !hasPuts}
            data-testid="download-puts-button"
          >
            {actionStrings.downloadPuts}
          </Button>
          <Button
            variant="contained"
            onClick={onDownloadCombined}
            disabled={disabled || !hasData}
            data-testid="download-combined-button"
          >
            {actionStrings.downloadCombined}
          </Button>
        </Stack>
        {actionStrings.downloadAll && (
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <Button
              variant="outlined"
              onClick={onDownloadAll}
              disabled={disabled || !hasAnyData}
              data-testid="download-all-button"
            >
              {actionStrings.downloadAll}
            </Button>
          </Stack>
        )}
      </Stack>
    </Paper>
  );
};

export default ProcessorActions;
