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

const processorStrings = strings.processor;

const montar = (ui) => render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

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

  afterEach(() => cleanup());

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
      const filas = compras.querySelectorAll('tbody tr');
      expect(filas.length).toBeGreaterThan(1);

      // Cada fila trae símbolo, venue, cantidad, precio y neto.
      const celdas = [...filas[0].querySelectorAll('td')].map((c) => c.textContent.trim());
      expect(celdas.length).toBeGreaterThanOrEqual(5);
      expect(celdas[0]).toBeTruthy();
      expect(['CI', '24HS']).toContain(celdas[1]);
      // El neto de una compra es negativo.
      expect(celdas[celdas.length - 1]).toMatch(/^-/);
    });

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
        expect(tabla.querySelectorAll('tbody tr').length).toBeGreaterThan(0);
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
      expect(tabla.querySelectorAll('tbody tr').length).toBeGreaterThan(0);
    });

    it('muestra filas en la pestaña de diferencias', async () => {
      const usuario = userEvent.setup();
      montar(<ReconciliationView {...props()} />);

      await usuario.click(screen.getByTestId('reconciliation-tab-mismatched'));

      await waitFor(() => {
        const tabla = screen.getByTestId('reconciliation-mismatched-table');
        expect(tabla.querySelectorAll('tbody tr').length).toBeGreaterThan(0);
      });
    }, 30000);

    it('muestra la orden que el broker no vio', async () => {
      const usuario = userEvent.setup();
      montar(<ReconciliationView {...props()} />);

      await usuario.click(screen.getByTestId('reconciliation-tab-absent'));

      await waitFor(() => {
        const tabla = screen.getByTestId('reconciliation-absent-table');
        expect(tabla.querySelectorAll('tbody tr').length).toBeGreaterThan(0);
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
