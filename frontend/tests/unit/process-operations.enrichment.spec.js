import { describe, it, expect } from 'vitest';

import {
  parseToken,
  enrichOperationRow,
  deriveGroups,
} from '../../src/services/csv/process-operations.js';

const buildRow = (overrides = {}) => ({
  order_id: 'OP-1',
  symbol: overrides.symbol ?? '',
  expiration: overrides.expiration ?? '',
  security_id: overrides.security_id ?? '',
  side: overrides.side ?? 'BUY',
  option_type: overrides.option_type ?? null,
  strike: overrides.strike ?? null,
  quantity: overrides.quantity ?? 10,
  price: overrides.price ?? 120,
  text: overrides.text ?? '',
  ...overrides,
});

describe('parseToken', () => {
  it('parses CALL, PUT, and decimal strike tokens', () => {
    expect(parseToken('ALUC400.OC')).toMatchObject({
      symbol: 'ALU',
      type: 'CALL',
      strike: 400,
      expiration: 'OC',
    });

    expect(parseToken('GGALV120ENE24')).toMatchObject({
      symbol: 'GGAL',
      type: 'PUT',
      strike: 120,
      expiration: 'ENE24',
    });

    expect(parseToken('GFGC4478.3O')).toMatchObject({
      symbol: 'GFG',
      type: 'CALL',
      strike: 4478.3,
      expiration: 'O',
    });
  });
});

describe('parseToken invalid cases', () => {
  it('returns null when token does not match specification', () => {
    expect(parseToken('GGAL120NOV')).toBeNull();
    expect(parseToken('RANDOM')).toBeNull();
    expect(parseToken('')).toBeNull();
  });
});

describe('enrichOperationRow', () => {
  it('preserves explicit fields and only fills missing ones from token', () => {
    const explicitRow = buildRow({
      symbol: 'GGAL',
      expiration: 'NOV24',
      option_type: 'CALL',
      strike: 120,
      security_id: 'ALUAV300.DIC24',
    });

    const explicitResult = enrichOperationRow(explicitRow);
    expect(explicitResult.symbol).toBe('GGAL');
    expect(explicitResult.expiration).toBe('NOV24');
    expect(explicitResult.type).toBe('CALL');
    expect(explicitResult.strike).toBe(120);
    expect(explicitResult.meta.detectedFromToken).toBe(false);

    const missingExpirationRow = buildRow({
      symbol: 'ALUA',
      expiration: '',
      option_type: 'CALL',
      strike: null,
      security_id: 'ALUAC400.OC',
    });

    const missingExpirationResult = enrichOperationRow(missingExpirationRow);
    expect(missingExpirationResult.symbol).toBe('ALUA');
    expect(missingExpirationResult.expiration).toBe('OC');
    expect(missingExpirationResult.type).toBe('CALL');
    expect(missingExpirationResult.strike).toBe(400);
    expect(missingExpirationResult.meta.detectedFromToken).toBe(true);
    expect(missingExpirationResult.meta.sourceToken).toBe('ALUAC400.OC');
  });
});

describe('deriveGroups', () => {
  it('aggregates calls and puts per symbol + expiration', () => {
    const operations = [
      { id: '1', symbol: 'GGAL', expiration: 'NOV24', type: 'CALL' },
      { id: '2', symbol: 'GGAL', expiration: 'NOV24', type: 'PUT' },
      { id: '3', symbol: 'GGAL', expiration: 'NOV24', type: 'CALL' },
      { id: '4', symbol: 'ALUA', expiration: 'DIC24', type: 'CALL' },
    ];

    const groups = deriveGroups(operations);

    expect(groups).toEqual([
      {
        id: 'ALUA::DIC24',
        symbol: 'ALUA',
        expiration: 'DIC24',
        counts: { calls: 1, puts: 0, total: 1 },
      },
      {
        id: 'GGAL::NOV24',
        symbol: 'GGAL',
        expiration: 'NOV24',
        counts: { calls: 2, puts: 1, total: 3 },
      },
    ]);
  });

  it('groups unknown option rows by symbol with fallback expiration when missing', () => {
    const operations = [
      { id: '1', symbol: 'AL30', expiration: '24HS', type: 'UNKNOWN' },
      { id: '2', symbol: 'AL30', expiration: '24HS', type: 'UNKNOWN' },
      { id: '3', symbol: 'GGAL', expiration: '', type: 'UNKNOWN' },
    ];

    const groups = deriveGroups(operations);

    const al30Group = groups.find((group) => group.id === 'AL30::24HS');
    expect(al30Group).toBeDefined();
    expect(al30Group.counts.total).toBe(2);

    const ggalGroup = groups.find((group) => group.id === 'GGAL::NONE');
    expect(ggalGroup).toBeDefined();
    expect(ggalGroup.counts.total).toBe(1);
  });
});

describe('operation classification', () => {
  it('derives type precedence from explicit field, token, and defaults to UNKNOWN', () => {
    const explicitTypeRow = buildRow({ option_type: 'PUT', symbol: 'GGAL', strike: 110 });
    const explicitResult = enrichOperationRow(explicitTypeRow);
    expect(explicitResult.type).toBe('PUT');
    expect(explicitResult.meta.detectedFromToken).toBe(false);

    const tokenTypeRow = buildRow({
      option_type: null,
      symbol: '',
      strike: null,
      security_id: 'GGALV110ENE24',
    });
    const tokenTypeResult = enrichOperationRow(tokenTypeRow);
    expect(tokenTypeResult.type).toBe('PUT');
    expect(tokenTypeResult.symbol).toBe('GGAL');
    expect(tokenTypeResult.expiration).toBe('ENE24');
    expect(tokenTypeResult.meta.detectedFromToken).toBe(true);

    const unknownRow = buildRow({ option_type: null, symbol: '', security_id: 'OPER' });
    const unknownResult = enrichOperationRow(unknownRow);
    expect(unknownResult.type).toBe('UNKNOWN');
    expect(unknownResult.symbol).toBe('OPER');
    expect(unknownResult.expiration).toBe('NONE');
  });
});
