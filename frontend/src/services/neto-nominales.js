/**
 * Plazos y neto de nominales de la vista Compra y Venta.
 *
 * Trabaja sobre las filas que arma la vista: `{ symbol, settlement, quantity }`,
 * con `quantity` positiva en las compras y negativa en las ventas.
 */

// CI primero y 24HS después; cualquier otro plazo, alfabético al final.
const ORDEN_PLAZOS = ['CI', '24HS'];

const rangoPlazo = (plazo) => {
  const indice = ORDEN_PLAZOS.indexOf(plazo);
  return indice === -1 ? ORDEN_PLAZOS.length : indice;
};

/** Plazos distintos presentes en las filas, en orden CI, 24HS, resto. */
export const listarPlazos = (...grupos) => {
  const plazos = new Set();
  grupos.forEach((filas = []) => {
    filas.forEach((fila) => {
      if (fila?.settlement) {
        plazos.add(fila.settlement);
      }
    });
  });
  return [...plazos].sort((a, b) => rangoPlazo(a) - rangoPlazo(b) || a.localeCompare(b));
};

/**
 * Plazos seleccionados que siguen disponibles. Si ninguno lo está (o no hay
 * selección), devuelve `[]`, que significa "todos".
 */
export const plazosEfectivos = (seleccionados = [], disponibles = []) =>
  seleccionados.filter((plazo) => disponibles.includes(plazo));

/** Filtra filas por plazo; una selección vacía no filtra. */
export const filtrarPorPlazo = (filas = [], plazos = []) => {
  if (!plazos.length) {
    return filas;
  }
  const permitidos = new Set(plazos);
  return filas.filter((fila) => permitidos.has(fila.settlement));
};

/** Clave de una fila del neto: la tenencia se ingresa por símbolo y plazo. */
export const claveNeto = (symbol, settlement) => `${symbol}::${settlement}`;

/**
 * Neto de nominales por símbolo y plazo: lo comprado menos lo vendido.
 *
 * Va por plazo porque lo disponible depende del plazo: lo que se tenía en CI
 * más lo operado en CI es lo que queda en CI.
 *
 * @returns {Array<{key: string, symbol: string, settlement: string,
 *   comprado: number, vendido: number, neto: number}>}
 *   `vendido` en valor absoluto; ordenado por símbolo y después por plazo
 *   (CI, 24HS, resto).
 */
export const calcularNetoNominales = (filasCompra = [], filasVenta = []) => {
  const porClave = new Map();
  const acumular = (filas, campo) => {
    filas.forEach((fila) => {
      const key = claveNeto(fila.symbol, fila.settlement);
      if (!porClave.has(key)) {
        porClave.set(key, {
          key,
          symbol: fila.symbol,
          settlement: fila.settlement,
          comprado: 0,
          vendido: 0,
        });
      }
      porClave.get(key)[campo] += Math.abs(Number(fila.quantity) || 0);
    });
  };
  acumular(filasCompra, 'comprado');
  acumular(filasVenta, 'vendido');

  return [...porClave.values()]
    .map((entrada) => ({ ...entrada, neto: entrada.comprado - entrada.vendido }))
    .sort((a, b) => a.symbol.localeCompare(b.symbol)
      || rangoPlazo(a.settlement) - rangoPlazo(b.settlement)
      || a.settlement.localeCompare(b.settlement));
};

/**
 * Suma a cada fila la tenencia que se ingresó para su símbolo y plazo, y lo
 * disponible: la tenencia más el neto. Sin tenencia ingresada, `tenencia` es
 * `null` y se toma como cero.
 *
 * @param {Array} filas Filas de `calcularNetoNominales`.
 * @param {Record<string, number>} tenencias Por clave de `claveNeto`.
 */
export const aplicarTenencias = (filas = [], tenencias = {}) => filas.map((fila) => {
  const tenencia = Number.isFinite(tenencias?.[fila.key]) ? tenencias[fila.key] : null;
  return { ...fila, tenencia, disponible: (tenencia ?? 0) + fila.neto };
});

/**
 * Total de las filas que se ven: suma tenencia, comprado y vendido; el neto es
 * comprado menos vendido y lo disponible, tenencia más neto.
 *
 * @returns {{tenencia: number, comprado: number, vendido: number, neto: number, disponible: number}}
 */
export const totalizarNetoNominales = (filas = []) => {
  const sumar = (campo) => filas.reduce((suma, fila) => suma + (Number(fila[campo]) || 0), 0);
  const tenencia = sumar('tenencia');
  const comprado = sumar('comprado');
  const vendido = sumar('vendido');
  const neto = comprado - vendido;
  return { tenencia, comprado, vendido, neto, disponible: tenencia + neto };
};

/**
 * Lee los nominales que se escriben a mano. Son enteros, así que puntos,
 * comas y espacios se toman como separadores de miles ("1.000.000" y
 * "1,000,000" valen lo mismo).
 *
 * @returns {number|null|undefined} El número; `null` si el texto está vacío
 *   (sin tenencia); `undefined` si no es un número.
 */
export const parsearNominales = (texto) => {
  const limpio = String(texto ?? '').replace(/[\s.,]/g, '');
  if (!limpio) {
    return null;
  }
  if (!/^-?\d+$/.test(limpio)) {
    return undefined;
  }
  // `Number('-0')` es -0; la tenencia en cero se muestra "0".
  return Number(limpio) || 0;
};
