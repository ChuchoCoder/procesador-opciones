/**
 * Integration test for Arbitrage de Plazos feature
 * Tests data transformation and P&L calculation with real CSV data
 */

import { describe, it, expect } from 'vitest';
import { parseOperations, parseCauciones } from '../../src/services/data-aggregation.js';
import { aggregateByInstrumentoPlazo, filterGruposByInstrument } from '../../src/services/data-aggregation.js';
import { calculatePnL } from '../../src/services/pnl-calculations.js';
import { VENUES, LADOS } from '../../src/services/arbitrage-types.js';
import { calculateCIto24hsPlazo, addBusinessDays } from '../../src/services/business-days.js';

describe('Arbitrage de Plazos Integration', () => {
  // Sample operations from ArbitrajePlazos.csv - S31O5 arbitrage
  const rawOperations = [
    {
      id: '6c9b2088-901f-44c6-b670-afe6c0e19cf3',
      symbol: 'MERV - XMEV - S31O5 - CI',
      side: 'SELL',
      transact_time: '2025-10-17 14:20:03.021000Z',
      last_qty: 61,
      last_price: 130.7,
    },
    {
      id: 'd3c96d7c-27ea-4745-92f2-f8a966836191',
      symbol: 'MERV - XMEV - S31O5 - 24hs',
      side: 'BUY',
      transact_time: '2025-10-17 14:20:03.157000Z',
      last_qty: 61,
      last_price: 130.91,
    },
    {
      id: '24751dcd-91be-47ab-93be-e1a051c61305',
      symbol: 'MERV - XMEV - S31O5 - CI',
      side: 'SELL',
      transact_time: '2025-10-17 14:20:05.355000Z',
      last_qty: 1000000,
      last_price: 130.7,
    },
    {
      id: 'bbc6d873-9dcd-4566-9735-984695f48003',
      symbol: 'MERV - XMEV - S31O5 - 24hs',
      side: 'BUY',
      transact_time: '2025-10-17 14:20:05.474000Z',
      last_qty: 1000000,
      last_price: 130.91,
    },
  ];

  // Sample caución operations from ArbitrajePlazos.csv - PESOS cauciones
  const rawCauciones = [
    {
      id: '7cf595a8-9cd0-433e-9016-d92bbaa795e5',
      symbol: 'MERV - XMEV - PESOS - 3D',
      side: 'BUY',
      transact_time: '2025-10-17 14:14:25.233000Z',
      last_qty: 567616,
      last_price: 30.26,
    },
    {
      id: '9a192149-65d4-465d-942f-81ef40ddf9a8',
      symbol: 'MERV - XMEV - PESOS - 3D',
      side: 'SELL',
      transact_time: '2025-10-17 14:44:47.972000Z',
      last_qty: 10000000,
      last_price: 31.51,
    },
  ];

  describe('Data Transformation', () => {
    it('should parse operations with venue extraction', () => {
      const operations = parseOperations(rawOperations);

      expect(operations).toHaveLength(4);
      
      // Check first CI operation
      const firstCI = operations.find(op => op.id === '6c9b2088-901f-44c6-b670-afe6c0e19cf3');
      expect(firstCI).toBeDefined();
      expect(firstCI.instrumento).toBe('S31O5');
      expect(firstCI.venue).toBe(VENUES.CI);
      expect(firstCI.lado).toBe(LADOS.VENTA);
      expect(firstCI.cantidad).toBe(61);
  expect(firstCI.precio).toBeCloseTo(130.7 * 0.01, 6);

      // Check first 24hs operation
      const first24hs = operations.find(op => op.id === 'd3c96d7c-27ea-4745-92f2-f8a966836191');
      expect(first24hs).toBeDefined();
      expect(first24hs.instrumento).toBe('S31O5');
      expect(first24hs.venue).toBe(VENUES.H24);
      expect(first24hs.lado).toBe(LADOS.COMPRA);
      expect(first24hs.cantidad).toBe(61);
  expect(first24hs.precio).toBeCloseTo(130.91 * 0.01, 6);
    });

    it('should extract instrument name correctly from various symbol formats', () => {
      const testCases = [
        { symbol: 'MERV - XMEV - S31O5 - CI', expected: 'S31O5' },
        { symbol: 'MERV - XMEV - S31O5 - 24hs', expected: 'S31O5' },
        { symbol: 'MERV - XMEV - TZXM6 - CI', expected: 'TZXM6' },
        { symbol: 'MERV - XMEV - AL30D - CI', expected: 'AL30D' },
        { symbol: 'S31O5', expected: 'S31O5' }, // Simple format
      ];

      testCases.forEach(({ symbol, expected }) => {
        const operations = parseOperations([{ id: '1', symbol, side: 'BUY', last_qty: 100, last_price: 1 }]);
        expect(operations[0].instrumento).toBe(expected);
      });
    });

    it('should detect venue from symbol suffix', () => {
      const testCases = [
        { symbol: 'MERV - XMEV - S31O5 - CI', expected: VENUES.CI },
        { symbol: 'MERV - XMEV - S31O5 - 24hs', expected: VENUES.H24 },
        { symbol: 'MERV - XMEV - S31O5 - 24h', expected: VENUES.H24 },
        { symbol: 'S31O5 - CI', expected: VENUES.CI },
        { symbol: 'S31O5', expected: VENUES.CI }, // Default to CI
      ];

      testCases.forEach(({ symbol, expected }) => {
        const operations = parseOperations([{ id: '1', symbol, side: 'BUY', last_qty: 100, last_price: 1 }]);
        expect(operations[0].venue).toBe(expected);
      });
    });
  });

  describe('Caución Parsing', () => {
    it('should parse PESOS operations as cauciones', () => {
      const cauciones = parseCauciones(rawCauciones);

      expect(cauciones).toHaveLength(2);
      
      // Check first caución (BUY = colocadora)
      const firstCaucion = cauciones[0];
      expect(firstCaucion.instrumento).toBe('PESOS');
      expect(firstCaucion.tenorDias).toBe(3);
      expect(firstCaucion.tipo).toBe('colocadora');
      expect(firstCaucion.monto).toBeGreaterThan(0);
      
      // Check second caución (SELL = tomadora)
      const secondCaucion = cauciones[1];
      expect(secondCaucion.tipo).toBe('tomadora');
      expect(secondCaucion.tenorDias).toBe(3);
    });

    it('should not include PESOS operations in regular operations', () => {
      const operations = parseOperations(rawCauciones);
      
      // PESOS operations should be filtered out
      expect(operations).toHaveLength(0);
    });

    it('should extract plazo from symbol correctly', () => {
      const testCases = [
        { symbol: 'MERV - XMEV - PESOS - 3D', expectedPlazo: 3 },
        { symbol: 'MERV - XMEV - PESOS - 18D', expectedPlazo: 18 },
        { symbol: 'PESOS - 7D', expectedPlazo: 7 },
      ];

      testCases.forEach(({ symbol, expectedPlazo }) => {
        const cauciones = parseCauciones([{ 
          id: '1', 
          symbol, 
          side: 'BUY', 
          last_qty: 1000, 
          last_price: 30,
          transact_time: '2025-10-17 14:00:00Z',
        }]);
        expect(cauciones[0].tenorDias).toBe(expectedPlazo);
      });
    });
  });

  describe('Business Days Calculation', () => {
    it('should calculate 3-day plazo for Friday CI operation (weekend included)', () => {
      // October 17, 2025 is a Friday
      const friday = new Date('2025-10-17T14:00:00Z');
      const plazo = calculateCIto24hsPlazo(friday);
      
      // 24hs settlement is next business day = Monday (3 calendar days)
      expect(plazo).toBe(3);
    });

    it('should calculate 1-day plazo for Thursday CI operation', () => {
      // Thursday operation, 24hs settles Friday (1 calendar day)
      const thursday = new Date('2025-10-16T14:00:00Z');
      const plazo = calculateCIto24hsPlazo(thursday);
      
      expect(plazo).toBe(1);
    });

    it('should skip weekends when calculating next business day', () => {
      // Friday
      const friday = new Date('2025-10-17T14:00:00Z');
      const nextBusinessDay = addBusinessDays(friday, 1);
      
      // Should be Monday (Oct 20)
      expect(nextBusinessDay.getDate()).toBe(20);
      expect(nextBusinessDay.getDay()).toBe(1); // Monday
    });
  });

  describe('Data Aggregation', () => {
    it('should group operations by instrument and calculate plazo correctly', () => {
      const operations = parseOperations(rawOperations);
      const jornada = new Date('2025-10-17');
      
      const grupos = aggregateByInstrumentoPlazo(operations, [], jornada);

      expect(grupos.size).toBeGreaterThan(0);
      
      // Should have S31O5 with plazo 3 (Friday to Monday = 3 calendar days)
      const keys = Array.from(grupos.keys());
      expect(keys.some(key => key.includes('S31O5'))).toBe(true);
      
      // Check that plazo is calculated correctly (3 days for Friday operation)
      const s31o5Key = keys.find(k => k.startsWith('S31O5'));
      expect(s31o5Key).toBe('S31O5:3');
    });

    it('should classify operations by venue and side', () => {
      const operations = parseOperations(rawOperations);
      const jornada = new Date('2025-10-17');
      
      const grupos = aggregateByInstrumentoPlazo(operations, [], jornada);
      const s31o5Grupo = Array.from(grupos.values()).find(g => g.instrumento === 'S31O5');

      expect(s31o5Grupo).toBeDefined();
      expect(s31o5Grupo.ventasCI.length).toBe(2); // 2 SELL CI operations
      expect(s31o5Grupo.compras24h.length).toBe(2); // 2 BUY 24hs operations
    });
  });

  describe('P&L Calculation', () => {
    it('should calculate P&L for VentaCI_Compra24h pattern', () => {
      const operations = parseOperations(rawOperations);
      const jornada = new Date('2025-10-17');
      
      const grupos = aggregateByInstrumentoPlazo(operations, [], jornada);
      const s31o5Grupo = Array.from(grupos.values()).find(g => g.instrumento === 'S31O5');

      expect(s31o5Grupo).toBeDefined();

      const resultados = calculatePnL(s31o5Grupo);

      expect(resultados.length).toBeGreaterThan(0);
      
      // Should find VentaCI_Compra24h pattern
      const ventaCICompra24h = resultados.find(r => r.patron === 'VentaCI_Compra24h');
      expect(ventaCICompra24h).toBeDefined();
      
      // Check matched quantity (min of ventas CI and compras 24h)
  expect(ventaCICompra24h.matchedQty).toBeCloseTo(999258.2294, 1); // Total matched using price-adjusted notional
      
      // Check P&L trade is calculated (should be negative: buying higher than selling)
      // Sell at 130.7, buy at 130.91 = loss of 0.21 per unit
      expect(ventaCICompra24h.pnl_trade).toBeLessThan(0);
      
      // P&L total should equal P&L trade (no cauciones in this test)
      expect(ventaCICompra24h.pnl_total).toBe(ventaCICompra24h.pnl_trade);
    });

    it('should handle operations without cauciones', () => {
      const operations = parseOperations(rawOperations);
      const jornada = new Date('2025-10-17');
      
      const grupos = aggregateByInstrumentoPlazo(operations, [], jornada);
      const s31o5Grupo = Array.from(grupos.values()).find(g => g.instrumento === 'S31O5');

      const resultados = calculatePnL(s31o5Grupo);
      const ventaCICompra24h = resultados.find(r => r.patron === 'VentaCI_Compra24h');

      expect(ventaCICompra24h.pnl_caucion).toBe(0);
      expect(ventaCICompra24h.estado).toMatch(/matched_sin_caucion|sin_caucion/);
    });
  });

  describe('Instrument Filtering', () => {
    it('should filter grupos by instrument', () => {
      const operations = parseOperations(rawOperations);
      const jornada = new Date('2025-10-17');
      
      const grupos = aggregateByInstrumentoPlazo(operations, [], jornada);
      const filtered = filterGruposByInstrument(grupos, 'S31O5');

      expect(filtered.length).toBeGreaterThan(0);
      expect(filtered.every(g => g.instrumento === 'S31O5')).toBe(true);
    });

    it('should return all grupos when filtering by "all"', () => {
      const operations = parseOperations(rawOperations);
      const jornada = new Date('2025-10-17');
      
      const grupos = aggregateByInstrumentoPlazo(operations, [], jornada);
      const filtered = filterGruposByInstrument(grupos, 'all');

      expect(filtered.length).toBe(grupos.size);
    });
  });
});
