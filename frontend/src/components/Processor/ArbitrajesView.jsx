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

/**
 * Filter rows based on selected group IDs
 * Returns all rows if "All" is selected or no selection made
 */
function filterRowsBySelection(allRows, selectedGroupId, groupOptions) {
  // Normalize selectedGroupId to array
  const selectedIds = Array.isArray(selectedGroupId) 
    ? selectedGroupId 
    : selectedGroupId 
      ? [selectedGroupId] 
      : [];
  
  // Check if "All" is selected or no selection
  const allSelected = selectedIds.length === 0 || 
                      selectedIds.includes('__ALL__') ||
                      selectedGroupId === '__ALL__';
  
  if (allSelected) {
    return allRows;
  }
  
  // Build set of selected instrument names from group options
  const selectedInstruments = new Set();
  selectedIds.forEach(id => {
    const option = groupOptions?.find(opt => opt.id === id);
    if (option?.label) {
      selectedInstruments.add(option.label);
    }
  });
  
  // Filter rows by selected instruments
  return selectedInstruments.size > 0
    ? allRows.filter(row => selectedInstruments.has(row.instrumento))
    : allRows;
}

const ArbitrajesView = ({
  operations = [],
  groupOptions,
  selectedGroupId,
  strings,
  onGroupChange,
  avgTNAByCurrency: avgTNAProp = null,
}) => {
  // Show the spinner immediately if the parent passed operations already
  // (prevents a flash of "no data" before parsing starts).
  const [isCalculating, setIsCalculating] = useState(() => operations?.length > 0);
  const [tableData, setTableData] = useState([]);
  // Track instruments that actually have arbitrage results (to filter groupOptions)
  const [availableInstruments, setAvailableInstruments] = useState(new Set());

  const filterStrings = strings?.filters ?? {};
  const arbitrageStrings = strings?.arbitrage ?? {};

  // Helper function to clear all state
  const clearState = () => {
    setTableData([]);
    setAvailableInstruments(new Set());
    setIsCalculating(false);
  };

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
        clearState();
        return;
      }

      const prepareId = `prepare-${Date.now()}`;
      console.time(`[ArbitrajesView] Total preparation time (${prepareId})`);
      setIsCalculating(true);

      // Allow UI to update first
      setTimeout(async () => {
        try {
          const enrichOpsId = `enrich-ops-${Date.now()}`;
          console.time(`[ArbitrajesView] Enrich operations (${enrichOpsId})`);
          // Enrich operations with fee calculations FIRST
          const enrichedOperations = await enrichArbitrageOperations(operations);
          console.timeEnd(`[ArbitrajesView] Enrich operations (${enrichOpsId})`);
          console.log('[ArbitrajesView] Enriched operations count:', enrichedOperations.length);

          const parseOpsId = `parse-ops-${Date.now()}`;
          console.time(`[ArbitrajesView] Parse operations (${parseOpsId})`);
          // Parse operations and cauciones using the service layer
          const parsedOperations = parseOperations(enrichedOperations);
          console.timeEnd(`[ArbitrajesView] Parse operations (${parseOpsId})`);
          console.log('[ArbitrajesView] Parsed operations count:', parsedOperations.length);

          const parseCaucId = `parse-cauc-${Date.now()}`;
          console.time(`[ArbitrajesView] Parse cauciones (${parseCaucId})`);
          const parsedCauciones = parseCauciones(enrichedOperations);
          console.timeEnd(`[ArbitrajesView] Parse cauciones (${parseCaucId})`);
          console.log('[ArbitrajesView] Parsed cauciones count:', parsedCauciones.length);

          const enrichCaucId = `enrich-cauc-${Date.now()}`;
          console.time(`[ArbitrajesView] Enrich cauciones (${enrichCaucId})`);
          // Enrich cauciones with fees
          const enrichedCauciones = await enrichCauciones(parsedCauciones);
          console.timeEnd(`[ArbitrajesView] Enrich cauciones (${enrichCaucId})`);

          if (cancelled) return;

          setParsedOperationsState(parsedOperations);
          setEnrichedCaucionesState(enrichedCauciones || []);
          console.timeEnd(`[ArbitrajesView] Total preparation time (${prepareId})`);

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
          clearState();
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
      // If there are no parsed operations yet, and we're currently in a
      // calculating/parsing phase, don't prematurely clear the loading
      // indicator — let the prepare() effect finish and populate state.
      if (!parsedOperationsState || parsedOperationsState.length === 0) {
        if (isCalculating) {
          // parsing/aggregation still in progress — keep spinner visible
          return;
        }
        clearState();
        return;
      }

      setIsCalculating(true);

      // Allow the browser to paint the loading spinner before we run
      // potentially CPU/IO-heavy aggregation and P&L calculations.
      // A short timeout yields control to the event loop so the UI updates.
      await new Promise((resolve) => setTimeout(resolve, 50));

      try {
        const aggId = `agg-${Date.now()}`;
        console.time(`[ArbitrajesView] Total aggregation & P&L time (${aggId})`);
        const jornada = new Date();

        const aggByInstId = `agg-by-inst-${Date.now()}`;
        console.time(`[ArbitrajesView] Aggregate by instrumento/plazo (${aggByInstId})`);
        // ALWAYS aggregate ALL operations to know which instruments have arbitrage data
        // The filtering by selectedGroupId will happen AFTER on the table rows
        const grupos = aggregateByInstrumentoPlazo(parsedOperationsState, enrichedCaucionesState, jornada, effectiveAvgTNAByCurrency);
        const allGrupos = Array.from(grupos.values());
        console.timeEnd(`[ArbitrajesView] Aggregate by instrumento/plazo (${aggByInstId})`);
        console.log('[ArbitrajesView] Total grupos:', allGrupos.length);

        // Calculate P&L for ALL instruments to build the complete availableInstruments set
        const allRows = [];
        const instrumentsWithResults = new Set();
        
        const calcPnlId = `calc-pnl-${Date.now()}`;
        console.time(`[ArbitrajesView] Calculate P&L for all grupos (${calcPnlId})`);
        for (const grupo of allGrupos) {
          if (cancelled) break;
          const resultados = await calculatePnL(grupo);
          resultados.forEach((resultado) => {
            if (resultado.matchedQty > 0) {
              const row = transformToTableRow(grupo, resultado);
              allRows.push(row);
              // Track ALL instruments that have valid arbitrage results
              instrumentsWithResults.add(grupo.instrumento);
            }
          });
        }
        console.timeEnd(`[ArbitrajesView] Calculate P&L for all grupos (${calcPnlId})`);
        console.log('[ArbitrajesView] Total rows with results:', allRows.length);

        const filterRowsId = `filter-rows-${Date.now()}`;
        console.time(`[ArbitrajesView] Filter rows by selection (${filterRowsId})`);
        // Filter rows based on selectedGroupId for display
        const displayRows = filterRowsBySelection(allRows, selectedGroupId, groupOptions);
        console.timeEnd(`[ArbitrajesView] Filter rows by selection (${filterRowsId})`);
        console.log('[ArbitrajesView] Display rows after filtering:', displayRows.length);

        console.timeEnd(`[ArbitrajesView] Total aggregation & P&L time (${aggId})`);

        if (!cancelled) {
          setTableData(displayRows);
          setAvailableInstruments(instrumentsWithResults);
        }
      } catch (error) {
        console.error('Error calculating arbitrage P&L:', error);
        console.error('Error stack:', error.stack);
        if (!cancelled) {
          clearState();
        }
      } finally {
        if (!cancelled) setIsCalculating(false);
      }
    };

    doAggregation();

    return () => {
      cancelled = true;
    };
    // Note: isCalculating is intentionally excluded from deps to prevent infinite loops
    // effectiveAvgTNAByCurrency is derived from avgTNAByCurrencyMemo/avgTNAProp which are already tracked
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsedOperationsState, enrichedCaucionesState, avgTNAByCurrencyMemo, avgTNAProp, selectedGroupId, groupOptions]);

  // Filter groupOptions to only show instruments that have arbitrage data
  const filteredGroupOptions = useMemo(() => {
    if (!groupOptions?.length || availableInstruments.size === 0) {
      return [];
    }

    // Filter options to only include those that have arbitrage results
    // Always keep the "All" option
    return groupOptions.filter((opt) => {
      return opt.id === '__ALL__' || 
             opt.label === (filterStrings.all || 'All') ||
             availableInstruments.has(opt.label);
    });
  }, [groupOptions, availableInstruments, filterStrings.all]);

  return (
    <Stack spacing={2} sx={{ flex: 1, minHeight: 0, p: 2 }}>
      {/* Filters */}
      <Stack direction="row" spacing={2} alignItems="center">
        {filteredGroupOptions && filteredGroupOptions.length > 0 && (
          <GroupFilter
            options={filteredGroupOptions}
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
