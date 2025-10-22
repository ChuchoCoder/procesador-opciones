import { describe, it, expect } from 'vitest';
import { validateAndFilterRows } from '../../src/services/csv/validators.js';

describe('Broker Status Validation', () => {
  it('should accept FILLED status from broker operations', () => {
    const rows = [
      {
        order_id: 'ORD-001',
        side: 'BUY',
        quantity: 100,
        price: 10.5,
        status: 'FILLED',  // Broker API uppercase
        event_subtype: 'execution_report',
      },
    ];

    const result = validateAndFilterRows({ rows });

    expect(result.rows).toHaveLength(1);
    expect(result.exclusions.invalidStatus).toBe(0);
    expect(result.rows[0].status).toBe('fully_executed');
  });

  it('should accept PARTIAL_FILL status from broker operations', () => {
    const rows = [
      {
        order_id: 'ORD-002',
        side: 'SELL',
        quantity: 50,
        price: 20.75,
        status: 'PARTIAL_FILL',  // Broker API uppercase
        event_subtype: 'execution_report',
      },
    ];

    const result = validateAndFilterRows({ rows });

    expect(result.rows).toHaveLength(1);
    expect(result.exclusions.invalidStatus).toBe(0);
    expect(result.rows[0].status).toBe('partially_executed');
  });

  it('should accept filled status from CSV imports', () => {
    const rows = [
      {
        order_id: 'ORD-003',
        side: 'BUY',
        quantity: 100,
        price: 10.5,
        status: 'filled',  // CSV lowercase
        event_subtype: 'execution_report',
      },
    ];

    const result = validateAndFilterRows({ rows });

    expect(result.rows).toHaveLength(1);
    expect(result.exclusions.invalidStatus).toBe(0);
    expect(result.rows[0].status).toBe('fully_executed');
  });

  it('should reject invalid status values', () => {
    const rows = [
      {
        order_id: 'ORD-004',
        side: 'BUY',
        quantity: 100,
        price: 10.5,
        status: 'PENDING',  // Invalid status
        event_subtype: 'execution_report',
      },
    ];

    const result = validateAndFilterRows({ rows });

    expect(result.rows).toHaveLength(0);
    expect(result.exclusions.invalidStatus).toBe(1);
  });

  it('should handle mixed case status values from broker', () => {
    const rows = [
      {
        order_id: 'ORD-005',
        side: 'BUY',
        quantity: 100,
        price: 10.5,
        ord_status: 'FILLED',  // ord_status field
        event_subtype: 'execution_report',
      },
    ];

    const result = validateAndFilterRows({ rows });

    expect(result.rows).toHaveLength(1);
    expect(result.exclusions.invalidStatus).toBe(0);
  });
});
