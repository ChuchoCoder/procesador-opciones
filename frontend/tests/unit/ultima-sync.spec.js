/**
 * `describirUltimaSync`: qué tan vieja es la última sincronización con el
 * broker. La app no se actualiza sola, así que mirar datos de hace media hora
 * sin darse cuenta es fácil: el 2026-11-20 el neto mostraba 81.928 nominales
 * de AL30/AL30D cargados a las 12:10, contra 131.928 del broker a las 12:20.
 */
/* eslint-env node */
import { describe, it, expect } from 'vitest';
import {
  describirUltimaSync,
  UMBRAL_DESACTUALIZADA_MS,
} from '../../src/services/ultima-sync.js';

const a = (hhmmss) => Date.parse(`2026-11-20T${hhmmss}-03:00`);

describe('describirUltimaSync', () => {
  it('sin sincronización no describe nada', () => {
    expect(describirUltimaSync(null, a('12:20:00'))).toBeNull();
    expect(describirUltimaSync(undefined, a('12:20:00'))).toBeNull();
  });

  it('da la hora de la sync en horario de Buenos Aires', () => {
    const d = describirUltimaSync(a('12:09:18'), a('12:09:30'));
    expect(d.hora).toBe('12:09:18');
  });

  it('una sync reciente no está desactualizada', () => {
    const d = describirUltimaSync(a('12:09:18'), a('12:09:30'));
    expect(d.desactualizada).toBe(false);
    expect(d.relativo).toBe('hace menos de 1 minuto');
  });

  it(`pasado el umbral (${UMBRAL_DESACTUALIZADA_MS / 60000} min) avisa que está desactualizada`, () => {
    const sync = a('12:09:18');
    expect(describirUltimaSync(sync, sync + UMBRAL_DESACTUALIZADA_MS - 1).desactualizada).toBe(false);
    expect(describirUltimaSync(sync, sync + UMBRAL_DESACTUALIZADA_MS).desactualizada).toBe(true);
  });

  it('describe la antigüedad en minutos, horas y días', () => {
    const sync = a('12:09:18');
    expect(describirUltimaSync(sync, a('12:20:00')).relativo).toBe('hace 10 minutos');
    expect(describirUltimaSync(sync, a('12:10:30')).relativo).toBe('hace 1 minuto');
    expect(describirUltimaSync(sync, a('14:30:00')).relativo).toBe('hace 2 horas');
    expect(describirUltimaSync(sync, sync + 86400000).relativo).toBe('hace 1 día');
  });

  it('una sync de otro día muestra también la fecha', () => {
    const d = describirUltimaSync(Date.parse('2026-11-19T16:22:00-03:00'), a('10:00:00'));
    expect(d.hora).toBe('19/11 16:22:00');
    expect(d.desactualizada).toBe(true);
  });
});
