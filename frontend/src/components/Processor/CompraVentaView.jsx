import { useMemo, useState } from 'react';
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
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Tooltip from '@mui/material/Tooltip';

import GroupFilter from './GroupFilter.jsx';
import { getBuySellOperations } from '../../services/csv/buy-sell-matcher.js';

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
  const safeValue = Object.is(value, -0) ? 0 : value;
  if (quantityFormatter) {
    return quantityFormatter.format(safeValue);
  }
  return String(safeValue);
};

const formatDecimal = (value) => {
  if (!Number.isFinite(value)) {
    return '';
  }
  const safeValue = Object.is(value, -0) ? 0 : value;
  if (decimalFormatter) {
    return decimalFormatter.format(safeValue);
  }
  return String(safeValue);
};

const DEFAULT_SETTLEMENT = 'CI';

const normalizeSymbol = (symbol = '') => {
  const trimmed = symbol.trim();
  if (!trimmed) {
    return '';
  }

  const parts = trimmed
    .split(/\s*-\s*/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length > 1) {
    const candidate = parts
      .slice(0, -1)
      .reverse()
      .find((part) => /[A-Z]/i.test(part) && !/^\d+$/.test(part));

    if (candidate) {
      const tokenMatch = candidate.match(/^([A-Z0-9]+?)[CV]\d+/i);
      if (tokenMatch) {
        return tokenMatch[1];
      }
      return candidate;
    }
  }

  return parts[0] ?? trimmed;
};

const normalizeSettlement = (value = '') => {
  const settlement = value?.trim();
  if (!settlement) {
    return DEFAULT_SETTLEMENT;
  }
  return settlement.toUpperCase();
};

const aggregateRows = (rows) => {
  if (!rows.length) {
    return rows;
  }

  const groups = new Map();

  rows.forEach((row) => {
    const key = `${row.symbol}::${row.settlement}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        symbol: row.symbol,
        settlement: row.settlement,
        quantity: 0,
        weightedPriceSum: 0,
        totalWeight: 0,
      });
    }

    const entry = groups.get(key);
    entry.quantity += row.quantity;
    const weight = Number.isFinite(row.weight) && row.weight > 0
      ? row.weight
      : Math.abs(row.quantity);
    entry.weightedPriceSum += row.price * weight;
    entry.totalWeight += weight;
  });

  return Array.from(groups.values())
    .map((entry) => ({
      key: entry.key,
      symbol: entry.symbol,
      settlement: entry.settlement,
      quantity: entry.quantity,
      price: entry.totalWeight ? entry.weightedPriceSum / entry.totalWeight : 0,
    }))
    .sort((a, b) => {
      if (a.symbol === b.symbol) {
        return a.settlement.localeCompare(b.settlement);
      }
      return a.symbol.localeCompare(b.symbol);
    });
};

const buildRows = (operations = [], side = 'BUY') => {
  const sign = side === 'SELL' ? -1 : 1;

  return operations.map((operation, index) => {
    const symbol = normalizeSymbol(operation.symbol ?? '');
    const settlement = normalizeSettlement(operation.expiration ?? operation.settlement);
    const rawQuantity = Number(operation.quantity ?? 0);
    const quantity = Number.isFinite(rawQuantity) ? rawQuantity * sign : 0;
    const price = Number(operation.price ?? 0);

    return {
      key: `${operation.order_id ?? operation.id ?? operation.trade_id ?? 'row'}-${index}`,
      symbol,
      settlement,
      quantity,
      price,
      weight: Math.abs(rawQuantity),
    };
  });
};

const BuySellTable = ({
  title,
  operations,
  strings,
  testId,
  averagingEnabled,
  onToggleAveraging,
  showAveragingControl,
}) => {
  const hasData = operations.length > 0;
  const averagingLabel = strings?.tables?.averageByInstrument ?? 'Promediar';
  const averagingTooltip = strings?.tables?.averageTooltip ?? 'Promediar por instrumento y plazo';

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
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Typography variant="subtitle1" component="h3">
                    {title}
                  </Typography>
                  {showAveragingControl && hasData && (
                    <Tooltip title={averagingTooltip}>
                      <FormControlLabel
                        sx={{
                          ml: 0,
                          '& .MuiFormControlLabel-label': { fontSize: '0.75rem' },
                        }}
                        control={(
                          <Switch
                            size="small"
                            color="primary"
                            checked={averagingEnabled}
                            onChange={(event) => onToggleAveraging?.(event.target.checked)}
                            inputProps={{ 'aria-label': averagingLabel }}
                          />
                        )}
                        label={averagingLabel}
                      />
                    </Tooltip>
                  )}
                </Stack>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>{strings?.tables?.symbol ?? 'Símbolo'}</TableCell>
              <TableCell>{strings?.tables?.settlement ?? 'Plazo'}</TableCell>
              <TableCell align="right">{strings?.tables?.quantity ?? 'Cantidad'}</TableCell>
              <TableCell align="right">{strings?.tables?.price ?? 'Precio'}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!hasData && (
              <TableRow>
                <TableCell colSpan={4} align="center">
                  <Typography variant="body2" color="text.secondary">
                    {strings?.tables?.empty ?? 'Sin datos para mostrar.'}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {operations.map((row, index) => (
              <TableRow
                key={row.key}
                sx={index % 2 === 1 ? { backgroundColor: 'action.hover' } : undefined}
              >
                <TableCell>{row.symbol}</TableCell>
                <TableCell>{row.settlement}</TableCell>
                <TableCell
                  align="right"
                  sx={{ color: row.quantity < 0 ? 'error.main' : undefined }}
                >
                  {formatQuantity(row.quantity)}
                </TableCell>
                <TableCell align="right">{formatDecimal(row.price)}</TableCell>
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

  const [averagingEnabled, setAveragingEnabled] = useState(true);

  const { buys, sells } = useMemo(() => {
    return getBuySellOperations(operations);
  }, [operations]);

  const buyRows = useMemo(() => buildRows(buys, 'BUY'), [buys]);
  const sellRows = useMemo(() => buildRows(sells, 'SELL'), [sells]);

  const processedBuys = useMemo(
    () => (averagingEnabled ? aggregateRows(buyRows) : buyRows),
    [averagingEnabled, buyRows],
  );

  const processedSells = useMemo(
    () => (averagingEnabled ? aggregateRows(sellRows) : sellRows),
    [averagingEnabled, sellRows],
  );

  const handleToggleAveraging = (value) => {
    setAveragingEnabled(value);
  };

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
          '& > :first-of-type': {
            borderRight: { lg: 1, xs: 0 },
            borderColor: 'divider',
          },
        }}
      >
        {/* BUY operations table */}
        <BuySellTable
          title={strings?.tables?.buyTitle ?? 'Operaciones de Compra'}
          operations={processedBuys}
          strings={strings}
          testId="processor-buy-table"
          averagingEnabled={averagingEnabled}
          onToggleAveraging={handleToggleAveraging}
          showAveragingControl
        />

        {/* SELL operations table */}
        <BuySellTable
          title={strings?.tables?.sellTitle ?? 'Operaciones de Venta'}
          operations={processedSells}
          strings={strings}
          testId="processor-sell-table"
          averagingEnabled={averagingEnabled}
          onToggleAveraging={handleToggleAveraging}
          showAveragingControl
        />
      </Box>
    </Stack>
  );
};

export default CompraVentaView;
