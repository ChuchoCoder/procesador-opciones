/**
 * T051: Unit tests for error taxonomy
 * Verify error classification and retry decisions
 */
/* eslint-env node, jest */
import { describe, it, expect } from 'vitest';
import {
  ERROR_CATEGORIES,
  classifyError,
  shouldRetry,
} from '../../src/services/broker/error-taxonomy.js';

describe('Error Taxonomy', () => {
  describe('classifyError', () => {
    describe('HTTP status code classification', () => {
      it('classifies 401 as AUTH', () => {
        const result = classifyError(new Error('Unauthorized'), 401);
        expect(result).toBe(ERROR_CATEGORIES.AUTH);
      });

      it('classifies 403 as AUTH', () => {
        const result = classifyError(new Error('Forbidden'), 403);
        expect(result).toBe(ERROR_CATEGORIES.AUTH);
      });

      it('classifies 429 as RATE_LIMIT', () => {
        const result = classifyError(new Error('Too many requests'), 429);
        expect(result).toBe(ERROR_CATEGORIES.RATE_LIMIT);
      });

      it('classifies 500 as TRANSIENT', () => {
        const result = classifyError(new Error('Internal server error'), 500);
        expect(result).toBe(ERROR_CATEGORIES.TRANSIENT);
      });

      it('classifies 502 as TRANSIENT', () => {
        const result = classifyError(new Error('Bad gateway'), 502);
        expect(result).toBe(ERROR_CATEGORIES.TRANSIENT);
      });

      it('classifies 503 as TRANSIENT', () => {
        const result = classifyError(new Error('Service unavailable'), 503);
        expect(result).toBe(ERROR_CATEGORIES.TRANSIENT);
      });

      it('classifies 400 as PERMANENT', () => {
        const result = classifyError(new Error('Bad request'), 400);
        expect(result).toBe(ERROR_CATEGORIES.PERMANENT);
      });

      it('classifies 404 as PERMANENT', () => {
        const result = classifyError(new Error('Not found'), 404);
        expect(result).toBe(ERROR_CATEGORIES.PERMANENT);
      });
    });

    describe('Message pattern classification', () => {
      it('classifies AUTH_FAILED message as AUTH', () => {
        const result = classifyError(new Error('AUTH_FAILED: invalid token'));
        expect(result).toBe(ERROR_CATEGORIES.AUTH);
      });

      it('classifies TOKEN_EXPIRED message as AUTH', () => {
        const result = classifyError(new Error('TOKEN_EXPIRED'));
        expect(result).toBe(ERROR_CATEGORIES.AUTH);
      });

      it('classifies AUTH_REQUIRED message as AUTH', () => {
        const result = classifyError(new Error('AUTH_REQUIRED'));
        expect(result).toBe(ERROR_CATEGORIES.AUTH);
      });

      it('classifies RATE_LIMITED message as RATE_LIMIT', () => {
        const result = classifyError(new Error('RATE_LIMITED'));
        expect(result).toBe(ERROR_CATEGORIES.RATE_LIMIT);
      });

      it('classifies timeout message as TRANSIENT', () => {
        const result = classifyError(new Error('Request timeout'));
        expect(result).toBe(ERROR_CATEGORIES.TRANSIENT);
      });

      it('classifies network message as TRANSIENT', () => {
        const result = classifyError(new Error('network error'));
        expect(result).toBe(ERROR_CATEGORIES.TRANSIENT);
      });

      it('classifies ECONNREFUSED message as TRANSIENT', () => {
        const result = classifyError(new Error('ECONNREFUSED'));
        expect(result).toBe(ERROR_CATEGORIES.TRANSIENT);
      });

      it('classifies SERVER_ERROR message as TRANSIENT', () => {
        const result = classifyError(new Error('SERVER_ERROR'));
        expect(result).toBe(ERROR_CATEGORIES.TRANSIENT);
      });

      it('classifies unknown message as PERMANENT', () => {
        const result = classifyError(new Error('some random error'));
        expect(result).toBe(ERROR_CATEGORIES.PERMANENT);
      });
    });

    describe('String error handling', () => {
      it('handles string errors instead of Error objects', () => {
        const result = classifyError('AUTH_FAILED');
        expect(result).toBe(ERROR_CATEGORIES.AUTH);
      });

      it('handles empty string as PERMANENT', () => {
        const result = classifyError('');
        expect(result).toBe(ERROR_CATEGORIES.PERMANENT);
      });
    });

    describe('Status code precedence over message', () => {
      it('prioritizes status 401 over non-auth message', () => {
        const result = classifyError(new Error('network error'), 401);
        expect(result).toBe(ERROR_CATEGORIES.AUTH);
      });

      it('prioritizes status 429 over generic message', () => {
        const result = classifyError(new Error('too busy'), 429);
        expect(result).toBe(ERROR_CATEGORIES.RATE_LIMIT);
      });
    });
  });

  describe('shouldRetry', () => {
    it('returns true for TRANSIENT errors', () => {
      expect(shouldRetry(ERROR_CATEGORIES.TRANSIENT)).toBe(true);
    });

    it('returns true for RATE_LIMIT errors', () => {
      expect(shouldRetry(ERROR_CATEGORIES.RATE_LIMIT)).toBe(true);
    });

    it('returns false for AUTH errors', () => {
      expect(shouldRetry(ERROR_CATEGORIES.AUTH)).toBe(false);
    });

    it('returns false for PERMANENT errors', () => {
      expect(shouldRetry(ERROR_CATEGORIES.PERMANENT)).toBe(false);
    });

    it('returns false for unknown categories', () => {
      expect(shouldRetry('UNKNOWN')).toBe(false);
    });
  });

  describe('Integration scenarios', () => {
    it('correctly handles auth expiry workflow', () => {
      const error = new Error('TOKEN_EXPIRED');
      const category = classifyError(error);
      
      expect(category).toBe(ERROR_CATEGORIES.AUTH);
      expect(shouldRetry(category)).toBe(false);
    });

    it('correctly handles transient network failure', () => {
      const error = new Error('network timeout');
      const category = classifyError(error);
      
      expect(category).toBe(ERROR_CATEGORIES.TRANSIENT);
      expect(shouldRetry(category)).toBe(true);
    });

    it('correctly handles rate limiting', () => {
      const error = new Error('RATE_LIMITED');
      const category = classifyError(error, 429);
      
      expect(category).toBe(ERROR_CATEGORIES.RATE_LIMIT);
      expect(shouldRetry(category)).toBe(true);
    });

    it('correctly handles permanent client error', () => {
      const error = new Error('Invalid parameter');
      const category = classifyError(error, 400);
      
      expect(category).toBe(ERROR_CATEGORIES.PERMANENT);
      expect(shouldRetry(category)).toBe(false);
    });
  });
});
