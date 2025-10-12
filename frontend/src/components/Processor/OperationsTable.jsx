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

import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

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

const OperationsTable = ({ title, operations, strings, testId }) => (
  <Paper elevation={2} sx={{ flex: 1 }}>
    <TableContainer>
      <Table size="small" data-testid={testId}>
        <TableHead>
          <TableRow>
            <TableCell colSpan={3}>
              <Typography variant="subtitle1" component="h3">
                {title}
              </Typography>
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell>{strings.tables.quantity}</TableCell>
            <TableCell>{strings.tables.strike}</TableCell>
            <TableCell>{strings.tables.price}</TableCell>
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
                  <TableCell>{formatDecimal(operation.strike)}</TableCell>
                  <TableCell>{formatDecimal(operation.averagePrice)}</TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </TableContainer>
  </Paper>
);

export default OperationsTable;
