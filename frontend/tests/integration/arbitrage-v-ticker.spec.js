/**
 * Integration test for V ticker arbitrage flow
 * Tests that instrument "V" (CI sell + 24h buy) appears in arbitraje de plazos
 * Uses only V rows from the actual CSV ReporteOperaciones_17825 (34).csv
 */

/* eslint-env node, jest */
import { describe, it, beforeAll, expect } from 'vitest';
import Papa from 'papaparse';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'path';

import { enrichArbitrageOperations, enrichCauciones } from '../../src/services/arbitrage-fee-enrichment.js';
import { parseOperations, parseCauciones, aggregateByInstrumentoPlazo, filterGruposByInstrument, calculateAvgTNAByCurrency } from '../../src/services/data-aggregation.js';
import { calculatePnL } from '../../src/services/pnl-calculations.js';

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

describe('V Ticker Arbitrage Full Flow', () => {
  let allRows;
  let enrichedOperations;
  let parsedOperations;
  let enrichedCauciones;
  let vGrupo;
  let allTableRows;
  let vRow;

  beforeAll(async () => {
    // Step 1: Load CSV with just V ticker rows
    const filePath = join(dirname(fileURLToPath(import.meta.url)), 'data', 'arbitrage-V-ticker.csv');
    const csvContent = await readFile(filePath, 'utf-8');
    const parsed = Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
    });

    allRows = parsed.data.filter((row) => row.symbol);
    console.log(`[Test] Loaded ${allRows.length} V ticker rows from CSV`);

    allRows.forEach((row, i) => {
      console.log(`[Test] Row ${i}: side=${row.side}, symbol=${row.symbol}, last_qty=${row.last_qty}, last_price=${row.last_price}, cum_qty=${row.cum_qty}, leaves_qty=${row.leaves_qty}, ord_status=${row.ord_status}`);
    });

    // Step 2: Enrich operations with fees
    enrichedOperations = await enrichArbitrageOperations(allRows);
    console.log(`[Test] Enriched ${enrichedOperations.length} operations`);

    // Step 3: Parse operations and cauciones
    parsedOperations = parseOperations(enrichedOperations);
    const parsedCaucionesRaw = parseCauciones(enrichedOperations);

    // Step 4: Enrich cauciones with fees
    enrichedCauciones = await enrichCauciones(parsedCaucionesRaw);
    console.log(`[Test] Parsed ${parsedOperations.length} operations, ${enrichedCauciones.length} cauciones`);

    // Log parsed operations for V
    const vParsedOps = parsedOperations.filter(op => op.instrumento === 'V');
    console.log(`[Test] Parsed V operations: ${vParsedOps.length}`);
    vParsedOps.forEach((op, i) => {
      console.log(`[Test] V op ${i}: lado=${op.lado}, venue=${op.venue}, cantidad=${op.cantidad}, precio=${op.precio}, order_id=${op.order_id}`);
    });

    // Step 5: Aggregate by instrument and plazo
    const jornada = new Date('2026-06-25T00:00:00Z');
    const avgTNAByCurrency = calculateAvgTNAByCurrency(enrichedCauciones || []);
    const grupos = aggregateByInstrumentoPlazo(parsedOperations, enrichedCauciones, jornada, avgTNAByCurrency);
    console.log(`[Test] Created ${grupos.size} grupos:`, [...grupos.keys()]);

    // Step 6: Get V grupo
    const vGrupos = filterGruposByInstrument(grupos, 'V');
    if (vGrupos.length === 0) {
      console.error('[Test] ERROR: No V grupo found!');
      vGrupo = null;
    } else {
      vGrupo = vGrupos[0];
      console.log('[Test] V grupo:', {
        instrumento: vGrupo.instrumento,
        plazo: vGrupo.plazo,
        ventasCI: vGrupo.ventasCI.length,
        compras24h: vGrupo.compras24h.length,
        comprasCI: vGrupo.comprasCI.length,
        ventas24h: vGrupo.ventas24h.length,
        avgTNA: vGrupo.avgTNA,
      });

      const sumQty = (ops) => ops.reduce((s, o) => s + o.cantidad, 0);
      const sumPrice = (ops) => ops.reduce((s, o) => s + o.precio * o.cantidad, 0);
      const totalVCI = sumQty(vGrupo.ventasCI);
      const totalC24 = sumQty(vGrupo.compras24h);
      console.log(`[Test] V CI SELL total qty: ${totalVCI}, 24h BUY total qty: ${totalC24}`);

      // Step 7: Calculate P&L
      const resultados = await calculatePnL(vGrupo);
      console.log(`[Test] Resultados: ${resultados.length}`);
      resultados.forEach(r => {
        console.log(`[Test] Patron=${r.patron}, matchedQty=${r.matchedQty}, estado=${r.estado}, pnl_trade=${r.pnl_trade}`);
      });

      // Step 8: Transform to table rows (same filter as ArbitrajesView line 262)
      allTableRows = [];
      resultados.forEach((resultado) => {
        if (resultado.matchedQty > 0) {
          allTableRows.push(transformToTableRow(vGrupo, resultado));
        }
      });
      console.log(`[Test] Table rows from V: ${allTableRows.length}`);
      vRow = allTableRows.find((row) => row.patron === 'VentaCI_Compra24h');
      if (vRow) {
        console.log('[Test] V table row:', vRow);
      } else {
        console.warn('[Test] No VentaCI_Compra24h row for V!');
      }
    }
  });

  it('should have parsed V operations from CSV', () => {
    expect(parsedOperations).toBeDefined();
    const vOps = parsedOperations.filter(op => op.instrumento === 'V');
    expect(vOps.length).toBeGreaterThan(0);
    console.log(`[TEST] V operations count: ${vOps.length}`);
  });

  it('should have V CI SELL operations', () => {
    expect(vGrupo).toBeDefined();
    expect(vGrupo.ventasCI.length).toBeGreaterThan(0);
    const totalSellQty = vGrupo.ventasCI.reduce((s, o) => s + o.cantidad, 0);
    console.log(`[TEST] V CI SELL: ${vGrupo.ventasCI.length} ops, ${totalSellQty} qty`);
    expect(totalSellQty).toBe(51);
  });

  it('should have V 24h BUY operations', () => {
    expect(vGrupo).toBeDefined();
    expect(vGrupo.compras24h.length).toBeGreaterThan(0);
    const totalBuyQty = vGrupo.compras24h.reduce((s, o) => s + o.cantidad, 0);
    console.log(`[TEST] V 24h BUY: ${vGrupo.compras24h.length} ops, ${totalBuyQty} qty`);
    expect(totalBuyQty).toBe(51);
  });

  it('should produce VentaCI_Compra24h result with matchedQty > 0', () => {
    expect(vGrupo).toBeDefined();
    // This is the critical assertion - this should pass if V appears
    expect(vRow).toBeDefined();
    expect(vRow.cantidad).toBe(51);
  });

  it('should have V in the final table data', () => {
    expect(allTableRows).toBeDefined();
    expect(allTableRows.length).toBeGreaterThan(0);
    const instrumentNames = allTableRows.map(r => r.instrumento);
    console.log(`[TEST] Instruments in table: ${[...new Set(instrumentNames)].join(', ')}`);
    expect(instrumentNames).toContain('V');
  });
});
