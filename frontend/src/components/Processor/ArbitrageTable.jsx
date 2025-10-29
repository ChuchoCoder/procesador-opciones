/**
 * ArbitrageTable - Display P&L results by instrument, plazo, and pattern
 * Implements User Story 1, 2, 3 from specs/006-arbitraje-de-plazos
 */

import { useState, useMemo, lazy, Suspense, memo } from 'react';
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
import CircularProgress from '@mui/material/CircularProgress';

import { formatCurrency } from '../../services/pnl-calculations.js';
import { PATTERNS, ESTADOS, LADOS } from '../../services/arbitrage-types.js';

// Lazy load the operations detail component
const ArbitrageOperationsDetail = lazy(() => import('./ArbitrageOperationsDetail.jsx'));

const tooltipSlotProps = {
  tooltip: {
    sx: {
      bgcolor: 'grey.900',
      color: 'grey.100',
      '& .MuiTypography-root': {
        color: 'grey.100',
      },
    },
  },
  arrow: {
    sx: {
      color: 'grey.900',
    },
  },
};

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
  if (!row.operations || row.operations.length === 0) {
    return <Typography variant="caption" sx={{ color: 'grey.300' }}>Sin operaciones</Typography>;
  }

  const renderSection = (label, data, isSell) => {
    if (!data) return null;
    const totalValue = Number.isFinite(data.totalValue) ? data.totalValue : 0;
    const avgPrice = Number.isFinite(data.avgPrice) ? data.avgPrice : 0;
    const totalFees = Number.isFinite(data.totalFees) ? data.totalFees : 0;
    const net = isSell ? (totalValue - totalFees) : (totalValue + totalFees);

    return (
      <Box sx={{ mb: 0.5 }}>
        <Typography variant="body2" sx={{ display: 'block', color: 'grey.100' }}>
          {label}: {formatCurrency(totalValue)}
        </Typography>
        <Box sx={{ ml: 1, mt: 0.25 }}>
          <Typography variant="body2" sx={{ display: 'block', color: 'grey.400', fontSize: '0.75rem' }}>
            {'\u2022'} Precio promedio: {formatCurrency(avgPrice)}
          </Typography>
          <Typography variant="body2" sx={{ display: 'block', color: 'grey.400', fontSize: '0.75rem' }}>
            {'\u2022'} Comisiones: {formatCurrency(totalFees)}
          </Typography>
          <Typography variant="body2" sx={{ display: 'block', color: isSell ? 'error.main' : 'success.main', fontSize: '0.75rem' }}>
            {'\u2022'} Neto: {formatCurrency(net)}
          </Typography>
        </Box>
      </Box>
    );
  };

  return (
    <Box sx={{ p: 1, minWidth: 300 }}>
      <Typography variant="body2" sx={{ fontWeight: 600, display: 'block', mb: 1, color: 'grey.100' }}>
        Detalle P&L Trade
      </Typography>
      {renderSection('Venta CI', row.ventaCI_breakdown, true)}
      {renderSection('Compra 24H', row.compra24h_breakdown, false)}
      {renderSection('Compra CI', row.compraCI_breakdown, false)}
      {renderSection('Venta 24H', row.venta24h_breakdown, true)}
      <Typography variant="body2" sx={{ display: 'block', mt: 1, fontWeight: 600, borderTop: '1px solid', borderColor: 'grey.700', pt: 0.5, color: 'grey.100' }}>
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
    // If the service provided a normalized caucion fees breakdown for the row,
    // prefer rendering that instead of re-estimating amounts in the UI.
    const breakdown = row.caucionFeesBreakdown || row.feeBreakdown || null;
    if (breakdown) {
      const formatter = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const fmt = (v) => (Number.isFinite(v) ? formatter.format(v) : '—');
      const fmtSigned = (v) => {
        if (!Number.isFinite(v)) return '—';
        const abs = formatter.format(Math.abs(v));
        if (v > 0) return `+${abs}`;
        if (v < 0) return `-${abs}`;
        return abs;
      };

      const principal = Number.isFinite(row.principal) ? row.principal : null;
      const baseAmount = Number.isFinite(breakdown.baseAmount) ? breakdown.baseAmount : principal;
      const arancel = Number.isFinite(breakdown.arancel) ? breakdown.arancel : (Number.isFinite(breakdown.arancelAmount) ? breakdown.arancelAmount : 0);
      const derechos = Number.isFinite(breakdown.derechos) ? breakdown.derechos : (Number.isFinite(breakdown.derechosMercadoAmount) ? breakdown.derechosMercadoAmount : 0);
      const gastosGarantia = Number.isFinite(breakdown.gastos) ? breakdown.gastos : (Number.isFinite(breakdown.gastosGarantiaAmount) ? breakdown.gastosGarantiaAmount : 0);
      const iva = Number.isFinite(breakdown.iva) ? breakdown.iva : (Number.isFinite(breakdown.ivaAmount) ? breakdown.ivaAmount : 0);
      const totalExpenses = Number.isFinite(breakdown.totalExpenses) ? breakdown.totalExpenses : (arancel + derechos + gastosGarantia + iva);
      const netSettlement = Number.isFinite(breakdown.netSettlement) ? breakdown.netSettlement : (Number.isFinite(breakdown.baseAmount) ? (breakdown.baseAmount - totalExpenses) : null);

      return (
        <Box sx={{ p: 1, minWidth: 300 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, display: 'block', mb: 1, color: 'grey.100' }}>
            Detalle P&L Caución {row.isCaucionColocadora ? "Colocadora" : "Tomadora"}
          </Typography>
          <Typography variant="body2" sx={{ display: 'block', mt: 1, color: 'grey.100' }}>
            Plazo: {row.plazo ?? row.tenorDias ?? breakdown.tenorDays ?? '—'} días
          </Typography>
          {(Number.isFinite(breakdown.avgTNA) || Number.isFinite(row.avgTNA)) && (
            <Typography variant="body2" sx={{ display: 'block', mt: 0.5, color: 'primary.light', fontWeight: 500 }}>
              TNA Promedio: {Number(breakdown.avgTNA ?? row.avgTNA).toFixed(2)}%
            </Typography>
          )}
          <Typography variant="body2" sx={{ display: 'block', mt: 1, color: 'grey.100' }}>
            Importe Bruto: {principal !== null ? fmt(principal) : '—'}
          </Typography>

          <Typography variant="body2" sx={{ display: 'block', mt: 1, color: 'grey.100' }}>
            Interés devengado: {fmtSigned(breakdown.accruedInterest ?? row.accruedInterest ?? row.pnl_caucion)}
          </Typography>
          <Typography variant="body2" sx={{ display: 'block', mt: 1, color: 'grey.100' }}>
            Monto base: {baseAmount !== null ? fmt(baseAmount) : '—'}
          </Typography>
          <Typography variant="body2" sx={{ display: 'block', color: 'grey.400', ml: 1 }}>
            Arancel: {fmtSigned(arancel)}
          </Typography>
          <Typography variant="body2" sx={{ display: 'block', color: 'grey.400', ml: 1 }}>
            Derechos de mercado: {fmtSigned(derechos)}
          </Typography>
          {Number.isFinite(gastosGarantia) && (
            <Typography variant="body2" sx={{ display: 'block', color: 'grey.400', ml: 1 }}>
              Gastos de garantía: {fmtSigned(gastosGarantia)}
            </Typography>
          )}
          <Typography variant="body2" sx={{ display: 'block', color: 'grey.400', ml: 1 }}>
            IVA sobre gastos: {fmtSigned(iva)}
          </Typography>

          <Typography variant="body2" sx={{ display: 'block', mt: 1, fontWeight: 600, borderTop: '1px solid', borderColor: 'grey.700', pt: 0.5, color: 'grey.100' }}>
            Gastos totales: {fmtSigned(totalExpenses)}
          </Typography>
          <Typography variant="body2" sx={{ display: 'block', fontWeight: 600, color: 'grey.100' }}>
            Neto de liquidación: {netSettlement !== null ? fmt(netSettlement) : '—'}
          </Typography>
        </Box>
      );
    }

    // No service breakdown available — be strict: do not estimate repo fees locally.
    const formatter = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmt = (v) => (Number.isFinite(v) ? formatter.format(v) : '—');

    return (
      <Box sx={{ p: 1, minWidth: 300 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, display: 'block', mb: 1, color: 'grey.100' }}>
          Detalle P&L Caución {row.isCaucionColocadora ? "Colocadora" : "Tomadora"}
        </Typography>
        <Typography variant="body2" sx={{ display: 'block', mt: 1, color: 'grey.100' }}>
          Plazo: {row.plazo ?? row.tenorDias ?? '—'} días
        </Typography>
        {(Number.isFinite(row.avgTNA) && row.avgTNA > 0) && (
          <Typography variant="body2" sx={{ display: 'block', mt: 0.5, color: 'primary.light', fontWeight: 500 }}>
            TNA Promedio: {Number(row.avgTNA).toFixed(2)}%
          </Typography>
        )}
        <Typography variant="body2" sx={{ color: 'grey.400' }}>
          Datos de caución no disponibles (el servicio no proporcionó breakdown)
        </Typography>
        <Typography variant="body2" sx={{ display: 'block', mt: 1, color: 'grey.100' }}>
          Monto base: {fmt(null)}
        </Typography>
        <Typography variant="body2" sx={{ display: 'block', mt: 1, color: 'grey.100' }}>
          Interés devengado: {fmt(null)}
        </Typography>
        <Typography variant="body2" sx={{ display: 'block', mt: 1, fontWeight: 600, borderTop: '1px solid', borderColor: 'grey.700', pt: 0.5, color: 'grey.100' }}>
          Gastos totales: {fmt(null)}
        </Typography>
        <Typography variant="body2" sx={{ display: 'block', fontWeight: 600, color: 'grey.100' }}>
          Neto de liquidación: {fmt(null)}
        </Typography>
      </Box>
    );
  }
  const formatter = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmt = (v) => (Number.isFinite(v) ? formatter.format(v) : '—');
  const fmtSigned = (v) => {
    if (!Number.isFinite(v)) return '—';
    const abs = formatter.format(Math.abs(v));
    if (v > 0) return `+${abs}`;
    if (v < 0) return `-${abs}`;
    return abs;
  };

  return (
    <Box sx={{ p: 1, minWidth: 300 }}>
      <Typography variant="body2" sx={{ fontWeight: 600, display: 'block', mb: 1, color: 'grey.100' }}>
        Detalle P&L Caución {row.isCaucionColocadora ? "Colocadora" : "Tomadora"}
      </Typography>
      <Typography variant="body2" sx={{ display: 'block', mb: 1, color: 'grey.100' }}>
        Plazo: {row.plazo} días
      </Typography>
      {(row.avgTNA > 0 || Number.isFinite(row.avgTNA)) && (
        <Typography variant="body2" sx={{ display: 'block', mb: 1, color: 'primary.light', fontWeight: 500 }}>
          TNA Promedio: {Number(row.avgTNA).toFixed(2)}%
        </Typography>
      )}

      {row.cauciones.map((c, idx) => {
        // Prefer service-provided principalPortion (portion of operation principal
        // allocated to this caución). Fall back to baseAmount, then the
        // original tranche monto, then any principalAmount if present.
        const base = Number.isFinite(c.principalPortion)
          ? c.principalPortion
          : Number.isFinite(c.baseAmount)
            ? c.baseAmount
            : Number.isFinite(c.monto)
              ? c.monto
              : (Number.isFinite(c.principalAmount) ? c.principalAmount : 0);
        const tasa = Number.isFinite(c.tasa) ? c.tasa : (Number.isFinite(c.tna) ? c.tna : (row.avgTNA || null));
        const tenor = Number.isFinite(c.tenorDias) ? c.tenorDias : (Number.isFinite(c.tenorDays) ? c.tenorDays : null);
        const interes = Number.isFinite(c.interes) ? c.interes : (Number.isFinite(c.accruedInterest) ? c.accruedInterest : 0);
        const arancel = Number.isFinite(c.arancelAmount) ? c.arancelAmount : (Number.isFinite(c.arancel) ? c.arancel : 0);
        const derechos = Number.isFinite(c.derechosMercadoAmount) ? c.derechosMercadoAmount : (Number.isFinite(c.derechosMercado) ? c.derechosMercado : 0);
        const gastosGarantia = Number.isFinite(c.gastosGarantiaAmount) ? c.gastosGarantiaAmount : (Number.isFinite(c.gastosGarantia) ? c.gastosGarantia : 0);
        const iva = Number.isFinite(c.ivaAmount) ? c.ivaAmount : (Number.isFinite(c.iva) ? c.iva : 0);
        const totalExpenses = Number.isFinite(c.totalExpenses) ? c.totalExpenses : (arancel + derechos + gastosGarantia + iva);
        const netSettlement = Number.isFinite(c.netSettlement) ? c.netSettlement : (Number.isFinite(c.neto) ? c.neto : null);
        const roleLabel = c.tipo || c.role || (c.roleLabel ?? 'Caución');
        const currency = c.currency || (c.instrument && c.instrument.currency) || 'ARS';

        return (
          <Box key={idx} sx={{ mb: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, display: 'block', color: 'grey.100' }}>
              {roleLabel} · {currency}
            </Typography>
            <Typography variant="body2" sx={{ display: 'block', color: 'grey.100' }}>
              Monto base: {fmt(base)}
            </Typography>
            {tasa !== null && (
              <Typography variant="body2" sx={{ display: 'block', color: 'grey.400', ml: 1 }}>
                TNA Promedio: {Number(tasa).toFixed(2)}%
              </Typography>
            )}
            {tenor !== null && (
              <Typography variant="body2" sx={{ display: 'block', color: 'grey.400', ml: 1 }}>
                Plazo: {tenor} días
              </Typography>
            )}

            <Typography variant="body2" sx={{ display: 'block', color: 'grey.100', mt: 0.5 }}>
              Interés devengado: {fmtSigned(interes)}
            </Typography>
            <Typography variant="body2" sx={{ display: 'block', color: 'grey.400', ml: 1 }}>
              Arancel: {fmtSigned(arancel)}
            </Typography>
            <Typography variant="body2" sx={{ display: 'block', color: 'grey.400', ml: 1 }}>
              Derechos de mercado: {fmtSigned(derechos)}
            </Typography>
            {Number.isFinite(gastosGarantia) && (
              <Typography variant="body2" sx={{ display: 'block', color: 'grey.400', ml: 1 }}>
                Gastos de garantía: {fmtSigned(gastosGarantia)}
              </Typography>
            )}
            <Typography variant="body2" sx={{ display: 'block', color: 'grey.400', ml: 1 }}>
              IVA sobre gastos: {fmtSigned(iva)}
            </Typography>
            <Typography variant="body2" sx={{ display: 'block', mt: 1, fontWeight: 600, borderTop: '1px solid', borderColor: 'grey.700', pt: 0.5, color: 'grey.100' }}>
              Gastos totales: {fmtSigned(totalExpenses)}
            </Typography>
            <Typography variant="body2" sx={{ display: 'block', fontWeight: 600, color: 'grey.100' }}>
              Neto de liquidación: {netSettlement !== null ? fmt(netSettlement) : '—'}
            </Typography>
          </Box>
        );
      })}

      <Typography variant="body2" sx={{ display: 'block', mt: 1, fontWeight: 600, borderTop: '1px solid', borderColor: 'grey.700', pt: 0.5, color: 'grey.100' }}>
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
      <Typography variant="body2" sx={{ fontWeight: 600, display: 'block', mb: 1, color: 'grey.100' }}>
        Detalle P&L Total
      </Typography>
      <Typography variant="body2" sx={{ display: 'block', color: 'grey.100' }}>
        P&L Trade: {formatCurrency(row.pnl_trade)}
      </Typography>
      <Typography variant="body2" sx={{ display: 'block', color: 'grey.100' }}>
        P&L Caución: {formatCurrency(row.pnl_caucion)}
      </Typography>
      <Typography variant="body2" sx={{ display: 'block', mt: 1, fontWeight: 600, borderTop: '1px solid', borderColor: 'grey.700', pt: 0.5, color: 'grey.100' }}>
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
 * Memoized to prevent unnecessary re-renders
 */
const ArbitrageRow = memo(function ArbitrageRow({ row, strings, expandedRows, onToggleRow }) {
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
            <Typography
              component="span"
              variant="body2"
              sx={{ color: getPnLColor(row.pnl_trade) }}
            >
              {formatCurrency(row.pnl_trade)}
            </Typography>
            <Tooltip title={getPnLTradeBreakdown(row)} arrow slotProps={tooltipSlotProps}>
              <InfoIcon sx={{ fontSize: 16, color: 'info.main', cursor: 'help' }} />
            </Tooltip>
          </Box>
        </TableCell>
        <TableCell align="right">
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
            <Typography
              component="span"
              variant="body2"
              sx={{ color: getPnLColor(row.pnl_caucion) }}
            >
              {formatCurrency(row.pnl_caucion)}
            </Typography>
            <Tooltip title={getPnLCaucionBreakdown(row)} arrow slotProps={tooltipSlotProps}>
              <InfoIcon sx={{ fontSize: 16, color: 'info.main', cursor: 'help' }} />
            </Tooltip>
          </Box>
        </TableCell>
        <TableCell align="right">
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
            <Typography
              component="span"
              variant="body2"
              sx={{ color: getPnLColor(row.pnl_total) }}
            >
              {formatCurrency(row.pnl_total)}
            </Typography>
            <Tooltip title={getPnLTotalBreakdown(row)} arrow slotProps={tooltipSlotProps}>
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

      {/* Expandable details row - lazy loaded */}
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={9}>
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            {isExpanded && (
              <Suspense fallback={
                <Box sx={{ margin: 2, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 100 }}>
                  <CircularProgress size={24} />
                </Box>
              }>
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
              </Suspense>
            )}
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
});

/**
 * ArbitrageTable component
 */
const ArbitrageTable = ({ data = [], strings = {}, onSort }) => {
  const renderStartTime = performance.now();
  
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [orderBy, setOrderBy] = useState('pnl_total');
  const [order, setOrder] = useState('desc');

  const arbitrageStrings = strings?.arbitrage || {};
  const columnsStrings = arbitrageStrings?.columns || {};

  // Calculate totals from data
  const totals = useMemo(() => {
    const calcStart = performance.now();
    if (!data || data.length === 0) {
      return { pnlTrade: 0, pnlCaucion: 0, pnlTotal: 0 };
    }
    const result = data.reduce(
      (acc, row) => {
        acc.pnlTrade += row.pnl_trade || 0;
        acc.pnlCaucion += row.pnl_caucion || 0;
        acc.pnlTotal += row.pnl_total || 0;
        return acc;
      },
      { pnlTrade: 0, pnlCaucion: 0, pnlTotal: 0 }
    );
    const calcEnd = performance.now();
    if (calcEnd - calcStart > 5) {
      console.warn(`[ArbitrageTable] Slow totals calculation: ${(calcEnd - calcStart).toFixed(2)}ms for ${data.length} rows`);
    }
    return result;
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
    const sortStart = performance.now();
    if (!data) return [];
    
    const result = [...data].sort((a, b) => {
      // Always sort by Instrumento (asc) as primary
      const instrumentoCompare = (a.instrumento || '').localeCompare(b.instrumento || '');
      if (instrumentoCompare !== 0) return instrumentoCompare;
      
      // Then by Patron (asc) as secondary
      const patronCompare = (a.patron || '').localeCompare(b.patron || '');
      if (patronCompare !== 0) return patronCompare;
      
      // Then by Cantidad (desc) as tertiary
      const cantidadCompare = (b.cantidad || 0) - (a.cantidad || 0);
      if (cantidadCompare !== 0) return cantidadCompare;
      
      // Finally, if user selected a different column, apply that sort
      if (orderBy !== 'instrumento' && orderBy !== 'patron' && orderBy !== 'cantidad') {
        const aValue = a[orderBy];
        const bValue = b[orderBy];
        
        if (aValue !== bValue) {
          if (order === 'asc') {
            return aValue < bValue ? -1 : 1;
          } else {
            return aValue > bValue ? -1 : 1;
          }
        }
      }
      
      return 0;
    });
    
    const sortEnd = performance.now();
    if (sortEnd - sortStart > 10) {
      console.warn(`[ArbitrageTable] Slow sorting: ${(sortEnd - sortStart).toFixed(2)}ms for ${data.length} rows`);
    }
    
    return result;
  }, [data, orderBy, order]);

  // Log total render time
  const renderEndTime = performance.now();
  const renderDuration = renderEndTime - renderStartTime;
  if (renderDuration > 50) {
    console.warn(`[ArbitrageTable] Slow render: ${renderDuration.toFixed(2)}ms for ${data?.length || 0} rows`);
  }

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
  <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
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
                {columnsStrings.pnlTrade || 'P&L Trade'}
              </TableSortLabel>
              <Typography
                variant="caption"
                display="block"
                sx={{
                  color: getPnLColor(totals.pnlTrade),
                  fontSize: '0.7rem',
                  mt: 0.25,
                }}
              >
                {formatCurrency(totals.pnlTrade)}
              </Typography>
            </TableCell>
            <TableCell align="right">
              <TableSortLabel
                active={orderBy === 'pnl_caucion'}
                direction={orderBy === 'pnl_caucion' ? order : 'asc'}
                onClick={() => handleRequestSort('pnl_caucion')}
                aria-label="ordenar por P&L Caución"
              >
                {columnsStrings.pnlCaucion || 'P&L Caución'}
              </TableSortLabel>
              <Typography
                variant="caption"
                display="block"
                sx={{
                  color: getPnLColor(totals.pnlCaucion),
                  fontSize: '0.7rem',
                  mt: 0.25,
                }}
              >
                {formatCurrency(totals.pnlCaucion)}
              </Typography>
            </TableCell>
            <TableCell align="right">
              <TableSortLabel
                active={orderBy === 'pnl_total'}
                direction={orderBy === 'pnl_total' ? order : 'asc'}
                onClick={() => handleRequestSort('pnl_total')}
                aria-label="ordenar por P&L Total"
              >
                {columnsStrings.pnlTotal || 'P&L Total'}
              </TableSortLabel>
              <Typography
                variant="caption"
                display="block"
                sx={{
                  color: getPnLColor(totals.pnlTotal),
                  fontSize: '0.7rem',
                  mt: 0.25,
                }}
              >
                {formatCurrency(totals.pnlTotal)}
              </Typography>
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
