/**
 * El ciclo de vida del procesamiento de una jornada, como máquina de estados.
 *
 * ## Qué reemplaza
 *
 * El estado real estaba repartido en tres variables, y dos de ellas eran
 * invisibles para React:
 *
 *   - `report === null` funcionaba como **comando**: ponerlo en null era la
 *     forma de pedir "procesá". Un dato haciendo de señal.
 *   - `pendingRefreshRef` (un ref) desactivaba el efecto de auto-procesamiento
 *     mientras una sincronización estaba en vuelo.
 *   - `lastSyncTimestampRef` (otro ref) guardaba el timestamp previo para
 *     reconocer que la sync había terminado.
 *
 * Eso formaba un interlock de tres vías entre efectos: uno se desactivaba
 * mirando un ref del otro, y el orden en que corrían era parte del contrato.
 * Nada de eso se podía ejercitar desde un test.
 *
 * ## El modelo
 *
 *   SIN_FUENTE ──seleccionar──► PENDIENTE ──iniciar──► PROCESANDO ──ok──► LISTO
 *                                   ▲                      │
 *                            sync terminó                  └──falla──► FALLIDO
 *                                   │
 *                            ESPERANDO_SYNC ◄──pedir refresh
 *
 * `PENDIENTE` es la única fase en la que corresponde procesar, y eso queda
 * dicho en un solo lugar (`debeProcesar`) en lugar de deducirse de
 * `!report && !isProcessing && !pendingRefreshRef.current`.
 */

export const FASES = Object.freeze({
  /** No hay fuente seleccionada. */
  SIN_FUENTE: 'sin-fuente',
  /** Hay una fuente y hay que procesarla. */
  PENDIENTE: 'pendiente',
  /** Procesamiento en curso. */
  PROCESANDO: 'procesando',
  /** Hay un reporte listo. */
  LISTO: 'listo',
  /** Se pidió un refresh del broker: no procesar hasta que la sync termine. */
  ESPERANDO_SYNC: 'esperando-sync',
  /** El procesamiento falló. */
  FALLIDO: 'fallido',
});

export const EVENTOS = Object.freeze({
  FUENTE_SELECCIONADA: 'fuente-seleccionada',
  REFRESH_PEDIDO: 'refresh-pedido',
  SYNC_TERMINADO: 'sync-terminado',
  PROCESAMIENTO_INICIADO: 'procesamiento-iniciado',
  PROCESAMIENTO_OK: 'procesamiento-ok',
  PROCESAMIENTO_FALLIDO: 'procesamiento-fallido',
  REDERIVAR: 'rederivar',
  LIMPIADO: 'limpiado',
});

export const estadoInicial = Object.freeze({
  fase: FASES.SIN_FUENTE,
  fuente: null,
  /** El timestamp de sync vigente cuando se pidió el refresh. */
  esperandoSyncDesde: null,
});

/**
 * ¿Corresponde arrancar un procesamiento?
 *
 * Antes esto era `selectedDataSource && !report && !isProcessing`, más un
 * early-return mirando `pendingRefreshRef.current` desde otro efecto.
 *
 * @param {object} estado
 * @returns {boolean}
 */
export const debeProcesar = (estado) =>
  estado?.fase === FASES.PENDIENTE && Boolean(estado?.fuente);

/**
 * ¿Hay una sincronización esperada cuyo resultado todavía no llegó?
 * @param {object} estado
 * @returns {boolean}
 */
export const esperaSync = (estado) => estado?.fase === FASES.ESPERANDO_SYNC;

/**
 * Transición. Un evento que no aplica a la fase actual devuelve el mismo
 * estado, sin mutarlo.
 *
 * @param {object} estado
 * @param {{tipo: string, fuente?: object, timestamp?: *}} evento
 * @returns {object}
 */
export const reducirProcesamiento = (estado = estadoInicial, evento = {}) => {
  switch (evento.tipo) {
    case EVENTOS.FUENTE_SELECCIONADA: {
      if (!evento.fuente) {
        return { ...estadoInicial };
      }
      return { fase: FASES.PENDIENTE, fuente: evento.fuente, esperandoSyncDesde: null };
    }

    case EVENTOS.REFRESH_PEDIDO: {
      // Sólo tiene sentido si se está mirando datos del broker; si no, el
      // refresh corre pero no hay nada que re-procesar al terminar.
      if (estado.fuente?.type !== 'broker') {
        return estado;
      }
      return {
        ...estado,
        fase: FASES.ESPERANDO_SYNC,
        esperandoSyncDesde: evento.timestamp ?? null,
      };
    }

    case EVENTOS.SYNC_TERMINADO: {
      if (estado.fase !== FASES.ESPERANDO_SYNC) {
        return estado;
      }
      // Sin un timestamp nuevo no hay evidencia de que la sync haya traído
      // algo: se sigue esperando.
      if (!evento.timestamp || evento.timestamp === estado.esperandoSyncDesde) {
        return estado;
      }
      return {
        fase: FASES.PENDIENTE,
        fuente: evento.fuente ?? estado.fuente,
        esperandoSyncDesde: null,
      };
    }

    case EVENTOS.PROCESAMIENTO_INICIADO: {
      if (estado.fase !== FASES.PENDIENTE) {
        return estado;
      }
      return { ...estado, fase: FASES.PROCESANDO };
    }

    case EVENTOS.PROCESAMIENTO_OK: {
      return { ...estado, fase: FASES.LISTO };
    }

    case EVENTOS.PROCESAMIENTO_FALLIDO: {
      // Se suelta la fuente a propósito: si quedara seleccionada, el efecto de
      // auto-procesamiento volvería a dispararse en loop.
      return { fase: FASES.FALLIDO, fuente: null, esperandoSyncDesde: null };
    }

    case EVENTOS.REDERIVAR: {
      // Cambió configuración que afecta a lo derivado (una excepción de strike),
      // pero las filas crudas siguen siendo las mismas. Vuelve a PENDIENTE sin
      // soltar la fuente, y el componente re-deriva reusando esas filas.
      if (!estado.fuente) {
        return estado;
      }
      return { ...estado, fase: FASES.PENDIENTE };
    }

    case EVENTOS.LIMPIADO: {
      return { ...estadoInicial };
    }

    default:
      return estado;
  }
};
