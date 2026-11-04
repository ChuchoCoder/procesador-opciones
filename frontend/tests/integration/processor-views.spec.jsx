/**
 * Tests de componente de las tres vistas que no tenían ninguno.
 *
 * Se alimentan con operaciones del pipeline real (`processOperations`), no con
 * fixtures a mano, porque lo que interesa verificar es justamente que la vista
 * sabe leer la forma de fila que produce producción.
 */
/* eslint-env node */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';

import CompraVentaView from '../../src/components/Processor/CompraVentaView.jsx';
import ArbitrajesView from '../../src/components/Processor/ArbitrajesView.jsx';
import ReconciliationView from '../../src/components/Processor/ReconciliationView.jsx';
import strings from '../../src/strings/es-AR.js';
import theme from '../../src/app/theme.js';
import { loadEnrichedOperations, loadReport } from './helpers/arbitrage-pipeline.js';
import { storageKeys } from '../../src/services/storage/local-storage.js';

const processorStrings = strings.processor;

const montar = (ui) => render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

// Filas del cuerpo de una tabla. No usar `querySelectorAll('tbody tr')`: con
// varias tablas en la página, jsdom devuelve también filas de las otras.
const filasDe = (tabla) => [...tabla.tBodies[0].rows];

const propsFiltro = {
  groupOptions: [],
  selectedGroupId: [],
  onGroupChange: () => {},
};

describe('vistas del Procesador', () => {
  let operaciones;

  beforeAll(async () => {
    operaciones = await loadEnrichedOperations('Arbitraje-Plazos.csv');
    expect(operaciones.length).toBeGreaterThan(0);
  }, 60000);

  afterEach(() => {
    cleanup();
    // La grilla elegida (operaciones o neto) se persiste: que no pase de un test a otro.
    localStorage.removeItem(storageKeys.compraVentaView);
  });

  describe('CompraVentaView', () => {
    it('muestra filas con valores reales, no el estado vacío', () => {
      montar(
        <CompraVentaView
          operations={operaciones}
          strings={processorStrings}
          expirationLabels={{}}
          {...propsFiltro}
        />,
      );

      const compras = screen.getByTestId('processor-buy-table');
      expect(screen.getByTestId('processor-sell-table')).toBeTruthy();

      // No alcanza con que exista la tabla: tiene que mostrar operaciones.
      expect(compras.textContent).not.toContain('Sin datos');
      const filas = filasDe(compras);
      expect(filas.length).toBeGreaterThan(1);

      // Cada fila trae símbolo, venue, cantidad, precio y neto.
      const celdas = [...filas[0].querySelectorAll('td')].map((c) => c.textContent.trim());
      expect(celdas.length).toBeGreaterThanOrEqual(5);
      expect(celdas[0]).toBeTruthy();
      expect(['CI', '24HS']).toContain(celdas[1]);
      // El neto de una compra es negativo.
      expect(celdas[celdas.length - 1]).toMatch(/^-/);
    });

    it('filtra por plazo y recalcula el neto de nominales', async () => {
      const user = userEvent.setup();
      montar(
        <CompraVentaView
          operations={operaciones}
          strings={processorStrings}
          expirationLabels={{}}
          {...propsFiltro}
        />,
      );

      // Plazo de cada fila; la fila de "Sin datos" no tiene segunda celda.
      const plazosDe = (testId) => filasDe(screen.getByTestId(testId))
        .map((fila) => fila.cells[1]?.textContent.trim())
        .filter(Boolean);
      const plazosVisibles = () => new Set([
        ...plazosDe('processor-buy-table'),
        ...plazosDe('processor-sell-table'),
      ]);
      const plazosIniciales = [...plazosVisibles()];
      // El fixture opera en más de un plazo: si no, filtrar no probaría nada.
      expect(plazosIniciales).toEqual(expect.arrayContaining(['CI', '24HS']));

      // Neto por símbolo según la grilla del neto, que se ve en lugar de las
      // de operaciones. En cada fila, y en el total, neto = comprado - vendido;
      // el total suma las filas que se ven.
      const numeros = (fila) => [...fila.cells].slice(1)
        .map((c) => Number(c.textContent.trim().replace(/[+,]/g, '')));
      const netoPorSimbolo = async () => {
        await user.click(screen.getByTestId('processor-view-net-nominals'));
        const tabla = screen.getByTestId('processor-net-nominals-table');
        const netos = Object.fromEntries(filasDe(tabla).map((fila) => {
          const [comprado, vendido, neto] = numeros(fila);
          expect(comprado + vendido).toBe(neto);
          return [fila.cells[0].textContent.trim(), neto];
        }));
        const [compradoTotal, vendidoTotal, netoTotal] = numeros(tabla.tFoot.rows[0]);
        expect(compradoTotal + vendidoTotal).toBe(netoTotal);
        const sumaFilas = Object.values(netos).reduce((a, b) => a + b, 0);
        // Cada fila se muestra redondeada: medio nominal de diferencia por fila.
        expect(Math.abs(sumaFilas - netoTotal)).toBeLessThanOrEqual(Object.keys(netos).length / 2);
        await user.click(screen.getByTestId('processor-view-operations'));
        return netos;
      };
      const netoTodos = await netoPorSimbolo();
      expect(Object.keys(netoTodos).length).toBeGreaterThan(0);

      // Elegir cada plazo por separado: sólo se ven sus filas, y los netos de
      // todos los plazos suman el neto de "Todos".
      const suma = {};
      for (const plazo of plazosIniciales) {
        await user.click(screen.getByTestId(`settlement-filter-option-${plazo}`));
        expect(plazosVisibles()).toEqual(new Set([plazo]));
        Object.entries(await netoPorSimbolo()).forEach(([simbolo, neto]) => {
          suma[simbolo] = (suma[simbolo] ?? 0) + neto;
        });
        // Volver a hacer click deselecciona: sin selección es "Todos".
        await user.click(screen.getByTestId(`settlement-filter-option-${plazo}`));
      }
      // Los valores mostrados están redondeados a enteros, y redondear cada
      // plazo no conmuta con sumar: se admite medio nominal por plazo.
      Object.entries(netoTodos).forEach(([simbolo, neto]) => {
        expect(Math.abs(suma[simbolo] - neto)).toBeLessThanOrEqual(plazosIniciales.length / 2);
      });

      await user.click(screen.getByTestId('settlement-filter-option-CI'));
      await user.click(screen.getByTestId('settlement-filter-option-all'));
      expect(plazosVisibles()).toEqual(new Set(plazosIniciales));
    }, 30000);

    it('olvida un plazo elegido que el filtro de instrumento hizo desaparecer', async () => {
      const user = userEvent.setup();
      const vista = (ops) => (
        <ThemeProvider theme={theme}>
          <CompraVentaView
            operations={ops}
            strings={processorStrings}
            expirationLabels={{}}
            {...propsFiltro}
          />
        </ThemeProvider>
      );
      const { rerender } = render(vista(operaciones));
      const plazosDe = (testId) => new Set(filasDe(screen.getByTestId(testId))
        .map((fila) => fila.cells[1]?.textContent.trim())
        .filter(Boolean));
      const todos = plazosDe('processor-buy-table');

      await user.click(screen.getByTestId('settlement-filter-option-CI'));
      expect(plazosDe('processor-buy-table')).toEqual(new Set(['CI']));

      // Sin operaciones no hay plazo CI: la selección se descarta...
      rerender(vista([]));
      // ...y no vuelve a filtrar cuando CI reaparece.
      rerender(vista(operaciones));
      expect(plazosDe('processor-buy-table')).toEqual(todos);
      expect(screen.getByTestId('settlement-filter-option-all').getAttribute('aria-pressed')).toBe('true');
    }, 30000);

    it('muestra o las operaciones o el neto de nominales, y recuerda la elección', async () => {
      const user = userEvent.setup();
      const vista = () => montar(
        <CompraVentaView
          operations={operaciones}
          strings={processorStrings}
          expirationLabels={{}}
          {...propsFiltro}
        />,
      );
      const boton = (testId) => screen.getByTestId(testId);
      const elegido = (testId) => boton(testId).getAttribute('aria-pressed');

      const { unmount } = vista();
      // Por defecto, las operaciones; el neto no está.
      expect(elegido('processor-view-operations')).toBe('true');
      expect(screen.getByTestId('processor-buy-table')).toBeTruthy();
      expect(screen.getByTestId('processor-sell-table')).toBeTruthy();
      expect(screen.queryByTestId('processor-net-nominals-table')).toBeNull();

      await user.click(boton('processor-view-net-nominals'));
      expect(elegido('processor-view-net-nominals')).toBe('true');
      expect(screen.queryByTestId('processor-buy-table')).toBeNull();
      expect(screen.queryByTestId('processor-sell-table')).toBeNull();
      const tabla = screen.getByTestId('processor-net-nominals-table');
      expect(filasDe(tabla).length).toBeGreaterThan(0);
      expect(screen.getByTestId('processor-net-nominals-total').textContent).toMatch(/^Total/);

      // Tocar la grilla ya elegida no deja la vista sin ninguna.
      await user.click(boton('processor-view-net-nominals'));
      expect(screen.getByTestId('processor-net-nominals-table')).toBeTruthy();

      // Al volver a la vista sigue en el neto.
      unmount();
      vista();
      expect(screen.getByTestId('processor-net-nominals-table')).toBeTruthy();
      expect(screen.queryByTestId('processor-buy-table')).toBeNull();

      await user.click(boton('processor-view-operations'));
      expect(screen.queryByTestId('processor-net-nominals-table')).toBeNull();
      expect(filasDe(screen.getByTestId('processor-buy-table')).length).toBeGreaterThan(1);
    }, 30000);

    it('no explota sin operaciones', () => {
      montar(
        <CompraVentaView
          operations={[]}
          strings={processorStrings}
          expirationLabels={{}}
          {...propsFiltro}
        />,
      );
      // Sin datos sigue habiendo estructura, no un crash.
      expect(screen.queryByTestId('processor-buy-table')).toBeTruthy();
    });
  });

  describe('ArbitrajesView', () => {
    it('calcula y muestra la tabla de arbitrajes', async () => {
      montar(
        <ArbitrajesView
          operations={operaciones}
          strings={processorStrings}
          {...propsFiltro}
        />,
      );

      // La vista arranca un pipeline asíncrono (parse -> agregación -> P&L)
      // con yields de paint, así que hay que esperarlo.
      await waitFor(
        () => {
          expect(screen.getByRole('table')).toBeTruthy();
        },
        { timeout: 20000 },
      );

      // Y la tabla tiene resultados de verdad: instrumento, plazo y P&L.
      const tabla = screen.getByRole('table');
      await waitFor(() => {
        expect(filasDe(tabla).length).toBeGreaterThan(0);
      }, { timeout: 20000 });

      expect(tabla.textContent).toMatch(/S31O5|D31O5|TX26/);
      // Montos con separador de miles y símbolo de moneda.
      expect(tabla.textContent).toMatch(/ARS/);
    }, 40000);

    it('no explota sin operaciones', async () => {
      montar(
        <ArbitrajesView operations={[]} strings={processorStrings} {...propsFiltro} />,
      );
      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).toBeNull();
      }, { timeout: 10000 });
    }, 20000);
  });

  describe('ReconciliationView', () => {
    let csvOps;
    let brokerOps;

    beforeAll(async () => {
      // La conciliación consume las operaciones NORMALIZADAS —las que tienen
      // `order_id`, `action` y `tradeTimestamp`—, no las de `report.operations`.
      // Es lo que le pasa ProcessorScreen vía `fusionarOperacionesCsv`.
      const report = await loadReport('Arbitraje-Plazos.csv');
      const porOrden = new Map();
      (report.normalizedOperations ?? []).forEach((op) => {
        if (!porOrden.has(op.order_id)) porOrden.set(op.order_id, []);
        porOrden.get(op.order_id).push(op);
      });

      // Órdenes completas: la conciliación colapsa los fills por order_id, así
      // que pasarle una porción de una orden da cantidades que no coinciden.
      const ordenes = [...porOrden.keys()].slice(0, 6);
      csvOps = ordenes.flatMap((id) => porOrden.get(id));
      // El broker vio las mismas órdenes salvo la última: eso deja una ausente.
      brokerOps = ordenes.slice(0, 5)
        .flatMap((id) => porOrden.get(id))
        .map((op) => ({ ...op, source: 'broker' }));
    }, 60000);

    const props = () => ({
      strings: processorStrings,
      csvOperations: csvOps,
      brokerOperations: brokerOps,
      ...propsFiltro,
    });

    it('pide las dos fuentes antes de poder conciliar', () => {
      montar(
        <ReconciliationView
          strings={processorStrings}
          csvOperations={csvOps}
          brokerOperations={[]}
          {...propsFiltro}
        />,
      );
      expect(screen.queryByTestId('reconciliation-tab-matched')).toBeNull();
      expect(screen.getByText(processorStrings.reconciliation.emptyNeedsBothSources)).toBeTruthy();
    });

    it('muestra filas en la pestaña de coincidentes', () => {
      montar(<ReconciliationView {...props()} />);

      const tabla = screen.getByTestId('reconciliation-matched-table');
      expect(filasDe(tabla).length).toBeGreaterThan(0);
    });

    it('muestra filas en la pestaña de diferencias', async () => {
      const usuario = userEvent.setup();
      montar(<ReconciliationView {...props()} />);

      await usuario.click(screen.getByTestId('reconciliation-tab-mismatched'));

      await waitFor(() => {
        const tabla = screen.getByTestId('reconciliation-mismatched-table');
        expect(filasDe(tabla).length).toBeGreaterThan(0);
      });
    }, 30000);

    it('muestra la orden que el broker no vio', async () => {
      const usuario = userEvent.setup();
      montar(<ReconciliationView {...props()} />);

      await usuario.click(screen.getByTestId('reconciliation-tab-absent'));

      await waitFor(() => {
        const tabla = screen.getByTestId('reconciliation-absent-table');
        expect(filasDe(tabla).length).toBeGreaterThan(0);
      });
    }, 30000);

    it('resume el resultado en los chips', () => {
      montar(<ReconciliationView {...props()} />);

      const resumen = processorStrings.reconciliation;
      const conEtiqueta = (etiqueta) => screen.getAllByText(
        (contenido) => contenido.startsWith(`${etiqueta}: `),
      );
      expect(conEtiqueta(resumen.summaryMatched).length).toBeGreaterThan(0);
      expect(conEtiqueta(resumen.summaryAbsentBroker).length).toBeGreaterThan(0);
    });
  });
});
