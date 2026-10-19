/**
 * Servidor stub de la API del broker (Matba Rofex / Primary).
 *
 * Implementa los tres endpoints que usa `jsrofex-client`, para poder ejercitar
 * el camino HTTP real —fetch de verdad, cliente de verdad, UI de verdad— sin
 * credenciales reales ni acceso al servidor del broker.
 *
 * Uso:
 *
 *     node tools/broker-stub.mjs          # escucha en http://localhost:8899
 *     cd frontend && npm run dev
 *
 * Y en la app: "Conectar con Broker" -> URL Personalizada ->
 * http://localhost:8899, con cualquier usuario y contraseña. La clave
 * `clave-incorrecta` devuelve 401, para probar el camino de error.
 */
import { createServer } from 'node:http';

const PUERTO = 8899;
const TOKEN = 'token-stub-de-prueba';

/** Órdenes con la forma que devuelve /rest/order/all. */
const ordenes = [
  {
    orderId: 'STUB-1',
    clOrdId: 'cl-1',
    accountId: { id: '17825' },
    instrumentId: { symbol: 'MERV - XMEV - GGAL - CI', marketId: 'ROFX' },
    side: 'BUY',
    price: 4860,
    orderQty: 1500,
    cumQty: 1500,
    leavesQty: 0,
    avgPx: 4860,
    lastPx: 4860,
    lastQty: 1500,
    status: 'FILLED',
    transactTime: '20260625-14:34:43.806-0300',
    text: null,
  },
  {
    orderId: 'STUB-2',
    clOrdId: 'cl-2',
    accountId: { id: '17825' },
    instrumentId: { symbol: 'MERV - XMEV - PFE - 24hs', marketId: 'ROFX' },
    side: 'SELL',
    price: 9500,
    orderQty: 9,
    cumQty: 9,
    leavesQty: 0,
    avgPx: 9500,
    lastPx: 9500,
    lastQty: 9,
    status: 'FILLED',
    transactTime: '20260625-15:02:11.000-0300',
    text: null,
  },
  {
    // Parcialmente ejecutada: ejercita el camino de fills parciales.
    orderId: 'STUB-3',
    clOrdId: 'cl-3',
    accountId: { id: '17825' },
    instrumentId: { symbol: 'MERV - XMEV - S31O5 - CI', marketId: 'ROFX' },
    side: 'SELL',
    price: 130.76,
    orderQty: 1000,
    cumQty: 400,
    leavesQty: 600,
    avgPx: 130.76,
    lastPx: 130.76,
    lastQty: 400,
    status: 'PARTIALLY_FILLED',
    transactTime: '20260625-15:30:00.000-0300',
    text: null,
  },
];

const cors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'X-Username, X-Password, X-Auth-Token, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Expose-Headers', 'X-Auth-Token');
};

const json = (res, codigo, cuerpo) => {
  res.writeHead(codigo, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(cuerpo));
};

createServer((req, res) => {
  cors(res);
  const url = new URL(req.url, `http://localhost:${PUERTO}`);
  console.log(`[stub] ${req.method} ${url.pathname}${url.search}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 1) Autenticación: el token viaja en un header de respuesta.
  if (url.pathname === '/auth/getToken' && req.method === 'POST') {
    const usuario = req.headers['x-username'];
    const clave = req.headers['x-password'];

    if (!usuario || !clave) {
      json(res, 401, { status: 'ERROR', message: 'faltan credenciales' });
      return;
    }
    // Credenciales inventadas para probar el camino de error.
    if (clave === 'clave-incorrecta') {
      json(res, 401, { status: 'ERROR', message: 'credenciales inválidas' });
      return;
    }

    res.setHeader('X-Auth-Token', TOKEN);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'OK' }));
    return;
  }

  const token = req.headers['x-auth-token'];
  if (token !== TOKEN) {
    json(res, 401, { status: 'ERROR', message: 'token inválido' });
    return;
  }

  // 2) Cuentas.
  if (url.pathname === '/rest/accounts') {
    json(res, 200, { status: 'OK', accounts: [{ id: 1, name: '17825', brokerId: 1 }] });
    return;
  }

  // 3) Órdenes de la cuenta.
  if (url.pathname === '/rest/order/all') {
    json(res, 200, { status: 'OK', orders: ordenes });
    return;
  }

  json(res, 404, { status: 'ERROR', message: 'no implementado en el stub' });
}).listen(PUERTO, () => {
  console.log(`[stub] escuchando en http://localhost:${PUERTO}`);
});
