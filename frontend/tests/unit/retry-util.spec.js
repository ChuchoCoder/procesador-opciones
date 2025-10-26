/**
 * T052: Unit tests for retry utility
 * Verify retry logic, backoff sequences, and rate limit parsing
 */
/* eslint-env node, jest */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { retryWithBackoff, parseRetryAfter } from '../../src/services/broker/retry-util.js';

describe('Retry Utility', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('retryWithBackoff', () => {
    it('succeeds on first attempt without retry', async () => {
      const mockFn = vi.fn().mockResolvedValue('success');

      const promise = retryWithBackoff(mockFn);
      const result = await promise;

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('retries on failure with default sequence [2000, 5000, 10000]', async () => {
      const mockFn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Attempt 1 failed'))
        .mockRejectedValueOnce(new Error('Attempt 2 failed'))
        .mockResolvedValue('success');

      const promise = retryWithBackoff(mockFn);

      // Advance through retry delays
      await vi.advanceTimersByTimeAsync(2000); // First retry delay
      await vi.advanceTimersByTimeAsync(5000); // Second retry delay

      const result = await promise;

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('throws last error if all retries exhausted', async () => {
      const finalError = new Error('Final attempt failed');
      const mockFn = vi.fn().mockRejectedValue(finalError);

      const promise = retryWithBackoff(mockFn);
      // attach no-op rejection handler to avoid Node's PromiseRejectionHandledWarning
      void promise.catch(() => {});

      // Advance through all retry delays
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(5000);
      await vi.advanceTimersByTimeAsync(10000);

      await expect(promise).rejects.toThrow('Final attempt failed');
      expect(mockFn).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });

    it('honors custom retry sequence', async () => {
      const mockFn = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValue('success');

      const customSequence = [1000, 3000];
      const promise = retryWithBackoff(mockFn, { retrySequence: customSequence });

      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(3000);

      const result = await promise;

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('stops retrying if shouldRetryFn returns false', async () => {
      const authError = new Error('AUTH_FAILED');
      const mockFn = vi.fn().mockRejectedValue(authError);

      const shouldRetryFn = (error) => !error.message.includes('AUTH_FAILED');

      const promise = retryWithBackoff(mockFn, { shouldRetryFn });

      await expect(promise).rejects.toThrow('AUTH_FAILED');
      expect(mockFn).toHaveBeenCalledTimes(1); // No retries
    });

    it('retries transient errors but not auth errors', async () => {
      const transientError = new Error('timeout');
      const authError = new Error('AUTH_FAILED');
      
      const mockFn = vi
        .fn()
        .mockRejectedValueOnce(transientError)
        .mockRejectedValueOnce(authError);

      const shouldRetryFn = (error) => !error.message.includes('AUTH_FAILED');

      const promise = retryWithBackoff(mockFn, { shouldRetryFn });
      // avoid unhandled rejection warning when auth error causes early rejection
      void promise.catch(() => {});

      await vi.advanceTimersByTimeAsync(2000); // First retry for transient error

      await expect(promise).rejects.toThrow('AUTH_FAILED');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('handles empty retry sequence', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('fail'));

      const promise = retryWithBackoff(mockFn, { retrySequence: [] });

      await expect(promise).rejects.toThrow('fail');
      expect(mockFn).toHaveBeenCalledTimes(1); // Only initial attempt
    });

    it('handles async function that resolves immediately', async () => {
      const mockFn = vi.fn().mockResolvedValue(42);

      const result = await retryWithBackoff(mockFn);

      expect(result).toBe(42);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('parseRetryAfter', () => {
    it('parses RATE_LIMITED:milliseconds format', () => {
      const error = new Error('RATE_LIMITED:30000');
      const waitMs = parseRetryAfter(error);

      expect(waitMs).toBe(30000);
    });

    it('parses "retry after seconds" format', () => {
      const error = new Error('Too many requests, retry after 45 seconds');
      const waitMs = parseRetryAfter(error);

      expect(waitMs).toBe(45000);
    });

    it('parses error.retryAfter property (seconds)', () => {
      const error = new Error('Rate limited');
      error.retryAfter = 30;

      const waitMs = parseRetryAfter(error);

      expect(waitMs).toBe(30000);
    });

    it('returns default 60s for unknown format', () => {
      const error = new Error('Some random error');
      const waitMs = parseRetryAfter(error);

      expect(waitMs).toBe(60000);
    });

    it('handles string error input', () => {
      const error = 'RATE_LIMITED:15000';
      const waitMs = parseRetryAfter(error);

      expect(waitMs).toBe(15000);
    });

    it('handles empty string', () => {
      const waitMs = parseRetryAfter('');

      expect(waitMs).toBe(60000); // default
    });

    it('handles null input', () => {
      const waitMs = parseRetryAfter(null);

      expect(waitMs).toBe(60000); // default
    });

    it('handles malformed RATE_LIMITED format', () => {
      const error = new Error('RATE_LIMITED:invalid');
      const waitMs = parseRetryAfter(error);

      // parseInt('invalid') returns NaN, should fall through to default
      expect(waitMs).toBe(60000);
    });

    it('ignores non-finite retryAfter property', () => {
      const error = new Error('Rate limited');
      error.retryAfter = NaN;

      const waitMs = parseRetryAfter(error);

      expect(waitMs).toBe(60000);
    });
  });

  describe('Integration scenarios', () => {
    it('retries network timeout then succeeds', async () => {
      const mockFn = vi
        .fn()
        .mockRejectedValueOnce(new Error('network timeout'))
        .mockResolvedValue('data');

      const shouldRetryFn = (error) => error.message.includes('timeout');

      const promise = retryWithBackoff(mockFn, { shouldRetryFn });

      await vi.advanceTimersByTimeAsync(2000);

      const result = await promise;

      expect(result).toBe('data');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('exhausts retries for persistent transient errors', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('server unavailable'));

      const shouldRetryFn = () => true;

      const promise = retryWithBackoff(mockFn, {
        shouldRetryFn,
        retrySequence: [100, 200],
      });
      // attach handler so Node doesn't report the rejection as unhandled before test asserts
      void promise.catch(() => {});

      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(200);

      await expect(promise).rejects.toThrow('server unavailable');
      expect(mockFn).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('parses and returns rate limit wait time from structured error', () => {
      const error = {
        message: 'RATE_LIMITED:120000',
        retryAfter: 120,
      };

      const waitMs = parseRetryAfter(error);

      // Property takes precedence
      expect(waitMs).toBe(120000);
    });
  });
});
