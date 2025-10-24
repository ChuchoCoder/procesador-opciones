import { describe, it, expect } from 'vitest';
import {
  DataSourceAdapter,
  CsvDataSource,
  JsonDataSource,
  MockDataSource,
} from '../../src/services/data-sources/index.js';

describe('Data Source Adapters', () => {
  describe('DataSourceAdapter (Base Class)', () => {
    it('throws error when parse is not implemented', async () => {
      const adapter = new DataSourceAdapter();
      await expect(adapter.parse()).rejects.toThrow('must be implemented');
    });

    it('throws error when getSourceType is not implemented', () => {
      const adapter = new DataSourceAdapter();
      expect(() => adapter.getSourceType()).toThrow('must be implemented');
    });
  });

  describe('CsvDataSource', () => {
    it('returns correct source type', () => {
      const source = new CsvDataSource();
      expect(source.getSourceType()).toBe('csv');
    });

    it('throws error when no input provided', async () => {
      const source = new CsvDataSource();
      await expect(source.parse(null)).rejects.toThrow('CSV input is required');
    });

    it('parses simple CSV content', async () => {
      const csvContent = `order_id,symbol,side,quantity,price
123,TEST,BUY,10,100
124,TEST,SELL,5,105`;

      const source = new CsvDataSource();
      const result = await source.parse(csvContent);

      expect(result).toBeDefined();
      expect(result.rows).toBeDefined();
      expect(Array.isArray(result.rows)).toBe(true);
      expect(result.rows.length).toBe(2);
      expect(result.meta).toBeDefined();
      expect(result.meta.rowCount).toBe(2);
    });
  });

  describe('JsonDataSource', () => {
    it('returns correct source type', () => {
      const source = new JsonDataSource();
      expect(source.getSourceType()).toBe('json');
    });

    it('parses array of orders', async () => {
      const orders = [
        {
          orderId: 'O001',
          symbol: 'TEST',
          side: 'BUY',
          orderQty: 10,
          price: 100,
        },
        {
          orderId: 'O002',
          symbol: 'TEST',
          side: 'SELL',
          orderQty: 5,
          price: 105,
        },
      ];

      const source = new JsonDataSource();
      const result = await source.parse(orders);

      expect(result.rows.length).toBe(2);
      expect(result.rows[0].order_id).toBe('O001');
      expect(result.rows[0].side).toBe('BUY');
      expect(result.rows[1].order_id).toBe('O002');
      expect(result.rows[1].side).toBe('SELL');
    });

    it('parses broker response with orders property', async () => {
      const brokerResponse = {
        status: 'OK',
        orders: [
          {
            orderId: 'BR001',
            instrumentId: { symbol: 'MERV - XMEV - TEST - CI' },
            side: 'BUY',
            orderQty: 15,
            price: 200,
          },
        ],
      };

      const source = new JsonDataSource();
      const result = await source.parse(brokerResponse);

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].order_id).toBe('BR001');
      expect(result.rows[0].symbol).toBe('MERV - XMEV - TEST - CI');
    });

    it('parses JSON string', async () => {
      const jsonString = JSON.stringify({
        orders: [
          { orderId: 'STR001', symbol: 'TEST', side: 'BUY', orderQty: 20, price: 150 },
        ],
      });

      const source = new JsonDataSource();
      const result = await source.parse(jsonString);

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].order_id).toBe('STR001');
    });

    it('throws error for invalid JSON string', async () => {
      const source = new JsonDataSource();
      await expect(source.parse('invalid{json')).rejects.toThrow('Failed to parse JSON');
    });

    it('throws error for non-array data without orders property', async () => {
      const source = new JsonDataSource();
      await expect(
        source.parse({ status: 'OK', data: 'no orders here' }),
      ).rejects.toThrow('Invalid JSON format');
    });

    it('normalizes side values correctly', async () => {
      const orders = [
        { orderId: 'O1', side: 'BUY', orderQty: 1, price: 100 },
        { orderId: 'O2', side: 'SELL', orderQty: 1, price: 100 },
        { orderId: 'O3', side: 'B', orderQty: 1, price: 100 },
        { orderId: 'O4', side: 'S', orderQty: 1, price: 100 },
        { orderId: 'O5', side: '1', orderQty: 1, price: 100 },
        { orderId: 'O6', side: '2', orderQty: 1, price: 100 },
      ];

      const source = new JsonDataSource();
      const result = await source.parse(orders);

      expect(result.rows[0].side).toBe('BUY');
      expect(result.rows[1].side).toBe('SELL');
      expect(result.rows[2].side).toBe('BUY');
      expect(result.rows[3].side).toBe('SELL');
      expect(result.rows[4].side).toBe('BUY');
      expect(result.rows[5].side).toBe('SELL');
    });

    it('parses numeric values correctly', async () => {
      const orders = [
        {
          orderId: 'O1',
          price: 100.5,
          orderQty: 10,
          avgPx: 101.25,
          cumQty: 8,
        },
        {
          orderId: 'O2',
          price: '200,75',
          orderQty: '15',
          avgPx: null,
        },
      ];

      const source = new JsonDataSource();
      const result = await source.parse(orders);

      expect(result.rows[0].order_price).toBe(100.5);
      expect(result.rows[0].order_size).toBe(10);
      expect(result.rows[0].avg_price).toBe(101.25);
      expect(result.rows[0].cum_qty).toBe(8);

      expect(result.rows[1].order_price).toBe(200.75);
      expect(result.rows[1].order_size).toBe(15);
      expect(result.rows[1].avg_price).toBeNull();
    });

    it('extracts symbol from various formats', async () => {
      const orders = [
        { orderId: 'O1', instrumentId: { symbol: 'SYM1' } },
        { orderId: 'O2', symbol: 'SYM2' },
        { orderId: 'O3', instrument: 'SYM3' },
        { orderId: 'O4' },
      ];

      const source = new JsonDataSource();
      const result = await source.parse(orders);

      expect(result.rows[0].symbol).toBe('SYM1');
      expect(result.rows[1].symbol).toBe('SYM2');
      expect(result.rows[2].symbol).toBe('SYM3');
      expect(result.rows[3].symbol).toBeNull();
    });

    it('includes metadata about row count and thresholds', async () => {
      const orders = Array.from({ length: 100 }, (_, i) => ({
        orderId: `O${i}`,
        symbol: 'TEST',
      }));

      const source = new JsonDataSource();
      const result = await source.parse(orders);

      expect(result.meta.rowCount).toBe(100);
      expect(result.meta.exceededMaxRows).toBe(false);
      expect(result.meta.warningThresholdExceeded).toBe(false);
      expect(Array.isArray(result.meta.errors)).toBe(true);
    });

    it('truncates data when MAX_ROWS exceeded', async () => {
      const orders = Array.from({ length: 60000 }, (_, i) => ({
        orderId: `O${i}`,
        symbol: 'TEST',
      }));

      const source = new JsonDataSource();
      const result = await source.parse(orders);

      expect(result.rows.length).toBeLessThanOrEqual(50000);
      expect(result.meta.exceededMaxRows).toBe(true);
    });
  });

  describe('MockDataSource', () => {
    it('returns correct source type', () => {
      const source = new MockDataSource();
      expect(source.getSourceType()).toBe('mock');
    });

    it('returns constructor-provided mock rows', async () => {
      const mockRows = [
        { order_id: 'M001', symbol: 'MOCK', side: 'BUY' },
        { order_id: 'M002', symbol: 'MOCK', side: 'SELL' },
      ];

      const source = new MockDataSource(mockRows);
      const result = await source.parse();

      expect(result.rows).toEqual(mockRows);
      expect(result.meta.rowCount).toBe(2);
    });

    it('accepts array input to override mock rows', async () => {
      const constructorRows = [{ order_id: 'C001' }];
      const inputRows = [{ order_id: 'I001' }, { order_id: 'I002' }];

      const source = new MockDataSource(constructorRows);
      const result = await source.parse(inputRows);

      expect(result.rows).toEqual(inputRows);
      expect(result.meta.rowCount).toBe(2);
    });

    it('allows setting mock rows after construction', async () => {
      const source = new MockDataSource([]);
      
      const newRows = [{ order_id: 'N001' }];
      source.setMockRows(newRows);

      const result = await source.parse();
      expect(result.rows).toEqual(newRows);
    });

    it('allows setting mock metadata', async () => {
      const source = new MockDataSource([{ order_id: 'M001' }]);
      
      source.setMockMeta({ customField: 'customValue' });

      const result = await source.parse();
      expect(result.meta.customField).toBe('customValue');
      expect(result.meta.rowCount).toBe(1);
    });

    it('merges config.meta with mock metadata', async () => {
      const source = new MockDataSource([{ id: '1' }], { mockMeta: true });
      
      const result = await source.parse(null, { meta: { configMeta: true } });

      expect(result.meta.mockMeta).toBe(true);
      expect(result.meta.configMeta).toBe(true);
    });

    it('returns empty array when no mock data provided', async () => {
      const source = new MockDataSource();
      const result = await source.parse();

      expect(result.rows).toEqual([]);
      expect(result.meta.rowCount).toBe(0);
    });
  });

  describe('JsonDataSource - Enhanced Features', () => {
    describe('normalizeTimestamp', () => {
      const source = new JsonDataSource();

      it('converts broker timestamp to ISO format', () => {
        const result = source.normalizeTimestamp('20251021-14:57:20.149-0300');
        expect(result).toBe('2025-10-21T14:57:20.149-03:00');
      });

      it('handles timestamps without milliseconds', () => {
        const result = source.normalizeTimestamp('20251021-14:57:20-0300');
        expect(result).toBe('2025-10-21T14:57:20.000-03:00');
      });

      it('handles positive timezone offset', () => {
        const result = source.normalizeTimestamp('20251021-14:57:20.123+0530');
        expect(result).toBe('2025-10-21T14:57:20.123+05:30');
      });

      it('preserves ISO timestamps unchanged', () => {
        const iso = '2025-10-21T14:57:20.149Z';
        expect(source.normalizeTimestamp(iso)).toBe(iso);
      });

      it('preserves CSV-style timestamps unchanged', () => {
        const csv = '2025-10-21 14:57:20.149000Z';
        expect(source.normalizeTimestamp(csv)).toBe(csv);
      });

      it('returns original for invalid format', () => {
        const invalid = 'invalid-timestamp';
        expect(source.normalizeTimestamp(invalid)).toBe(invalid);
      });

      it('returns null for null input', () => {
        expect(source.normalizeTimestamp(null)).toBeNull();
      });

      it('returns null for undefined input', () => {
        expect(source.normalizeTimestamp(undefined)).toBeNull();
      });

      it('returns null for non-string input', () => {
        expect(source.normalizeTimestamp(12345)).toBeNull();
      });
    });

    describe('extractExecInst', () => {
      const source = new JsonDataSource();

      it('returns "D" for iceberg string "true"', () => {
        expect(source.extractExecInst({ iceberg: 'true' })).toBe('D');
      });

      it('returns "D" for iceberg boolean true', () => {
        expect(source.extractExecInst({ iceberg: true })).toBe('D');
      });

      it('returns "D" for displayQty > 0', () => {
        expect(source.extractExecInst({ displayQty: 5 })).toBe('D');
      });

      it('returns "D" for displayQty string > 0', () => {
        expect(source.extractExecInst({ displayQty: '10' })).toBe('D');
      });

      it('returns null for iceberg "false"', () => {
        expect(source.extractExecInst({ iceberg: 'false' })).toBeNull();
      });

      it('returns null for iceberg false', () => {
        expect(source.extractExecInst({ iceberg: false })).toBeNull();
      });

      it('returns null for displayQty 0', () => {
        expect(source.extractExecInst({ displayQty: 0 })).toBeNull();
      });

      it('returns null for normal order', () => {
        expect(source.extractExecInst({})).toBeNull();
      });

      it('returns null for null displayQty', () => {
        expect(source.extractExecInst({ displayQty: null })).toBeNull();
      });
    });

    describe('inferExecType', () => {
      const source = new JsonDataSource();

      it('returns existing execType if provided', () => {
        expect(source.inferExecType({ execType: 'X' })).toBe('X');
      });

      it('returns "F" for FILLED status', () => {
        expect(source.inferExecType({ status: 'FILLED' })).toBe('F');
      });

      it('returns "F" for PARTIALLY_FILLED status', () => {
        expect(source.inferExecType({ status: 'PARTIALLY_FILLED' })).toBe('F');
      });

      it('returns "F" for CANCELLED with executions', () => {
        expect(source.inferExecType({ status: 'CANCELLED', cumQty: 10 })).toBe('F');
      });

      it('returns "4" for CANCELLED without executions', () => {
        expect(source.inferExecType({ status: 'CANCELLED', cumQty: 0 })).toBe('4');
      });

      it('returns "8" for REJECTED', () => {
        expect(source.inferExecType({ status: 'REJECTED' })).toBe('8');
      });

      it('returns null for unknown status', () => {
        expect(source.inferExecType({ status: 'PENDING_NEW' })).toBeNull();
      });

      it('returns null for missing status', () => {
        expect(source.inferExecType({})).toBeNull();
      });

      it('handles case insensitive status', () => {
        expect(source.inferExecType({ status: 'filled' })).toBe('F');
        expect(source.inferExecType({ status: 'Filled' })).toBe('F');
      });
    });

    describe('inferEventSubtype', () => {
      const source = new JsonDataSource();

      it('always returns "execution_report"', () => {
        expect(source.inferEventSubtype()).toBe('execution_report');
      });
    });

    describe('shouldIncludeOrder', () => {
      const source = new JsonDataSource();

      it('includes FILLED orders', () => {
        expect(source.shouldIncludeOrder({ status: 'FILLED' })).toBe(true);
      });

      it('includes PARTIALLY_FILLED orders', () => {
        expect(source.shouldIncludeOrder({ status: 'PARTIALLY_FILLED' })).toBe(true);
      });

      it('excludes CANCELLED + REPLACED', () => {
        expect(source.shouldIncludeOrder({
          status: 'CANCELLED',
          text: 'REPLACED',
        })).toBe(false);
      });

      it('excludes CANCELLED + REPLACED case insensitive', () => {
        expect(source.shouldIncludeOrder({
          status: 'cancelled',
          text: 'Order REPLACED by user',
        })).toBe(false);
      });

      it('excludes PENDING_CANCEL', () => {
        expect(source.shouldIncludeOrder({ status: 'PENDING_CANCEL' })).toBe(false);
      });

      it('excludes REJECTED', () => {
        expect(source.shouldIncludeOrder({ status: 'REJECTED' })).toBe(false);
      });

      it('includes CANCELLED with executions', () => {
        expect(source.shouldIncludeOrder({
          status: 'CANCELLED',
          cumQty: 10,
        })).toBe(true);
      });

      it('excludes CANCELLED without executions', () => {
        expect(source.shouldIncludeOrder({
          status: 'CANCELLED',
          cumQty: 0,
        })).toBe(false);
      });

      it('excludes CANCELLED with null cumQty', () => {
        expect(source.shouldIncludeOrder({
          status: 'CANCELLED',
          cumQty: null,
        })).toBe(false);
      });

      it('includes unknown status', () => {
        expect(source.shouldIncludeOrder({ status: 'NEW' })).toBe(true);
      });

      it('handles case insensitive status', () => {
        expect(source.shouldIncludeOrder({ status: 'filled' })).toBe(true);
        expect(source.shouldIncludeOrder({ status: 'pending_cancel' })).toBe(false);
      });
    });

    describe('parse with filtering', () => {
      it('filters out replaced orders', async () => {
        const orders = [
          { orderId: 'O1', status: 'FILLED', cumQty: 10 },
          { orderId: 'O2', status: 'CANCELLED', text: 'REPLACED', cumQty: 0 },
          { orderId: 'O3', status: 'FILLED', cumQty: 5 },
        ];

        const source = new JsonDataSource();
        const result = await source.parse(orders);

        expect(result.rows.length).toBe(2);
        expect(result.meta.totalOrders).toBe(3);
        expect(result.meta.excluded.replaced).toBe(1);
        expect(result.rows[0].order_id).toBe('O1');
        expect(result.rows[1].order_id).toBe('O3');
      });

      it('filters out pending cancellations', async () => {
        const orders = [
          { orderId: 'O1', status: 'FILLED' },
          { orderId: 'O2', status: 'PENDING_CANCEL' },
        ];

        const source = new JsonDataSource();
        const result = await source.parse(orders);

        expect(result.rows.length).toBe(1);
        expect(result.meta.excluded.pendingCancel).toBe(1);
      });

      it('filters out rejections', async () => {
        const orders = [
          { orderId: 'O1', status: 'FILLED' },
          { orderId: 'O2', status: 'REJECTED', text: 'Insufficient funds' },
        ];

        const source = new JsonDataSource();
        const result = await source.parse(orders);

        expect(result.rows.length).toBe(1);
        expect(result.meta.excluded.rejected).toBe(1);
      });

      it('filters out pure cancellations', async () => {
        const orders = [
          { orderId: 'O1', status: 'FILLED' },
          { orderId: 'O2', status: 'CANCELLED', cumQty: 0 },
        ];

        const source = new JsonDataSource();
        const result = await source.parse(orders);

        expect(result.rows.length).toBe(1);
        expect(result.meta.excluded.cancelled).toBe(1);
      });

      it('includes cancelled orders with executions', async () => {
        const orders = [
          { orderId: 'O1', status: 'CANCELLED', cumQty: 5, text: 'Cancelled by user' },
        ];

        const source = new JsonDataSource();
        const result = await source.parse(orders);

        expect(result.rows.length).toBe(1);
        expect(result.meta.excluded.cancelled).toBe(0);
      });

      it('tracks all exclusion types', async () => {
        const orders = [
          { orderId: 'O1', status: 'FILLED' },
          { orderId: 'O2', status: 'CANCELLED', text: 'REPLACED' },
          { orderId: 'O3', status: 'PENDING_CANCEL' },
          { orderId: 'O4', status: 'REJECTED' },
          { orderId: 'O5', status: 'CANCELLED', cumQty: 0 },
          { orderId: 'O6', status: 'FILLED' },
        ];

        const source = new JsonDataSource();
        const result = await source.parse(orders);

        expect(result.rows.length).toBe(2);
        expect(result.meta.totalOrders).toBe(6);
        expect(result.meta.excluded.replaced).toBe(1);
        expect(result.meta.excluded.pendingCancel).toBe(1);
        expect(result.meta.excluded.rejected).toBe(1);
        expect(result.meta.excluded.cancelled).toBe(1);
      });
    });

    describe('normalizeOrder with enhanced fields', () => {
      it('normalizes timestamps', async () => {
        const orders = [{
          orderId: 'O1',
          transactTime: '20251021-14:57:20.149-0300',
          status: 'FILLED',
        }];

        const source = new JsonDataSource();
        const result = await source.parse(orders);

        expect(result.rows[0].transact_time).toBe('2025-10-21T14:57:20.149-03:00');
      });

      it('sets exec_inst for iceberg orders', async () => {
        const orders = [{
          orderId: 'O1',
          iceberg: 'true',
          status: 'FILLED',
        }];

        const source = new JsonDataSource();
        const result = await source.parse(orders);

        expect(result.rows[0].exec_inst).toBe('D');
      });

      it('sets event_subtype', async () => {
        const orders = [{
          orderId: 'O1',
          status: 'FILLED',
        }];

        const source = new JsonDataSource();
        const result = await source.parse(orders);

        expect(result.rows[0].event_subtype).toBe('execution_report');
      });

      it('infers exec_type from status', async () => {
        const orders = [{
          orderId: 'O1',
          status: 'FILLED',
        }];

        const source = new JsonDataSource();
        const result = await source.parse(orders);

        expect(result.rows[0].exec_type).toBe('F');
      });

      it('sets expire_date and stop_px to null', async () => {
        const orders = [{
          orderId: 'O1',
          status: 'FILLED',
        }];

        const source = new JsonDataSource();
        const result = await source.parse(orders);

        expect(result.rows[0].expire_date).toBeNull();
        expect(result.rows[0].stop_px).toBeNull();
      });
    });
  });

  describe('Integration between adapters', () => {
    it('all adapters implement required interface', () => {
      const adapters = [
        new CsvDataSource(),
        new JsonDataSource(),
        new MockDataSource(),
      ];

      adapters.forEach((adapter) => {
        expect(adapter).toBeInstanceOf(DataSourceAdapter);
        expect(typeof adapter.parse).toBe('function');
        expect(typeof adapter.getSourceType).toBe('function');
        expect(typeof adapter.getSourceType()).toBe('string');
      });
    });

    it('each adapter returns unique source type', () => {
      const sources = [
        new CsvDataSource(),
        new JsonDataSource(),
        new MockDataSource(),
      ];

      const types = sources.map((s) => s.getSourceType());
      const uniqueTypes = new Set(types);

      expect(uniqueTypes.size).toBe(types.length);
    });
  });
});
