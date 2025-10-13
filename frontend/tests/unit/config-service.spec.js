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
    prefixRules: 'po.prefixRules',
    expirations: 'po.expirations',
    activeExpiration: 'po.activeExpiration',
    useAveraging: 'po.useAveraging',
    lastReport: 'po.lastReport.v1',
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
          case 'po.prefixRules':
            return {
              ggal: {
                symbol: ' ggal ',
                defaultDecimals: 2,
                strikeOverrides: {
                  '110': 2,
                  '': 4,
                },
                expirationOverrides: {
                  ene24: {
                    defaultDecimals: 3,
                    strikeOverrides: {
                      110: 3,
                    },
                  },
                },
              },
              alua: {
                symbol: 'ALUA',
                defaultDecimals: 0,
              },
            };
          case 'po.expirations':
            return {
              Enero: { suffixes: ['ENE', ' Ene '] },
              Marzo: { suffixes: ['MAR'] },
            };
          case 'po.activeExpiration':
            return 'Marzo';
          case 'po.useAveraging':
            return true;
          default:
            return null;
        }
      });

    const result = service.loadConfiguration();

    expect(result.prefixRules).toEqual({
      GGAL: {
        symbol: 'GGAL',
        defaultDecimals: 2,
        strikeOverrides: {
          110: 2,
        },
        expirationOverrides: {
          ENE24: {
            defaultDecimals: 3,
            strikeOverrides: {
              110: 3,
            },
          },
        },
      },
      ALUA: {
        symbol: 'ALUA',
        defaultDecimals: 0,
        strikeOverrides: {},
        expirationOverrides: {},
      },
    });
    expect(result.expirations).toEqual({
      Enero: { suffixes: ['ENE'] },
      Marzo: { suffixes: ['MAR'] },
    });
    expect(result.activeExpiration).toBe('Marzo');
    expect(result.useAveraging).toBe(true);
  });

  it('falls back to defaults when persisted data is invalid', () => {
    storageAvailableMock.mockReturnValue(true);

    readItemMock.mockImplementation((key) => {
      switch (key) {
        case 'po.prefixRules':
          return 'not-an-object';
        case 'po.expirations':
          return null;
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
      prefixRules: {
        ggal: {
          symbol: ' ggal ',
          defaultDecimals: '2',
          strikeOverrides: {
            '110': '3',
            '': '5',
          },
          expirationOverrides: {
            ene24: {
              defaultDecimals: '4',
              strikeOverrides: {
                '110': '5',
              },
            },
          },
        },
      },
      expirations: {
        Enero: { suffixes: [' ene ', 'ENE'] },
        Marzo: { suffixes: ['MAR'] },
      },
      activeExpiration: 'Marzo',
      useAveraging: true,
    };

    const result = service.saveConfiguration(config);

    expect(writeItemMock).toHaveBeenCalledTimes(4);
    expect(writeItemMock).toHaveBeenCalledWith('po.prefixRules', {
      GGAL: {
        symbol: 'GGAL',
        defaultDecimals: 2,
        strikeOverrides: {
          110: 3,
        },
        expirationOverrides: {
          ENE24: {
            defaultDecimals: 4,
            strikeOverrides: {
              110: 5,
            },
          },
        },
      },
    });
    expect(writeItemMock).toHaveBeenCalledWith('po.expirations', {
      Enero: { suffixes: ['ENE'] },
      Marzo: { suffixes: ['MAR'] },
    });
    expect(writeItemMock).toHaveBeenCalledWith('po.activeExpiration', 'Marzo');
    expect(writeItemMock).toHaveBeenCalledWith('po.useAveraging', true);

    expect(result.prefixRules.GGAL.defaultDecimals).toBe(2);
    expect(result.prefixRules.GGAL.strikeOverrides).toEqual({ 110: 3 });
    expect(result.prefixRules.GGAL.expirationOverrides).toEqual({
      ENE24: {
        defaultDecimals: 4,
        strikeOverrides: { 110: 5 },
      },
    });
    expect(result.expirations.Enero.suffixes).toEqual(['ENE']);
  });

  it('resets configuration to defaults and clears persisted values', () => {
    storageAvailableMock.mockReturnValue(true);

    const result = service.resetConfiguration();

    expect(writeItemMock).toHaveBeenCalledTimes(4);
    expect(writeItemMock).toHaveBeenCalledWith('po.expirations', service.DEFAULT_CONFIGURATION.expirations);
    expect(writeItemMock).toHaveBeenCalledWith('po.activeExpiration', service.DEFAULT_CONFIGURATION.activeExpiration);
    expect(writeItemMock).toHaveBeenCalledWith('po.useAveraging', service.DEFAULT_CONFIGURATION.useAveraging);
    expect(writeItemMock).toHaveBeenCalledWith('po.prefixRules', service.DEFAULT_CONFIGURATION.prefixRules);

    expect(result).toEqual(service.DEFAULT_CONFIGURATION);
  });
});
