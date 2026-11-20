/**
 * Qué tan vieja es la última sincronización con el broker.
 *
 * La app no se actualiza sola: los datos son los de la última sync (al
 * conectar, al abrir la app o al apretar "Sincronizar con el broker"). Sin una
 * hora a la vista es fácil comparar contra el broker datos de hace media hora y
 * creer que los nominales no coinciden.
 */

/** A partir de esta antigüedad la sync se marca como desactualizada. */
export const UMBRAL_DESACTUALIZADA_MS = 5 * 60 * 1000;

const ZONA = 'America/Argentina/Buenos_Aires';

const formatoHora = new Intl.DateTimeFormat('es-AR', {
  timeZone: ZONA,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

const formatoDia = new Intl.DateTimeFormat('es-AR', {
  timeZone: ZONA,
  day: '2-digit',
  month: '2-digit',
});

const formatoFecha = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA });

const plural = (n, singular, pluralForma) => `hace ${n} ${n === 1 ? singular : pluralForma}`;

const relativo = (diferenciaMs) => {
  const minutos = Math.floor(diferenciaMs / 60000);
  const horas = Math.floor(diferenciaMs / 3600000);
  const dias = Math.floor(diferenciaMs / 86400000);

  if (minutos < 1) return 'hace menos de 1 minuto';
  if (minutos < 60) return plural(minutos, 'minuto', 'minutos');
  if (horas < 24) return plural(horas, 'hora', 'horas');
  return plural(dias, 'día', 'días');
};

/**
 * @param {number|null|undefined} timestamp - Epoch ms de la última sync exitosa
 * @param {number} [ahora=Date.now()] - Epoch ms actual
 * @returns {{hora: string, relativo: string, desactualizada: boolean}|null}
 *   `hora` lleva la fecha delante cuando la sync es de otro día.
 */
export const describirUltimaSync = (timestamp, ahora = Date.now()) => {
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) {
    return null;
  }

  const diferencia = Math.max(0, ahora - timestamp);
  const mismoDia = formatoFecha.format(timestamp) === formatoFecha.format(ahora);
  const hora = mismoDia
    ? formatoHora.format(timestamp)
    : `${formatoDia.format(timestamp)} ${formatoHora.format(timestamp)}`;

  return {
    hora,
    relativo: relativo(diferencia),
    desactualizada: diferencia >= UMBRAL_DESACTUALIZADA_MS,
  };
};
