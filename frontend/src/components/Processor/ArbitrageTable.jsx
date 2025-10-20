/**
 * ArbitrageTable - Display P&L results by instrument, plazo, and pattern
 * Implements User Story 1, 2, 3 from specs/006-arbitraje-de-plazos
 */

import { useState, useMemo } from 'react';
import Box from '@mui/material/Box';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import IconButton from '@mui/material/IconButton';
import Collapse from '@mui/material/Collapse';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import Typography from '@mui/material/Typography';
import TableSortLabel from '@mui/material/TableSortLabel';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import InfoIcon from '@mui/icons-material/Info';

import { formatCurrency } from '../../services/pnl-calculations.js';
import { PATTERNS, ESTADOS, LADOS } from '../../services/arbitrage-types.js';
import ArbitrageOperationsDetail from './ArbitrageOperationsDetail.jsx';

/**
 * Get color for P&L value
 * @param {number} value
 * @returns {string}
 */
function getPnLColor(value) {
  if (value > 0) return 'success.main';
  if (value < 0) return 'error.main';
  return 'text.secondary';
}

/**
 * Generate P&L Trade breakdown tooltip
 * Uses pre-calculated breakdown values from P&L service to ensure consistency
 * @param {Object} row - Row data with operations and breakdown
 * @returns {JSX.Element}
 */
function getPnLTradeBreakdown(row) {
  console.log('getPnLTradeBreakdown called with:', {
    hasOperations: !!row.operations,
    operationsCount: row.operations?.length,
    hasVentaCI: !!row.ventaCI_breakdown,
    hasCompra24h: !!row.compra24h_breakdown,
    hasCompraCI: !!row.compraCI_breakdown,
    hasVenta24h: !!row.venta24h_breakdown,
    ventaCI_breakdown: row.ventaCI_breakdown,
    compra24h_breakdown: row.compra24h_breakdown,
  });

  if (!row.operations || row.operations.length === 0) {
    return <Typography variant="caption">Sin operaciones</Typography>;
  }

  return (
    <Box sx={{ p: 1, minWidth: 300 }}>
      <Typography variant="body2" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
        Detalle P&L Trade
      </Typography>
      {row.ventaCI_breakdown && (
        <>
          <Typography variant="body2" sx={{ display: 'block' }}>
            Venta CI: {formatCurrency(row.ventaCI_breakdown.totalValue)}
          </Typography>
          <Typography variant="body2" sx={{ display: 'block', color: 'text.secondary', ml: 1, fontSize: '0.75rem' }}>
            Precio promedio: {formatCurrency(row.ventaCI_breakdown.avgPrice)}
          </Typography>
          <Typography variant="body2" sx={{ display: 'block', color: 'text.secondary', ml: 1 }}>
            Comisiones: {formatCurrency(row.ventaCI_breakdown.totalFees)}
          </Typography>
        </>
      )}
      {row.compra24h_breakdown && (
        <>
          <Typography variant="body2" sx={{ display: 'block', mt: 0.5 }}>
            Compra 24H: {formatCurrency(row.compra24h_breakdown.totalValue)}
          </Typography>
          <Typography variant="body2" sx={{ display: 'block', color: 'text.secondary', ml: 1, fontSize: '0.75rem' }}>
            Precio promedio: {formatCurrency(row.compra24h_breakdown.avgPrice)}
          </Typography>
          <Typography variant="body2" sx={{ display: 'block', color: 'text.secondary', ml: 1 }}>
            Comisiones: {formatCurrency(row.compra24h_breakdown.totalFees)}
          </Typography>
        </>
      )}
      {row.compraCI_breakdown && (
        <>
          <Typography variant="body2" sx={{ display: 'block', mt: 0.5 }}>
            Compra CI: {formatCurrency(row.compraCI_breakdown.totalValue)}
          </Typography>
          <Typography variant="body2" sx={{ display: 'block', color: 'text.secondary', ml: 1, fontSize: '0.75rem' }}>
            Precio promedio: {formatCurrency(row.compraCI_breakdown.avgPrice)}
          </Typography>
          <Typography variant="body2" sx={{ display: 'block', color: 'text.secondary', ml: 1 }}>
            Comisiones: {formatCurrency(row.compraCI_breakdown.totalFees)}
          </Typography>
        </>
      )}
      {row.venta24h_breakdown && (
        <>
          <Typography variant="body2" sx={{ display: 'block', mt: 0.5 }}>
            Venta 24H: {formatCurrency(row.venta24h_breakdown.totalValue)}
          </Typography>
          <Typography variant="body2" sx={{ display: 'block', color: 'text.secondary', ml: 1, fontSize: '0.75rem' }}>
            Precio promedio: {formatCurrency(row.venta24h_breakdown.avgPrice)}
          </Typography>
          <Typography variant="body2" sx={{ display: 'block', color: 'text.secondary', ml: 1 }}>
            Comisiones: {formatCurrency(row.venta24h_breakdown.totalFees)}
          </Typography>
        </>
      )}
      <Typography variant="body2" sx={{ display: 'block', mt: 1, fontWeight: 600, borderTop: '1px solid', borderColor: 'divider', pt: 0.5 }}>
        Total: {formatCurrency(row.pnl_trade)}
      </Typography>
    </Box>
  );
}

/**
 * Generate P&L Caucion breakdown tooltip
 * @param {Object} row - Row data with cauciones
 * @returns {JSX.Element}
 */
function getPnLCaucionBreakdown(row) {
  if (!row.cauciones || row.cauciones.length === 0) {
    return (
      <Box sx={{ p: 1, minWidth: 200 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
          Detalle P&L Caución
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Sin cauciones - Usando TNA promedio
        </Typography>
        <Typography variant="body2" sx={{ display: 'block', mt: 1 }}>
          Monto: {formatCurrency(row.cantidad * row.precioPromedio)}
        </Typography>
        <Typography variant="body2" sx={{ display: 'block' }}>
          Plazo: {row.plazo} días
        </Typography>
        <Typography variant="body2" sx={{ display: 'block', mt: 1, fontWeight: 600 }}>
          Interés estimado: {formatCurrency(row.pnl_caucion)}
        </Typography>
      </Box>
    );
  }

  const totalInteres = row.cauciones.reduce((sum, c) => sum + (c.interes || 0), 0);
  const totalFees = row.cauciones.reduce((sum, c) => sum + (c.feeAmount || 0), 0);

  return (
    <Box sx={{ p: 1, minWidth: 250 }}>
      <Typography variant="body2" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
        Detalle P&L Caución
      </Typography>
      {row.cauciones.map((c, idx) => (
        <Box key={idx} sx={{ mb: 1 }}>
          <Typography variant="body2" sx={{ display: 'block' }}>
            {c.tipo}: {formatCurrency(c.monto)}
          </Typography>
          <Typography variant="body2" sx={{ display: 'block', color: 'text.secondary', ml: 1 }}>
            Tasa: {c.tasa}% - {c.tenorDias} días
          </Typography>
          <Typography variant="body2" sx={{ display: 'block', color: 'text.secondary', ml: 1 }}>
            Interés: {formatCurrency(c.interes)}
          </Typography>
          {c.feeAmount > 0 && (
            <Typography variant="body2" sx={{ display: 'block', color: 'text.secondary', ml: 1 }}>
              Comisiones: {formatCurrency(c.feeAmount)}
            </Typography>
          )}
        </Box>
      ))}
      <Typography variant="body2" sx={{ display: 'block', mt: 1, fontWeight: 600, borderTop: '1px solid', borderColor: 'divider', pt: 0.5 }}>
        Total: {formatCurrency(row.pnl_caucion)}
      </Typography>
    </Box>
  );
}

/**
 * Generate P&L Total breakdown tooltip
 * @param {Object} row - Row data
 * @returns {JSX.Element}
 */
function getPnLTotalBreakdown(row) {
  return (
    <Box sx={{ p: 1, minWidth: 200 }}>
      <Typography variant="body2" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
        Detalle P&L Total
      </Typography>
      <Typography variant="body2" sx={{ display: 'block' }}>
        P&L Trade: {formatCurrency(row.pnl_trade)}
      </Typography>
      <Typography variant="body2" sx={{ display: 'block' }}>
        P&L Caución: {formatCurrency(row.pnl_caucion)}
      </Typography>
      <Typography variant="body2" sx={{ display: 'block', mt: 1, fontWeight: 600, borderTop: '1px solid', borderColor: 'divider', pt: 0.5 }}>
        Total: {formatCurrency(row.pnl_total)}
      </Typography>
    </Box>
  );
}

/**
 * Render pattern as pill badges (CI/24)
 * @param {string} patron - Pattern identifier (e.g., 'VentaCI_Compra24h')
 * @returns {JSX.Element}
 */
function renderPatternPills(patron) {
  if (patron === PATTERNS.VENTA_CI_COMPRA_24H) {
    return (
      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
        <Chip label="CI" size="small" color="error" sx={{ fontSize: '0.7rem', height: 20 }} />
        <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>→</Typography>
        <Chip label="24" size="small" color="success" sx={{ fontSize: '0.7rem', height: 20 }} />
      </Box>
    );
  } else if (patron === PATTERNS.COMPRA_CI_VENTA_24H) {
    return (
      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
        <Chip label="CI" size="small" color="success" sx={{ fontSize: '0.7rem', height: 20 }} />
        <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>→</Typography>
        <Chip label="24" size="small" color="error" sx={{ fontSize: '0.7rem', height: 20 }} />
      </Box>
    );
  }
  return <Typography variant="body2">{patron}</Typography>;
}

/**
 * Get estado chip color
 * @param {string} estado
 * @returns {string}
 */
function getEstadoColor(estado) {
  switch (estado) {
    case ESTADOS.COMPLETO:
      return 'success';
    case ESTADOS.CANTIDADES_DESBALANCEADAS:
      return 'warning';
    case ESTADOS.SIN_CAUCION:
    case ESTADOS.MATCHED_SIN_CAUCION:
      return 'info';
    case ESTADOS.SIN_CONTRAPARTE:
      return 'default';
    default:
      return 'default';
  }
}

/**
 * Row component with expandable details
 */
function ArbitrageRow({ row, strings, expandedRows, onToggleRow }) {
  const isExpanded = expandedRows.has(row.id);
  const arbitrageStrings = strings?.arbitrage || {};
  const detailsStrings = arbitrageStrings?.details || {};

  return (
    <>
      <TableRow
        hover
        sx={{
          '& > *': { borderBottom: 'unset' },
          cursor: 'pointer',
          backgroundColor: isExpanded ? 'action.hover' : 'inherit',
        }}
        onClick={() => onToggleRow(row.id)}
      >
        <TableCell padding="checkbox">
          <IconButton
            aria-label={isExpanded ? arbitrageStrings.collapseRow : arbitrageStrings.expandRow}
            size="small"
          >
            {isExpanded ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        </TableCell>
        <TableCell>{row.instrumento}</TableCell>
        <TableCell align="right">{row.plazo}</TableCell>
        <TableCell>
          {renderPatternPills(row.patron)}
        </TableCell>
        <TableCell align="right">{row.cantidad.toLocaleString('es-AR')}</TableCell>
        <TableCell align="right">
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
            <Box component="span" sx={{ color: getPnLColor(row.pnl_trade) }}>
              {formatCurrency(row.pnl_trade)}
            </Box>
            <Tooltip title={getPnLTradeBreakdown(row)} arrow>
              <InfoIcon sx={{ fontSize: 16, color: 'info.main', cursor: 'help' }} />
            </Tooltip>
          </Box>
        </TableCell>
        <TableCell align="right">
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
            <Box component="span" sx={{ color: getPnLColor(row.pnl_caucion) }}>
              {formatCurrency(row.pnl_caucion)}
            </Box>
            <Tooltip title={getPnLCaucionBreakdown(row)} arrow>
              <InfoIcon sx={{ fontSize: 16, color: 'info.main', cursor: 'help' }} />
            </Tooltip>
          </Box>
        </TableCell>
        <TableCell align="right">
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
            <Box component="span" sx={{ color: getPnLColor(row.pnl_total) }}>
              {formatCurrency(row.pnl_total)}
            </Box>
            <Tooltip title={getPnLTotalBreakdown(row)} arrow>
              <InfoIcon sx={{ fontSize: 16, color: 'info.main', cursor: 'help' }} />
            </Tooltip>
          </Box>
        </TableCell>
        <TableCell>
          <Chip
            label={arbitrageStrings.estados?.[row.estado] || row.estado}
            size="small"
            color={getEstadoColor(row.estado)}
            sx={{ fontSize: '0.75rem' }}
          />
        </TableCell>
      </TableRow>

      {/* Expandable details row */}
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={9}>
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <Box sx={{ margin: 2 }}>
              <Typography variant="subtitle2" gutterBottom component="div" sx={{ fontWeight: 600 }}>
                {detailsStrings.title || 'Detalles de cálculo'}
              </Typography>

              {/* Operations details - side-by-side tables */}
              {row.operations && row.operations.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
                    {detailsStrings.operations || 'Operaciones'}
                  </Typography>
                  <ArbitrageOperationsDetail operations={row.operations} patron={row.patron} />
                </Box>
              )}

              {/* Cauciones table */}
              {row.cauciones && row.cauciones.length > 0 && (
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                    {detailsStrings.cauciones || 'Cauciones'}
                  </Typography>
                  <Table size="small" sx={{ mt: 1 }} aria-label="tabla de cauciones detalladas">
                    <TableHead>
                      <TableRow>
                        <TableCell>{detailsStrings.operationId || 'ID'}</TableCell>
                        <TableCell>{detailsStrings.caucionTipo || 'Tipo'}</TableCell>
                        <TableCell align="right">{detailsStrings.caucionMonto || 'Monto'}</TableCell>
                        <TableCell align="right">{detailsStrings.caucionTasa || 'Tasa'}</TableCell>
                        <TableCell align="right">{detailsStrings.caucionTenor || 'Tenor (días)'}</TableCell>
                        <TableCell align="right">{detailsStrings.caucionInteres || 'Interés'}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {row.cauciones.map((cau, index) => (
                        <TableRow key={`${cau.id}-${index}`}>
                          <TableCell>{cau.id}</TableCell>
                          <TableCell>{cau.tipo}</TableCell>
                          <TableCell align="right">{formatCurrency(cau.monto)}</TableCell>
                          <TableCell align="right">{cau.tasa}%</TableCell>
                          <TableCell align="right">{cau.tenorDias}</TableCell>
                          <TableCell align="right">{formatCurrency(cau.interes)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              )}

              {(!row.operations || row.operations.length === 0) &&
                (!row.cauciones || row.cauciones.length === 0) && (
                  <Typography variant="body2" color="text.secondary">
                    {detailsStrings.noOperations || 'Sin operaciones'}
                  </Typography>
                )}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

/**
 * ArbitrageTable component
 */
const ArbitrageTable = ({ data = [], strings = {}, onSort }) => {
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [orderBy, setOrderBy] = useState('pnl_total');
  const [order, setOrder] = useState('desc');

  const arbitrageStrings = strings?.arbitrage || {};
  const columnsStrings = arbitrageStrings?.columns || {};

  // Calculate totals from data
  const totals = useMemo(() => {
    if (!data || data.length === 0) {
      return { pnlTrade: 0, pnlCaucion: 0, pnlTotal: 0 };
    }
    return data.reduce(
      (acc, row) => {
        acc.pnlTrade += row.pnl_trade || 0;
        acc.pnlCaucion += row.pnl_caucion || 0;
        acc.pnlTotal += row.pnl_total || 0;
        return acc;
      },
      { pnlTrade: 0, pnlCaucion: 0, pnlTotal: 0 }
    );
  }, [data]);

  const handleToggleRow = (rowId) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(rowId)) {
        newSet.delete(rowId);
      } else {
        newSet.add(rowId);
      }
      return newSet;
    });
  };

  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === 'asc';
    const newOrder = isAsc ? 'desc' : 'asc';
    setOrder(newOrder);
    setOrderBy(property);
    if (onSort) {
      onSort(property, newOrder);
    }
  };

  const sortedData = useMemo(() => {
    if (!data) return [];
    
    return [...data].sort((a, b) => {
      const aValue = a[orderBy];
      const bValue = b[orderBy];
      
      if (aValue === bValue) return 0;
      
      if (order === 'asc') {
        return aValue < bValue ? -1 : 1;
      } else {
        return aValue > bValue ? -1 : 1;
      }
    });
  }, [data, orderBy, order]);

  if (!data || data.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center', maxWidth: 600, mx: 'auto' }}>
        <Typography variant="h6" color="text.primary" gutterBottom>
          {arbitrageStrings.noData || 'No hay datos de arbitrajes disponibles'}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          {arbitrageStrings.noArbitrageData || 'Los datos cargados no contienen información de arbitraje'}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'left' }}>
          {arbitrageStrings.noArbitrageDataHint || 'Para ver arbitrajes de plazo, necesitás cargar operaciones con información de venue (CI o 24h) y cauciones.'}
        </Typography>
      </Box>
    );
  }

  return (
    <TableContainer component={Paper} sx={{ maxHeight: '100%', overflow: 'auto' }}>
      <Table stickyHeader size="small" aria-label="tabla de arbitrajes de plazo">
        <TableHead>
          <TableRow>
            <TableCell padding="checkbox" />
            <TableCell>
              <TableSortLabel
                active={orderBy === 'instrumento'}
                direction={orderBy === 'instrumento' ? order : 'asc'}
                onClick={() => handleRequestSort('instrumento')}
                aria-label="ordenar por instrumento"
              >
                {columnsStrings.instrumento || 'Instrumento'}
              </TableSortLabel>
            </TableCell>
            <TableCell align="right">
              <TableSortLabel
                active={orderBy === 'plazo'}
                direction={orderBy === 'plazo' ? order : 'asc'}
                onClick={() => handleRequestSort('plazo')}
                aria-label="ordenar por plazo"
              >
                {columnsStrings.plazo || 'Plazo'}
              </TableSortLabel>
            </TableCell>
            <TableCell>{columnsStrings.patron || 'Patrón'}</TableCell>
            <TableCell align="right">
              <TableSortLabel
                active={orderBy === 'cantidad'}
                direction={orderBy === 'cantidad' ? order : 'asc'}
                onClick={() => handleRequestSort('cantidad')}
                aria-label="ordenar por cantidad"
              >
                {columnsStrings.cantidad || 'Cantidad'}
              </TableSortLabel>
            </TableCell>
            <TableCell align="right">
              <TableSortLabel
                active={orderBy === 'pnl_trade'}
                direction={orderBy === 'pnl_trade' ? order : 'asc'}
                onClick={() => handleRequestSort('pnl_trade')}
                aria-label="ordenar por P&L Trade"
              >
                <Box>
                  <Typography variant="body2" display="block" sx={{ fontWeight: 600 }}>
                    {columnsStrings.pnlTrade || 'P&L Trade'}
                  </Typography>
                  <Typography 
                    variant="body2" 
                    display="block" 
                    sx={{ 
                      color: getPnLColor(totals.pnlTrade), 
                      fontWeight: 700
                    }}
                  >
                    {formatCurrency(totals.pnlTrade)}
                  </Typography>
                </Box>
              </TableSortLabel>
            </TableCell>
            <TableCell align="right">
              <TableSortLabel
                active={orderBy === 'pnl_caucion'}
                direction={orderBy === 'pnl_caucion' ? order : 'asc'}
                onClick={() => handleRequestSort('pnl_caucion')}
                aria-label="ordenar por P&L Caución"
              >
                <Box>
                  <Typography variant="body2" display="block" sx={{ fontWeight: 600 }}>
                    {columnsStrings.pnlCaucion || 'P&L Caución'}
                  </Typography>
                  <Typography 
                    variant="body2" 
                    display="block" 
                    sx={{ 
                      color: getPnLColor(totals.pnlCaucion), 
                      fontWeight: 700
                    }}
                  >
                    {formatCurrency(totals.pnlCaucion)}
                  </Typography>
                </Box>
              </TableSortLabel>
            </TableCell>
            <TableCell align="right">
              <TableSortLabel
                active={orderBy === 'pnl_total'}
                direction={orderBy === 'pnl_total' ? order : 'asc'}
                onClick={() => handleRequestSort('pnl_total')}
                aria-label="ordenar por P&L Total"
              >
                <Box>
                  <Typography variant="body2" display="block" sx={{ fontWeight: 600 }}>
                    {columnsStrings.pnlTotal || 'P&L Total'}
                  </Typography>
                  <Typography 
                    variant="body2" 
                    display="block" 
                    sx={{ 
                      color: getPnLColor(totals.pnlTotal), 
                      fontWeight: 700
                    }}
                  >
                    {formatCurrency(totals.pnlTotal)}
                  </Typography>
                </Box>
              </TableSortLabel>
            </TableCell>
            <TableCell>{columnsStrings.estado || 'Estado'}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sortedData.map((row) => (
            <ArbitrageRow
              key={row.id}
              row={row}
              strings={strings}
              expandedRows={expandedRows}
              onToggleRow={handleToggleRow}
            />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default ArbitrageTable;
