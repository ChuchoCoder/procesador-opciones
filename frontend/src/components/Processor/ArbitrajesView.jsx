/**
 * ArbitrajesView - Main view for arbitrage analysis
 * Displays P&L table by instrument, plazo, and pattern
 * Implements User Stories 1, 2, 3 from specs/006-arbitraje-de-plazos
 */

import { useState, useEffect, useMemo } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';

import GroupFilter from './GroupFilter.jsx';
import ArbitrageTable from './ArbitrageTable.jsx';

import { parseOperations, parseCauciones, aggregateByInstrumentoPlazo, calculateAvgTNAByCurrency } from '../../services/data-aggregation.js';
import { calculatePnL } from '../../services/pnl-calculations.js';
import { enrichArbitrageOperations, enrichCauciones } from '../../services/arbitrage-fee-enrichment.js';
import { LADOS } from '../../services/arbitrage-types.js';

/**
 * Transform ResultadoPatron to table row format
 */
function transformToTableRow(grupo, resultado) {
  const row = {
    id: `${grupo.instrumento}-${grupo.plazo}-${resultado.patron}`,
    instrumento: grupo.instrumento,
    isCaucionColocadora: resultado.isCaucionColocadora,
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
    // Precomputed caucion fields so UI doesn't need to recalc
    principal: resultado.principal,
    baseAmount: resultado.baseAmount,
    accruedInterest: resultado.accruedInterest,
    caucionFeesTotal: resultado.caucionFeesTotal,
    caucionFeesBreakdown: resultado.caucionFeesBreakdown || resultado.feeBreakdown || null,
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
  groupOptions,
  selectedGroupId,
  strings,
  onGroupChange,
  avgTNAByCurrency: avgTNAProp = null,
}) => {
  const [isCalculating, setIsCalculating] = useState(false);
  const [tableData, setTableData] = useState([]);

  const filterStrings = strings?.filters ?? {};
  const arbitrageStrings = strings?.arbitrage ?? {};

  // We'll split processing into two stages so we can memoize the avgTNAByCurrency
  // using React's useMemo hook. Stage 1: parse & enrich inputs and store in state.
  const [parsedOperationsState, setParsedOperationsState] = useState([]);
  const [enrichedCaucionesState, setEnrichedCaucionesState] = useState([]);

  useEffect(() => {
    let cancelled = false;

    const prepare = async () => {
      if (!operations || operations.length === 0) {
        setParsedOperationsState([]);
        setEnrichedCaucionesState([]);
        setTableData([]);
        setIsCalculating(false);
        return;
      }

      setIsCalculating(true);

      // Allow UI to update first
      setTimeout(async () => {
        try {
          // Enrich operations with fee calculations FIRST
          const enrichedOperations = await enrichArbitrageOperations(operations);

          // Parse operations and cauciones using the service layer
          const parsedOperations = parseOperations(enrichedOperations);
          const parsedCauciones = parseCauciones(enrichedOperations);

          // Enrich cauciones with fees
          const enrichedCauciones = await enrichCauciones(parsedCauciones);

          if (cancelled) return;

          setParsedOperationsState(parsedOperations);
          setEnrichedCaucionesState(enrichedCauciones || []);

          // Debug sample
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
          } catch {
            // ignore
          }
        } catch (error) {
          console.error('ArbitrajesView prepare error', error);
          setParsedOperationsState([]);
          setEnrichedCaucionesState([]);
          setTableData([]);
          setIsCalculating(false);
        }
      }, 100);
    };

    prepare();

    return () => {
      cancelled = true;
    };
  }, [operations]);

  // Memoize avgTNAByCurrency so it only recomputes when enriched cauciones change
  const avgTNAByCurrencyMemo = useMemo(() => {
    return calculateAvgTNAByCurrency(enrichedCaucionesState || []);
  }, [enrichedCaucionesState]);

  // If a precomputed mapping is provided by the caller, prefer it (caller rollout).
  const effectiveAvgTNAByCurrency = (avgTNAProp && typeof avgTNAProp === 'object' && Object.keys(avgTNAProp).length > 0)
    ? avgTNAProp
    : avgTNAByCurrencyMemo;

  // Stage 2: aggregate and compute P&L when parsed operations or cauciones update
  useEffect(() => {
    let cancelled = false;

    const doAggregation = async () => {
      if (!parsedOperationsState || parsedOperationsState.length === 0) {
        setTableData([]);
        setIsCalculating(false);
        return;
      }

      setIsCalculating(true);

      try {
        const jornada = new Date();

  // Pass the precomputed mapping into the aggregator (prefer caller-provided mapping)
  const grupos = aggregateByInstrumentoPlazo(parsedOperationsState, enrichedCaucionesState, jornada, effectiveAvgTNAByCurrency);
        const filteredGrupos = Array.from(grupos.values());

        const rows = [];
        for (const grupo of filteredGrupos) {
          if (cancelled) break;
          const resultados = await calculatePnL(grupo);
          resultados.forEach((resultado) => {
            if (resultado.matchedQty > 0) {
              const row = transformToTableRow(grupo, resultado);
              rows.push(row);
            }
          });
        }

        if (!cancelled) setTableData(rows);
      } catch (error) {
        console.error('Error calculating arbitrage P&L:', error);
        console.error('Error stack:', error.stack);
        if (!cancelled) setTableData([]);
      } finally {
        if (!cancelled) setIsCalculating(false);
      }
    };

    doAggregation();

    return () => {
      cancelled = true;
    };
  }, [parsedOperationsState, enrichedCaucionesState, avgTNAByCurrencyMemo, avgTNAProp]);

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
