/* eslint-env node */
import { describe, it, expect } from 'vitest';

import {
  ALL_GROUP_ID,
  OPTION_OPERATION_TYPES,
  extractBaseSymbol,
  getOperationGroupId,
  getOptionInstrumentToken,
  isOptionGroup,
  splitInstrumentSymbol,
} from '../../src/services/clasificacion-instrumentos.js';

describe('clasificacion-instrumentos', () => {
  describe('extractBaseSymbol', () => {
    it('saca la especie de un símbolo completo del reporte', () => {
      expect(extractBaseSymbol('MERV - XMEV - GGAL - CI')).toBe('GGAL');
      expect(extractBaseSymbol('MERV - XMEV - S31O5 - 24hs')).toBe('S31O5');
    });

    it('recorta el token de una opción a su prefijo', () => {
      expect(extractBaseSymbol('MERV - XMEV - GFGC11000D - CI')).toBe('GFG');
    });

    it('tolera vacío y símbolos de un solo segmento', () => {
      expect(extractBaseSymbol('')).toBe('');
      expect(extractBaseSymbol('   ')).toBe('');
      expect(extractBaseSymbol('GGAL')).toBe('GGAL');
    });
  });

  describe('splitInstrumentSymbol', () => {
    it('devuelve la especie, descartando mercado y token de liquidación', () => {
      expect(splitInstrumentSymbol('MERV - XMEV - GGAL - CI')).toBe('GGAL');
      expect(splitInstrumentSymbol('MERV - XMEV - S31O5 - 24hs')).toBe('S31O5');
    });

    it('codifica el plazo de una caución como ESPECIE:plazo', () => {
      // Las cauciones llegan como PESOS - nD; el plazo sale del último token.
      expect(splitInstrumentSymbol('MERV - XMEV - PESOS - 3D')).toBe('PESOS:3');
      expect(splitInstrumentSymbol('MERV - XMEV - PESOS - 30D')).toBe('PESOS:30');
    });

    it('no explota con entrada vacía', () => {
      expect(() => splitInstrumentSymbol('')).not.toThrow();
      expect(() => splitInstrumentSymbol()).not.toThrow();
    });
  });

  describe('getOperationGroupId', () => {
    it('es estable: la misma operación da la misma clave', () => {
      const op = { symbol: 'MERV - XMEV - GGAL - CI', optionType: 'CALL', expiration: 'OC' };
      expect(getOperationGroupId(op)).toBe(getOperationGroupId({ ...op }));
    });

    it('separa operaciones de instrumentos distintos', () => {
      const a = getOperationGroupId({ symbol: 'MERV - XMEV - GGAL - CI', expiration: 'OC' });
      const b = getOperationGroupId({ symbol: 'MERV - XMEV - YPFD - CI', expiration: 'OC' });
      expect(a).not.toBe(b);
    });

    it('no explota con una operación vacía', () => {
      expect(() => getOperationGroupId({})).not.toThrow();
      expect(() => getOperationGroupId()).not.toThrow();
    });
  });

  describe('isOptionGroup', () => {
    it('reconoce un grupo con calls o puts', () => {
      expect(isOptionGroup({ counts: { calls: 2, puts: 0 } })).toBe(true);
      expect(isOptionGroup({ counts: { calls: 0, puts: 3 } })).toBe(true);
    });

    it('no considera opción a un grupo sin calls ni puts', () => {
      expect(isOptionGroup({ counts: { calls: 0, puts: 0 } })).toBe(false);
    });

    it('tolera un grupo sin counts', () => {
      expect(() => isOptionGroup({})).not.toThrow();
      expect(() => isOptionGroup()).not.toThrow();
    });
  });

  describe('getOptionInstrumentToken', () => {
    it('no explota ante una operación sin token', () => {
      expect(() => getOptionInstrumentToken({})).not.toThrow();
      expect(() => getOptionInstrumentToken()).not.toThrow();
    });
  });

  describe('constantes compartidas', () => {
    it('ALL_GROUP_ID es el sentinel único, antes definido 4 veces', () => {
      expect(ALL_GROUP_ID).toBe('__ALL__');
    });

    it('OPTION_OPERATION_TYPES cubre CALL y PUT', () => {
      expect(OPTION_OPERATION_TYPES.has('CALL')).toBe(true);
      expect(OPTION_OPERATION_TYPES.has('PUT')).toBe(true);
      expect(OPTION_OPERATION_TYPES.has('STOCK')).toBe(false);
    });
  });
});
