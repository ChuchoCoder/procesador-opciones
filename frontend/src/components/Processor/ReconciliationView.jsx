import { Fragment, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

import { reconcileOperations, DEFAULT_TIME_WINDOW_MS } from '../../services/broker/reconciliation.js';
import { getDotDecimalLocale } from '../../services/locale.js';
import GroupFilter from './GroupFilter.jsx';

const decimalFormatter = typeof Intl !== 'undefined'
  ? new Intl.NumberFormat(getDotDecimalLocale(), { maximumFractionDigits: 4 })
  : null;

const formatNumber = (value) => {
  if (!Number.isFinite(value)) {
    return '';
  }
  return decimalFormatter ? decimalFormatter.format(value) : String(value);
};

const formatTimestamp = (value) => {
  if (!Number.isFinite(value)) {
    return '';
  }
  return new Date(value).toLocaleTimeString(getDotDecimalLocale(), { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const csvRowsToCsvText = (headers, rows) => {
  const escape = (value) => {
    const str = value === null || value === undefined ? '' : String(value);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  return [headers, ...rows].map((row) => row.map(escape).join(',')).join('\n');
};

const downloadCsvText = (csvText, fileName) => {
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const RawDetail = ({ label, data }) => (
  <Box sx={{ flex: 1, minWidth: 0 }}>
    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
      {label}
    </Typography>
    <Box
      component="pre"
      sx={{
        m: 0,
        mt: 0.5,
        p: 1,
        fontSize: '0.7rem',
        backgroundColor: 'action.hover',
        borderRadius: 1,
        overflow: 'auto',
        maxHeight: 220,
      }}
    >
      {JSON.stringify(data ?? null, null, 2)}
    </Box>
  </Box>
);

const MatchedTable = ({ rows, strings, testId }) => {
  const [expandedId, setExpandedId] = useState(null);

  if (rows.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
        {strings.emptyNoData}
      </Typography>
    );
  }

  return (
    <Table size="small" data-testid={testId} stickyHeader>
      <TableHead>
        <TableRow>
          <TableCell />
          <TableCell>{strings.symbol}</TableCell>
          <TableCell>{strings.side}</TableCell>
          <TableCell align="right">{strings.price}</TableCell>
          <TableCell align="right">{strings.csvQuantity}</TableCell>
          <TableCell align="right">{strings.brokerQuantity}</TableCell>
          <TableCell align="right">{strings.csvTimestamp}</TableCell>
          <TableCell align="right">{strings.brokerTimestamp}</TableCell>
          <TableCell align="right">{strings.deltaMs}</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => {
          const isExpanded = expandedId === row.id;
          return (
            <Fragment key={row.id}>
              <TableRow hover onClick={() => setExpandedId(isExpanded ? null : row.id)} sx={{ cursor: 'pointer' }}>
                <TableCell padding="checkbox">
                  <IconButton size="small">
                    {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                  </IconButton>
                </TableCell>
                <TableCell>{row.csv.symbol}</TableCell>
                <TableCell>{row.csv.action}</TableCell>
                <TableCell align="right">{formatNumber(row.csv.price)}</TableCell>
                <TableCell align="right">{formatNumber(row.csv.quantity)}</TableCell>
                <TableCell align="right">{formatNumber(row.broker.quantity)}</TableCell>
                <TableCell align="right">{formatTimestamp(row.csv.tradeTimestamp)}</TableCell>
                <TableCell align="right">{formatTimestamp(row.broker.tradeTimestamp)}</TableCell>
                <TableCell align="right">{row.deltaMs}</TableCell>
              </TableRow>
              {isExpanded && (
                <TableRow>
                  <TableCell colSpan={9} sx={{ py: 1 }}>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                      <RawDetail label={strings.rawCsv} data={row.csv.rawSource} />
                      <RawDetail label={strings.rawBroker} data={row.broker.rawSource} />
                    </Stack>
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
};

const MismatchedTable = ({ rows, strings, testId }) => {
  const [expandedId, setExpandedId] = useState(null);

  if (rows.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
        {strings.emptyNoData}
      </Typography>
    );
  }

  return (
    <Table size="small" data-testid={testId} stickyHeader>
      <TableHead>
        <TableRow>
          <TableCell />
          <TableCell>{strings.symbol}</TableCell>
          <TableCell>{strings.side}</TableCell>
          <TableCell align="right">{strings.price}</TableCell>
          <TableCell align="right">{strings.csvQuantity}</TableCell>
          <TableCell align="right">{strings.brokerQuantity}</TableCell>
          <TableCell>{strings.diffFields}</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => {
          const isExpanded = expandedId === row.id;
          return (
            <Fragment key={row.id}>
              <TableRow hover onClick={() => setExpandedId(isExpanded ? null : row.id)} sx={{ cursor: 'pointer' }}>
                <TableCell padding="checkbox">
                  <IconButton size="small">
                    {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                  </IconButton>
                </TableCell>
                <TableCell>{row.csv.symbol}</TableCell>
                <TableCell>{row.csv.action}</TableCell>
                <TableCell align="right">{formatNumber(row.csv.price)}</TableCell>
                <TableCell align="right" sx={{ color: 'warning.main', fontWeight: 600 }}>{formatNumber(row.csv.quantity)}</TableCell>
                <TableCell align="right" sx={{ color: 'warning.main', fontWeight: 600 }}>{formatNumber(row.broker.quantity)}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap">
                    {row.diffFields.map((diff) => (
                      <Chip key={diff.field} size="small" label={diff.field} color="warning" variant="outlined" />
                    ))}
                  </Stack>
                </TableCell>
              </TableRow>
              {isExpanded && (
                <TableRow>
                  <TableCell colSpan={7} sx={{ py: 1 }}>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                      <RawDetail label={strings.rawCsv} data={row.csv.rawSource} />
                      <RawDetail label={strings.rawBroker} data={row.broker.rawSource} />
                    </Stack>
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
};

const AbsentTable = ({ rows, strings, testId }) => {
  const [expandedId, setExpandedId] = useState(null);

  if (rows.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
        {strings.emptyNoData}
      </Typography>
    );
  }

  return (
    <Table size="small" data-testid={testId} stickyHeader>
      <TableHead>
        <TableRow>
          <TableCell />
          <TableCell>{strings.symbol}</TableCell>
          <TableCell>{strings.side}</TableCell>
          <TableCell align="right">{strings.price}</TableCell>
          <TableCell align="right">{strings.csvQuantity}</TableCell>
          <TableCell>{strings.missingOn}</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => {
          const isExpanded = expandedId === row.id;
          const op = row.operation;
          return (
            <Fragment key={row.id}>
              <TableRow hover onClick={() => setExpandedId(isExpanded ? null : row.id)} sx={{ cursor: 'pointer' }}>
                <TableCell padding="checkbox">
                  <IconButton size="small">
                    {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                  </IconButton>
                </TableCell>
                <TableCell>{op.symbol}</TableCell>
                <TableCell>{op.action}</TableCell>
                <TableCell align="right">{formatNumber(op.price)}</TableCell>
                <TableCell align="right">{formatNumber(op.quantity)}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={row.side === 'csv' ? strings.missingOnBroker : strings.missingOnCsv}
                    color="error"
                    variant="outlined"
                  />
                </TableCell>
              </TableRow>
              {isExpanded && (
                <TableRow>
                  <TableCell colSpan={6} sx={{ py: 1 }}>
                    <RawDetail label={row.side === 'csv' ? strings.rawCsv : strings.rawBroker} data={op.rawSource} />
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
};

const SUB_TABS = {
  MATCHED: 'matched',
  MISMATCHED: 'mismatched',
  ABSENT: 'absent',
};

const buildFlatRows = (subTab, result) => {
  if (subTab === SUB_TABS.MATCHED) {
    return result.matched.map((row) => [
      row.csv.symbol, row.csv.action, row.csv.price, row.csv.quantity, row.broker.quantity,
      row.csv.tradeTimestamp, row.broker.tradeTimestamp, row.deltaMs,
    ]);
  }
  if (subTab === SUB_TABS.MISMATCHED) {
    return result.mismatched.map((row) => [
      row.csv.symbol, row.csv.action, row.csv.price, row.csv.quantity, row.broker.quantity,
      row.diffFields.map((d) => d.field).join('|'),
    ]);
  }
  return result.absent.map((row) => [
    row.operation.symbol, row.operation.action, row.operation.price, row.operation.quantity,
    row.side === 'csv' ? 'broker' : 'csv',
  ]);
};

const FLAT_HEADERS = {
  [SUB_TABS.MATCHED]: ['symbol', 'side', 'price', 'csv_quantity', 'broker_quantity', 'csv_timestamp', 'broker_timestamp', 'delta_ms'],
  [SUB_TABS.MISMATCHED]: ['symbol', 'side', 'price', 'csv_quantity', 'broker_quantity', 'diff_fields'],
  [SUB_TABS.ABSENT]: ['symbol', 'side', 'price', 'quantity', 'missing_on'],
};

const ReconciliationView = ({
  strings,
  csvOperations = [],
  brokerOperations = [],
  groupOptions = [],
  selectedGroupId,
  onGroupChange,
}) => {
  const reconciliationStrings = strings?.reconciliation ?? {};
  const filterStrings = strings?.filters ?? {};
  const [subTab, setSubTab] = useState(SUB_TABS.MATCHED);

  const result = useMemo(
    () => reconcileOperations(csvOperations, brokerOperations, { timeWindowMs: DEFAULT_TIME_WINDOW_MS }),
    [csvOperations, brokerOperations],
  );

  const groupFilter = groupOptions.length > 0 && (
    <GroupFilter
      options={groupOptions}
      selectedGroupId={selectedGroupId}
      onChange={onGroupChange}
      strings={filterStrings}
    />
  );

  if (csvOperations.length === 0 || brokerOperations.length === 0) {
    return (
      <Stack spacing={0} sx={{ flex: 1, minHeight: 0 }}>
        {groupFilter}
        <Box sx={{ p: 3 }}>
          <Typography variant="body2" color="text.secondary">
            {reconciliationStrings.emptyNeedsBothSources}
          </Typography>
        </Box>
      </Stack>
    );
  }

  const handleCopy = async () => {
    const rows = buildFlatRows(subTab, result);
    const csvText = csvRowsToCsvText(FLAT_HEADERS[subTab], rows);
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(csvText);
    }
  };

  const handleDownload = () => {
    const rows = buildFlatRows(subTab, result);
    const csvText = csvRowsToCsvText(FLAT_HEADERS[subTab], rows);
    downloadCsvText(csvText, `reconciliacion-${subTab}.csv`);
  };

  return (
    <Stack spacing={0} sx={{ flex: 1, minHeight: 0 }}>
      {groupFilter}
      <Stack direction="row" spacing={1} sx={{ px: 2, pt: 2 }} flexWrap="wrap">
        <Chip size="small" color="success" label={`${reconciliationStrings.summaryMatched}: ${result.summary.matchedCount}`} />
        <Chip size="small" color="warning" label={`${reconciliationStrings.summaryMismatched}: ${result.summary.mismatchedCount}`} />
        <Chip size="small" color="error" label={`${reconciliationStrings.summaryAbsentCsv}: ${result.summary.absentCsvCount}`} />
        <Chip size="small" color="error" label={`${reconciliationStrings.summaryAbsentBroker}: ${result.summary.absentBrokerCount}`} />
      </Stack>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: 1, borderColor: 'divider', px: 2 }}>
        <Tabs value={subTab} onChange={(_, value) => setSubTab(value)}>
          <Tab value={SUB_TABS.MATCHED} label={reconciliationStrings.matchedTab} data-testid="reconciliation-tab-matched" />
          <Tab value={SUB_TABS.MISMATCHED} label={reconciliationStrings.mismatchedTab} data-testid="reconciliation-tab-mismatched" />
          <Tab value={SUB_TABS.ABSENT} label={reconciliationStrings.absentTab} data-testid="reconciliation-tab-absent" />
        </Tabs>
        <Stack direction="row" spacing={0.5}>
          <Tooltip title={reconciliationStrings.copy}>
            <IconButton size="small" onClick={handleCopy} data-testid="reconciliation-copy-button">
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={reconciliationStrings.download}>
            <IconButton size="small" onClick={handleDownload} data-testid="reconciliation-download-button">
              <DownloadIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      <Paper elevation={0} sx={{ flex: 1, minHeight: 0, overflow: 'hidden', borderRadius: 0 }}>
        <TableContainer sx={{ height: '100%', overflow: 'auto' }}>
          {subTab === SUB_TABS.MATCHED && (
            <MatchedTable rows={result.matched} strings={reconciliationStrings} testId="reconciliation-matched-table" />
          )}
          {subTab === SUB_TABS.MISMATCHED && (
            <MismatchedTable rows={result.mismatched} strings={reconciliationStrings} testId="reconciliation-mismatched-table" />
          )}
          {subTab === SUB_TABS.ABSENT && (
            <AbsentTable rows={result.absent} strings={reconciliationStrings} testId="reconciliation-absent-table" />
          )}
        </TableContainer>
      </Paper>
    </Stack>
  );
};

export default ReconciliationView;
