/**
 * `DataSourcesPanel`: la hora de la última sync con el broker queda a la vista
 * junto al botón de sincronizar, y se marca como desactualizada cuando pasa el
 * umbral. Antes sólo aparecía dentro del popover, y era fácil comparar contra
 * el broker datos de hace media hora sin darse cuenta.
 */
/* eslint-env node */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';

import DataSourcesPanel from '../../src/components/Processor/DataSourcesPanel.jsx';
import theme from '../../src/app/theme.js';
import { UMBRAL_DESACTUALIZADA_MS } from '../../src/services/ultima-sync.js';

const SYNC = Date.parse('2026-11-20T12:09:18-03:00');

const montar = (brokerSource) => render(
  <ThemeProvider theme={theme}>
    <DataSourcesPanel
      brokerSource={{ connected: true, accountId: '17825', operationCount: 24, ...brokerSource }}
      onRefreshBroker={() => {}}
    />
  </ThemeProvider>,
);

describe('DataSourcesPanel — última sync', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(SYNC + 10 * 1000);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('muestra la hora de la última sync sin abrir el panel', () => {
    montar({ lastSyncTimestamp: SYNC });

    const etiqueta = screen.getByTestId('ultima-sync');
    expect(etiqueta.textContent).toBe('Sync 12:09:18');
    expect(etiqueta.dataset.desactualizada).toBeUndefined();
  });

  it('avisa que está desactualizada cuando pasa el umbral, sin recargar', () => {
    montar({ lastSyncTimestamp: SYNC });

    act(() => {
      vi.advanceTimersByTime(UMBRAL_DESACTUALIZADA_MS);
    });

    const etiqueta = screen.getByTestId('ultima-sync');
    expect(etiqueta.dataset.desactualizada).toBe('true');
    expect(etiqueta.textContent).toContain('Sync 12:09:18');
    expect(etiqueta.textContent).toContain('hace 5 minutos');
  });

  it('mientras sincroniza lo dice en lugar de la hora', () => {
    montar({ lastSyncTimestamp: SYNC, syncing: true });

    expect(screen.getByTestId('ultima-sync').textContent).toBe('Sincronizando…');
  });

  it('sin una sync previa no muestra hora', () => {
    montar({ lastSyncTimestamp: null });

    expect(screen.queryByTestId('ultima-sync')).toBeNull();
  });
});
