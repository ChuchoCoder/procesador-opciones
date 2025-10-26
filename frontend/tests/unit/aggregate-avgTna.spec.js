/* eslint-env node, jest */
import { describe, it, expect } from 'vitest';
import { aggregateByInstrumentoPlazo, calculateAvgTNAByCurrency } from '../../src/services/data-aggregation.js';
import { VENUES, LADOS } from '../../src/services/arbitrage-types.js';

describe('aggregateByInstrumentoPlazo - avgTNA propagation', () => {
  it('sets grupo.avgTNA based on currency mapping and does not attach cauciones', () => {
    const jornada = new Date('2025-10-20T00:00:00Z');

    // Create two operations for instrument XYZ: one CI sell and one 24h buy
    const ops = [
      {
        id: 'op1',
        order_id: 'o1',
        instrumento: 'XYZ',
        lado: LADOS.VENTA,
        fechaHora: new Date('2025-10-20T10:00:00Z'),
        cantidad: 100,
        precio: 10,
        comisiones: 1,
        venue: VENUES.CI,
      },
      {
        id: 'op2',
        order_id: 'o2',
        instrumento: 'XYZ',
        lado: LADOS.COMPRA,
        fechaHora: new Date('2025-10-20T12:00:00Z'),
        cantidad: 100,
        precio: 9.5,
        comisiones: 1,
        venue: VENUES.H24,
      },
    ];

    // Cauciones across two currencies
    const cauciones = [
      { id: 'c1', instrumento: 'PESOS', monto: 1000, tasa: 80, currency: 'ARS' },
      { id: 'c2', instrumento: 'PESOS', monto: 500, tasa: 100, currency: 'ARS' },
      { id: 'c3', instrumento: 'PESOS', monto: 200, tasa: 10, currency: 'USD' },
      { id: 'c4', instrumento: 'PESOS', monto: 300, tasa: 12, currency: 'USD' },
    ];

    const avgMap = calculateAvgTNAByCurrency(cauciones);

    // Call aggregator with precomputed map
    const grupos = aggregateByInstrumentoPlazo(ops, cauciones, jornada, avgMap);

    // Expect one grupo for XYZ with plazo determined by earliest CI->24h mapping
  // Depending on calculateCIto24hsPlazo, plazo may be 0; we primarily assert avgTNA and cauciones
    const grupo = Array.from(grupos.values()).find(g => g.instrumento === 'XYZ');
    expect(grupo).toBeDefined();
    // Instrument mapping default currency is ARS in absence of instrument mapping; avgMap contains ARS
    expect(grupo.avgTNA).toBeCloseTo(avgMap.ARS, 6);
    // Ensure grupo.cauciones is empty (we don't attach explicit cauciones)
    expect(Array.isArray(grupo.cauciones)).toBe(true);
    expect(grupo.cauciones.length).toBe(0);
  });

  it('computes avgTNA internally if mapping not provided and behaves the same', () => {
    const jornada = new Date('2025-10-20T00:00:00Z');
    const ops = [
      { id: 'o1', order_id: 'o1', instrumento: 'ABC', lado: LADOS.VENTA, fechaHora: new Date(), cantidad: 10, precio: 1, comisiones: 0, venue: VENUES.CI },
      { id: 'o2', order_id: 'o2', instrumento: 'ABC', lado: LADOS.COMPRA, fechaHora: new Date(), cantidad: 10, precio: 0.9, comisiones: 0, venue: VENUES.H24 },
    ];
    const cauciones = [{ id: 'c', instrumento: 'PESOS', monto: 100, tasa: 50, currency: 'ARS' }];

    const gruposWithMap = aggregateByInstrumentoPlazo(ops, cauciones, jornada, calculateAvgTNAByCurrency(cauciones));
    const gruposNoMap = aggregateByInstrumentoPlazo(ops, cauciones, jornada);

    const g1 = Array.from(gruposWithMap.values()).find(g => g.instrumento === 'ABC');
    const g2 = Array.from(gruposNoMap.values()).find(g => g.instrumento === 'ABC');

    expect(g1).toBeDefined();
    expect(g2).toBeDefined();
    expect(g1.avgTNA).toBeCloseTo(g2.avgTNA, 6);
    expect(g1.cauciones.length).toBe(0);
    expect(g2.cauciones.length).toBe(0);
  });
});
