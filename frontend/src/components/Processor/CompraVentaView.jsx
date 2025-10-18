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
import Chip from '@mui/material/Chip';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';

import GroupFilter from './GroupFilter.jsx';
import { getBuySellOperations } from '../../services/csv/buy-sell-matcher.js';
import { resolveExpirationLabel } from '../../services/csv/expiration-labels.js';
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

const formatFee = (value) => {
  if (!Number.isFinite(value)) {
    return '';
  }
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

/**
 * Calculate net total based on operation side.
 * BUY operations: add fees to gross total (you pay more)
 * SELL operations: subtract fees from gross total (you receive less)
 * 
 * @param {number} grossNotional - The gross notional value
 * @param {number} feeAmount - The total fee amount
 * @param {string} side - The operation side: 'BUY' or 'SELL'
 * @returns {number} The net total
 */
const calculateNetTotal = (grossNotional, feeAmount, side) => {
  const gross = grossNotional ?? 0;
  const fee = feeAmount ?? 0;
  
  // BUY operations: gross + fees (you pay the gross amount plus fees)
  if (side === 'BUY') {
    return gross + fee;
  }
  
  // SELL operations: gross - fees (you receive the gross amount minus fees)
  return gross - fee;
};

const DEFAULT_SETTLEMENT = 'CI';
const OPTION_OPERATION_TYPES = new Set(['CALL', 'PUT']);

const extractOptionToken = (operation = {}) => {
  const candidates = [
    operation?.meta?.sourceToken,
    operation?.meta?.instrumentToken,
    operation?.originalSymbol,
    operation?.raw?.symbol,
    operation?.symbol,
  ];

  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    if (typeof candidate !== 'string') {
      continue;
    }

    const trimmed = candidate.trim();
    if (!trimmed) {
      continue;
    }

    return trimmed.toUpperCase();
  }

  return '';
};

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

const resolveSettlementLabel = (operation = {}, { expirationLabels } = {}) => {
  const fallbackValue = operation?.settlement ?? operation?.expiration;

  if (OPTION_OPERATION_TYPES.has(operation?.optionType)) {
    const optionLabel = resolveExpirationLabel(operation?.expiration ?? fallbackValue ?? '', {
      expirationLabels,
    });
    if (optionLabel) {
      return optionLabel;
    }
    return normalizeSettlement(operation?.expiration ?? fallbackValue ?? '');
  }

  return normalizeSettlement(fallbackValue ?? '');
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
        feeAmount: 0,
        grossNotional: 0,
        feeBreakdown: row.feeBreakdown,
        category: row.category,
        side: row.side, // Preserve side from first row in group
      });
    }

    const entry = groups.get(key);
    entry.quantity += row.quantity;
    entry.feeAmount += (row.feeAmount || 0);
    entry.grossNotional += (row.grossNotional || 0);
    const weight = Number.isFinite(row.weight) && row.weight > 0
      ? row.weight
      : Math.abs(row.quantity);
    entry.weightedPriceSum += row.price * weight;
    entry.totalWeight += weight;
  });

  return Array.from(groups.values())
    .map((entry) => {
      // Recalculate fee breakdown for aggregated gross notional
      const feeBreakdown = entry.feeBreakdown && entry.grossNotional > 0 ? {
        ...entry.feeBreakdown,
        commissionAmount: entry.grossNotional * entry.feeBreakdown.commissionPct,
        rightsAmount: entry.grossNotional * entry.feeBreakdown.rightsPct,
        vatAmount: entry.grossNotional * (entry.feeBreakdown.commissionPct + entry.feeBreakdown.rightsPct) * entry.feeBreakdown.vatPct,
      } : entry.feeBreakdown;

      return {
        key: entry.key,
        symbol: entry.symbol,
        settlement: entry.settlement,
        quantity: entry.quantity,
        price: entry.totalWeight ? entry.weightedPriceSum / entry.totalWeight : 0,
        feeAmount: entry.feeAmount,
        grossNotional: entry.grossNotional,
        feeBreakdown,
        category: entry.category,
        side: entry.side, // Preserve side in aggregated output
      };
    })
    .sort((a, b) => {
      if (a.symbol === b.symbol) {
        return a.settlement.localeCompare(b.settlement);
      }
      return a.symbol.localeCompare(b.symbol);
    });
};

const buildRows = (operations = [], side = 'BUY', { expirationLabels } = {}) => {
  const sign = side === 'SELL' ? -1 : 1;

  return operations.map((operation, index) => {
    const isOption = OPTION_OPERATION_TYPES.has(operation.optionType);
    const normalizedFallback = normalizeSymbol(operation.symbol ?? '');
    const rawSymbol = isOption ? extractOptionToken(operation) : (operation.symbol ?? '');
    const symbol = isOption ? rawSymbol || normalizedFallback : normalizeSymbol(rawSymbol);
    const settlement = resolveSettlementLabel(operation, { expirationLabels });
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
      feeAmount: operation.feeAmount || 0,
      grossNotional: operation.grossNotional || 0,
      feeBreakdown: operation.feeBreakdown,
      category: operation.category || 'bonds',
      side, // Add side to the row
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
  
  // Determine if this is Buy or Sell table
  const isBuyTable = title?.toLowerCase().includes('compra');
  const isSellTable = title?.toLowerCase().includes('venta');
  
  // theme used for potential future color styling (placeholder retention)
  
  const getIcon = () => {
    if (isBuyTable) return <TrendingUpIcon sx={{ fontSize: 18 }} />;
    if (isSellTable) return <TrendingDownIcon sx={{ fontSize: 18 }} />;
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
                colSpan={5}
                sx={{
                  position: 'sticky',
                  top: 0,
                  backgroundColor: 'background.paper',
                  zIndex: 2,
                }}
              >
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Chip
                    icon={getIcon()}
                    label={title}
                    sx={{
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      letterSpacing: '0.5px',
                    }}
                  />
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
              <TableCell align="right">{strings?.tables?.netTotal ?? 'Neto'}</TableCell>
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
            {operations.map((row, index) => {
              const netTotal = calculateNetTotal(row.grossNotional, row.feeAmount, row.side);
              
              return (
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
                  <TableCell align="right">
                    <FeeTooltip
                      feeBreakdown={row.feeBreakdown}
                      grossNotional={row.grossNotional}
                      netTotal={netTotal}
                      totalQuantity={row.quantity}
                      strings={strings}
                    >
                      <Typography variant="body2" component="span">
                        {formatFee(netTotal)}
                      </Typography>
                    </FeeTooltip>
                  </TableCell>
                </TableRow>
              );
            })}
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
  expirationLabels,
  onGroupChange,
}) => {
  const filterStrings = strings?.filters ?? {};

  const [averagingEnabled, setAveragingEnabled] = useState(true);

  const { buys, sells } = useMemo(() => {
    return getBuySellOperations(operations);
  }, [operations]);

  const buyRows = useMemo(
    () => buildRows(buys, 'BUY', { expirationLabels }),
    [buys, expirationLabels],
  );
  const sellRows = useMemo(
    () => buildRows(sells, 'SELL', { expirationLabels }),
    [sells, expirationLabels],
  );

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
