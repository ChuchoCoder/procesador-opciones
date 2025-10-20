/**
 * ArbitrageOperationsDetail - Display operations in side-by-side tables
 * Follows the same pattern as COMPRA y VENTA view
 * Shows CI operations on one side and 24h operations on the other
 */

import { useMemo } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import InfoIcon from '@mui/icons-material/Info';
import IconButton from '@mui/material/IconButton';

const formatQuantity = (value) => {
  if (!Number.isFinite(value)) return '';
  return new Intl.NumberFormat('es-AR', {
    useGrouping: true,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatPrice = (value) => {
  if (!Number.isFinite(value)) return '';
  return new Intl.NumberFormat('es-AR', {
    useGrouping: true,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
};

const formatCurrency = (value) => {
  if (!Number.isFinite(value)) return '';
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

/**
 * Group operations by order_id (same as COMPRA y VENTA)
 */
function groupOperationsByOrderId(operations) {
  if (!operations || operations.length === 0) {
    return [];
  }

  const grouped = new Map();

  operations.forEach((op) => {
    const orderId = op.order_id || op.id;
    
    if (!grouped.has(orderId)) {
      grouped.set(orderId, {
        ...op,
        order_id: orderId,
        cantidad: op.cantidad,
        total: op.total || (op.cantidad * op.precio),
        comisiones: op.comisiones || 0,
        partialFills: 1,
      });
    } else {
      const existing = grouped.get(orderId);
      existing.cantidad += op.cantidad;
      existing.total += (op.total || (op.cantidad * op.precio));
      existing.comisiones += (op.comisiones || 0);
      existing.partialFills += 1;
    }
  });

  return Array.from(grouped.values());
}

/**
 * Calculate totals including weighted average price
 */
function calculateTotals(operations) {
  const totals = operations.reduce((acc, op) => {
    acc.cantidad += op.cantidad || 0;
    acc.total += op.total || 0;
    acc.comisiones += op.comisiones || 0;
    acc.cantidadPrecio += (op.cantidad || 0) * (op.precio || 0);
    return acc;
  }, { cantidad: 0, total: 0, comisiones: 0, cantidadPrecio: 0 });
  
  // Calculate weighted average price
  totals.precioPromedio = totals.cantidad > 0 ? totals.cantidadPrecio / totals.cantidad : 0;
  
  return totals;
}

/**
 * Single table for either CI or 24h operations
 */
const OperationsTable = ({ title, operations, sideLabel, isSell }) => {
  const groupedOps = useMemo(() => groupOperationsByOrderId(operations), [operations]);
  const totals = useMemo(() => calculateTotals(groupedOps), [groupedOps]);
  const hasData = groupedOps.length > 0;
  
  // Determine colors based on side
  const headerColor = isSell ? 'error.main' : 'success.main';
  const headerBgColor = isSell ? 'error.light' : 'success.light';

  return (
    <Paper
      elevation={0}
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        overflow: 'visible',
        borderRadius: 0,
      }}
    >
  <TableContainer sx={{ flex: 1, overflowX: 'auto', overflowY: 'visible' }}>
        <Table size="small" stickyHeader>
          <TableHead>
            {/* Title row with side label */}
            <TableRow>
              <TableCell
                colSpan={4}
                sx={{
                  position: 'sticky',
                  top: 0,
                  backgroundColor: headerBgColor,
                  zIndex: 2,
                  borderBottom: 2,
                  borderColor: 'divider',
                  py: 1,
                }}
              >
                <Typography 
                  variant="subtitle2" 
                  sx={{ 
                    fontWeight: 700,
                    color: headerColor,
                    textAlign: 'center',
                    fontSize: '0.9rem',
                    letterSpacing: '0.5px',
                  }}
                >
                  {title}
                </Typography>
              </TableCell>
            </TableRow>
            {/* Column headers with totals */}
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>
                Cantidad
                {hasData && (
                  <Typography variant="caption" display="block" sx={{ fontWeight: 700, color: 'text.primary' }}>
                    {formatQuantity(totals.cantidad)}
                  </Typography>
                )}
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>
                Precio
                {hasData && (
                  <Typography variant="caption" display="block" sx={{ fontWeight: 700, color: 'text.primary' }}>
                    {formatPrice(totals.precioPromedio)}
                  </Typography>
                )}
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>
                Total
                {hasData && (
                  <Typography variant="caption" display="block" sx={{ fontWeight: 700, color: 'text.primary' }}>
                    {formatCurrency(totals.total)}
                  </Typography>
                )}
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>
                Comisiones
                {hasData && (
                  <Typography variant="caption" display="block" sx={{ fontWeight: 700, color: 'text.primary' }}>
                    {formatCurrency(totals.comisiones)}
                  </Typography>
                )}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!hasData && (
              <TableRow>
                <TableCell colSpan={4} align="center">
                  <Typography variant="body2" color="text.secondary">
                    Sin operaciones
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {groupedOps.map((op, index) => {
              // Determine if this is a sell operation
              const isSellOp = op.lado === 'VENTA' || op.lado === 'V';
              const displayQuantity = isSellOp ? -Math.abs(op.cantidad) : op.cantidad;
              
              return (
                <TableRow
                  key={op.order_id || index}
                  sx={index % 2 === 1 ? { backgroundColor: 'action.hover' } : undefined}
                >
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography
                        variant="body2"
                        sx={{ color: isSellOp ? 'error.main' : 'inherit', fontWeight: isSellOp ? 500 : 400 }}
                      >
                        {formatQuantity(displayQuantity)}
                      </Typography>
                      {op.order_id && (
                        <Tooltip title={`ID: ${op.order_id}`} placement="top">
                          <IconButton size="small" sx={{ p: 0.25 }}>
                            <InfoIcon sx={{ fontSize: 14, color: 'info.main' }} />
                          </IconButton>
                        </Tooltip>
                      )}
                      {op.partialFills > 1 && (
                        <Chip 
                          label={`×${op.partialFills}`} 
                          size="small" 
                          sx={{ height: 16, fontSize: '0.65rem' }} 
                        />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell align="right">{formatPrice(op.precio)}</TableCell>
                  <TableCell align="right">{formatCurrency(op.total)}</TableCell>
                  <TableCell align="right" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                    {formatCurrency(op.comisiones)}
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

/**
 * Main component - side-by-side tables for CI and 24h operations
 */
const ArbitrageOperationsDetail = ({ operations, patron }) => {
  // Split operations by venue (CI vs 24h)
  const { ciOperations, h24Operations, ciSide, h24Side } = useMemo(() => {
    if (!operations || operations.length === 0) {
      return { ciOperations: [], h24Operations: [], ciSide: '', h24Side: '' };
    }

    const ci = [];
    const h24 = [];
    let ciLado = '';
    let h24Lado = '';

    operations.forEach((op) => {
      const venue = op.venue || '';
      if (venue.includes('CI')) {
        ci.push(op);
        if (!ciLado) ciLado = op.lado;
      } else if (venue.includes('24')) {
        h24.push(op);
        if (!h24Lado) h24Lado = op.lado;
      }
    });

    return {
      ciOperations: ci,
      h24Operations: h24,
      ciSide: ciLado,
      h24Side: h24Lado,
    };
  }, [operations]);

  // Determine titles based on pattern
  const ciTitle = ciSide === 'VENTA' || ciSide === 'V' ? 'Venta CI' : 'Compra CI';
  const h24Title = h24Side === 'COMPRA' || h24Side === 'C' ? 'Compra 24hs' : 'Venta 24hs';
  const ciIsSell = ciSide === 'VENTA' || ciSide === 'V';
  const h24IsSell = h24Side === 'VENTA' || h24Side === 'V';

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        gap: 0,
        minHeight: 200,
        '& > :first-of-type': {
          borderRight: { md: 1, xs: 0 },
          borderBottom: { xs: 1, md: 0 },
          borderColor: 'divider',
        },
      }}
    >
      <OperationsTable
        title={ciTitle}
        operations={ciOperations}
        sideLabel={ciSide}
        isSell={ciIsSell}
      />
      <OperationsTable
        title={h24Title}
        operations={h24Operations}
        sideLabel={h24Side}
        isSell={h24IsSell}
      />
    </Box>
  );
};

export default ArbitrageOperationsDetail;
