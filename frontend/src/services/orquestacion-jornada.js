/**
 * Las decisiones de orquestación de una jornada, separadas de su ejecución.
 *
 * `runProcessing` (101 líneas) y `triggerSync` (113 líneas) mezclaban cuatro
 * reglas de dominio con seis setters de React y tres refs usados como control
 * de flujo. Las reglas son puras; lo que no se puede separar sin rediseñar es
 * el encadenamiento de efectos, que queda en el componente.
 *
 * Acá viven las decisiones: qué adaptador corresponde a una selección, cómo se
 * fusionan las operaciones al cargar un CSV, qué pestaña abrir con un reporte
 * nuevo, y si una sincronización puede arrancar.
 *
 * Ver CONTEXT.md para los términos y docs/adr/0001 para por qué el
 * enriquecimiento de fees no se repite acá.
 */

import { CsvDataSource, JsonDataSource } from './data-sources/index.js';
import { mergeBrokerBatch } from './broker/dedupe-utils.js';
import { FUENTES, filtrarPorFuente } from './operacion.js';

/** Motivos por los que una sincronización no puede arrancar. */
export const MOTIVOS_SYNC = Object.freeze({
  NO_AUTENTICADO: 'NOT_AUTHENTICATED',
  YA_EN_CURSO: 'SYNC_IN_PROGRESS',
});

/**
 * Resuelve el adaptador, el payload y el nombre para una selección de fuente.
 *
 * Son tres casos: una sincronización con el broker (que procesa las
 * operaciones ya sincronizadas, filtradas a las del broker), un CSV, y la
 * forma legacy en la que llegaba un `File` suelto.
 *
 * @param {object} seleccion - `{type: 'broker'|'csv', file?, name?}` o un File
 * @param {object} contexto
 * @param {Array<object>} [contexto.syncedOperations]
 * @param {string} [contexto.brokerAccountId]
 * @returns {{dataSource: object, file: *, fileName: string}}
 */
export const resolverFuenteDeDatos = (seleccion, { syncedOperations = [], brokerAccountId } = {}) => {
  if (seleccion?.type === 'broker') {
    return {
      dataSource: new JsonDataSource(),
      // Siempre se recalcula desde `syncedOperations` para no procesar datos
      // viejos después de un refresh.
      file: filtrarPorFuente(syncedOperations, FUENTES.BROKER),
      fileName: seleccion.name || `Broker-${brokerAccountId || 'Unknown'}.json`,
    };
  }

  if (seleccion?.type === 'csv') {
    return {
      dataSource: new CsvDataSource(),
      file: seleccion.file,
      fileName: seleccion.file?.name || 'operations.csv',
    };
  }

  // Legacy: un File directo.
  return {
    dataSource: new CsvDataSource(),
    file: seleccion,
    fileName: seleccion?.name || 'operations.csv',
  };
};

/**
 * Fusiona las operaciones al cargar un CSV: descarta las de CSV anteriores,
 * conserva las del broker y agrega las nuevas.
 *
 * No hay dedupe entre fuentes a propósito: una fila de CSV y una del broker
 * nunca son "el mismo registro" a fusionar, porque los espacios de `order_id`
 * son incompatibles (ver `isDuplicate` en `broker/dedupe-utils.js`).
 *
 * @param {Array<object>} operacionesExistentes
 * @param {Array<object>} operacionesNormalizadas - las del CSV recién procesado
 * @returns {Array<object>|null} null si no hay nada nuevo que fusionar
 */
export const fusionarOperacionesCsv = (operacionesExistentes = [], operacionesNormalizadas = []) => {
  if (!Array.isArray(operacionesNormalizadas) || operacionesNormalizadas.length === 0) {
    return null;
  }

  const soloBroker = filtrarPorFuente(operacionesExistentes, FUENTES.BROKER);
  const { mergedOps } = mergeBrokerBatch(soloBroker, operacionesNormalizadas);

  return mergedOps;
};

/**
 * Qué pestaña abrir con un reporte recién procesado: la que tenga operaciones,
 * prefiriendo CALLS. Un reporte sin ninguna de las dos también abre en CALLS.
 *
 * @param {object} reporte - el resultado de `processOperations`
 * @param {boolean} useAveraging - cuál de las dos vistas mira el usuario
 * @returns {'calls'|'puts'}
 */
export const elegirPreviewInicial = (reporte, useAveraging) => {
  const vista = reporte?.views?.[useAveraging ? 'averaged' : 'raw'];
  const puts = vista?.puts?.operations?.length ?? 0;
  const calls = vista?.calls?.operations?.length ?? 0;

  return calls === 0 && puts > 0 ? 'puts' : 'calls';
};

/**
 * ¿Puede arrancar una sincronización?
 *
 * @param {object} estado
 * @param {object|null} estado.auth
 * @param {boolean} estado.syncInProgress
 * @returns {{puede: true} | {puede: false, motivo: string}}
 */
export const puedeSincronizar = ({ auth, syncInProgress } = {}) => {
  if (!auth || !auth.token) {
    return { puede: false, motivo: MOTIVOS_SYNC.NO_AUTENTICADO };
  }

  if (syncInProgress) {
    return { puede: false, motivo: MOTIVOS_SYNC.YA_EN_CURSO };
  }

  return { puede: true };
};
