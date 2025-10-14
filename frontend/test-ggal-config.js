/**
 * Test script to verify GGAL configuration
 * Run this in the browser console to check the current configuration
 */

// Read GGAL configuration
const ggalConfig = localStorage.getItem('po:settings:GGAL');
console.log('=== GGAL Configuration ===');
console.log('Raw value:', ggalConfig);

if (ggalConfig) {
  try {
    const parsed = JSON.parse(ggalConfig);
    console.log('Parsed configuration:', JSON.stringify(parsed, null, 2));
    
    // Check prefixes
    console.log('\n=== Prefixes ===');
    console.log('Prefixes:', parsed.prefixes);
    
    // Check October expiration
    console.log('\n=== October Expiration ===');
    if (parsed.expirations && parsed.expirations.OCTUBRE) {
      console.log('October config:', JSON.stringify(parsed.expirations.OCTUBRE, null, 2));
    } else if (parsed.expirations && parsed.expirations.OCT) {
      console.log('Oct config:', JSON.stringify(parsed.expirations.OCT, null, 2));
    } else {
      console.log('No October/Oct expiration found');
      console.log('Available expirations:', Object.keys(parsed.expirations || {}));
    }
    
    // Check default decimals
    console.log('\n=== Default Decimals ===');
    console.log('strikeDefaultDecimals:', parsed.strikeDefaultDecimals);
    console.log('defaultDecimals:', parsed.defaultDecimals);
    
  } catch (error) {
    console.error('Error parsing GGAL config:', error);
  }
} else {
  console.log('No GGAL configuration found in localStorage');
}

// List all symbol configs
console.log('\n=== All Symbol Configurations ===');
const allKeys = Object.keys(localStorage);
const symbolKeys = allKeys.filter(key => key.startsWith('po:settings:'));
console.log('Symbol configs found:', symbolKeys);
