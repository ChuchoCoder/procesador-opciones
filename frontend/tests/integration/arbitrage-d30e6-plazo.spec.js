/**
 * Integration test for D30E6 arbitrage plazo calculation bug
 * Tests that plazo is correctly extracted from PESOS cauciones (3D)
 * instead of being calculated from CI→24hs business days logic (1D)
 * 
 * IMPORTANT: This is a true integration test with NO MOCKS
 * - Uses real CSV file
 * - Uses real service functions
 * - Uses real fee calculations
 * - Tests the complete flow: CSV → Parse → Enrich → Aggregate → Calculate P&L
 * 
 * Expected Behavior:
 * - Date: 2025-12-30 (Tuesday)
 * - Instrument: D30E6
 * - Operations: 6 CI buys @ 143,200 + 6 24hs sells @ 144,200 (600 titles total)
 * - Cauciones: PESOS - 3D (minimum plazo available)
 * - Expected plazo: 3 days (from cauciones)
 * - Current bug: plazo = 1 day (from business days logic)
 * - Expected P&L: ~$535,255.70
 */

/* eslint-env node, jest */
import { describe, it, beforeAll, expect } from 'vitest';
import Papa from 'papaparse';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'path';

// Real imports - NO MOCKS
import { enrichArbitrageOperations, enrichCauciones } from '../../src/services/arbitrage-fee-enrichment.js';
import { parseOperations, parseCauciones, aggregateByInstrumentoPlazo, filterGruposByInstrument, calculateAvgTNAByCurrency } from '../../src/services/data-aggregation.js';
import { calculatePnL } from '../../src/services/pnl-calculations.js';

/**
 * Transform ResultadoPatron to table row format (same as ArbitrajesView.jsx)
 */
function transformToTableRow(grupo, resultado) {
  return {
    id: `${grupo.instrumento}-${grupo.plazo}-${resultado.patron}`,
    instrumento: grupo.instrumento,
    plazo: grupo.plazo,
    patron: resultado.patron,
    cantidad: resultado.matchedQty,
    pnl_trade: resultado.pnl_trade,
    pnl_caucion: resultado.pnl_caucion,
    pnl_total: resultado.pnl_total,
    estado: resultado.estado,
    operations: resultado.operations,
    cauciones: resultado.cauciones,
    avgTNA: resultado.avgTNA,
  };
}

describe('D30E6 Arbitrage Plazo Calculation Bug', () => {
  let allRows;
  let enrichedOperations;
  let parsedOperations;
  let enrichedCauciones;
  let d30e6Grupo;
  let tableData;
  let d30e6Row;
  let avgTNAByCurrency;

  beforeAll(async () => {
    console.log('\n=== D30E6 Arbitrage Plazo Test Setup ===\n');

    // Step 1: Load CSV
    const filePath = join(
      dirname(fileURLToPath(import.meta.url)),
      'data',
      'ReporteOperaciones_17825-2025-12-30.csv'
    );
    console.log('[Step 1] Loading CSV:', filePath);
    const csvContent = await readFile(filePath, 'utf-8');
    const parsed = Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
    });

    allRows = parsed.data.filter((row) => row.symbol);
    console.log(`[Step 1] ✓ Loaded ${allRows.length} rows from CSV\n`);

    // Step 2: Enrich operations with fees
    console.log('[Step 2] Enriching operations with fees...');
    enrichedOperations = await enrichArbitrageOperations(allRows);
    console.log(`[Step 2] ✓ Enriched ${enrichedOperations.length} operations\n`);

    // Step 3: Parse operations and cauciones
    console.log('[Step 3] Parsing operations and cauciones...');
    parsedOperations = parseOperations(enrichedOperations);
    const parsedCaucionesRaw = parseCauciones(enrichedOperations);
    console.log(`[Step 3] ✓ Parsed ${parsedOperations.length} operations, ${parsedCaucionesRaw.length} cauciones (raw)\n`);

    // Step 4: Enrich cauciones with fees
    console.log('[Step 4] Enriching cauciones with fees...');
    enrichedCauciones = await enrichCauciones(parsedCaucionesRaw);
    console.log(`[Step 4] ✓ Enriched ${enrichedCauciones.length} cauciones\n`);

    // Step 5: Calculate weighted average TNA per currency
    console.log('[Step 5] Calculating weighted average TNA...');
    avgTNAByCurrency = calculateAvgTNAByCurrency(enrichedCauciones || []);
    console.log('[Step 5] ✓ Weighted avg TNA by currency:', avgTNAByCurrency, '\n');

    // Step 6: Aggregate by instrument and plazo
    const jornada = new Date('2025-12-30T00:00:00Z');
    console.log('[Step 6] Aggregating by instrument and plazo...');
    console.log('[Step 6] Jornada:', jornada.toISOString(), '(Tuesday)');
    const grupos = aggregateByInstrumentoPlazo(
      parsedOperations,
      enrichedCauciones,
      jornada,
      avgTNAByCurrency
    );
    console.log(`[Step 6] ✓ Created ${grupos.size} grupos\n`);

    // Step 7: Filter by D30E6 instrument
    console.log('[Step 7] Filtering to D30E6 instrument...');
    const d30e6Grupos = filterGruposByInstrument(grupos, 'D30E6');
    if (d30e6Grupos.length === 0) {
      console.error('[Step 7] ✗ ERROR: No D30E6 grupo found!');
      throw new Error('D30E6 grupo not found in aggregated data');
    }
    [d30e6Grupo] = d30e6Grupos;
    console.log('[Step 7] ✓ Found D30E6 grupo:', {
      instrumento: d30e6Grupo.instrumento,
      plazo: d30e6Grupo.plazo,
      comprasCI: d30e6Grupo.comprasCI.length,
      ventas24h: d30e6Grupo.ventas24h.length,
      avgTNA: d30e6Grupo.avgTNA,
    });
    console.log('');

    // Step 8: Calculate P&L
    console.log('[Step 8] Calculating P&L...');
    const resultados = await calculatePnL(d30e6Grupo);
    console.log(`[Step 8] ✓ Calculated ${resultados.length} pattern results\n`);

    // Step 9: Transform to table rows
    console.log('[Step 9] Transforming to table rows...');
    tableData = [];
    resultados.forEach((resultado) => {
      if (resultado.matchedQty > 0) {
        tableData.push(transformToTableRow(d30e6Grupo, resultado));
      }
    });
    d30e6Row = tableData.find((row) => row.patron === 'CompraCI_Venta24h');
    console.log(`[Step 9] ✓ Generated ${tableData.length} table rows`);
    if (d30e6Row) {
      console.log('[Step 9] D30E6 table row:', {
        patron: d30e6Row.patron,
        plazo: d30e6Row.plazo,
        cantidad: d30e6Row.cantidad,
        pnl_trade: d30e6Row.pnl_trade,
        pnl_caucion: d30e6Row.pnl_caucion,
        pnl_total: d30e6Row.pnl_total,
      });
    } else {
      console.warn('[Step 9] ⚠ WARNING: CompraCI_Venta24h row not found!');
    }
    console.log('\n=== Setup Complete ===\n');
  });

  describe('Test 1: Verify D30E6 Operations Parsing', () => {
    it('should parse D30E6 operations correctly', () => {
      const d30e6Ops = parsedOperations.filter((op) => op.instrumento === 'D30E6');

      expect(d30e6Ops.length).toBeGreaterThan(0);
      console.log('[Test 1] Total D30E6 operations:', d30e6Ops.length);

      // Verify CI buy operations
      const comprasCI = d30e6Ops.filter((op) => op.venue === 'CI' && op.lado === 'C');
      expect(comprasCI.length).toBe(6);
      expect(comprasCI.every((op) => op.precio === 143200)).toBe(true);
      expect(comprasCI.every((op) => op.cantidad === 100)).toBe(true);
      console.log('[Test 1] ✓ CI buys: 6 operations @ 143,200 (100 titles each)');

      // Verify 24hs sell operations
      const ventas24h = d30e6Ops.filter((op) => op.venue === '24h' && op.lado === 'V');
      expect(ventas24h.length).toBe(6);
      expect(ventas24h.every((op) => op.precio === 144200)).toBe(true);
      expect(ventas24h.every((op) => op.cantidad === 100)).toBe(true);
      console.log('[Test 1] ✓ 24hs sells: 6 operations @ 144,200 (100 titles each)');

      console.log('[Test 1] ✓ Total matched quantity:', 600);
    });
  });

  describe('Test 2: Verify PESOS - 3D Cauciones Parsing', () => {
    it('should parse PESOS - 3D cauciones correctly', () => {
      const cauciones3D = enrichedCauciones.filter(
        (c) => c.instrumento === 'PESOS' && c.tenorDias === 3
      );

      expect(cauciones3D.length).toBeGreaterThan(0);
      console.log('[Test 2] PESOS - 3D cauciones found:', cauciones3D.length);

      // Verify that 3D is the minimum plazo available
      const allCaucionesDays = enrichedCauciones
        .filter((c) => c.instrumento === 'PESOS' && c.tenorDias > 0)
        .map((c) => c.tenorDias);

      const uniquePlazos = [...new Set(allCaucionesDays)].sort();
      const minPlazo = Math.min(...allCaucionesDays);

      console.log('[Test 2] All PESOS cauciones plazos:', uniquePlazos);
      console.log('[Test 2] Minimum plazo:', minPlazo);
      expect(minPlazo).toBe(3); // 3D is the minimum plazo in this CSV

      const totalMonto = cauciones3D.reduce((sum, c) => sum + c.monto, 0);
      console.log('[Test 2] Total monto 3D:', totalMonto.toLocaleString('es-AR'));
      console.log('[Test 2] ✓ 3D is the minimum plazo available');
    });
  });

  describe('Test 3: CRITICAL - Verify D30E6 Grupo Plazo', () => {
    it('should use plazo=3 from minimum PESOS caucion, not business days', () => {
      expect(d30e6Grupo).toBeDefined();
      expect(d30e6Grupo.instrumento).toBe('D30E6');

      console.log('\n=== PLAZO CALCULATION ANALYSIS ===');

      // Analyze available PESOS cauciones
      const allPesosPlazos = enrichedCauciones
        .filter((c) => c.instrumento === 'PESOS' && c.tenorDias > 0)
        .map((c) => c.tenorDias);
      const uniquePlazos = [...new Set(allPesosPlazos)].sort();
      const minPlazo = Math.min(...allPesosPlazos);

      console.log('Available PESOS cauciones plazos:', uniquePlazos);
      console.log('Minimum plazo from cauciones:', minPlazo);
      console.log('Current calculation method: CI→24hs business days');
      console.log('For Tuesday 2025-12-30: Tue→Wed = 1 day');
      console.log('');
      console.log('Expected plazo (from cauciones):', 3);
      console.log('Actual D30E6 grupo plazo:', d30e6Grupo.plazo);
      console.log('');

      // THIS IS THE BUG: Currently calculates 1, should be 3
      if (d30e6Grupo.plazo === 1) {
        console.log('❌ BUG CONFIRMED: Using business days logic (1D) instead of cauciones (3D)');
        console.log('   This causes incorrect P&L calculation!');
      } else if (d30e6Grupo.plazo === 3) {
        console.log('✅ FIXED: Using minimum plazo from cauciones (3D)');
      } else {
        console.log(`⚠️  UNEXPECTED: plazo = ${d30e6Grupo.plazo} (expected 3)`);
      }

      console.log('================================\n');

      // This assertion will FAIL with current implementation
      expect(d30e6Grupo.plazo).toBe(3);
    });
  });

  describe('Test 4: Verify P&L Calculation with Correct Plazo', () => {
    it('should calculate P&L with correct plazo (3 days)', () => {
      expect(d30e6Row).toBeDefined();
      expect(d30e6Row.plazo).toBe(3);

      console.log('\n=== P&L CALCULATION ANALYSIS ===');

      // Verify matched quantity
      expect(d30e6Row.cantidad).toBe(600); // 6 ops × 100 titles
      console.log('Matched quantity:', d30e6Row.cantidad, 'titles');

      // Verify P&L Trade (without caución)
      // Price difference: 144,200 - 143,200 = 1,000 per title
      const expectedTradePnLGross = 600 * 1000; // = 600,000
      console.log('P&L Trade (gross):', expectedTradePnLGross.toLocaleString('es-AR'));
      console.log('P&L Trade (actual, after fees):', d30e6Row.pnl_trade.toLocaleString('es-AR'));

      // P&L Trade should be positive and close to gross amount (after fees)
      expect(d30e6Row.pnl_trade).toBeGreaterThan(0);
      expect(d30e6Row.pnl_trade).toBeLessThan(expectedTradePnLGross);
      expect(d30e6Row.pnl_trade).toBeCloseTo(expectedTradePnLGross, -3); // Within 1,000

      // Verify P&L Caución (negative because it's tomadora = expense)
      console.log('P&L Caución (cost):', d30e6Row.pnl_caucion.toLocaleString('es-AR'));
      expect(d30e6Row.pnl_caucion).toBeLessThan(0); // Tomadora = expense

      // With plazo=3, the caución should cost ~3x more than with plazo=1
      // Expected caución cost with plazo=3: ~60,000-70,000 ARS
      const expectedCaucionCost = -65000;
      console.log('Expected caución cost (approx):', expectedCaucionCost.toLocaleString('es-AR'));

      // Verify P&L Total is close to expected
      const expectedTotalPnL = 535255.70; // From user's Windows app
      console.log('P&L Total (actual):', d30e6Row.pnl_total.toLocaleString('es-AR'));
      console.log('P&L Total (expected):', expectedTotalPnL.toLocaleString('es-AR'));
      console.log('Difference:', (d30e6Row.pnl_total - expectedTotalPnL).toLocaleString('es-AR'));

      // Allow 1% tolerance for rounding differences
      const tolerance = expectedTotalPnL * 0.01;
      expect(Math.abs(d30e6Row.pnl_total - expectedTotalPnL)).toBeLessThan(tolerance);

      console.log('\n✓ P&L calculation matches expected value within 1% tolerance');
      console.log('================================\n');
    });
  });

  describe('Test 5: Verify Weighted Average TNA from Cauciones', () => {
    it('should calculate weighted average TNA from PESOS cauciones', () => {
      expect(avgTNAByCurrency['ARS']).toBeGreaterThan(0);
      expect(d30e6Grupo.avgTNA).toBeGreaterThan(0);
      expect(d30e6Grupo.avgTNA).toBe(avgTNAByCurrency['ARS']);

      console.log('\n=== TNA CALCULATION ===');
      console.log('Weighted avg TNA (ARS):', avgTNAByCurrency['ARS'].toFixed(2) + '%');
      console.log('D30E6 grupo avgTNA:', d30e6Grupo.avgTNA.toFixed(2) + '%');
      console.log('✓ TNA correctly assigned from currency mapping');
      console.log('======================\n');
    });
  });

  describe('Summary Report', () => {
    it('should log complete test summary', () => {
      console.log('\n╔════════════════════════════════════════════════════════╗');
      console.log('║         D30E6 ARBITRAGE PLAZO TEST SUMMARY            ║');
      console.log('╚════════════════════════════════════════════════════════╝');
      console.log('');
      console.log('Date:', '2025-12-30 (Tuesday)');
      console.log('Instrument:', 'D30E6');
      console.log('Pattern:', 'CompraCI → Venta24h (caución tomadora)');
      console.log('');
      console.log('Operations:');
      console.log('  CI Buys:', d30e6Grupo.comprasCI.length, '× 100 titles @ 143,200');
      console.log('  24hs Sells:', d30e6Grupo.ventas24h.length, '× 100 titles @ 144,200');
      console.log('  Matched Qty:', d30e6Row.cantidad, 'titles');
      console.log('');
      console.log('Plazo Calculation:');
      console.log('  Expected:', '3 days (from PESOS - 3D cauciones)');
      console.log('  Actual:', d30e6Grupo.plazo, 'days');
      console.log('  Status:', d30e6Grupo.plazo === 3 ? '✅ CORRECT' : '❌ BUG DETECTED');
      console.log('');
      console.log('P&L Results:');
      console.log('  Trade:', d30e6Row.pnl_trade.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' }));
      console.log('  Caución:', d30e6Row.pnl_caucion.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' }));
      console.log('  Total:', d30e6Row.pnl_total.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' }));
      console.log('  Expected:', (535255.70).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' }));
      console.log('  Difference:', (d30e6Row.pnl_total - 535255.70).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' }));
      console.log('');
      console.log('Weighted Avg TNA (ARS):', avgTNAByCurrency['ARS'].toFixed(2) + '%');
      console.log('');
      console.log('╚════════════════════════════════════════════════════════╝\n');

      // This always passes - just for logging
      expect(true).toBe(true);
    });
  });
});
