/* eslint-env node, jest */
import { describe, it, expect } from 'vitest';

import {
  detectOperationsReportFormat,
  normalizeHistoricalOperationRows,
} from '../../src/services/csv/report-format.js';

describe('report format detection', () => {
  it('detects the historical broker report schema', () => {
    const rows = [
      {
        id: '86619126',
        timestamp: 1781703070369,
        status: 'PENDING_NEW',
        account: '17825',
        symbol: 'MERV - XMEV - MSFT - CI',
        side: 'SELL',
        price: '19660',
        size: '100',
        operatedSize: '',
        accumulatedSize: '',
        leavesSize: '',
        clientOrderId: '520263070003496',
        serverOrderId: '',
        originalClientOrderId: '',
      },
    ];

    expect(detectOperationsReportFormat(rows)).toBe('historical');
  });

  it('detects the daily execution report schema', () => {
    const rows = [
      {
        id: 'abc',
        order_id: '01K721W6C75ECWD0NBWTPAJH5W',
        account: '17825',
        security_id: 'bm_MERV_GFGV47343O_24hs',
        symbol: 'MERV - XMEV - GFGV47343O - 24hs',
        transact_time: '2025-10-21 13:58:06.287000Z',
        side: 'SELL',
        ord_type: 'LIMIT',
        order_price: 330,
        order_size: 12,
        exec_inst: null,
        time_in_force: 'DAY',
        expire_date: '',
        stop_px: null,
        last_cl_ord_id: '8Y3zMkiajyuATzL',
        text: '',
        exec_type: 'F',
        ord_status: 'Ejecutada',
        last_price: 330,
        last_qty: 12,
        avg_price: 330,
        cum_qty: 12,
        leaves_qty: 0,
        event_subtype: 'execution_report',
      },
    ];

    expect(detectOperationsReportFormat(rows)).toBe('daily');
  });
});

describe('historical report normalization', () => {
  it('keeps only execution rows and maps partial fills using the executed delta', () => {
    const rows = [
      {
        id: '86619126',
        timestamp: 1781703070369,
        status: 'NEW',
        account: '17825',
        symbol: 'MERV - XMEV - MSFT - CI',
        side: 'SELL',
        price: '19660',
        size: '100',
        operatedSize: '0',
        accumulatedSize: '',
        clientOrderId: '520263070003496',
        serverOrderId: '',
        originalClientOrderId: '',
      },
      {
        id: '86619128',
        timestamp: 1781703070421,
        status: 'PARTIALLY_FILLED',
        account: '17825',
        symbol: 'MERV - XMEV - MSFT - CI',
        side: 'SELL',
        price: '19660',
        size: '100',
        operatedSize: '15',
        accumulatedSize: '10',
        leavesSize: '85',
        clientOrderId: '520263070003496',
        serverOrderId: 'O0RixYVC5H0C-00050987',
        originalClientOrderId: '',
        orderType: 'LIMIT',
      },
      {
        id: '86619129',
        timestamp: 1781703070521,
        status: 'FILLED',
        account: '17825',
        symbol: 'MERV - XMEV - MSFT - CI',
        side: 'SELL',
        price: '19670',
        size: '100',
        operatedSize: '100',
        accumulatedSize: '85',
        leavesSize: '0',
        clientOrderId: '520263070003497',
        serverOrderId: 'O0RixYVC5H0C-00050987',
        originalClientOrderId: '',
        orderType: 'LIMIT',
      },
      {
        id: '86619169',
        timestamp: 1781703072176,
        status: 'CANCELLED',
        account: '17825',
        symbol: 'MERV - XMEV - MSFT - CI',
        side: 'SELL',
        price: '',
        size: '100',
        operatedSize: '',
        accumulatedSize: '',
        clientOrderId: '520263070003498',
        serverOrderId: 'O0RixYVC5H0C-00050988',
        originalClientOrderId: '',
      },
    ];

    const normalized = normalizeHistoricalOperationRows(rows);

    expect(normalized).toHaveLength(2);
    expect(normalized[0]).toMatchObject({
      order_id: '520263070003496',
      side: 'SELL',
      quantity: 10,
      price: 19660,
      exec_type: 'F',
      ord_status: 'partially_filled',
      cum_qty: 15,
      leaves_qty: 85,
      report_format: 'historical',
    });
    expect(normalized[1]).toMatchObject({
      order_id: '520263070003497',
      side: 'SELL',
      quantity: 85,
      price: 19670,
      exec_type: 'F',
      ord_status: 'filled',
      cum_qty: 100,
      leaves_qty: 0,
      report_format: 'historical',
    });
  });
});
