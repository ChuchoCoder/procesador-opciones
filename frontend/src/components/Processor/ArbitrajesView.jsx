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

        if (parsedOperations.length === 0) {
          console.warn('ArbitrajesView: No valid operations after parsing');
          setTableData([]);
          return;
        }

        // Aggregate operations and cauciones
        const grupos = aggregateByInstrumentoPlazo(parsedOperations, enrichedCauciones, jornada);

        const filteredGrupos = Array.from(grupos.values());

        // Calculate P&L for each grupo and flatten to table rows
        const rows = [];
        filteredGrupos.forEach((grupo) => {
          const resultados = calculatePnL(grupo);
          resultados.forEach((resultado) => {
            // Only include results with matched operations
            if (resultado.matchedQty > 0) {
              rows.push(transformToTableRow(grupo, resultado));
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
