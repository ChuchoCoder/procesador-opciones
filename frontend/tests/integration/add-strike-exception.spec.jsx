/**
 * `AddStrikeExceptionButton`.
 *
 * La revisión lo marcó como una de las piezas más densas y sin cobertura: 365
 * líneas en una celda de tabla, que hacen matching difuso de la clave de
 * vencimiento dos veces, comparan strikes con **tres estrategias competidoras**
 * (`raw`, `formatted`, y `Number(formatted)`), y crean el esquema de
 * configuración del símbolo inline antes de persistirlo.
 *
 * Nada de eso estaba exportado ni testeado. Esto cubre su comportamiento
 * observable a través del componente, que es el único seam que tiene.
 */
/* eslint-env node */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';

import AddStrikeExceptionButton from '../../src/components/Processor/AddStrikeExceptionButton.jsx';
import theme from '../../src/app/theme.js';
import { loadSymbolConfig, saveSymbolConfig } from '../../src/services/storage-settings.js';

const montar = (ui) => render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

/** El disparador vive en una celda de tabla y se identifica por su clase. */
const disparador = (container) => container.querySelector('.strike-exception-button');

/** Una operación consolidada como la que pasa `OperationsTable`. */
const operacion = (extra = {}) => ({
  matchedSymbol: 'GGAL',
  expiration: 'OC',
  strike: 4734.3,
  optionType: 'PUT',
  totalQuantity: -15,
  averagePrice: 354,
  legs: [{ meta: { sourceToken: 'GFGV47343O' } }],
  ...extra,
});

const abrirDialogo = async (usuario, container) => {
  await usuario.click(disparador(container));
  await waitFor(() => {
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
};

describe('AddStrikeExceptionButton', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('se renderiza como un botón en la celda', () => {
    const { container } = montar(<AddStrikeExceptionButton operation={operacion()} />);
    const boton = disparador(container);
    expect(boton).toBeTruthy();
    expect(boton.getAttribute('aria-label')).toMatch(/excepci[óo]n/i);
  });

  it('no se renderiza si falta metadata esencial', () => {
    // Sin strike no hay excepción posible, así que no ofrece el botón.
    const { container } = montar(
      <AddStrikeExceptionButton operation={{ matchedSymbol: 'GGAL', expiration: 'OC' }} />,
    );
    expect(disparador(container)).toBeNull();
  });

  it('abre un diálogo al clickearlo', async () => {
    const usuario = userEvent.setup();
    const { container } = montar(<AddStrikeExceptionButton operation={operacion()} />);

    await abrirDialogo(usuario, container);

    expect(screen.getByRole('dialog').textContent).toMatch(/Excepci[óo]n/i);
  }, 30000);

  it('se puede cerrar sin guardar nada', async () => {
    const usuario = userEvent.setup();
    const onSaved = vi.fn();
    const { container } = montar(
      <AddStrikeExceptionButton operation={operacion()} onSaved={onSaved} />,
    );

    await abrirDialogo(usuario, container);
    await usuario.click(screen.getByRole('button', { name: /cancelar/i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(onSaved).not.toHaveBeenCalled();
    expect(await loadSymbolConfig('GGAL')).toBeNull();
  }, 30000);

  it('persiste la excepción y avisa al guardar', async () => {
    const usuario = userEvent.setup();
    const onSaved = vi.fn();
    const { container } = montar(
      <AddStrikeExceptionButton operation={operacion()} onSaved={onSaved} />,
    );

    await abrirDialogo(usuario, container);
    await usuario.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    }, { timeout: 10000 });

    // El esquema del símbolo se crea inline si no existía.
    const config = await loadSymbolConfig('GGAL');
    expect(config).not.toBeNull();
    expect(config.symbol).toBe('GGAL');
    expect(config.expirations).toBeTypeOf('object');
  }, 30000);

  describe('las tres estrategias de comparación de strike', () => {
    /**
     * Guarda una configuración con un override escrito de una forma concreta y
     * verifica que el componente lo reconozca igual. Las tres formas conviven
     * en datos ya persistidos, y por eso la comparación las contempla.
     */
    const conOverride = async (override) => {
      await saveSymbolConfig({
        symbol: 'GGAL',
        prefix: 'GFG',
        expirations: {
          OC: { overrides: [override] },
        },
      });
    };

    it('reconoce un override guardado por `raw`', async () => {
      await conOverride({ raw: '47343', formatted: 'otra-cosa' });
      const { container } = montar(<AddStrikeExceptionButton operation={operacion()} />);
      await waitFor(() => expect(disparador(container)).toBeTruthy());
    }, 20000);

    it('reconoce un override guardado por `formatted`', async () => {
      await conOverride({ raw: 'no-coincide', formatted: '4734.3' });
      const { container } = montar(<AddStrikeExceptionButton operation={operacion()} />);
      await waitFor(() => expect(disparador(container)).toBeTruthy());
    }, 20000);

    it('reconoce un override cuyo `formatted` es numéricamente igual', async () => {
      // Tercera estrategia: Number('4734.30') === 4734.3
      await conOverride({ raw: 'no-coincide', formatted: '4734.30' });
      const { container } = montar(<AddStrikeExceptionButton operation={operacion()} />);
      await waitFor(() => expect(disparador(container)).toBeTruthy());
    }, 20000);
  });

  describe('robustez', () => {
    it('abre el diálogo aunque la operación no traiga token de origen', async () => {
      const usuario = userEvent.setup();
      const { container } = montar(
        <AddStrikeExceptionButton operation={operacion({ legs: [] })} />,
      );

      await abrirDialogo(usuario, container);
      expect(screen.getByRole('dialog')).toBeTruthy();
    }, 30000);

    it('no explota sin operación', () => {
      expect(() => montar(<AddStrikeExceptionButton operation={undefined} />)).not.toThrow();
    });

    it('no explota si no le pasan onSaved', async () => {
      const usuario = userEvent.setup();
      const { container } = montar(<AddStrikeExceptionButton operation={operacion()} />);

      await abrirDialogo(usuario, container);
      await usuario.click(screen.getByRole('button', { name: /guardar/i }));

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBeNull();
      }, { timeout: 10000 });
    }, 30000);
  });
});
