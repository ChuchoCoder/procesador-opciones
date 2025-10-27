import { describe, it, expect } from 'vitest';
import { validateEntries, __TESTS__ } from '../parsers.js';

describe('parsers.validateEntries', () => {
  it('filters and canonicalizes supported entries', () => {
    const input = ['of', 'bi', 'xX', 'LA', 'bi'];
    const out = validateEntries(input);
    expect(out).toContain('OF');
    expect(out).toContain('BI');
    expect(out).toContain('LA');
    expect(out).not.toContain('XX');
    // no duplicates
    const uniq = new Set(out);
    expect(uniq.size).toBe(out.length);
  });
});
