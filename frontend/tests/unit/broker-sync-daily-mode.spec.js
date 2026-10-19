/**
 * La línea de base con la que arranca una sincronización.
 *
 * Este spec no importaba nada de `src/`: re-escribía el filtro dentro del test,
 * cinco veces, y asserteaba sobre su propia copia. Y esa copia afirmaba lo
 * **contrario** de lo que hace producción:
 *
 *     // la copia del test
 *     if (op.source === 'csv') return true;
 *     return opTimestamp >= todayStart;      // conservaba broker de hoy
 *
 *     // producción (sync-service, modo daily)
 *     lista.filter((op) => op?.source === 'csv')   // descarta TODO el broker
 *
 * Es decir: 21 aserciones en verde sobre una regla que la app no tiene. Ahora
 * ejercita `filtrarLineaDeBase`, que es la que usa `startDailySync`.
 */
/* eslint-env node */
import { describe, it, expect } from 'vitest';

import { DAILY_MODE, filtrarLineaDeBase } from '../../src/services/broker/sync-service.js';

const REFRESH = 'refresh';

const unDia = 24 * 60 * 60 * 1000;
const hoy = Date.now();
const ayer = hoy - unDia;

const operaciones = [
  { id: '1', symbol: 'GGAL', source: 'broker', tradeTimestamp: ayer, quantity: 100 },
  { id: '2', symbol: 'YPF', source: 'broker', tradeTimestamp: hoy, quantity: 50 },
  { id: '3', symbol: 'PAMP', source: 'csv', tradeTimestamp: ayer, quantity: 200 },
  { id: '4', symbol: 'ALUA', source: 'csv', tradeTimestamp: hoy, quantity: 75 },
];

describe('filtrarLineaDeBase', () => {
  describe('modo daily: arranca de cero por el lado del broker', () => {
    it('descarta TODAS las operaciones del broker, incluidas las de hoy', () => {
      const base = filtrarLineaDeBase(operaciones, DAILY_MODE);

      // Esto es lo que el spec viejo negaba: la de hoy tampoco sobrevive.
      expect(base.every((op) => op.source === 'csv')).toBe(true);
      expect(base.map((op) => op.symbol)).toEqual(['PAMP', 'ALUA']);
    });

    it('conserva las de CSV sin importar la fecha', () => {
      const base = filtrarLineaDeBase(operaciones, DAILY_MODE);
      const ayerCsv = base.find((op) => op.symbol === 'PAMP');

      expect(ayerCsv).toBeDefined();
      expect(ayerCsv.tradeTimestamp).toBe(ayer);
    });

    it('con sólo operaciones del broker deja la base vacía', () => {
      const soloBroker = operaciones.filter((op) => op.source === 'broker');
      expect(filtrarLineaDeBase(soloBroker, DAILY_MODE)).toEqual([]);
    });

    it('descarta operaciones sin fuente', () => {
      const base = filtrarLineaDeBase([{ id: 'x' }, { id: 'y', source: null }], DAILY_MODE);
      expect(base).toEqual([]);
    });

    it('es el modo por defecto', () => {
      expect(filtrarLineaDeBase(operaciones)).toEqual(
        filtrarLineaDeBase(operaciones, DAILY_MODE),
      );
    });
  });

  describe('modo refresh: conserva todo para el dedupe incremental', () => {
    it('no descarta nada', () => {
      const base = filtrarLineaDeBase(operaciones, REFRESH);
      expect(base).toHaveLength(operaciones.length);
      expect(base.map((op) => op.symbol)).toEqual(['GGAL', 'YPF', 'PAMP', 'ALUA']);
    });

    it('conserva las del broker, que es lo que el dedupe necesita', () => {
      const base = filtrarLineaDeBase(operaciones, REFRESH);
      expect(base.filter((op) => op.source === 'broker')).toHaveLength(2);
    });
  });

  describe('robustez', () => {
    it('tolera entradas vacías o no-array', () => {
      expect(filtrarLineaDeBase([], DAILY_MODE)).toEqual([]);
      expect(filtrarLineaDeBase(undefined, DAILY_MODE)).toEqual([]);
      expect(filtrarLineaDeBase(null, REFRESH)).toEqual([]);
    });

    it('no muta la lista que recibe', () => {
      const original = [...operaciones];
      filtrarLineaDeBase(operaciones, DAILY_MODE);
      expect(operaciones).toEqual(original);
    });
  });
});
