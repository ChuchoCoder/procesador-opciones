import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';

const SummaryMetric = ({ label, value, testId }) => (
  <Stack spacing={0.5} alignItems="flex-start">
    <Typography variant="body2" color="text.secondary">
      {label}
    </Typography>
    <Typography variant="h5" component="span" data-testid={testId}>
      {value}
    </Typography>
  </Stack>
);

const SummaryPanel = ({ summary, strings }) => {
  if (!summary) {
    return null;
  }

  const averagingLabel = summary.averagingEnabled
    ? strings.summary.averagingOn
    : strings.summary.averagingOff;

  return (
    <Paper elevation={2} sx={{ p: 3 }}>
      <Stack spacing={2}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Typography variant="h6" component="h2">
            {strings.summary.title}
          </Typography>
          <Chip label={averagingLabel} color={summary.averagingEnabled ? 'primary' : 'default'} />
        </Stack>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={4}>
          <SummaryMetric
            label={strings.summary.calls}
            value={summary.callsRows}
            testId="summary-calls-count"
          />
          <SummaryMetric
            label={strings.summary.puts}
            value={summary.putsRows}
            testId="summary-puts-count"
          />
          <SummaryMetric
            label={strings.summary.total}
            value={summary.totalRows}
            testId="summary-total-count"
          />
        </Stack>

        <Typography variant="body2" color="text.secondary">
          {`${strings.summary.processedAt}: ${summary.processedAt}`}
        </Typography>
      </Stack>
    </Paper>
  );
};

export default SummaryPanel;
