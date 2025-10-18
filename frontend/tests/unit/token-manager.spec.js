// Unit tests for token-manager.js (T016)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { needsRefresh, isTokenValid, performRefresh, ensureValidToken } from '../../src/services/broker/token-manager.js';
import * as jsrofexClient from '../../src/services/broker/jsrofex-client.js';

describe('token-manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('needsRefresh', () => {
    it('returns false if no brokerAuth', () => {
      expect(needsRefresh(null)).toBe(false);
      expect(needsRefresh(undefined)).toBe(false);
    });

    it('returns false if token missing', () => {
      expect(needsRefresh({ expiry: Date.now() + 120000 })).toBe(false);
    });

    it('returns false if expiry missing', () => {
      expect(needsRefresh({ token: 'abc123' })).toBe(false);
    });

    it('returns false if token expires more than 60s in future', () => {
      const brokerAuth = {
        token: 'abc123',
        expiry: Date.now() + 120000, // 2 minutes from now
      };
      expect(needsRefresh(brokerAuth)).toBe(false);
    });

    it('returns true if token expires within 60s', () => {
      const brokerAuth = {
        token: 'abc123',
        expiry: Date.now() + 30000, // 30 seconds from now
      };
      expect(needsRefresh(brokerAuth)).toBe(true);
    });

    it('returns true if token already expired', () => {
      const brokerAuth = {
        token: 'abc123',
        expiry: Date.now() - 10000, // 10 seconds ago
      };
      expect(needsRefresh(brokerAuth)).toBe(true);
    });

    it('returns true at exactly 60s threshold', () => {
      const brokerAuth = {
        token: 'abc123',
        expiry: Date.now() + 60000, // exactly 60s from now
      };
      expect(needsRefresh(brokerAuth)).toBe(true);
    });
  });

  describe('isTokenValid', () => {
    it('returns false if no brokerAuth', () => {
      expect(isTokenValid(null)).toBe(false);
      expect(isTokenValid(undefined)).toBe(false);
    });

    it('returns false if token missing', () => {
      expect(isTokenValid({ expiry: Date.now() + 120000 })).toBe(false);
    });

    it('returns false if expiry missing', () => {
      expect(isTokenValid({ token: 'abc123' })).toBe(false);
    });

    it('returns true if token not yet expired', () => {
      const brokerAuth = {
        token: 'abc123',
        expiry: Date.now() + 30000, // 30 seconds from now
      };
      expect(isTokenValid(brokerAuth)).toBe(true);
    });

    it('returns false if token already expired', () => {
      const brokerAuth = {
        token: 'abc123',
        expiry: Date.now() - 1000, // 1 second ago
      };
      expect(isTokenValid(brokerAuth)).toBe(false);
    });
  });

  describe('performRefresh', () => {
    it('throws if no brokerAuth provided', async () => {
      await expect(performRefresh(null)).rejects.toThrow('REFRESH_FAILED: No current token available');
    });

    it('throws if brokerAuth missing token', async () => {
      await expect(performRefresh({ expiry: 123456789 })).rejects.toThrow('REFRESH_FAILED: No current token available');
    });

    it('calls refreshToken with current token', async () => {
      const mockRefresh = vi.spyOn(jsrofexClient, 'refreshToken').mockResolvedValue({
        token: 'new-token-xyz',
        expiry: Date.now() + 300000,
      });

      const brokerAuth = {
        token: 'old-token-abc',
        expiry: Date.now() + 30000,
        accountId: 'ACC123',
        displayName: 'Test Account',
      };

      const result = await performRefresh(brokerAuth);

      expect(mockRefresh).toHaveBeenCalledWith('old-token-abc');
      expect(result.token).toBe('new-token-xyz');
      expect(result.expiry).toBeGreaterThan(Date.now());
    });

    it('preserves account metadata after refresh', async () => {
      vi.spyOn(jsrofexClient, 'refreshToken').mockResolvedValue({
        token: 'new-token-xyz',
        expiry: Date.now() + 300000,
      });

      const brokerAuth = {
        token: 'old-token-abc',
        expiry: Date.now() + 30000,
        accountId: 'ACC123',
        displayName: 'Test Account',
      };

      const result = await performRefresh(brokerAuth);

      expect(result.accountId).toBe('ACC123');
      expect(result.displayName).toBe('Test Account');
    });

    it('propagates error if refreshToken fails', async () => {
      vi.spyOn(jsrofexClient, 'refreshToken').mockRejectedValue(
        new Error('TOKEN_EXPIRED: Refresh failed, re-authentication required')
      );

      const brokerAuth = {
        token: 'old-token-abc',
        expiry: Date.now() + 30000,
      };

      await expect(performRefresh(brokerAuth)).rejects.toThrow('TOKEN_EXPIRED');
    });
  });

  describe('ensureValidToken', () => {
    it('throws if no brokerAuth', async () => {
      const mockDispatch = vi.fn();
      await expect(ensureValidToken(null, mockDispatch)).rejects.toThrow('NOT_AUTHENTICATED');
    });

    it('throws if brokerAuth missing token', async () => {
      const mockDispatch = vi.fn();
      await expect(ensureValidToken({ expiry: 123456789 }, mockDispatch)).rejects.toThrow('NOT_AUTHENTICATED');
    });

    it('throws if token already expired', async () => {
      const mockDispatch = vi.fn();
      const brokerAuth = {
        token: 'expired-token',
        expiry: Date.now() - 10000, // expired 10s ago
      };

      await expect(ensureValidToken(brokerAuth, mockDispatch)).rejects.toThrow('TOKEN_EXPIRED');
      expect(mockDispatch).not.toHaveBeenCalled();
    });

    it('returns token directly if valid and not near expiry', async () => {
      const mockDispatch = vi.fn();
      const brokerAuth = {
        token: 'valid-token',
        expiry: Date.now() + 120000, // expires in 2 minutes
      };

      const token = await ensureValidToken(brokerAuth, mockDispatch);

      expect(token).toBe('valid-token');
      expect(mockDispatch).not.toHaveBeenCalled();
    });

    it('refreshes token if within 60s threshold', async () => {
      const mockDispatch = vi.fn();
      const newExpiry = Date.now() + 300000;
      
      vi.spyOn(jsrofexClient, 'refreshToken').mockResolvedValue({
        token: 'refreshed-token',
        expiry: newExpiry,
      });

      const brokerAuth = {
        token: 'expiring-soon',
        expiry: Date.now() + 30000, // expires in 30s (within threshold)
        accountId: 'ACC123',
      };

      const token = await ensureValidToken(brokerAuth, mockDispatch);

      expect(token).toBe('refreshed-token');
      expect(mockDispatch).toHaveBeenCalledWith({
        token: 'refreshed-token',
        expiry: newExpiry,
        accountId: 'ACC123',
        displayName: undefined,
      });
    });

    it('propagates refresh errors', async () => {
      const mockDispatch = vi.fn();
      
      vi.spyOn(jsrofexClient, 'refreshToken').mockRejectedValue(
        new Error('TOKEN_EXPIRED: Refresh failed')
      );

      const brokerAuth = {
        token: 'expiring-soon',
        expiry: Date.now() + 30000, // within refresh threshold
      };

      await expect(ensureValidToken(brokerAuth, mockDispatch)).rejects.toThrow('TOKEN_EXPIRED');
      expect(mockDispatch).not.toHaveBeenCalled(); // Auth not updated on failure
    });
  });
});
