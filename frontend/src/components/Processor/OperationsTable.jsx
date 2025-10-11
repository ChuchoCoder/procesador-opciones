import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';

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
              return (
                <TableRow key={rowKey}>
                  <TableCell>{formatQuantity(operation.totalQuantity)}</TableCell>
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
