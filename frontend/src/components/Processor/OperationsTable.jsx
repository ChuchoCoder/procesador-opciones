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

import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';

const quantityFormatter = typeof Intl !== 'undefined'
  ? new Intl.NumberFormat('es-AR', {
      useGrouping: false,
      maximumFractionDigits: 0,
    })
  : null;

const decimalFormatter = typeof Intl !== 'undefined'
  ? new Intl.NumberFormat('es-AR', {
      useGrouping: false,
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
                colSpan={3}
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
                  <Typography variant="subtitle1" component="h3">
                    {title}
                  </Typography>
                  {hasData && (
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      {onToggleAveraging && (
                        <Tooltip title={strings?.upload?.averagingSwitch ?? 'Promediar por strike'}>
                          <FormControlLabel
                            sx={{ 
                              ml: 0, 
                              mr: 0.5, 
                              '& .MuiFormControlLabel-label': { display: 'none' } 
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
                          />
                        </Tooltip>
                      )}
                      <Tooltip title={strings.actions?.copy ?? 'Copiar'}>
                        <IconButton
                          onClick={onCopy}
                          size="small"
                          data-testid={`${testId}-copy-button`}
                        >
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={strings.actions?.download ?? 'Descargar'}>
                        <IconButton
                          onClick={onDownload}
                          size="small"
                          data-testid={`${testId}-download-button`}
                        >
                          <DownloadIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  )}
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
              }}
            >
              {strings.tables.strike}
            </TableCell>
            <TableCell
              align="right"
              sx={{
                position: 'sticky',
                top: 48,
                backgroundColor: '#fafafa',
                zIndex: 1,
              }}
            >
              {strings.tables.price}
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {operations.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} align="center">
                {strings.tables.empty}
              </TableCell>
            </TableRow>
          ) : (
            operations.map((operation) => {
              const rowKey = `${operation.originalSymbol ?? 'op'}-${operation.strike}-${operation.totalQuantity}-${operation.averagePrice}`;
              const hasInferredSource = Boolean(
                operation?.legs?.some((leg) => leg?.meta?.detectedFromToken),
              );

              return (
                <TableRow key={rowKey}>
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      {hasInferredSource && (
                        <Tooltip title={strings.tables.inferredTooltip} disableInteractive>
                          <InfoOutlinedIcon
                            fontSize="inherit"
                            sx={{ fontSize: '1rem' }}
                            data-testid="operations-inferred-indicator"
                            titleAccess={strings.tables.inferredTooltip}
                            color="info"
                          />
                        </Tooltip>
                      )}
                      <span>{formatQuantity(operation.totalQuantity)}</span>
                    </Stack>
                  </TableCell>
                  <TableCell align="right">{formatDecimal(operation.strike)}</TableCell>
                  <TableCell align="right">{formatDecimal(operation.averagePrice)}</TableCell>
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
