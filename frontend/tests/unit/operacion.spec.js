/* eslint-env node */
import { describe, it, expect } from 'vitest';

import {
  resolveCantidad,
  resolveComisiones,
  resolveFactores,
  resolveFechaHora,
  resolveLado,
  resolveOrderId,
  resolvePrecio,
  resolveSymbol,
} from '../../src/services/operacion.js';

describe('operacion', () => {
  describe('una sola precedencia de alias', () => {
    it('prefiere el campo canónico en español sobre el inglés y los FIX', () => {
      const raw = { cantidad: 1, quantity: 2, last_qty: 3, lastQty: 4 };
      expect(resolveCantidad(raw)).toBe(1);
    });

    it('cae al canónico en inglés, que es lo que emite el pipeline', () => {
      expect(resolveCantidad({ quantity: 2, last_qty: 3 })).toBe(2);
      expect(resolvePrecio({ price: 130.7, last_price: 99 })).toBe(130.7);
    });

    it('cae a los alias FIX del reporte del broker', () => {
      expect(resolveCantidad({ last_qty: 3 })).toBe(3);
      expect(resolveCantidad({ lastQty: 4 })).toBe(4);
      expect(resolvePrecio({ last_price: 5.5 })).toBe(5.5);
      expect(resolvePrecio({ lastPx: 6.5 })).toBe(6.5);
    });

    it('resuelve igual una fila de producción, donde sólo está el canónico inglés', () => {
      // Forma real de report.operations: quantity/price presentes,
      // cantidad/precio y los alias FIX ausentes.
      const fila = { quantity: 61, price: 130.7 };
      expect(resolveCantidad(fila)).toBe(61);
      expect(resolvePrecio(fila)).toBe(130.7);
    });

    it('devuelve 0 ante ausencia o basura, en lugar de NaN', () => {
      expect(resolveCantidad({})).toBe(0);
      expect(resolvePrecio({})).toBe(0);
      expect(resolveCantidad({ cantidad: 'no es un número' })).toBe(0);
    });

    it('no confunde 0 con ausente', () => {
      expect(resolveCantidad({ cantidad: 0, quantity: 99 })).toBe(0);
    });
  });

  describe('resolveSymbol', () => {
    it('prefiere originalSymbol, que es el símbolo completo del reporte', () => {
      expect(resolveSymbol({
        originalSymbol: 'MERV - XMEV - S31O5 - CI',
        symbol: 'S31O5',
      })).toBe('MERV - XMEV - S31O5 - CI');
    });

    it('acepta la forma anidada del broker', () => {
      expect(resolveSymbol({ instrumentId: { symbol: 'DLR/DIC25' } })).toBe('DLR/DIC25');
    });

    it('devuelve string vacío cuando no hay símbolo', () => {
      expect(resolveSymbol({})).toBe('');
      expect(resolveSymbol()).toBe('');
    });
  });

  describe('resolveComisiones', () => {
    it('lee comisiones o feeAmount, el rename que ya silenció un término de P&L', () => {
      expect(resolveComisiones({ comisiones: 1.5 })).toBe(1.5);
      expect(resolveComisiones({ feeAmount: 0.797 })).toBe(0.797);
      expect(resolveComisiones({})).toBe(0);
    });
  });

  describe('resolveLado y resolveOrderId', () => {
    it('resuelve el lado desde cualquiera de los tres nombres', () => {
      expect(resolveLado({ lado: 'C' })).toBe('C');
      expect(resolveLado({ side: 'SELL' })).toBe('SELL');
      expect(resolveLado({ action: 'buy' })).toBe('buy');
    });

    it('resuelve el order_id, que varias ejecuciones comparten', () => {
      expect(resolveOrderId({ order_id: 'A' })).toBe('A');
      expect(resolveOrderId({ orderId: 'B' })).toBe('B');
      expect(resolveOrderId({ clOrdId: 'C' })).toBe('C');
      expect(resolveOrderId({ id: 'D' })).toBe('D');
    });
  });

  describe('resolveFechaHora', () => {
    it('busca también en el objeto raw anidado de las filas ya procesadas', () => {
      expect(resolveFechaHora({ raw: { transact_time: '2026-06-25T14:34:43Z' } }))
        .toBe('2026-06-25T14:34:43Z');
    });

    it('el campo de primer nivel gana sobre el anidado', () => {
      expect(resolveFechaHora({
        transact_time: 'arriba',
        raw: { transact_time: 'abajo' },
      })).toBe('arriba');
    });
  });

  describe('resolveFactores', () => {
    it('aplica los factores del instrumento una sola vez', () => {
      const lookup = () => ({ priceConversionFactor: 100, contractMultiplier: 1 });
      const { priceConversionFactor, contractMultiplier } = resolveFactores(
        { symbol: 'MERV - XMEV - TX26 - CI' },
        lookup,
      );
      expect(priceConversionFactor).toBe(100);
      expect(contractMultiplier).toBe(1);
    });

    it('usa instrumentDetails de la fila si ya viene resuelto', () => {
      const { priceConversionFactor } = resolveFactores(
        { symbol: 'X', instrumentDetails: { priceConversionFactor: 5 } },
        () => ({ priceConversionFactor: 999 }),
      );
      expect(priceConversionFactor).toBe(5);
    });

    it('cae a 1 cuando el instrumento no se encuentra, sin romper', () => {
      const { instrumentDetails, priceConversionFactor, contractMultiplier } =
        resolveFactores({ symbol: 'NO EXISTE' }, () => null);
      expect(instrumentDetails).toBeNull();
      expect(priceConversionFactor).toBe(1);
      expect(contractMultiplier).toBe(1);
    });
  });
});
