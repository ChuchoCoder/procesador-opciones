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
import { loadEnrichedOperations } from './helpers/arbitrage-pipeline.js';
import { FUENTES, filtrarPorFuente } from '../../src/services/operacion.js';

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
    it('renderiza las tablas de compras y ventas con operaciones reales', () => {
      montar(
        <CompraVentaView
          operations={operaciones}
          strings={processorStrings}
          expirationLabels={{}}
          {...propsFiltro}
        />,
      );

      expect(screen.getByTestId('processor-buy-table')).toBeTruthy();
      expect(screen.getByTestId('processor-sell-table')).toBeTruthy();
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
    /** La conciliación necesita las dos fuentes; el pipeline marca todo como csv. */
    const dosFuentes = () => {
      const csv = filtrarPorFuente(operaciones, FUENTES.CSV).slice(0, 20);
      const broker = csv.slice(0, 10).map((op) => ({ ...op, source: FUENTES.BROKER }));
      return { csv, broker };
    };

    it('pide las dos fuentes antes de poder conciliar', () => {
      montar(
        <ReconciliationView
          strings={processorStrings}
          csvOperations={filtrarPorFuente(operaciones, FUENTES.CSV).slice(0, 5)}
          brokerOperations={[]}
          {...propsFiltro}
        />,
      );
      // Con una sola fuente no hay nada que conciliar: estado vacío, sin pestañas.
      expect(screen.queryByTestId('reconciliation-tab-matched')).toBeNull();
      expect(screen.getByText(processorStrings.reconciliation.emptyNeedsBothSources)).toBeTruthy();
    });

    it('muestra las tres pestañas con operaciones de ambas fuentes', () => {
      const { csv, broker } = dosFuentes();
      montar(
        <ReconciliationView
          strings={processorStrings}
          csvOperations={csv}
          brokerOperations={broker}
          {...propsFiltro}
        />,
      );

      expect(screen.getByTestId('reconciliation-tab-matched')).toBeTruthy();
      expect(screen.getByTestId('reconciliation-tab-mismatched')).toBeTruthy();
      expect(screen.getByTestId('reconciliation-tab-absent')).toBeTruthy();
    });

    it('cambia de pestaña al clickear', async () => {
      const usuario = userEvent.setup();
      const { csv, broker } = dosFuentes();
      montar(
        <ReconciliationView
          strings={processorStrings}
          csvOperations={csv}
          brokerOperations={broker}
          {...propsFiltro}
        />,
      );

      const pestanaCoincidentes = screen.getByTestId('reconciliation-tab-matched');
      const pestanaAusentes = screen.getByTestId('reconciliation-tab-absent');

      // Arranca en "coincidentes".
      expect(pestanaCoincidentes).toHaveAttribute('aria-selected', 'true');
      expect(pestanaAusentes).toHaveAttribute('aria-selected', 'false');

      await usuario.click(pestanaAusentes);

      await waitFor(() => {
        expect(pestanaAusentes).toHaveAttribute('aria-selected', 'true');
      });
      expect(pestanaCoincidentes).toHaveAttribute('aria-selected', 'false');
    }, 20000);
  });
});
