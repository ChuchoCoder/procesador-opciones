import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Chip from '@mui/material/Chip';
import { useTheme } from '@mui/material/styles';

import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import ArrowCircleUpIcon from '@mui/icons-material/ArrowCircleUp';
import ArrowCircleDownIcon from '@mui/icons-material/ArrowCircleDown';

import FeeTooltip from './FeeTooltip.jsx';

const quantityFormatter = typeof Intl !== 'undefined'
  ? new Intl.NumberFormat('es-AR', {
      useGrouping: true,
      maximumFractionDigits: 0,
    })
  : null;

const decimalFormatter = typeof Intl !== 'undefined'
  ? new Intl.NumberFormat('es-AR', {
      useGrouping: true,
      minimumFractionDigits: 0,
      maximumFractionDigits: 4,
    })
  : null;

const formatQuantity = (value) => {
  if (!Number.isFinite(value)) {
    return '';
  }
  if (quantityFormatter) {
    return quantityFormatter.format(value);
  }
  return String(value);
};

const formatDecimal = (value) => {
  if (!Number.isFinite(value)) {
    return '';
  }
  if (decimalFormatter) {
    return decimalFormatter.format(value);
  }
  return String(value);
};

const feeFormatter = typeof Intl !== 'undefined'
  ? new Intl.NumberFormat('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  : null;

const formatFee = (value) => {
  if (!Number.isFinite(value)) {
    return '—';
  }
  if (feeFormatter) {
    return feeFormatter.format(value);
  }
  return value.toFixed(2);
};

const OperationsTable = ({ 
  title, 
  operations, 
  strings, 
  testId, 
  onCopy, 
  onDownload,
  averagingEnabled,
  onToggleAveraging,
}) => {
  const hasData = operations.length > 0;
  const theme = useTheme();
  
  // Determine if this is CALLS or PUTS based on title
  const isCallsTable = title?.toLowerCase().includes('call');
  const isPutsTable = title?.toLowerCase().includes('put');
  
  const getChipColor = () => {
    if (isCallsTable) return theme.palette.calls.main;
    if (isPutsTable) return theme.palette.puts.main;
    return theme.palette.primary.main;
  };
  
  const getIcon = () => {
    if (isCallsTable) return <ArrowCircleUpIcon sx={{ fontSize: 18 }} />;
    if (isPutsTable) return <ArrowCircleDownIcon sx={{ fontSize: 18 }} />;
    return null;
  };

  return (
    <Paper
      elevation={0}
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        overflow: 'hidden',
        borderRadius: 0,
      }}
    >
      <TableContainer sx={{ flex: 1, overflow: 'auto' }}>
        <Table size="small" data-testid={testId} stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell
                colSpan={4}
                sx={{
                  position: 'sticky',
                  top: 0,
                  backgroundColor: 'background.paper',
                  zIndex: 2,
                }}
              >
                <Stack 
                  direction="row" 
                  alignItems="center" 
                  justifyContent="space-between"
                  sx={{ width: '100%' }}
                >
                  <Chip
                    icon={getIcon()}
                    label={title}
                    sx={{
                      backgroundColor: getChipColor(),
                      color: '#fff',
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      letterSpacing: '0.5px',
                      '& .MuiChip-icon': {
                        color: '#fff',
                      },
                    }}
                  />
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    {hasData && onToggleAveraging && (
                      <Tooltip title={strings?.upload?.averagingSwitch ?? 'Promediar por strike'}>
                        <FormControlLabel
                          sx={{ 
                            ml: 0, 
                            mr: 0.5,
                            '& .MuiFormControlLabel-label': { fontSize: '0.75rem' },
                          }}
                          control={(
                            <Switch
                              size="small"
                              checked={averagingEnabled}
                              onChange={(e) => onToggleAveraging?.(e.target.checked)}
                              color="primary"
                              data-testid={`${testId}-averaging-switch`}
                              inputProps={{ 
                                'aria-label': 'Promediar por strike',
                              }}
                            />
                          )}
                          label="PROMEDIAR"
                        />
                      </Tooltip>
                    )}
                    <Tooltip title={strings.actions?.copy ?? 'Copiar'}>
                      <span style={{ display: 'inline-flex' }}>
                        <IconButton
                          onClick={onCopy}
                          size="small"
                          data-testid={`${testId}-copy-button`}
                          disabled={!hasData}
                        >
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title={strings.actions?.download ?? 'Descargar'}>
                      <span style={{ display: 'inline-flex' }}>
                        <IconButton
                          onClick={onDownload}
                          size="small"
                          data-testid={`${testId}-download-button`}
                          disabled={!hasData}
                        >
                          <DownloadIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Stack>
                </Stack>
              </TableCell>
            </TableRow>
          <TableRow>
            <TableCell
              sx={{
                position: 'sticky',
                top: 48,
                backgroundColor: '#fafafa',
                zIndex: 1,
                pt: 2,
              }}
            >
              {strings.tables.quantity}
            </TableCell>
            <TableCell
              align="right"
              sx={{
                position: 'sticky',
                top: 48,
                backgroundColor: '#fafafa',
                zIndex: 1,
                pt: 2,
              }}
            >
              <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="flex-end">
                <span>{strings.tables.strike}</span>
                <Tooltip title={strings.tables.inferredTooltip} disableInteractive>
                  <InfoOutlinedIcon
                    fontSize="inherit"
                    sx={{ fontSize: '1rem', color: 'info.main' }}
                  />
                </Tooltip>
              </Stack>
            </TableCell>
            <TableCell
              align="right"
              sx={{
                position: 'sticky',
                top: 48,
                backgroundColor: '#fafafa',
                zIndex: 1,
                pt: 2,
              }}
            >
              {strings.tables.price}
            </TableCell>
            <TableCell
              align="right"
              sx={{
                position: 'sticky',
                top: 48,
                backgroundColor: '#fafafa',
                zIndex: 1,
                pt: 2,
              }}
            >
              {strings.tables.fee || 'Gastos'}
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {operations.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} align="center">
                {strings.tables.empty}
              </TableCell>
            </TableRow>
          ) : (
            operations.map((operation, index) => {
              const rowKey = `${operation.originalSymbol ?? 'op'}-${operation.strike}-${operation.totalQuantity}-${operation.averagePrice}`;
              const feeAmount = operation.feeAmount ?? 0;
              const feeBreakdown = operation.feeBreakdown;
              const grossNotional = operation.grossNotional ?? 0;

              return (
                <TableRow
                  key={rowKey}
                  sx={index % 2 === 1 ? { backgroundColor: 'action.hover' } : undefined}
                >
                  <TableCell>
                    {formatQuantity(operation.totalQuantity)}
                  </TableCell>
                  <TableCell align="right">{formatDecimal(operation.strike)}</TableCell>
                  <TableCell align="right">{formatDecimal(operation.averagePrice)}</TableCell>
                  <TableCell align="right">
                    <FeeTooltip
                      feeBreakdown={feeBreakdown}
                      grossNotional={grossNotional}
                      strings={strings}
                    >
                      <Typography variant="body2" component="span">
                        {formatFee(feeAmount)}
                      </Typography>
                    </FeeTooltip>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </TableContainer>
  </Paper>
  );
};

export default OperationsTable;
