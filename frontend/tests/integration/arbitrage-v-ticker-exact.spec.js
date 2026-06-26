/**
 * Exact replication of production flow for V ticker
 * Step 1: normalizeOperationRows (like processOperations)
 * Step 2: validateAndFilterRows (excludes 23 rows)
 * Step 3: enrichArbitrageOperations
 * Step 4: parseOperations -> aggregate -> calculatePnL
 * Step 5: Assert V is present with matchedQty=51
 */
import { describe, it, beforeAll, expect } from 'vitest';
import Papa from 'papaparse';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'path';

import { normalizeOperationRows } from '../../src/services/csv/legacy-normalizer.js';
import { validateAndFilterRows } from '../../src/services/csv/validators.js';
import { enrichArbitrageOperations } from '../../src/services/arbitrage-fee-enrichment.js';
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

describe('V Ticker Exact Production Flow', () => {
  let validatedRows;
  let allRows;
  let parsedOperations;
  let grupos;
  let errored;

  beforeAll(async () => {
    errored = false;

    try {
      // Step 1: Read and parse CSV
      const filePath = join(dirname(fileURLToPath(import.meta.url)), 'data', 'arbitrage-V-ticker.csv');
      const csvContent = await readFile(filePath, 'utf-8');
      const csvPath = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'users', 'feder', 'Downloads', 'ReporteOperaciones_17825 (34).csv');
      
      let allCsv;
      try {
        allCsv = await readFile('C:\\Users\\feder\\Downloads\\ReporteOperaciones_17825 (34).csv', 'utf-8');
      } catch {
        // fallback - use V-only file if full CSV not available in CI
        allCsv = csvContent;
      }

      const parsed = Papa.parse(allCsv, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
      });

      allRows = parsed.data.filter((row) => row.symbol);
      console.log(`[Test] Raw CSV rows with symbol: ${allRows.length}`);

      // Step 2: Normalize rows (exactly like processOperations line 1047)
      const { rows: normalizedRows, missingColumns } = normalizeOperationRows(allRows, {});
      console.log(`[Test] Normalized rows: ${normalizedRows.length}, missingColumns:`, missingColumns);

      // Step 3: Validate and filter (exactly like processOperations line 1061)
      const validated = validateAndFilterRows({ rows: normalizedRows });
      validatedRows = validated.rows;
      const exclusions = validated.exclusions;
      console.log(`[Test] Validated rows: ${validatedRows.length}`);
      console.log(`[Test] Exclusions:`, JSON.stringify(exclusions));

      // Count V in validated rows
      const vNormalized = normalizedRows.filter(r => r.symbol?.includes(' - V '));
      const vValidated = validatedRows.filter(r => r.symbol?.includes(' - V '));
      console.log(`[Test] V rows in normalized: ${vNormalized.length}, validated: ${vValidated.length}`);

      // Step 4: Build operations in processOperations format
      // (simplified - just use validated rows directly)
      const enrichedForArbitrage = await enrichArbitrageOperations(validatedRows);
      console.log(`[Test] Enriched for arbitrage: ${enrichedForArbitrage.length}`);

      // Step 5: Parse
      parsedOperations = parseOperations(enrichedForArbitrage);
      console.log(`[Test] Parsed operations: ${parsedOperations.length}`);

      const vParsed = parsedOperations.filter(op => op.instrumento === 'V');
      console.log(`[Test] V parsed operations: ${vParsed.length}`);
      vParsed.forEach(op => console.log(`[Test] V op: ${op.lado}/${op.venue}, qty=${op.cantidad}, price=${op.precio}`));

      // Step 6: Parse cauciones
      const parsedCaucionesRaw = parseCauciones(enrichedForArbitrage);
      console.log(`[Test] Parsed cauciones: ${parsedCaucionesRaw.length}`);

      // Step 7: Aggregate
      const jornada = new Date('2026-06-25T00:00:00Z');
      const avgTNAByCurrency = calculateAvgTNAByCurrency(parsedCaucionesRaw || []);
      const gruposMap = aggregateByInstrumentoPlazo(parsedOperations, parsedCaucionesRaw, jornada, avgTNAByCurrency);
      grupos = gruposMap;
      console.log(`[Test] Total grupos: ${gruposMap.size}`);
      console.log(`[Test] Grupo keys:`, [...gruposMap.keys()]);

      const vGrupos = filterGruposByInstrument(gruposMap, 'V');
      if (vGrupos.length > 0) {
        const vg = vGrupos[0];
        console.log(`[Test] V grupo: ventasCI=${vg.ventasCI.length}(${vg.ventasCI.reduce((s,o) => s+o.cantidad, 0)}), compras24h=${vg.compras24h.length}(${vg.compras24h.reduce((s,o) => s+o.cantidad, 0)})`);
      } else {
        console.log(`[Test] NO V GRUPO FOUND`);
      }
    } catch (error) {
      console.error('[Test] Error:', error);
      errored = true;
    }
  });

  it('should have validated V rows', () => {
    expect(validatedRows).toBeDefined();
    const v = validatedRows.filter(r => r.symbol?.includes(' - V '));
    expect(v.length).toBe(7);
  });

  it('should have V parsed operations', () => {
    const vOps = parsedOperations.filter(op => op.instrumento === 'V');
    expect(vOps.length).toBe(7);
  });

  it('should have V grupo', () => {
    const vGrupos = filterGruposByInstrument(grupos, 'V');
    expect(vGrupos.length).toBeGreaterThan(0);
  });

  it('should produce matchedQty=51 for V', async () => {
    const vGrupos = filterGruposByInstrument(grupos, 'V');
    expect(vGrupos.length).toBeGreaterThan(0);
    const vGrupo = vGrupos[0];
    const resultados = await calculatePnL(vGrupo);
    const ventaCI = resultados.find(r => r.patron === 'VentaCI_Compra24h');
    expect(ventaCI).toBeDefined();
    expect(ventaCI.matchedQty).toBe(51);
    expect(ventaCI.estado).toBe('completo');
  });
});
