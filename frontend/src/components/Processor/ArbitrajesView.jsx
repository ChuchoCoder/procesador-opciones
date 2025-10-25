/**
 * ArbitrajesView - Main view for arbitrage analysis
 * Displays P&L table by instrument, plazo, and pattern
 * Implements User Stories 1, 2, 3 from specs/006-arbitraje-de-plazos
 */

import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';

import GroupFilter from './GroupFilter.jsx';
import ArbitrageTable from './ArbitrageTable.jsx';

import { parseOperations, parseCauciones, aggregateByInstrumentoPlazo } from '../../services/data-aggregation.js';
import { calculatePnL } from '../../services/pnl-calculations.js';
import { enrichArbitrageOperations, enrichCauciones } from '../../services/arbitrage-fee-enrichment.js';
import { getRepoFeeConfig } from '../../services/storage-settings.js';
import { LADOS } from '../../services/arbitrage-types.js';

/**
 * Transform ResultadoPatron to table row format
 */
function transformToTableRow(grupo, resultado) {
  const row = {
    id: `${grupo.instrumento}-${grupo.plazo}-${resultado.patron}`,
    instrumento: grupo.instrumento,
    plazo: grupo.plazo,
    patron: resultado.patron,
    cantidad: resultado.matchedQty,
    precioPromedio: resultado.precioPromedio,
    pnl_trade: resultado.pnl_trade,
    pnl_caucion: resultado.pnl_caucion,
    pnl_total: resultado.pnl_total,
    estado: resultado.estado,
    operations: resultado.operations,
    cauciones: resultado.cauciones,
    avgTNA: resultado.avgTNA, // Weighted average TNA from all cauciones
    // Copy breakdown fields for tooltip display
    ventaCI_breakdown: resultado.ventaCI_breakdown,
    compra24h_breakdown: resultado.compra24h_breakdown,
    compraCI_breakdown: resultado.compraCI_breakdown,
    venta24h_breakdown: resultado.venta24h_breakdown,
  };
  
  return row;
}

const ArbitrajesView = ({
  operations = [],
  cauciones = [],
  groupOptions,
  selectedGroupId,
  strings,
  onGroupChange,
}) => {
  const [isCalculating, setIsCalculating] = useState(false);
  const [tableData, setTableData] = useState([]);

  const filterStrings = strings?.filters ?? {};
  const arbitrageStrings = strings?.arbitrage ?? {};

  // Process operations and calculate P&L with useEffect for async operations
  useEffect(() => {
    const processData = async () => {
      if (!operations || operations.length === 0) {
        setTableData([]);
        setIsCalculating(false);
        return;
      }

      setIsCalculating(true);

      // Use setTimeout to allow UI to update before heavy processing
      setTimeout(async () => {
        try {
          // Get current jornada (trading day) - for now use today
          const jornada = new Date();

          // Enrich operations with fee calculations FIRST
          const enrichedOperations = await enrichArbitrageOperations(operations);

        // Parse operations and cauciones using the service layer
        // parseOperations will skip PESOS operations (cauciones)
        // parseCauciones will extract PESOS operations and convert them
        const parsedOperations = parseOperations(enrichedOperations);
        const parsedCauciones = parseCauciones(enrichedOperations);

        // Enrich cauciones with fees
        const enrichedCauciones = await enrichCauciones(parsedCauciones);

        // Debug: print a concise sample of enriched cauciones to help diagnose missing breakdowns
        try {
          const sample = (enrichedCauciones || []).slice(0, 6).map((c) => ({
            id: c?.id ?? null,
            instrumento: c?.instrumento ?? null,
            monto: c?.monto ?? null,
            tasa: c?.tasa ?? null,
            tenorDias: c?.tenorDias ?? null,
            feeAmount: c?.feeAmount ?? null,
            hasFeeBreakdown: !!c?.feeBreakdown,
            feeBreakdownKeys: c?.feeBreakdown ? Object.keys(c.feeBreakdown) : null,
          }));
          console.debug('[ArbitrajesView] enrichedCauciones sample', { total: enrichedCauciones.length, sample });
        } catch (e) {
          // ignore
        }

        if (parsedOperations.length === 0) {
          console.warn('ArbitrajesView: No valid operations after parsing');
          setTableData([]);
          return;
        }

  // Aggregate operations and cauciones
  const grupos = aggregateByInstrumentoPlazo(parsedOperations, enrichedCauciones, jornada);

  const filteredGrupos = Array.from(grupos.values());

  // Load repo fee config and repo fees calculator so we can estimate
  // repo fees for grupos that don't have explicit cauciones attached.
  const repoFeeConfig = await getRepoFeeConfig();
  const { calculateRepoExpenseBreakdown, calculateAccruedInterest } = await import('../../services/fees/repo-fees.js');

        // Calculate P&L for each grupo and flatten to table rows
        const rows = [];
        filteredGrupos.forEach((grupo) => {
          const resultados = calculatePnL(grupo);
          resultados.forEach((resultado) => {
            // Only include results with matched operations
            if (resultado.matchedQty > 0) {
              const row = transformToTableRow(grupo, resultado);

              // If grupo has no cauciones but we have an avgTNA, attempt to
              // estimate repo fee breakdown using repoFeeConfig so the tooltip
              // can show approximate arancel/derechos/iva instead of zeros.
              try {
                if ((!row.cauciones || row.cauciones.length === 0) && row.avgTNA > 0 && repoFeeConfig) {
                  // Compute operation total and adjust principal by including/excluding
                  // broker commissions and operation-level fees (feeAmount) just like P&L logic.
                  const operationTotal = Number.isFinite(row.cantidad) && Number.isFinite(row.precioPromedio)
                    ? row.cantidad * row.precioPromedio
                    : (Number.isFinite(row.monto) ? row.monto : 0);
                  const tenorDays = Number.isFinite(grupo.plazo) ? grupo.plazo : 0;
                  const priceTNA = row.avgTNA;

                  // Infer role from first operation side (sell => colocadora, buy => tomadora)
                  let inferredRole = 'tomadora';
                  const ops = Array.isArray(row.operations) ? row.operations : [];
                  try {
                    if (ops.length > 0) {
                      const first = ops[0];
                      const sideRaw = String(first?.lado ?? first?.side ?? '').toUpperCase();
                      const isSell = sideRaw.startsWith('V') || sideRaw === 'SELL';
                      const isBuy = sideRaw.startsWith('C') || sideRaw === 'BUY';
                      if (isSell) inferredRole = 'colocadora';
                      else if (isBuy) inferredRole = 'tomadora';
                    }
                  } catch (e) {
                    // keep default
                  }

                  // Determine which operations contributed to the side that defines the principal
                  const sideOps = ops.filter((op) => {
                    try {
                      const raw = String(op?.lado ?? op?.side ?? '').toUpperCase();
                      const isSell = raw.startsWith('V') || raw === 'SELL';
                      const isBuy = raw.startsWith('C') || raw === 'BUY';
                      return inferredRole === 'colocadora' ? isSell : isBuy;
                    } catch (e) {
                      return false;
                    }
                  });

                  const totalSideQuantity = sideOps.reduce((s, o) => s + (Number.isFinite(o?.cantidad) ? o.cantidad : (Number.isFinite(o?.last_qty) ? o.last_qty : 0)), 0) || row.cantidad || 0;
                  const matchedQty = row.cantidad || 0;
                  const proportion = totalSideQuantity > 0 ? (matchedQty / totalSideQuantity) : 1;

                  const totalBrokerCommissionsSide = sideOps.reduce((s, o) => s + (Number.isFinite(o?.comisiones) ? o.comisiones : 0), 0) * proportion;
                  const totalOperationFeeAmountSide = sideOps.reduce((s, o) => s + (Number.isFinite(o?.feeAmount) ? o.feeAmount : 0), 0) * proportion;

                  // Principal used for interest calculation: operationTotal +/- (commissions + operation fees)
                  const principal = inferredRole === 'colocadora'
                    ? (operationTotal - totalBrokerCommissionsSide - totalOperationFeeAmountSide)
                    : (operationTotal + totalBrokerCommissionsSide + totalOperationFeeAmountSide);

                  const accrued = calculateAccruedInterest(principal, priceTNA, tenorDays);
                  const baseAmount = principal + accrued;

                  const repoOperationInput = {
                    id: row.id,
                    instrument: { cfiCode: 'RP', displayName: `${grupo.instrumento} ${tenorDays}D` },
                    currency: 'ARS',
                    role: inferredRole,
                    principalAmount: principal,
                    baseAmount,
                    priceTNA,
                    tenorDays,
                  };

                  const raw = calculateRepoExpenseBreakdown(repoOperationInput, repoFeeConfig);
                  if (raw) {
                    const normalized = {
                      _raw: raw,
                      principalAmount: raw.principalAmount,
                      tenorDays: raw.tenorDays,
                      baseAmount: raw.baseAmount,
                      accruedInterest: raw.accruedInterest,
                      arancel: raw.arancelAmount ?? raw.arancel ?? 0,
                      derechos: raw.derechosMercadoAmount ?? raw.derechos ?? 0,
                      gastos: raw.gastosGarantiaAmount ?? raw.gastos ?? 0,
                      iva: raw.ivaAmount ?? raw.iva ?? 0,
                      totalExpenses: raw.totalExpenses ?? 0,
                      netSettlement: raw.netSettlement ?? raw.baseAmount ?? baseAmount,
                      warnings: raw.warnings ?? [],
                      status: raw.status ?? null,
                    };

                    // Attach both feeBreakdown and top-level fields so the tooltip
                    // which checks row.arancelAmount / row.arancel etc can read them.
                    // Also attach the principal used for estimation so the UI can
                    // display the same Monto base used by the P&L calculation.
                    row.principal = principal;
                    row.feeBreakdown = normalized;
                    row.arancel = normalized.arancel;
                    row.derechosMercado = normalized.derechos;
                    row.gastosGarantia = normalized.gastos;
                    row.iva = normalized.iva;
                    row.totalExpenses = normalized.totalExpenses;
                    row.netSettlement = normalized.netSettlement;
                  }
                }
              } catch (err) {
                // don't block the UI if estimation fails
                console.warn('[ArbitrajesView] failed to estimate repo fees for grupo', { grupo: grupo.instrumento, error: err });
              }

              rows.push(row);
            }
          });
        });

        setTableData(rows);
        } catch (error) {
          console.error('Error calculating arbitrage P&L:', error);
          console.error('Error stack:', error.stack);
          setTableData([]);
        } finally {
          setIsCalculating(false);
        }
      }, 100); // 100ms delay to allow UI to show loading state
    };

    processData();
  }, [operations, cauciones]);

  return (
    <Stack spacing={2} sx={{ flex: 1, minHeight: 0, p: 2 }}>
      {/* Filters */}
      <Stack direction="row" spacing={2} alignItems="center">
        {groupOptions && groupOptions.length > 0 && (
          <GroupFilter
            options={groupOptions}
            selectedGroupId={selectedGroupId}
            onChange={onGroupChange}
            strings={filterStrings}
          />
        )}
      </Stack>

      {/* Main content area */}
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex' }}>
        {/* Table */}
        <Box sx={{ flex: 1, minHeight: 0 }}>
          {isCalculating ? (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100%',
              }}
            >
              <CircularProgress />
              <Typography variant="body2" sx={{ ml: 2 }}>
                {arbitrageStrings.loadingData || 'Cargando datos...'}
              </Typography>
            </Box>
          ) : (
            <ArbitrageTable data={tableData} strings={strings} />
          )}
        </Box>
      </Box>
    </Stack>
  );
};

export default ArbitrajesView;
