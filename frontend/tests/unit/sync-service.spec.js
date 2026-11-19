/**
 * `startDailySync` de punta a punta, con el cliente HTTP mockeado.
 *
 * La revisión lo señalaba como intestable: 14 parámetros con nombre, seis de
 * ellos callbacks con un protocolo de invocación implícito —`startSync` una
 * vez, `stagePage` por página, y después exactamente uno de `commitSync` /
 * `failSync` / `cancelSync`— más `setBaseUrl` como efecto global disparado
 * desde adentro. Por eso el único spec de sync que existía copiaba la lógica
 * en lugar de llamarla (lo arreglé en #31, pero probando sólo la regla de la
 * línea de base, no el ciclo).
 *
 * Mockeando `jsrofex-client` y `token-manager` se puede ejercitar el ciclo
 * entero sin red y sin credenciales: es lo más cerca del camino HTTP real que
 * se puede llegar sin una cuenta de broker.
 */
/* eslint-env node */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const listOperations = vi.fn();
const setBaseUrl = vi.fn();

vi.mock('../../src/services/broker/jsrofex-client.js', () => ({
  listOperations: (...args) => listOperations(...args),
  setBaseUrl: (...args) => setBaseUrl(...args),
}));

vi.mock('../../src/services/broker/token-manager.js', () => ({
  ensureValidToken: vi.fn(async (auth) => auth),
}));

const { startDailySync, refreshNewOperations, DAILY_MODE } = await import('../../src/services/broker/sync-service.js');

const brokerAuth = { token: 'token-de-prueba', accountId: '17825' };

/** Una operación cruda como la devuelve el broker. */
const opBroker = (id, extra = {}) => ({
  orderId: id,
  instrumentId: { symbol: 'MERV - XMEV - GGAL - CI' },
  side: 'BUY',
  cumQty: 10,
  avgPx: 100,
  transactTime: '20260625-14:34:43.806-0300',
  status: 'FILLED',
  ...extra,
});

const hacerCallbacks = () => ({
  setBrokerAuth: vi.fn(),
  startSync: vi.fn(),
  stagePage: vi.fn(),
  commitSync: vi.fn(),
  failSync: vi.fn(),
  cancelSync: vi.fn(),
});

describe('startDailySync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('recorre el ciclo completo: startSync, stagePage y commitSync', async () => {
    listOperations.mockResolvedValue({ operations: [opBroker('A'), opBroker('B')] });
    const cb = hacerCallbacks();

    await startDailySync({ brokerAuth, existingOperations: [], ...cb });

    expect(cb.startSync).toHaveBeenCalledTimes(1);
    expect(cb.stagePage).toHaveBeenCalledTimes(1);
    expect(cb.commitSync).toHaveBeenCalledTimes(1);
    // Exactamente uno de los tres terminales.
    expect(cb.failSync).not.toHaveBeenCalled();
    expect(cb.cancelSync).not.toHaveBeenCalled();
  });

  it('aplica la URL del broker como efecto global antes de pedir', async () => {
    listOperations.mockResolvedValue({ operations: [] });
    const cb = hacerCallbacks();

    await startDailySync({
      brokerAuth,
      existingOperations: [],
      brokerApiUrl: 'https://api.ejemplo.test',
      ...cb,
    });

    expect(setBaseUrl).toHaveBeenCalledWith('https://api.ejemplo.test');
  });

  it('pagina mientras el broker devuelva pageToken', async () => {
    listOperations
      .mockResolvedValueOnce({ operations: [opBroker('A')], nextPageToken: 'p2' })
      .mockResolvedValueOnce({ operations: [opBroker('B')], nextPageToken: 'p3' })
      .mockResolvedValueOnce({ operations: [opBroker('C')] });
    const cb = hacerCallbacks();

    await startDailySync({ brokerAuth, existingOperations: [], ...cb });

    expect(listOperations).toHaveBeenCalledTimes(3);
    expect(cb.stagePage).toHaveBeenCalledTimes(3);
    // El índice de página avanza en cada vuelta.
    expect(cb.stagePage.mock.calls.map((c) => c[1])).toEqual([0, 1, 2]);
    expect(cb.commitSync).toHaveBeenCalledTimes(1);
  });

  it('en modo daily descarta las operaciones previas del broker', async () => {
    listOperations.mockResolvedValue({ operations: [opBroker('NUEVA')] });
    const cb = hacerCallbacks();

    await startDailySync({
      brokerAuth,
      existingOperations: [
        { id: 'vieja-broker', source: 'broker', order_id: 'X' },
        { id: 'vieja-csv', source: 'csv', order_id: 'Y' },
      ],
      mode: DAILY_MODE,
      ...cb,
    });

    const [mergedOps] = cb.commitSync.mock.calls[0];
    // La de CSV sobrevive; la del broker anterior no.
    expect(mergedOps.some((op) => op.id === 'vieja-csv')).toBe(true);
    expect(mergedOps.some((op) => op.id === 'vieja-broker')).toBe(false);
  });

  it('informa el progreso por página', async () => {
    listOperations
      .mockResolvedValueOnce({ operations: [opBroker('A')], nextPageToken: 'p2' })
      .mockResolvedValueOnce({ operations: [opBroker('B')] });
    const onProgress = vi.fn();
    const cb = hacerCallbacks();

    await startDailySync({ brokerAuth, existingOperations: [], onProgress, ...cb });

    expect(onProgress).toHaveBeenCalledTimes(2);
    expect(onProgress.mock.calls[1][0]).toMatchObject({ pagesFetched: 2 });
  });

  it('cancela sin commitear cuando el token de cancelación se activa', async () => {
    const cancellationToken = { isCanceled: false };
    listOperations.mockImplementation(async () => {
      cancellationToken.isCanceled = true;
      return { operations: [opBroker('A')], pageToken: 'p2' };
    });
    const cb = hacerCallbacks();

    await startDailySync({
      brokerAuth,
      existingOperations: [],
      cancellationToken,
      ...cb,
    });

    expect(cb.cancelSync).toHaveBeenCalled();
    expect(cb.commitSync).not.toHaveBeenCalled();
  });

  it('falla sin commitear cuando el broker responde con error', async () => {
    listOperations.mockRejectedValue(Object.assign(new Error('401 Unauthorized'), {
      status: 401,
    }));
    const cb = hacerCallbacks();

    const resultado = await startDailySync({ brokerAuth, existingOperations: [], ...cb });

    expect(cb.failSync).toHaveBeenCalled();
    expect(cb.commitSync).not.toHaveBeenCalled();
    expect(resultado?.success).toBe(false);
  }, 30000);

  it('commitea igual cuando el broker no devuelve operaciones', async () => {
    listOperations.mockResolvedValue({ operations: [] });
    const cb = hacerCallbacks();

    await startDailySync({ brokerAuth, existingOperations: [], ...cb });

    expect(cb.commitSync).toHaveBeenCalledTimes(1);
    expect(cb.failSync).not.toHaveBeenCalled();
  });
});

describe('refreshNewOperations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Caso real del 2026-11-19 (cuenta 17825): una orden de compra de AL30D por
  // 9.835 estaba ejecutada en 5.117 cuando la API armó la respuesta. Terminó de
  // ejecutarse a las 12:23:01.128, antes de que la sync guardara su marca de
  // tiempo (el reloj de la PC al commitear). La ejecución final quedaba "más
  // vieja" que la última sync y el refresh la descartaba para siempre: la app
  // mostraba 167.316 comprados contra 172.034 del broker.
  const parcial = opBroker('O0TXMjMFdB9T-10822808', {
    clOrdId: '533661747125719',
    execId: 'EXEC-PARCIAL',
    instrumentId: { symbol: 'MERV - XMEV - AL30D - CI' },
    orderQty: 9835,
    cumQty: 5117,
    status: 'PARTIALLY_FILLED',
    transactTime: '20261119-12:22:58.400-0300',
  });
  const ejecutada = {
    ...parcial,
    execId: 'EXEC-FINAL',
    cumQty: 9835,
    status: 'FILLED',
    transactTime: '20261119-12:23:01.128-0300',
  };
  const commitDeLaSyncAnterior = Date.parse('2026-11-19T12:23:01.500-03:00');

  const sincronizarDia = async (operaciones) => {
    listOperations.mockResolvedValueOnce({ operations: operaciones });
    const cb = hacerCallbacks();
    await startDailySync({ brokerAuth, existingOperations: [], mode: DAILY_MODE, ...cb });
    return cb.commitSync.mock.calls[0][0];
  };

  const refrescar = async (existentes, operaciones) => {
    listOperations.mockResolvedValueOnce({ operations: operaciones });
    const cb = hacerCallbacks();
    const resultado = await refreshNewOperations({
      brokerAuth,
      operations: existentes,
      lastSyncTimestamp: commitDeLaSyncAnterior,
      ...cb,
    });
    return { mergedOps: cb.commitSync.mock.calls[0][0], resultado };
  };

  it('toma la ejecución final aunque su transactTime sea anterior a la última sync', async () => {
    const tras1raSync = await sincronizarDia([parcial]);

    const { mergedOps, resultado } = await refrescar(tras1raSync, [ejecutada]);

    const deLaOrden = mergedOps.filter((op) => op.order_id === parcial.orderId);
    expect(deLaOrden).toHaveLength(1);
    expect(deLaOrden[0].quantity).toBe(9835);
    expect(resultado.operationsAdded).toBe(1);
  });

  it('no duplica las órdenes que no cambiaron desde la última sync', async () => {
    const tras1raSync = await sincronizarDia([ejecutada]);

    const { mergedOps, resultado } = await refrescar(tras1raSync, [ejecutada]);

    expect(mergedOps.filter((op) => op.order_id === ejecutada.orderId)).toHaveLength(1);
    expect(resultado.operationsAdded).toBe(0);
  });
});
