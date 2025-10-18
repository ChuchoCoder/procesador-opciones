/* global globalThis */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { login, refreshToken, listOperations, getAccounts, setEnvironment } from '../../src/services/broker/jsrofex-client.js';

describe('jsRofex Client (T025 / T007)', () => {
  let fetchMock;

  beforeEach(() => {
    setEnvironment('reMarkets');
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('login', () => {
    it('should return token and expiry on successful auth', async () => {
      const mockHeaders = new Map();
      mockHeaders.set('X-Auth-Token', 'test-token-123');
      
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        headers: mockHeaders,
      });

      const result = await login({ username: 'user', password: 'pass' });

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/auth/getToken'),
        expect.objectContaining({
          method: 'POST',
          headers: {
            'X-Username': 'user',
            'X-Password': 'pass',
          },
        })
      );
      expect(result.token).toBe('test-token-123');
      expect(result.expiry).toBeGreaterThan(Date.now());
    });

    it('should throw AUTH_FAILED on 401', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 401,
      });

      await expect(login({ username: 'bad', password: 'bad' })).rejects.toThrow('AUTH_FAILED');
    });

    it('should throw AUTH_FAILED when no token in response', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map(), // No token header
      });

      await expect(login({ username: 'user', password: 'pass' })).rejects.toThrow('AUTH_FAILED: No token received');
    });
  });

  describe('refreshToken', () => {
    it('should return same token with updated expiry (Primary API maintains long sessions)', async () => {
      const result = await refreshToken('old-token');

      expect(result.token).toBe('old-token');
      expect(result.expiry).toBeGreaterThan(Date.now());
    });
  });

  describe('getAccounts', () => {
    it('should return accounts array', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          accounts: [
            { id: 'TEST123', name: 'Test Account', brokerId: 1, status: true },
          ],
        }),
      });

      const accounts = await getAccounts('valid-token');

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/rest/accounts'),
        expect.objectContaining({
          method: 'GET',
          headers: { 'X-Auth-Token': 'valid-token' },
        })
      );
      expect(accounts).toBeDefined();
      expect(Array.isArray(accounts)).toBe(true);
      expect(accounts.length).toBeGreaterThan(0);
      expect(accounts[0]).toHaveProperty('id');
    });

    it('should throw AUTH_REQUIRED on 401', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 401,
      });

      await expect(getAccounts('invalid-token')).rejects.toThrow('AUTH_REQUIRED');
    });
  });

  describe('listOperations', () => {
    it('should return operations array from REST API with accountId provided', async () => {
      // Only mock getAllOrdersStatus since accountId is provided
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          orders: [
            {
              orderId: '12345',
              clOrdId: 'client-123',
              instrumentId: { symbol: 'GGAL', marketId: 'ROFEX' },
              price: 100.5,
              orderQty: 10,
              side: 'BUY',
              status: 'NEW',
              transactTime: '20251015-10:30:00.000-0300',
            },
          ],
        }),
      });

      const result = await listOperations({ token: 'valid-token', accountId: 'TEST123' });

      expect(result.operations).toBeDefined();
      expect(Array.isArray(result.operations)).toBe(true);
      expect(result.operations.length).toBeGreaterThan(0);
      expect(result.nextPageToken).toBeUndefined();
      expect(result.estimatedTotal).toBe(result.operations.length);
    });

    it('should filter operations by date when provided', async () => {
      // Only mock getAllOrdersStatus
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          orders: [
            {
              orderId: '1',
              transactTime: '20251015-10:30:00.000-0300',
            },
            {
              orderId: '2',
              transactTime: '20251016-10:30:00.000-0300',
            },
          ],
        }),
      });

      const result = await listOperations({
        token: 'valid-token',
        accountId: 'TEST123',
        date: '2025-10-15',
      });

      expect(result.operations.length).toBe(1);
      expect(result.operations[0].orderId).toBe('1');
    });

    it('should throw AUTH_REQUIRED when no token', async () => {
      await expect(listOperations({ accountId: 'TEST123' })).rejects.toThrow('AUTH_REQUIRED');
    });

    it('should get default account when accountId not provided', async () => {
      // Mock getAccounts
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          accounts: [{ id: 'AUTO123' }],
        }),
      });

      // Mock getAllOrdersStatus
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          orders: [],
        }),
      });

      const result = await listOperations({ token: 'valid-token' });

      expect(result.operations).toBeDefined();
      expect(Array.isArray(result.operations)).toBe(true);
    });
  });
});
