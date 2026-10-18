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
import FeeTooltip from './FeeTooltip.jsx';
import TooltipRepoFees from './TooltipRepoFees.jsx';
import { formatCantidad, formatDecimal, formatMoneda } from '../../services/formato.js';
// Era una copia carácter por carácter de extractBaseSymbol.
import { extractBaseSymbol as normalizeSymbol } from '../../services/clasificacion-instrumentos.js';
import { calcularNetoOperacion, esCompraPorLado } from '../../services/operacion.js';

// This view leaves money cells blank when a value is absent, rather than
// showing an em dash.
const formatFee = (value) => formatMoneda(value, { placeholder: '' });

/**
 * Format net total with sign prefix based on operation side.
 * BUY operations: show as negative (money out)
 * SELL operations: show with + prefix (money in)
 */
const formatNetTotal = (value, side) => {
  if (!Number.isFinite(value)) {
    return '';
  }
  const formattedValue = formatFee(value);
  // BUY operations: show negative
  if (esCompraPorLado(side)) {
    return `-${formattedValue}`;
  }
  // SELL operations: show with + prefix
  return `+${formattedValue}`;
};

const roundAmount = (value, digits = 2) => {
  if (!Number.isFinite(value)) {
    return value;
  }
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

const cloneRepoWarning = (warning) => {
  if (!warning || typeof warning !== 'object') {
    return warning;
  }
  return {
    ...warning,
  };
};

const cloneReconciliation = (reconciliation) => {
  if (!reconciliation || typeof reconciliation !== 'object') {
    return reconciliation;
  }
  return {
    ...reconciliation,
  };
};

const cloneFeeBreakdown = (breakdown) => {
  if (!breakdown || typeof breakdown !== 'object') {
    return breakdown;
  }

  const cloned = {
    ...breakdown,
  };

  if (breakdown.instrument && typeof breakdown.instrument === 'object') {
    cloned.instrument = { ...breakdown.instrument };
  }
  if (Array.isArray(breakdown.warnings)) {
    cloned.warnings = breakdown.warnings.map(cloneRepoWarning);
  }
  if (breakdown.reconciliation && typeof breakdown.reconciliation === 'object') {
    cloned.reconciliation = cloneReconciliation(breakdown.reconciliation);
  }

  return cloned;
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
const calculateNetTotal = (grossNotional, feeAmount, side) =>
  calcularNetoOperacion(grossNotional, feeAmount, esCompraPorLado(side));

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


const normalizeSettlement = (value = '') => {
  const settlement = value?.trim();
  if (!settlement) {
    return DEFAULT_SETTLEMENT;
  }
  return settlement.toUpperCase();
};

const resolveSettlementLabel = (operation = {}) => {
  const fallbackValue = operation?.settlement ?? operation?.expiration;

  if (OPTION_OPERATION_TYPES.has(operation?.optionType)) {
    return DEFAULT_SETTLEMENT;
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

    // Only accept explicit service-provided caucion breakdowns. Do NOT build
    // a minimal breakdown from flat fields (avoid local estimation/fallback).
    const serviceCaucionBreakdown = row?.caucionFeesBreakdown ?? null;

    const initialFeeBreakdown = cloneFeeBreakdown(serviceCaucionBreakdown ?? row?.feeBreakdown ?? null);

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
        feeBreakdown: initialFeeBreakdown,
        category: row.category,
        side: row.side, // Preserve side from first row in group
        // For repo rows we don't fabricate an initial net (avoid local repo estimation). Use provided netSettlement when present.
        netSettlement: Number.isFinite(row.netSettlement)
          ? row.netSettlement
          : (Number.isFinite(initialFeeBreakdown?.netSettlement) ? initialFeeBreakdown.netSettlement : null),
      });
    }

    const entry = groups.get(key);
    entry.quantity += row.quantity;
    entry.feeAmount += (row.feeAmount || 0);
    entry.grossNotional += (row.grossNotional || 0);

    // If the row has an explicit netSettlement (service-provided), accumulate it for the group
    const netCandidate = Number.isFinite(row?.netSettlement)
      ? row.netSettlement
      : Number.isFinite(row?.caucionFeesBreakdown?.netSettlement)
        ? Number(row.caucionFeesBreakdown.netSettlement)
        : Number.isFinite(row?.feeBreakdown?.netSettlement)
          ? Number(row.feeBreakdown.netSettlement)
          : null;
    if (Number.isFinite(netCandidate)) {
      entry.netSettlement = (entry.netSettlement ?? 0) + netCandidate;
    }
    const weight = Number.isFinite(row.weight) && row.weight > 0
      ? row.weight
      : Math.abs(row.quantity);
    entry.weightedPriceSum += row.price * weight;
    entry.totalWeight += weight;
  });

  return Array.from(groups.values())
    .map((entry) => {
      // Build final feeBreakdown: prefer service-provided repo breakdowns and avoid local repo aggregation.
      let feeBreakdown = cloneFeeBreakdown(entry.feeBreakdown);
      if (entry.feeBreakdown?.source?.startsWith('repo')) {
        // Use the service-provided breakdown as-is. If multiple rows provided explicit netSettlement,
        // we summed them into entry.netSettlement above; reflect that in the breakdown.
        feeBreakdown = cloneFeeBreakdown(entry.feeBreakdown);
        if (Number.isFinite(entry.netSettlement)) {
          feeBreakdown.netSettlement = roundAmount(entry.netSettlement);
          entry.netSettlement = roundAmount(entry.netSettlement);
        } else if (Number.isFinite(feeBreakdown.netSettlement)) {
          entry.netSettlement = roundAmount(feeBreakdown.netSettlement);
        }
        entry.feeAmount = Number.isFinite(feeBreakdown.totalExpenses) ? feeBreakdown.totalExpenses : entry.feeAmount;
      } else if (entry.feeBreakdown && entry.grossNotional > 0) {
        feeBreakdown = {
          ...cloneFeeBreakdown(entry.feeBreakdown),
          commissionAmount: entry.grossNotional * entry.feeBreakdown.commissionPct,
          rightsAmount: entry.grossNotional * entry.feeBreakdown.rightsPct,
          vatAmount: entry.grossNotional * (entry.feeBreakdown.commissionPct + entry.feeBreakdown.rightsPct) * entry.feeBreakdown.vatPct,
        };
      }

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
        netSettlement: Number.isFinite(entry.netSettlement) ? entry.netSettlement : undefined,
      };
    })
    .sort((a, b) => {
      // Sort by Simbolo (asc)
      if (a.symbol !== b.symbol) {
        return a.symbol.localeCompare(b.symbol);
      }
      // Then by Plazo/settlement (asc)
      if (a.settlement !== b.settlement) {
        return a.settlement.localeCompare(b.settlement);
      }
      
      // Determine if operations are buy or sell
      const aIsBuy = a.side === 'BUY';
      const bIsBuy = b.side === 'BUY';
      
      // Then by Precio - ASC for COMPRA, DESC for VENTA
      if (a.price !== b.price) {
        if (aIsBuy && bIsBuy) {
          return a.price - b.price; // COMPRA: Price ascending (cheapest first)
        } else {
          return b.price - a.price; // VENTA: Price descending (highest first)
        }
      }
      
      // Finally by Cantidad (desc) - absolute values for comparison
      return Math.abs(b.quantity) - Math.abs(a.quantity);
    });
};

const buildRows = (operations = [], side = 'BUY', { expirationLabels } = {}) => {
  const sign = side === 'SELL' ? -1 : 1;
  const isBuy = side === 'BUY';

  const rows = operations.map((operation, index) => {
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
      feeBreakdown: cloneFeeBreakdown(operation.feeBreakdown),
      category: operation.category || 'bonds',
      side, // Add side to the row
    };
  });

  // Sort rows: Symbol (asc), Plazo (asc), then Price based on side, then Cantidad (desc)
  return rows.sort((a, b) => {
    // Sort by Simbolo (asc)
    if (a.symbol !== b.symbol) {
      return a.symbol.localeCompare(b.symbol);
    }
    // Then by Plazo/settlement (asc)
    if (a.settlement !== b.settlement) {
      return a.settlement.localeCompare(b.settlement);
    }
    // Then by Precio - ASC for COMPRA, DESC for VENTA
    if (a.price !== b.price) {
      if (isBuy) {
        return a.price - b.price; // COMPRA: Price ascending (cheapest first)
      } else {
        return b.price - a.price; // VENTA: Price descending (highest first)
      }
    }
    // Finally by Cantidad (desc) - absolute values for comparison
    return Math.abs(b.quantity) - Math.abs(a.quantity);
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

  const chipColor = isBuyTable ? 'success' : isSellTable ? 'error' : 'default';

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
                    color={chipColor}
                    variant="filled"
                    sx={{
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      letterSpacing: '0.5px',
                      px: 0.5,
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
              // Prefer service-provided caucion breakdowns / fields. Do NOT compute local repo estimations here.
              // Priority: row.caucionFeesBreakdown -> service flat fields (caucionFeesTotal/principal/baseAmount/accruedInterest) -> row.feeBreakdown
              const serviceCaucionBreakdown = row?.caucionFeesBreakdown ?? (Number.isFinite(row?.caucionFeesTotal) || Number.isFinite(row?.baseAmount) || Number.isFinite(row?.accruedInterest) || Number.isFinite(row?.principal)
                ? {
                  // Build a minimal breakdown shape from flat service fields (these come from the service and are NOT locally estimated)
                  totalExpenses: Number.isFinite(row.caucionFeesTotal) ? row.caucionFeesTotal : undefined,
                  principalAmount: Number.isFinite(row.principal) ? row.principal : undefined,
                  baseAmount: Number.isFinite(row.baseAmount) ? row.baseAmount : undefined,
                  accruedInterest: Number.isFinite(row.accruedInterest) ? row.accruedInterest : undefined,
                  netSettlement: Number.isFinite(row.netSettlement) ? row.netSettlement : undefined,
                  source: 'repo',
                }
                : null);

              const _preferredBreakdown = serviceCaucionBreakdown ?? row?.feeBreakdown ?? null;

              // Determine net total. For repo rows use explicit service breakdowns only.
              // For other rows, compute net from explicit netSettlement or fall back to
              // grossNotional +/- feeAmount (preserve previous behaviour for non-repo rows).
              let netTotal;
              if (serviceCaucionBreakdown?.source?.startsWith('repo')) {
                const netCandidate = Number.isFinite(serviceCaucionBreakdown?.netSettlement)
                  ? serviceCaucionBreakdown.netSettlement
                  : Number.isFinite(row?.netSettlement)
                    ? row.netSettlement
                    : undefined;
                netTotal = Number.isFinite(netCandidate) ? netCandidate : undefined;
              } else {
                const explicitNet = Number.isFinite(row?.netSettlement) ? row.netSettlement : null;
                netTotal = Number.isFinite(explicitNet) ? explicitNet : calculateNetTotal(row.grossNotional, row.feeAmount, row.side);
              }

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
                    {formatCantidad(row.quantity)}
                  </TableCell>
                  <TableCell align="right">{formatDecimal(row.price)}</TableCell>
                  <TableCell 
                    align="right"
                    sx={{
                      color: row.side === 'BUY' ? 'error.main' : 'success.main',
                      fontWeight: 600,
                    }}
                  >
                    {serviceCaucionBreakdown?.source?.startsWith('repo') ? (
                      <TooltipRepoFees breakdown={serviceCaucionBreakdown} strings={strings}>
                        <Typography variant="body2" component="span" sx={{ fontWeight: 'inherit', color: 'inherit' }}>
                          {formatNetTotal(netTotal, row.side)}
                        </Typography>
                      </TooltipRepoFees>
                    ) : (
                      <FeeTooltip
                        feeBreakdown={row.feeBreakdown}
                        grossNotional={row.grossNotional}
                        netTotal={netTotal}
                        totalQuantity={row.quantity}
                        strings={strings}
                      >
                        <Typography variant="body2" component="span" sx={{ fontWeight: 'inherit', color: 'inherit' }}>
                          {formatNetTotal(netTotal, row.side)}
                        </Typography>
                      </FeeTooltip>
                    )}
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
