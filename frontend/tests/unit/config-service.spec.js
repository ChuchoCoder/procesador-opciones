import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const readItemMock = vi.fn();
const writeItemMock = vi.fn();
const removeItemMock = vi.fn();
const storageAvailableMock = vi.fn();

const mockStorageModule = () => ({
  readItem: readItemMock,
  writeItem: writeItemMock,
  removeItem: removeItemMock,
  storageAvailable: storageAvailableMock,
  storageKeys: {
    symbols: 'po.symbols',
    expirations: 'po.expirations',
    activeSymbol: 'po.activeSymbol',
    activeExpiration: 'po.activeExpiration',
    useAveraging: 'po.useAveraging',
  },
});

describe('config-service', () => {
  let service;

  const importService = async () => {
    service = await import('../../src/services/storage/config-service.js');
  };

  beforeEach(async () => {
    vi.resetModules();
    vi.doMock('../../src/services/storage/local-storage.js', mockStorageModule);
    readItemMock.mockReset();
    writeItemMock.mockReset();
    removeItemMock.mockReset();
    storageAvailableMock.mockReset();
    await importService();
  });

  afterEach(() => {
    vi.resetModules();
    vi.doUnmock('../../src/services/storage/local-storage.js');
  });

  it('returns defaults when storage is unavailable', () => {
    storageAvailableMock.mockReturnValue(false);

    const result = service.loadConfiguration();

    expect(result).toEqual(service.DEFAULT_CONFIGURATION);
    expect(readItemMock).not.toHaveBeenCalled();
  });

  it('loads and sanitizes persisted configuration when available', () => {
    storageAvailableMock.mockReturnValue(true);

    readItemMock
      .mockImplementation((key) => {
        switch (key) {
          case 'po.symbols':
            return ['GGAL', 'ALUA', ''];
          case 'po.expirations':
            return {
              Enero: { suffixes: ['ENE', ' Ene '] },
              Marzo: { suffixes: ['MAR'] },
            };
          case 'po.activeSymbol':
            return 'ALUA';
          case 'po.activeExpiration':
            return 'Marzo';
          case 'po.useAveraging':
            return true;
          default:
            return null;
        }
      });

    const result = service.loadConfiguration();

    expect(result.symbols).toEqual(['GGAL', 'ALUA']);
    expect(result.expirations).toEqual({
      Enero: { suffixes: ['ENE'] },
      Marzo: { suffixes: ['MAR'] },
    });
    expect(result.activeSymbol).toBe('ALUA');
    expect(result.activeExpiration).toBe('Marzo');
    expect(result.useAveraging).toBe(true);
  });

  it('falls back to defaults when persisted data is invalid', () => {
    storageAvailableMock.mockReturnValue(true);

    readItemMock.mockImplementation((key) => {
      switch (key) {
        case 'po.symbols':
          return 'not-an-array';
        case 'po.expirations':
          return null;
        case 'po.activeSymbol':
          return 'UNKNOWN';
        case 'po.activeExpiration':
          return 'Missing';
        case 'po.useAveraging':
          return 'not-a-boolean';
        default:
          return null;
      }
    });

    const result = service.loadConfiguration();

    expect(result).toEqual(service.DEFAULT_CONFIGURATION);
  });

  it('persists sanitized configuration slices when saving', () => {
    storageAvailableMock.mockReturnValue(true);

    const config = {
      symbols: [' GGAL ', 'ALUA', 'GGAL'],
      expirations: {
        Enero: { suffixes: [' ene ', 'ENE'] },
        Marzo: { suffixes: ['MAR'] },
      },
      activeSymbol: 'GGAL',
      activeExpiration: 'Marzo',
      useAveraging: true,
    };

    const result = service.saveConfiguration(config);

    expect(writeItemMock).toHaveBeenCalledTimes(5);
    expect(writeItemMock).toHaveBeenCalledWith('po.symbols', ['GGAL', 'ALUA']);
    expect(writeItemMock).toHaveBeenCalledWith('po.expirations', {
      Enero: { suffixes: ['ENE'] },
      Marzo: { suffixes: ['MAR'] },
    });
    expect(writeItemMock).toHaveBeenCalledWith('po.activeSymbol', 'GGAL');
    expect(writeItemMock).toHaveBeenCalledWith('po.activeExpiration', 'Marzo');
    expect(writeItemMock).toHaveBeenCalledWith('po.useAveraging', true);

    expect(result.symbols).toEqual(['GGAL', 'ALUA']);
    expect(result.expirations.Enero.suffixes).toEqual(['ENE']);
  });

  it('resets configuration to defaults and clears persisted values', () => {
    storageAvailableMock.mockReturnValue(true);

    const result = service.resetConfiguration();

    expect(writeItemMock).toHaveBeenCalledTimes(5);
    expect(writeItemMock).toHaveBeenCalledWith('po.symbols', service.DEFAULT_CONFIGURATION.symbols);
    expect(writeItemMock).toHaveBeenCalledWith('po.expirations', service.DEFAULT_CONFIGURATION.expirations);
    expect(writeItemMock).toHaveBeenCalledWith('po.activeSymbol', service.DEFAULT_CONFIGURATION.activeSymbol);
    expect(writeItemMock).toHaveBeenCalledWith('po.activeExpiration', service.DEFAULT_CONFIGURATION.activeExpiration);
    expect(writeItemMock).toHaveBeenCalledWith('po.useAveraging', service.DEFAULT_CONFIGURATION.useAveraging);

    expect(result).toEqual(service.DEFAULT_CONFIGURATION);
  });
});
