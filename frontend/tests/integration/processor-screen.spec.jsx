/**
 * El primer test de componente del repo.
 *
 * La suite tenía `@testing-library/react` instalado y configurado y ni un solo
 * `render()`: el arnés estaba armado y sin usar, porque no había nada a qué
 * llamar que no fuera un componente de 1300 líneas.
 *
 * Esto cubre el ciclo de vida del procesamiento end-to-end a través de la UI
 * —seleccionar un CSV, procesarlo, ver la tabla— que es lo que ninguna prueba
 * de servicio puede verificar: el cableado.
 */
/* eslint-env node */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import { HashRouter } from 'react-router-dom';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import ProcessorScreen from '../../src/components/Processor/ProcessorScreen.jsx';
import { ConfigProvider } from '../../src/state/config-context.jsx';
import theme from '../../src/app/theme.js';

const dataDir = resolve(dirname(fileURLToPath(import.meta.url)), 'data');

const montar = () => render(
  <ThemeProvider theme={theme}>
    <HashRouter>
      <ConfigProvider>
        <ProcessorScreen />
      </ConfigProvider>
    </HashRouter>
  </ThemeProvider>,
);

/** Un File real a partir de un fixture del repo. */
const archivoFixture = async (nombre) => {
  const contenido = await readFile(resolve(dataDir, nombre), 'utf-8');
  return new File([contenido], nombre, { type: 'text/csv' });
};

describe('ProcessorScreen', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('monta sin reporte y sin explotar', async () => {
    montar();
    // El estado inicial no muestra tablas de operaciones.
    await waitFor(() => {
      expect(screen.queryByTestId('processor-calls-table')).toBeNull();
    });
  });

  it('procesa un CSV seleccionado y muestra las operaciones', async () => {
    const usuario = userEvent.setup();
    const { container } = montar();

    const input = container.querySelector('input[type="file"]');
    expect(input).not.toBeNull();

    await usuario.upload(input, await archivoFixture('GGAL-PUTS.csv'));

    // El ciclo completo: fuente seleccionada -> procesando -> listo.
    // Que aparezca la tabla de PUTS prueba que el auto-procesamiento corrió,
    // que el reporte llegó al estado y que la vista inicial se eligió sola.
    await waitFor(
      () => {
        expect(screen.getByTestId('processor-puts-table')).toBeTruthy();
      },
      { timeout: 15000 },
    );
  }, 30000);

  it('no deja la pantalla en "procesando" para siempre si el archivo es inválido', async () => {
    const usuario = userEvent.setup();
    const { container } = montar();

    const input = container.querySelector('input[type="file"]');
    await usuario.upload(
      input,
      new File(['esto no es un csv de operaciones'], 'basura.csv', { type: 'text/csv' }),
    );

    // Un CSV sin operaciones procesables tiene que terminar en un error visible
    // y soltar la fuente, no quedar colgado ni re-procesar en loop.
    await waitFor(
      () => {
        expect(screen.queryByTestId('processor-puts-table')).toBeNull();
        expect(screen.queryByRole('progressbar')).toBeNull();
      },
      { timeout: 15000 },
    );
  }, 30000);
});
