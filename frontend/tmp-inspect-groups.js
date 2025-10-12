import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { processOperations } from './src/services/csv/process-operations.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const run = async () => {
  const filePath = path.resolve(__dirname, 'tests/integration/data/GGAL-PUTS.csv');
  const buffer = fs.readFileSync(filePath);
  const result = await processOperations({
    file: { arrayBuffer: async () => buffer },
    fileName: 'GGAL-PUTS.csv',
    configuration: {
      symbols: [],
      expirations: {},
      activeSymbol: '',
      activeExpiration: '',
      useAveraging: false,
    },
  });

  console.log(JSON.stringify({
    groups: result.groups,
    options: result.operations.map((op) => ({
      symbol: op.symbol,
      expiration: op.expiration,
      originalSymbol: op.originalSymbol,
      groupKey: `${op.symbol || ''}::${op.expiration || ''}`,
    })),
  }, null, 2));
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
