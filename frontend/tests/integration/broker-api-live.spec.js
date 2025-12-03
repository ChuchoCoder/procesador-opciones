/**
 * Live Broker API Integration Test
 * 
 * This test makes real API calls to the broker (Matba Rofex / Primary).
 * Requires a .env file with valid credentials.
 * 
 * SETUP:
 * 1. Create a .env file in the frontend directory with:
 *    BROKER_USERNAME=your_username
 *    BROKER_PASSWORD=your_password
 *    BROKER_ENVIRONMENT=reMarkets  (or 'production')
 *    BROKER_API_URL=https://api.cocos.xoms.com.ar
 * 
 * 2. Run with: npm test -- tests/integration/broker-api-live.spec.js
 * 
 * NOTE: This test is skipped by default if credentials are not available.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { config as dotenvConfig } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../../.env');

dotenvConfig({ path: envPath });

// Import broker client functions
import { 
  login, 
  setEnvironment, 
  getEnvironment,
  getAccounts, 
  listOperations,
  getAllInstruments,
  getTrades,
  setBaseUrl,
  getBaseUrl
} from '../../src/services/broker/jsrofex-client.js';

// Check if credentials are available
const BROKER_USERNAME = process.env.BROKER_USERNAME;
const BROKER_PASSWORD = process.env.BROKER_PASSWORD;
const BROKER_API_URL = process.env.BROKER_API_URL;
const BROKER_ENVIRONMENT = process.env.BROKER_ENVIRONMENT || 'reMarkets';

const hasCredentials = BROKER_USERNAME && BROKER_PASSWORD;

// Helper to conditionally skip tests
const describeIfCredentials = hasCredentials ? describe : describe.skip;

describeIfCredentials('Broker API Live Integration', () => {
  let authToken;
  let tokenExpiry;
  let accounts;

  // Ensure authentication before ALL tests - this allows running individual tests
  beforeAll(async () => {
    // Set API URL - direct URL takes precedence over environment name
    if (BROKER_API_URL) {
      setBaseUrl(BROKER_API_URL);
      console.log(`[Test Setup] Using custom API URL: ${getBaseUrl()}`);
    } else {
      setEnvironment(BROKER_ENVIRONMENT);
      console.log(`[Test Setup] Using environment: ${getEnvironment()}`);
    }
    console.log(`[Test Setup] Base URL: ${getBaseUrl()}`);
    console.log(`[Test Setup] Username: ${BROKER_USERNAME ? BROKER_USERNAME.substring(0, 3) + '***' : 'NOT SET'}`);

    // Authenticate and get accounts upfront so all tests can run independently
    console.log('[Test Setup] Authenticating...');
    const authResult = await login({
      username: BROKER_USERNAME,
      password: BROKER_PASSWORD,
    });
    authToken = authResult.token;
    tokenExpiry = authResult.expiry;
    console.log(`[Test Setup] Token obtained, expires: ${new Date(tokenExpiry).toISOString()}`);

    // Get accounts
    accounts = await getAccounts(authToken);
    console.log(`[Test Setup] Found ${accounts.length} account(s)`);
  });

  describe('Authentication', () => {
    it('should obtain OAuth token with valid credentials', async () => {
      // Token was already obtained in beforeAll, just verify it
      expect(authToken).toBeDefined();
      expect(typeof authToken).toBe('string');
      expect(authToken.length).toBeGreaterThan(0);
      expect(tokenExpiry).toBeDefined();
      expect(tokenExpiry).toBeGreaterThan(Date.now());

      console.log(`[Auth Test] Token verified successfully`);
      console.log(`[Auth Test] Token length: ${authToken.length} chars`);
      console.log(`[Auth Test] Token expires: ${new Date(tokenExpiry).toISOString()}`);
    });

    it('should fail with invalid credentials', async () => {
      await expect(
        login({
          username: 'invalid_user',
          password: 'invalid_password',
        })
      ).rejects.toThrow(/AUTH_FAILED/);
    });
  });

  describe('Account Retrieval', () => {
    it('should get accounts for authenticated user', async () => {
      // Accounts were already fetched in beforeAll, just verify them
      expect(authToken).toBeDefined();
      expect(accounts).toBeDefined();
      expect(Array.isArray(accounts)).toBe(true);
      
      console.log(`[Accounts Test] Found ${accounts.length} account(s)`);
      
      if (accounts.length > 0) {
        console.log('[Accounts Test] Accounts:', JSON.stringify(accounts, null, 2));
        
        // Verify account structure
        const firstAccount = accounts[0];
        expect(firstAccount).toHaveProperty('name');
      }
    });
  });

  describe('Operations Retrieval', () => {
    it('should list operations for today', async () => {
      expect(authToken).toBeDefined();
      expect(accounts).toBeDefined();
      expect(accounts.length).toBeGreaterThan(0);

      const today = new Date().toISOString().split('T')[0];
      console.log(`[Operations Test] Fetching operations for ${today}...`);

      const result = await listOperations({
        date: today,
        token: authToken,
        accountId: accounts[0].name,
      });

      expect(result).toBeDefined();
      expect(result.operations).toBeDefined();
      expect(Array.isArray(result.operations)).toBe(true);

      console.log(`[Operations Test] Found ${result.operations.length} operation(s) for today`);

      if (result.operations.length > 0) {
        console.log('[Operations Test] First operation sample:');
        console.log(JSON.stringify(result.operations[0], null, 2));

        // Verify operation structure has expected fields
        const firstOp = result.operations[0];
        expect(firstOp).toHaveProperty('orderId');
      }
    });

    it('should list all operations (no date filter)', async () => {
      expect(authToken).toBeDefined();
      expect(accounts).toBeDefined();
      expect(accounts.length).toBeGreaterThan(0);

      console.log('[Operations Test] Fetching all operations...');

      const result = await listOperations({
        token: authToken,
        accountId: accounts[0].name,
      });

      expect(result).toBeDefined();
      expect(result.operations).toBeDefined();
      expect(Array.isArray(result.operations)).toBe(true);

      console.log(`[Operations Test] Total operations in account: ${result.operations.length}`);

      if (result.operations.length > 0) {
        // Log unique symbols traded
        const symbols = [...new Set(result.operations.map(op => 
          op.instrumentId?.symbol || 'unknown'
        ))];
        console.log(`[Operations Test] Unique symbols: ${symbols.slice(0, 10).join(', ')}${symbols.length > 10 ? '...' : ''}`);
        
        // Group by status
        const byStatus = result.operations.reduce((acc, op) => {
          const status = op.status || 'unknown';
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        }, {});
        console.log('[Operations Test] By status:', byStatus);
      }
    });
  });

  describe('Instruments Retrieval', () => {
    it('should get all available instruments', async () => {
      expect(authToken).toBeDefined();

      console.log('[Instruments Test] Fetching all instruments...');

      const result = await getAllInstruments(authToken);

      expect(result).toBeDefined();
      expect(result.instruments).toBeDefined();
      expect(Array.isArray(result.instruments)).toBe(true);

      console.log(`[Instruments Test] Total instruments: ${result.instruments.length}`);

      if (result.instruments.length > 0) {
        // Log first instrument as sample
        console.log('[Instruments Test] First instrument sample:');
        console.log(JSON.stringify(result.instruments[0], null, 2));

        // Group instruments by segment/type if available
        const bySegment = result.instruments.reduce((acc, inst) => {
          const segment = inst.segment || inst.marketSegmentId || 'unknown';
          acc[segment] = (acc[segment] || 0) + 1;
          return acc;
        }, {});
        console.log('[Instruments Test] By segment:', bySegment);

        // Show some symbol examples
        const symbols = result.instruments.slice(0, 10).map(i => i.symbol || i.instrumentId?.symbol || 'N/A');
        console.log(`[Instruments Test] Sample symbols: ${symbols.join(', ')}`);
      }
    });

    it('should fail to get instruments without token', async () => {
      await expect(
        getAllInstruments(null)
      ).rejects.toThrow(/AUTH_REQUIRED/);
    });

    it('should fail to get instruments with invalid token', async () => {
      await expect(
        getAllInstruments('invalid_token_xyz')
      ).rejects.toThrow(/AUTH_REQUIRED|Token invalid/);
    });
  });

  describe('Trade History Retrieval', () => {
    // Helper to format date as YYYY-MM-DD
    const formatDate = (date) => date.toISOString().split('T')[0];
    
    // Calculate date range: last 30 days until yesterday
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 31);
    
    const dateFrom = formatDate(thirtyDaysAgo);
    const dateTo = formatDate(yesterday);

    it('should get trade history for GGAL 24hs', async () => {
      expect(authToken).toBeDefined();

      console.log(`[Trades Test] Fetching trades from ${dateFrom} to ${dateTo}...`);

      const result = await getTrades({
        marketId: 'ROFX',
        symbol: 'MERV - XMEV - GGAL - 24hs',
        dateFrom,
        dateTo,
        external: true,
        token: authToken,
      });

      expect(result).toBeDefined();
      expect(result.trades).toBeDefined();
      expect(Array.isArray(result.trades)).toBe(true);

      console.log(`[Trades Test] Total trades found: ${result.trades.length}`);

      if (result.trades.length > 0) {
        // Log first trade as sample
        console.log('[Trades Test] First trade sample:');
        console.log(JSON.stringify(result.trades[0], null, 2));

        // Log last trade as well
        if (result.trades.length > 1) {
          console.log('[Trades Test] Last trade sample:');
          console.log(JSON.stringify(result.trades[result.trades.length - 1], null, 2));
        }
      }
    });

    it('should get trade history for DLR/ABR26 (Matba Rofex future)', async () => {
      expect(authToken).toBeDefined();

      console.log(`[Trades Test DLR] Fetching trades from ${dateFrom} to ${dateTo}...`);

      const result = await getTrades({
        marketId: 'ROFX',
        symbol: 'DLR/ABR26',
        dateFrom,
        dateTo,
        external: false,
        token: authToken,
      });

      expect(result).toBeDefined();
      expect(result.trades).toBeDefined();
      expect(Array.isArray(result.trades)).toBe(true);

      console.log(`[Trades Test DLR] Total trades found: ${result.trades.length}`);

      if (result.trades.length > 0) {
        // Log first trade as sample
        console.log('[Trades Test DLR] First trade sample:');
        console.log(JSON.stringify(result.trades[0], null, 2));

        // Log last trade as well
        if (result.trades.length > 1) {
          console.log('[Trades Test DLR] Last trade sample:');
          console.log(JSON.stringify(result.trades[result.trades.length - 1], null, 2));
        }
      }
    });

    it('should fail to get trades without token', async () => {
      await expect(
        getTrades({
          marketId: 'ROFX',
          symbol: 'MERV - XMEV - GGAL - 24hs',
          dateFrom,
          dateTo,
          token: null,
        })
      ).rejects.toThrow(/AUTH_REQUIRED/);
    });

    it('should fail to get trades without required params', async () => {
      await expect(
        getTrades({
          marketId: 'ROFX',
          // missing symbol, dateFrom, dateTo
          token: authToken,
        })
      ).rejects.toThrow(/INVALID_PARAMS/);
    });

    it('should fail to get trades with invalid token', async () => {
      await expect(
        getTrades({
          marketId: 'ROFX',
          symbol: 'MERV - XMEV - GGAL - 24hs',
          dateFrom,
          dateTo,
          token: 'invalid_token_xyz',
        })
      ).rejects.toThrow(/AUTH_REQUIRED|Token invalid/);
    });
  });

  describe('Error Handling', () => {
    it('should fail to get operations without token', async () => {
      await expect(
        listOperations({
          date: new Date().toISOString().split('T')[0],
          token: null,
          accountId: 'test',
        })
      ).rejects.toThrow(/AUTH_REQUIRED/);
    });

    it('should fail with invalid token', async () => {
      await expect(
        getAccounts('invalid_token_xyz')
      ).rejects.toThrow(/AUTH_REQUIRED|Token invalid/);
    });
  });
});

// If no credentials, log a helpful message
if (!hasCredentials) {
  describe('Broker API Live Integration', () => {
    it.skip('SKIPPED: No credentials available - create frontend/.env with BROKER_USERNAME and BROKER_PASSWORD', () => {
      // This test is intentionally empty - it just shows the skip message
    });
  });
}
