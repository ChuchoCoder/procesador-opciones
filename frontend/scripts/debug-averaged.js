#!/usr/bin/env node
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { processOperations } from '../src/services/csv/process-operations.js';
import { JsonDataSource } from '../src/services/data-sources/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const filePath = resolve(__dirname, '..', 'tests', 'integration', 'data', 'Put-Operations-2025-10-27.json');
  const content = await readFile(filePath, 'utf-8');
  const jsonData = JSON.parse(content);

  const dataSource = new JsonDataSource();
  const configuration = { useAveraging: true, prefixMap: {} };

  const result = await processOperations({
    dataSource,
    file: jsonData,
    fileName: 'Put-Operations-2025-10-27.json',
    configuration,
  });

  const averaged = result.views?.averaged?.puts?.operations || [];
  console.log('Averaged PUTs count:', averaged.length);
  console.log(JSON.stringify(averaged, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
