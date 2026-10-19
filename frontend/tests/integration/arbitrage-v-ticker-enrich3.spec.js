/**
 * El falso positivo del ticker V, y por qué el gate de CfiCode es necesario.
 *
 * Este archivo era una sesión de debug commiteada como spec: 87 líneas, **cero
 * aserciones**, todo `console.log`, y con `OPTION_TOKEN_REGEX` más el tokenizer
 * copiados de `process-operations.js` en lugar de importados. No podía fallar.
 *
 * Lo que estaba investigando sí vale un test, así que es lo que afirma ahora:
 * `MERV - XMEV - V - 24hs` es la **acción** V a 24 horas, pero su forma
 * colapsada `MERVXMEVV24HS` matchea el regex de tokens de opción, leyendo la
 * `V` del ticker como marca de PUT y el `24` de "24hs" como strike.
 */
/* eslint-env node */
import { describe, it, expect, beforeAll } from 'vitest';

import { parseToken } from '../../src/services/csv/process-operations.js';
import { loadEnrichedOperations } from './helpers/arbitrage-pipeline.js';

describe('ticker V: falso positivo de token de opción', () => {
  describe('parseToken, aislado', () => {
    it('matchea la forma colapsada de la acción V a 24hs (el falso positivo)', () => {
      const resultado = parseToken('MERVXMEVV24HS');

      // Esto NO es un bug de parseToken: es su trabajo, reconocer la forma de un
      // token de opción. El problema sería confiarle la clasificación.
      expect(resultado).not.toBeNull();
      expect(resultado.type).toBe('PUT');
      expect(resultado.strike).toBe(24);
    });

    it('no matchea la forma de la misma acción a CI', () => {
      // Sin el "24" no hay nada que parezca strike.
      expect(parseToken('MERVXMEVVCI')).toBeNull();
      expect(parseToken('V')).toBeNull();
    });

    it('sí reconoce opciones de verdad', () => {
      expect(parseToken('GFGC11000D')).toMatchObject({
        symbol: 'GFG', type: 'CALL', strike: 11000,
      });
      expect(parseToken('GFGV5000O')).toMatchObject({
        symbol: 'GFG', type: 'PUT', strike: 5000,
      });
    });

    it('no matchea un bono que termina en C', () => {
      // AL30C es un bono, no un call. Misma familia de confusión.
      expect(parseToken('AL30C')).toBeNull();
    });
  });

  describe('el pipeline completo no se deja engañar', () => {
    let filasV;

    beforeAll(async () => {
      const operaciones = await loadEnrichedOperations('arbitrage-V-ticker.csv');
      filasV = operaciones.filter((op) => String(op.symbol ?? '').includes(' - V - '));
      expect(filasV.length).toBeGreaterThan(0);
    }, 60000);

    it('clasifica la V como acción, no como opción', () => {
      filasV.forEach((op) => {
        expect(op.optionType).not.toBe('CALL');
        expect(op.optionType).not.toBe('PUT');
        expect(op.category).toBe('accionCedear');
      });
    });

    it('no le deja un strike inventado', () => {
      // Regresión: el gate de CfiCode rechazaba el tipo pero el strike 24 del
      // falso positivo sobrevivía hasta la operación final.
      filasV.forEach((op) => {
        expect(op.strike, `strike fantasma en ${op.symbol}`).toBeFalsy();
      });
    });

    it('conserva el venue, que es lo que distingue CI de 24hs', () => {
      const venues = new Set(filasV.map((op) => op.symbol.split(' - ').pop()));
      expect(venues.size).toBeGreaterThan(1);
    });
  });
});
