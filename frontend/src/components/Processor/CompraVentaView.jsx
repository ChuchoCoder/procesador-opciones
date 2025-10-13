import { useMemo } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';

import GroupFilter from './GroupFilter.jsx';
import { getNonOptionOperations } from '../../services/csv/buy-sell-matcher.js';

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

const BuySellTable = ({ title, operations, strings, testId, sideLabel }) => {
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
                colSpan={5}
                sx={{
                  position: 'sticky',
                  top: 0,
                  backgroundColor: 'background.paper',
                  zIndex: 2,
                }}
              >
                <Typography variant="subtitle1" component="h3">
                  {title}
                </Typography>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>{strings?.tables?.symbol ?? 'Símbolo'}</TableCell>
              <TableCell>{strings?.tables?.settlement ?? 'Plazo'}</TableCell>
              <TableCell align="right">{strings?.tables?.quantity ?? 'Cantidad'}</TableCell>
              <TableCell align="right">{strings?.tables?.price ?? 'Precio'}</TableCell>
              <TableCell>{strings?.tables?.side ?? 'Operación'}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!hasData && (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <Typography variant="body2" color="text.secondary">
                    {strings?.tables?.empty ?? 'Sin datos para mostrar.'}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {operations.map((operation, index) => (
              <TableRow key={`${operation.order_id ?? index}-${index}`}>
                <TableCell>{operation.symbol ?? ''}</TableCell>
                <TableCell>{operation.expiration ?? operation.settlement ?? 'CI'}</TableCell>
                <TableCell align="right">{formatQuantity(operation.quantity)}</TableCell>
                <TableCell align="right">{formatDecimal(operation.price)}</TableCell>
                <TableCell>{sideLabel}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
};

const CompraVentaView = ({
  operations,
  groupOptions,
  selectedGroupId,
  strings,
  onGroupChange,
}) => {
  const filterStrings = strings?.filters ?? {};

  const { buys, sells } = useMemo(() => {
    return getNonOptionOperations(operations);
  }, [operations]);

  return (
    <Stack spacing={0} sx={{ flex: 1, minHeight: 0 }}>
      {groupOptions.length > 0 && (
        <GroupFilter
          options={groupOptions}
          selectedGroupId={selectedGroupId}
          onChange={onGroupChange}
          strings={filterStrings}
        />
      )}

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: { xs: 'column', lg: 'row' },
          gap: 0,
        }}
      >
        {/* BUY operations table */}
        <BuySellTable
          title={strings?.tables?.buyTitle ?? 'Operaciones de Compra'}
          operations={buys}
          strings={strings}
          testId="processor-buy-table"
          sideLabel="COMPRA"
        />

        {/* SELL operations table */}
        <BuySellTable
          title={strings?.tables?.sellTitle ?? 'Operaciones de Venta'}
          operations={sells}
          strings={strings}
          testId="processor-sell-table"
          sideLabel="VENTA"
        />
      </Box>
    </Stack>
  );
};

export default CompraVentaView;
