import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';

import CallMadeIcon from '@mui/icons-material/CallMade';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import SummarizeIcon from '@mui/icons-material/Summarize';

const SummaryMetric = ({ label, value, testId, icon, color = 'text.primary' }) => (
  <Card variant="outlined" sx={{ height: '100%' }}>
    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
      <Stack spacing={1}>
        <Stack direction="row" spacing={1} alignItems="center">
          {icon && <Box sx={{ color: color }}>{icon}</Box>}
          <Typography variant="body2" color="text.secondary">
            {label}
          </Typography>
        </Stack>
        <Typography variant="h4" component="span" data-testid={testId} sx={{ color }}>
          {value}
        </Typography>
      </Stack>
    </CardContent>
  </Card>
);

const SummaryPanel = ({ summary, strings }) => {
  if (!summary) {
    return null;
  }

  const averagingLabel = summary.averagingEnabled
    ? strings.summary.averagingOn
    : strings.summary.averagingOff;

  return (
    <Paper elevation={0} sx={{ p: 2, backgroundColor: 'transparent' }}>
      <Stack spacing={2}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Typography variant="h6" component="h2">
            {strings.summary.title}
          </Typography>
          <Chip
            label={averagingLabel}
            color={summary.averagingEnabled ? 'primary' : 'default'}
            size="small"
          />
        </Stack>

        {/* Responsive metrics layout without deprecated Grid v1 props. */}
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(3, 1fr)',
            },
          }}
        >
          <SummaryMetric
            label={strings.summary.calls}
            value={summary.callsRows}
            testId="summary-calls-count"
            icon={<CallMadeIcon fontSize="small" />}
            color="success.main"
          />
          <SummaryMetric
            label={strings.summary.puts}
            value={summary.putsRows}
            testId="summary-puts-count"
            icon={<TrendingDownIcon fontSize="small" />}
            color="error.main"
          />
          <SummaryMetric
            label={strings.summary.total}
            value={summary.totalRows}
            testId="summary-total-count"
            icon={<SummarizeIcon fontSize="small" />}
            color="primary.main"
          />
        </Box>

        <Typography variant="caption" color="text.secondary">
          {`${strings.summary.processedAt}: ${summary.processedAt}`}
        </Typography>
      </Stack>
    </Paper>
  );
};

export default SummaryPanel;
