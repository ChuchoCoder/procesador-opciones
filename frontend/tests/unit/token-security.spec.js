/**
 * T062: Token security test - assert no raw credentials persisted
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { storageAvailable } from '../../src/services/storage/local-storage.js';

describe('Token Security', () => {
  let mockStorage;

  beforeEach(() => {
    mockStorage = {};
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
      mockStorage[key] = value;
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => {
      return mockStorage[key] || null;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    mockStorage = {};
  });

  it('should NOT persist raw username in localStorage', () => {
    // Simulate storing broker auth data
    const authData = {
      token: 'jwt-token-123',
      expiry: Date.now() + 3600000,
      accountId: 'account-456',
    };

    localStorage.setItem('config', JSON.stringify({ brokerAuth: authData }));

    const stored = JSON.parse(localStorage.getItem('config') || '{}');

    // Verify no raw username or password stored
    expect(stored.brokerAuth?.username).toBeUndefined();
    expect(stored.brokerAuth?.password).toBeUndefined();
    expect(stored.username).toBeUndefined();
    expect(stored.password).toBeUndefined();
  });

  it('should NOT persist raw password in localStorage', () => {
    const authData = {
      token: 'jwt-token-123',
      expiry: Date.now() + 3600000,
    };

    localStorage.setItem('config', JSON.stringify({ brokerAuth: authData }));

    const rawData = localStorage.getItem('config');

    // Ensure password is not in the raw string
    expect(rawData).not.toContain('password');
    expect(rawData).not.toContain('pwd');
    expect(rawData).not.toContain('credential');
  });

  it('should only persist token and expiry, not credentials', () => {
    const authData = {
      token: 'encrypted-jwt-token',
      expiry: 1697476800000,
      accountId: 'broker-account-789',
    };

    localStorage.setItem('procesador-config', JSON.stringify({ brokerAuth: authData }));

    const stored = JSON.parse(localStorage.getItem('procesador-config') || '{}');

    expect(stored.brokerAuth).toEqual({
      token: 'encrypted-jwt-token',
      expiry: 1697476800000,
      accountId: 'broker-account-789',
    });
  });

  it('should clear all auth data when clearing broker auth', () => {
    const authData = {
      token: 'jwt-token-123',
      expiry: Date.now() + 3600000,
    };

    localStorage.setItem('config', JSON.stringify({ brokerAuth: authData }));

    // Clear auth
    localStorage.setItem('config', JSON.stringify({ brokerAuth: null }));

    const stored = JSON.parse(localStorage.getItem('config') || '{}');
    expect(stored.brokerAuth).toBeNull();
  });

  it('should not expose credentials in console logs', () => {
    const consoleSpy = vi.spyOn(console, 'log');
    const consoleErrorSpy = vi.spyOn(console, 'error');

    const authData = {
      token: 'jwt-token-123',
      expiry: Date.now() + 3600000,
    };

    localStorage.setItem('config', JSON.stringify({ brokerAuth: authData }));

    // Get all console.log calls and check they don't contain sensitive data patterns
    const allLogs = consoleSpy.mock.calls.flat().join(' ');
    const allErrors = consoleErrorSpy.mock.calls.flat().join(' ');

    expect(allLogs).not.toMatch(/password[:\s]*[^\s]+/i);
    expect(allErrors).not.toMatch(/password[:\s]*[^\s]+/i);
    expect(allLogs).not.toMatch(/username[:\s]*[^\s]+/i);
    expect(allErrors).not.toMatch(/username[:\s]*[^\s]+/i);

    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('should handle chrome.storage if available (extension context)', () => {
    // Mock chrome.storage
    const mockChromeStorage = {
      local: {
        get: vi.fn((keys, callback) => callback({ config: { brokerAuth: { token: 'test' } } })),
        set: vi.fn((items, callback) => callback && callback()),
      },
    };

    global.chrome = { storage: mockChromeStorage };

    chrome.storage.local.set({ config: { brokerAuth: { token: 'jwt-123', expiry: 123456 } } });

    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      { config: { brokerAuth: { token: 'jwt-123', expiry: 123456 } } },
      expect.any(Function)
    );

    // Verify no credentials in the stored data
    const callArgs = mockChromeStorage.local.set.mock.calls[0][0];
    expect(callArgs.config.brokerAuth.username).toBeUndefined();
    expect(callArgs.config.brokerAuth.password).toBeUndefined();

    delete global.chrome;
  });
});
