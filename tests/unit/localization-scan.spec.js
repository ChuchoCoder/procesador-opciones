import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// Simple localization scan: ensure no obvious English UI placeholders remain in key directories.
// NOTE: This is heuristic; whitelist certain technical words.

const UI_DIRS = [
  'frontend/src/components',
  'frontend/src/app',
];

const WHITELIST = new Set([
  'CALLS', 'PUTS', 'CSV', 'ID', 'URL', 'HTTP', 'HTTPS', 'API', 'JSON', 'React', 'PO:',
]);

function isSpanishString(str) {
  // Heuristic: if contains common English filler words, flag. This will evolve.
  const englishIndicators = /(Select file|Processing|Cancel|Retry|Refresh|Login|Error|Still syncing)/i;
  return !englishIndicators.test(str);
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const issues = [];
  // Match quoted strings in JSX / JS
  const regex = /['"]([^'"\n]{3,})['"]/g;
  let m;
  while ((m = regex.exec(content)) !== null) {
    const text = m[1].trim();
    if (text.length < 3) continue;
    if (WHITELIST.has(text)) continue;
    if (!isSpanishString(text)) {
      issues.push({ text, filePath });
    }
  }
  return issues;
}

describe('localization scan', () => {
  it('should not find English UI strings outside whitelist', () => {
    const repoRoot = path.resolve(__dirname, '../../..');
    const allIssues = [];
    for (const rel of UI_DIRS) {
      const abs = path.join(repoRoot, rel);
      if (!fs.existsSync(abs)) continue;
      const stack = [abs];
      while (stack.length) {
        const current = stack.pop();
        const stat = fs.statSync(current);
        if (stat.isDirectory()) {
          for (const entry of fs.readdirSync(current)) {
            stack.push(path.join(current, entry));
          }
        } else if (/\.(jsx?|tsx?)$/.test(current)) {
          allIssues.push(...scanFile(current));
        }
      }
    }
    if (allIssues.length) {
      const msg = allIssues.map(i => `${i.filePath}: '${i.text}'`).join('\n');
      throw new Error(`English UI strings detected (translate to es-AR or whitelist):\n${msg}`);
    }
    expect(allIssues.length).toBe(0);
  });
});
