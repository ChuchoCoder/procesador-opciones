/**
 * El camino del broker, a nivel de componente.
 *
 * Es el único recorrido de la app que no se puede verificar a mano: login,
 * sincronización y reconciliación con dos fuentes necesitan credenciales reales
 * de la cuenta del usuario. Esto lo cubre sin ellas — valores de prueba y el
 * callback de login mockeado— que es lo que faltaba de los cuatro recorridos.
 *
 * Las operaciones del broker se sintetizan a partir de filas del pipeline real,
 * marcándolas con `source: 'broker'`: la forma es la de producción, sólo cambia
 * la procedencia.
 */
/* eslint-env node */
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';

import BrokerLogin from '../../src/components/Processor/BrokerLogin.jsx';
import ReconciliationView from '../../src/components/Processor/ReconciliationView.jsx';
import strings from '../../src/strings/es-AR.js';
import theme from '../../src/app/theme.js';
import { FUENTES, filtrarPorFuente } from '../../src/services/operacion.js';
import { loadEnrichedOperations } from './helpers/arbitrage-pipeline.js';

const montar = (ui) => render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

describe('BrokerLogin', () => {
  afterEach(() => cleanup());

  it('muestra los campos de conexión', () => {
    montar(<BrokerLogin onLogin={() => {}} />);

    expect(screen.getByTestId('broker-login-username')).toBeTruthy();
    expect(screen.getByTestId('broker-login-password')).toBeTruthy();
    expect(screen.getByTestId('broker-login-submit')).toBeTruthy();
  });

  it('envía usuario, contraseña y URL al conectar', async () => {
    const usuario = userEvent.setup();
    const onLogin = vi.fn();
    montar(<BrokerLogin onLogin={onLogin} />);

    // Valores de prueba: este test no toca credenciales reales.
    await usuario.type(
      screen.getByTestId('broker-login-username').querySelector('input'),
      'usuario-de-prueba',
    );
    await usuario.type(
      screen.getByTestId('broker-login-password').querySelector('input'),
      'contrasena-de-prueba',
    );
    await usuario.click(screen.getByTestId('broker-login-submit'));

    // La firma es posicional: (usuario, contraseña, urlApi).
    expect(onLogin).toHaveBeenCalledTimes(1);
    const [usuarioEnviado, , urlEnviada] = onLogin.mock.calls[0];
    expect(usuarioEnviado).toBe('usuario-de-prueba');
    expect(() => new URL(urlEnviada)).not.toThrow();
  }, 30000);

  it('mantiene el botón deshabilitado hasta que los campos estén completos', async () => {
    const usuario = userEvent.setup();
    montar(<BrokerLogin onLogin={() => {}} />);

    const boton = screen.getByTestId('broker-login-submit');
    expect(boton).toBeDisabled();

    await usuario.type(
      screen.getByTestId('broker-login-username').querySelector('input'),
      'usuario-de-prueba',
    );
    // Con sólo el usuario todavía no alcanza.
    expect(boton).toBeDisabled();

    await usuario.type(
      screen.getByTestId('broker-login-password').querySelector('input'),
      'contrasena-de-prueba',
    );
    expect(boton).not.toBeDisabled();
  }, 30000);

  it('muestra el error que devuelve el broker', () => {
    montar(<BrokerLogin onLogin={() => {}} error="Credenciales inválidas" />);

    const error = screen.getByTestId('broker-login-error');
    expect(error.textContent).toContain('Credenciales inválidas');
  });

  it('indica que está conectando y bloquea el botón', () => {
    montar(<BrokerLogin onLogin={() => {}} isLoading />);

    expect(screen.getByTestId('broker-login-loading')).toBeTruthy();
    expect(screen.getByTestId('broker-login-submit')).toBeDisabled();
  });

  it('se deshabilita entero cuando la pantalla lo pide', () => {
    montar(<BrokerLogin onLogin={() => {}} disabled />);
    expect(screen.getByTestId('broker-login-submit')).toBeDisabled();
  });
});

describe('Reconciliación con las dos fuentes', () => {
  let csvOps;
  let brokerOps;

  beforeAll(async () => {
    const operaciones = await loadEnrichedOperations('Arbitraje-Plazos.csv');
    csvOps = filtrarPorFuente(operaciones, FUENTES.CSV).slice(0, 30);

    // El broker trae las mismas operaciones; una con cantidad distinta, para
    // que haya algo que no coincida.
    brokerOps = csvOps.slice(0, 15).map((op, i) => ({
      ...op,
      source: FUENTES.BROKER,
      quantity: i === 0 ? (op.quantity ?? 0) + 1 : op.quantity,
    }));
  }, 60000);

  afterEach(() => cleanup());

  const props = () => ({
    strings: strings.processor,
    csvOperations: csvOps,
    brokerOperations: brokerOps,
    groupOptions: [],
    selectedGroupId: [],
    onGroupChange: () => {},
  });

  it('con las dos fuentes sale del estado vacío y concilia', () => {
    montar(<ReconciliationView {...props()} />);

    expect(screen.queryByText(strings.processor.reconciliation.emptyNeedsBothSources))
      .toBeNull();
    expect(screen.getByTestId('reconciliation-tab-matched')).toBeTruthy();
  });

  it('resume el resultado en los chips', () => {
    montar(<ReconciliationView {...props()} />);

    const resumen = strings.processor.reconciliation;
    // Los chips muestran "<etiqueta>: <n>". El texto también aparece en las
    // pestañas, así que puede haber más de un match.
    const conEtiqueta = (etiqueta) => screen.getAllByText(
      (contenido) => contenido.startsWith(`${etiqueta}: `),
    );

    expect(conEtiqueta(resumen.summaryMatched).length).toBeGreaterThan(0);
    expect(conEtiqueta(resumen.summaryMismatched).length).toBeGreaterThan(0);
  });

  it('permite recorrer las tres pestañas', async () => {
    const usuario = userEvent.setup();
    montar(<ReconciliationView {...props()} />);

    const pestanas = ['matched', 'mismatched', 'absent'].map((t) =>
      screen.getByTestId(`reconciliation-tab-${t}`));

    expect(pestanas[0]).toHaveAttribute('aria-selected', 'true');

    for (const pestana of pestanas.slice(1)) {
      await usuario.click(pestana);
      await waitFor(() => {
        expect(pestana).toHaveAttribute('aria-selected', 'true');
      });
    }
  }, 30000);

  it('ofrece exportar lo conciliado', () => {
    montar(<ReconciliationView {...props()} />);

    expect(screen.getByTestId('reconciliation-copy-button')).toBeTruthy();
    expect(screen.getByTestId('reconciliation-download-button')).toBeTruthy();
  });
});
