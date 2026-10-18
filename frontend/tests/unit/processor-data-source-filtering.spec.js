/**
 * Filtrado por fuente de datos.
 *
 * Antes este spec no importaba nada de `src/`: re-escribía el predicado dentro
 * del test y asserteaba sobre su propia copia, así que el de producción podía
 * cambiar y seguía verde. Ahora ejercita `filtrarPorFuente`, que es el que usa
 * `ProcessorScreen`.
 */
/* eslint-env node */
import { describe, it, expect } from 'vitest';

import { FUENTES, filtrarPorFuente } from '../../src/services/operacion.js';

const operaciones = [
  { id: '1', symbol: 'GGAL', source: 'broker', quantity: 100 },
  { id: '2', symbol: 'YPF', source: 'csv', quantity: 50 },
  { id: '3', symbol: 'PAMP', source: 'broker', quantity: 200 },
  { id: '4', symbol: 'ALUA', source: 'csv', quantity: 75 },
];

describe('filtrarPorFuente', () => {
  it('devuelve sólo las operaciones del broker', () => {
    const soloBroker = filtrarPorFuente(operaciones, FUENTES.BROKER);
    expect(soloBroker.map((op) => op.symbol)).toEqual(['GGAL', 'PAMP']);
  });

  it('devuelve sólo las operaciones de CSV', () => {
    const soloCsv = filtrarPorFuente(operaciones, FUENTES.CSV);
    expect(soloCsv.map((op) => op.symbol)).toEqual(['YPF', 'ALUA']);
  });

  it('excluye operaciones sin fuente o con fuente nula', () => {
    const mezcla = [
      { id: '1', source: 'broker' },
      { id: '2' },
      { id: '3', source: null },
    ];
    expect(filtrarPorFuente(mezcla, FUENTES.BROKER)).toHaveLength(1);
    expect(filtrarPorFuente(mezcla, FUENTES.CSV)).toHaveLength(0);
  });

  it('tolera entradas vacías o no-array', () => {
    expect(filtrarPorFuente([], FUENTES.BROKER)).toEqual([]);
    expect(filtrarPorFuente(undefined, FUENTES.BROKER)).toEqual([]);
    expect(filtrarPorFuente(null, FUENTES.CSV)).toEqual([]);
  });

  it('no matchea una fuente desconocida', () => {
    expect(filtrarPorFuente(operaciones, 'otra')).toEqual([]);
  });
});
