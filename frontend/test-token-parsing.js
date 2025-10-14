/**
 * Debug script to test token parsing and decimal resolution
 */

// Simulate the regex and parsing logic
const OPTION_TOKEN_REGEX = /^([A-Z0-9]+?)([CV])(\d+(?:\.\d+)?)(.*)$/;

const testToken = 'GFGV47343O';

console.log('Testing token:', testToken);
console.log('Regex:', OPTION_TOKEN_REGEX);

const match = testToken.match(OPTION_TOKEN_REGEX);
console.log('\nRegex match result:', match);

if (match) {
  const [, symbol, typeCode, strikeGroup, remainder] = match;
  console.log('\nParsed components:');
  console.log('  Symbol (prefix):', symbol);
  console.log('  Type code:', typeCode);
  console.log('  Strike group:', strikeGroup);
  console.log('  Remainder:', remainder);
  
  let expiration = remainder ? remainder.trim() : '';
  if (expiration.startsWith('.')) {
    expiration = expiration.slice(1);
  } else if (expiration.startsWith('-') || expiration.startsWith('_')) {
    expiration = expiration.slice(1);
  }
  
  expiration = expiration.replace(/[^0-9A-Z]+/g, '');
  const normalizedExpiration = expiration ? expiration.toUpperCase() : 'UNKNOWN';
  
  console.log('  Normalized expiration:', normalizedExpiration);
}

// Now test the decimal resolution logic
console.log('\n=== Testing Decimal Resolution ===');

// Mock symbol config
const mockGGALConfig = {
  symbol: 'GGAL',
  prefixes: ['GFG', 'GGAL'],
  strikeDefaultDecimals: 0,
  expirations: {
    'O': {
      decimals: 1,
      overrides: []
    },
    'OCTUBRE': {
      decimals: 1,
      overrides: []
    }
  }
};

console.log('Mock GGAL config:', JSON.stringify(mockGGALConfig, null, 2));

// Simulate resolveStrikeDecimals
const strikeToken = '47343';
const expirationCode = 'O';

console.log('\nLooking up expiration code:', expirationCode);
console.log('Available expirations:', Object.keys(mockGGALConfig.expirations));

if (mockGGALConfig.expirations[expirationCode]) {
  const expirationConfig = mockGGALConfig.expirations[expirationCode];
  console.log('Found expiration config:', JSON.stringify(expirationConfig, null, 2));
  console.log('Decimals to use:', expirationConfig.decimals);
} else {
  console.log('⚠️ Expiration code not found in config!');
  console.log('Using default decimals:', mockGGALConfig.strikeDefaultDecimals);
}

// Test strike formatting
const formatStrike = (strikeToken, decimals) => {
  const normalizedToken = String(strikeToken).trim();
  const digitsOnly = normalizedToken.replace(/[^0-9]/g, '');
  
  if (decimals <= 0) {
    return Number.parseFloat(digitsOnly);
  }
  
  const padded = digitsOnly.padStart(decimals + 1, '0');
  const whole = padded.slice(0, -decimals) || '0';
  const decimal = padded.slice(-decimals);
  const composed = `${whole}.${decimal}`;
  return Number.parseFloat(composed);
};

console.log('\n=== Strike Formatting ===');
console.log('Strike token:', strikeToken);
console.log('With 0 decimals:', formatStrike(strikeToken, 0));
console.log('With 1 decimal:', formatStrike(strikeToken, 1));
console.log('Expected result: 4734.3');
