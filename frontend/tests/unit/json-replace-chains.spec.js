/* eslint-env node, jest */
import { describe, it, expect } from 'vitest';
import { JsonDataSource } from '../../src/services/data-sources/index.js';

const AL30C_24H = 'MERV - XMEV - AL30C - 24hs';

const order = (overrides) => ({
  accountId: { id: '1' },
  instrumentId: { marketId: 'ROFX', symbol: AL30C_24H },
  ordType: 'LIMIT',
  side: 'BUY',
  timeInForce: 'DAY',
  lastPx: 0,
  lastQty: 0,
  text: ' ',
  ...overrides,
});

const totalQuantity = (rows) => rows.reduce((sum, row) => sum + row.quantity, 0);

describe('JsonDataSource: cadenas de reemplazo', () => {
  // Caso real (AL30C 24hs, compra): una orden de 300.000 se ejecutó 111.783,
  // se modificó, y la sucesora terminó con cumQty 300.000 — que ya incluye los
  // 111.783 de la original. El broker reporta 300.000, no 411.783.
  it('cuenta una vez una orden BYMA modificada tras una ejecución parcial', async () => {
    const orders = [
      order({
        orderId: 'O0TDmfe7JMnP-02501525',
        clOrdId: 'xYQAYxG5ypjY4jK1',
        execId: 'MERVE0TDmao4viGP',
        transactTime: '20261023-10:52:43.321-0300',
        price: 51.97,
        orderQty: 300000,
        cumQty: 111783,
        leavesQty: 188217,
        avgPx: 51.97,
        status: 'PARTIALLY_FILLED',
      }),
      order({
        orderId: 'O0TDmfe7JMnP-03475819',
        clOrdId: '5MIS7yem161vO9P1',
        execId: 'MERVE0TDmao4zTE0',
        transactTime: '20261023-11:00:27.956-0300',
        price: 51.99,
        orderQty: 300000,
        cumQty: 300000,
        leavesQty: 0,
        avgPx: 51.98255,
        status: 'FILLED',
      }),
    ];

    const { rows, meta } = await new JsonDataSource().parse(orders);

    expect(rows).toHaveLength(1);
    expect(rows[0].order_id).toBe('O0TDmfe7JMnP-03475819');
    expect(rows[0].quantity).toBe(300000);
    expect(rows[0].price).toBe(51.98255);
    expect(meta.excluded.supersededInChain).toBe(1);
  });

  it('se queda con el último eslabón aunque la cadena tenga varios reemplazos', async () => {
    const orders = [
      order({ orderId: 'O0TDmfe7MJ4M-01000001', clOrdId: 'a', execId: 'e1', side: 'SELL', transactTime: '20261023-12:00:00.000-0300', orderQty: 248494, cumQty: 30044, avgPx: 67.8, status: 'PARTIALLY_FILLED' }),
      order({ orderId: 'O0TDmfe7MJ4M-01000002', clOrdId: 'b', execId: 'e2', side: 'SELL', transactTime: '20261023-12:05:00.000-0300', orderQty: 248494, cumQty: 36795, avgPx: 67.763, status: 'PARTIALLY_FILLED' }),
      order({ orderId: 'O0TDmfe7MJ4M-01000003', clOrdId: 'c', execId: 'e3', side: 'SELL', transactTime: '20261023-12:10:00.000-0300', orderQty: 248494, cumQty: 36795, avgPx: 67.763, status: 'CANCELLED', text: 'CANCELED' }),
    ];

    const { rows } = await new JsonDataSource().parse(orders);

    expect(rows).toHaveLength(1);
    expect(rows[0].order_id).toBe('O0TDmfe7MJ4M-01000003');
    expect(totalQuantity(rows)).toBe(36795);
  });

  it('no junta órdenes BYMA distintas aunque sean del mismo instrumento y lado', async () => {
    const orders = [
      order({ orderId: 'O0TDmfe7LoKo-07633273', clOrdId: 'a', execId: 'e1', transactTime: '20261023-12:31:47.500-0300', orderQty: 300000, cumQty: 241724, avgPx: 51.92, status: 'CANCELLED', text: 'Cancelled by Owner' }),
      order({ orderId: 'O0TDmfe7NB3F-11660336', clOrdId: 'b', execId: 'e2', transactTime: '20261023-13:16:16.733-0300', orderQty: 282170, cumQty: 282170, avgPx: 51.99043, status: 'FILLED' }),
    ];

    const { rows } = await new JsonDataSource().parse(orders);

    expect(totalQuantity(rows)).toBe(241724 + 282170);
  });

  // En ROFX un reemplazo abre una orden nueva con su propio cumQty: la
  // original y la sucesora se suman (ver el fixture Operations-2025-10-21).
  it('suma la original y la sucesora en ROFX, donde el cumQty no se arrastra', async () => {
    const orders = [
      order({ orderId: '3327361079', clOrdId: 'a', execId: 'e1', instrumentId: { marketId: 'ROFX', symbol: 'DLR/OCT25' }, side: 'SELL', transactTime: '20251021-10:50:27.032-0300', orderQty: 24, cumQty: 6, avgPx: 1485.5, status: 'CANCELLED', text: 'Reemplazada' }),
      order({ orderId: '3327361404', clOrdId: 'b', execId: 'e2', instrumentId: { marketId: 'ROFX', symbol: 'DLR/OCT25' }, side: 'SELL', transactTime: '20251021-10:50:27.030-0300', orderQty: 18, cumQty: 18, avgPx: 1483.5, status: 'FILLED', text: 'Operada' }),
    ];

    const { rows } = await new JsonDataSource().parse(orders);

    expect(totalQuantity(rows)).toBe(24);
  });
});
