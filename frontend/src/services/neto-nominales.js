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

/**
 * Neto de nominales por símbolo: lo comprado menos lo vendido, sumando todos
 * los plazos de las filas recibidas.
 *
 * @returns {Array<{symbol: string, comprado: number, vendido: number, neto: number}>}
 *   `vendido` en valor absoluto; ordenado por símbolo.
 */
export const calcularNetoNominales = (filasCompra = [], filasVenta = []) => {
  const porSimbolo = new Map();
  const acumular = (filas, campo) => {
    filas.forEach((fila) => {
      if (!porSimbolo.has(fila.symbol)) {
        porSimbolo.set(fila.symbol, { symbol: fila.symbol, comprado: 0, vendido: 0 });
      }
      porSimbolo.get(fila.symbol)[campo] += Math.abs(Number(fila.quantity) || 0);
    });
  };
  acumular(filasCompra, 'comprado');
  acumular(filasVenta, 'vendido');

  return [...porSimbolo.values()]
    .map((entrada) => ({ ...entrada, neto: entrada.comprado - entrada.vendido }))
    .sort((a, b) => a.symbol.localeCompare(b.symbol));
};
