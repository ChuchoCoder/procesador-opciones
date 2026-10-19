/* eslint-env node */
import { describe, it, expect } from 'vitest';

import {
  EVENTOS,
  FASES,
  debeProcesar,
  esperaSync,
  estadoInicial,
  reducirProcesamiento,
} from '../../src/services/maquina-procesamiento.js';

const csv = { type: 'csv', file: { name: 'Operaciones.csv' } };
const broker = { type: 'broker', name: 'Broker-17825' };

/** Aplica una secuencia de eventos desde el estado inicial. */
const correr = (...eventos) => eventos.reduce(reducirProcesamiento, estadoInicial);

describe('maquina-procesamiento', () => {
  it('arranca sin fuente y sin nada que procesar', () => {
    expect(estadoInicial.fase).toBe(FASES.SIN_FUENTE);
    expect(debeProcesar(estadoInicial)).toBe(false);
  });

  describe('el camino feliz', () => {
    it('seleccionar una fuente deja el procesamiento pendiente', () => {
      const estado = correr({ tipo: EVENTOS.FUENTE_SELECCIONADA, fuente: csv });
      expect(estado.fase).toBe(FASES.PENDIENTE);
      expect(debeProcesar(estado)).toBe(true);
    });

    it('recorre pendiente -> procesando -> listo', () => {
      const procesando = correr(
        { tipo: EVENTOS.FUENTE_SELECCIONADA, fuente: csv },
        { tipo: EVENTOS.PROCESAMIENTO_INICIADO },
      );
      expect(procesando.fase).toBe(FASES.PROCESANDO);
      // Clave: mientras procesa, no hay que volver a procesar.
      expect(debeProcesar(procesando)).toBe(false);

      const listo = reducirProcesamiento(procesando, { tipo: EVENTOS.PROCESAMIENTO_OK });
      expect(listo.fase).toBe(FASES.LISTO);
      expect(debeProcesar(listo)).toBe(false);
    });

    it('seleccionar una fuente nueva con un reporte listo vuelve a pendiente', () => {
      const listo = correr(
        { tipo: EVENTOS.FUENTE_SELECCIONADA, fuente: csv },
        { tipo: EVENTOS.PROCESAMIENTO_INICIADO },
        { tipo: EVENTOS.PROCESAMIENTO_OK },
      );
      const otra = reducirProcesamiento(listo, {
        tipo: EVENTOS.FUENTE_SELECCIONADA,
        fuente: { type: 'csv', file: { name: 'Otro.csv' } },
      });
      expect(debeProcesar(otra)).toBe(true);
      expect(otra.fuente.file.name).toBe('Otro.csv');
    });

    it('seleccionar "ninguna fuente" vuelve al estado inicial', () => {
      const estado = correr(
        { tipo: EVENTOS.FUENTE_SELECCIONADA, fuente: csv },
        { tipo: EVENTOS.FUENTE_SELECCIONADA, fuente: null },
      );
      expect(estado).toEqual(estadoInicial);
    });
  });

  describe('el interlock del refresh (lo que antes eran dos refs)', () => {
    it('pedir un refresh sobre datos del broker suspende el procesamiento', () => {
      const estado = correr(
        { tipo: EVENTOS.FUENTE_SELECCIONADA, fuente: broker },
        { tipo: EVENTOS.REFRESH_PEDIDO, timestamp: 100 },
      );
      expect(estado.fase).toBe(FASES.ESPERANDO_SYNC);
      expect(esperaSync(estado)).toBe(true);
      // Esto es lo que antes lograba `pendingRefreshRef`: no procesar todavía.
      expect(debeProcesar(estado)).toBe(false);
    });

    it('no suspende nada si no se estaba mirando el broker', () => {
      const estado = correr(
        { tipo: EVENTOS.FUENTE_SELECCIONADA, fuente: csv },
        { tipo: EVENTOS.REFRESH_PEDIDO, timestamp: 100 },
      );
      expect(estado.fase).toBe(FASES.PENDIENTE);
    });

    it('una sync con timestamp nuevo libera el procesamiento', () => {
      const estado = correr(
        { tipo: EVENTOS.FUENTE_SELECCIONADA, fuente: broker },
        { tipo: EVENTOS.REFRESH_PEDIDO, timestamp: 100 },
        { tipo: EVENTOS.SYNC_TERMINADO, timestamp: 200 },
      );
      expect(estado.fase).toBe(FASES.PENDIENTE);
      expect(debeProcesar(estado)).toBe(true);
      expect(estado.esperandoSyncDesde).toBeNull();
    });

    it('una sync que no movió el timestamp sigue esperando', () => {
      // Era la comparación `currentSyncTimestamp !== lastSyncTimestampRef.current`.
      const estado = correr(
        { tipo: EVENTOS.FUENTE_SELECCIONADA, fuente: broker },
        { tipo: EVENTOS.REFRESH_PEDIDO, timestamp: 100 },
        { tipo: EVENTOS.SYNC_TERMINADO, timestamp: 100 },
      );
      expect(esperaSync(estado)).toBe(true);
      expect(debeProcesar(estado)).toBe(false);
    });

    it('una sync sin timestamp sigue esperando', () => {
      const estado = correr(
        { tipo: EVENTOS.FUENTE_SELECCIONADA, fuente: broker },
        { tipo: EVENTOS.REFRESH_PEDIDO, timestamp: 100 },
        { tipo: EVENTOS.SYNC_TERMINADO, timestamp: null },
      );
      expect(esperaSync(estado)).toBe(true);
    });

    it('al liberarse adopta la fuente renovada que trae el evento', () => {
      const renovada = { type: 'broker', name: 'Broker-17825', timestamp: 999 };
      const estado = correr(
        { tipo: EVENTOS.FUENTE_SELECCIONADA, fuente: broker },
        { tipo: EVENTOS.REFRESH_PEDIDO, timestamp: 100 },
        { tipo: EVENTOS.SYNC_TERMINADO, timestamp: 200, fuente: renovada },
      );
      expect(estado.fuente).toBe(renovada);
    });

    it('ignora un sync terminado que nadie estaba esperando', () => {
      const listo = correr(
        { tipo: EVENTOS.FUENTE_SELECCIONADA, fuente: broker },
        { tipo: EVENTOS.PROCESAMIENTO_INICIADO },
        { tipo: EVENTOS.PROCESAMIENTO_OK },
      );
      const despues = reducirProcesamiento(listo, {
        tipo: EVENTOS.SYNC_TERMINADO,
        timestamp: 777,
      });
      expect(despues).toBe(listo);
    });
  });

  describe('fallas', () => {
    it('al fallar suelta la fuente, para no re-procesar en loop', () => {
      const estado = correr(
        { tipo: EVENTOS.FUENTE_SELECCIONADA, fuente: csv },
        { tipo: EVENTOS.PROCESAMIENTO_INICIADO },
        { tipo: EVENTOS.PROCESAMIENTO_FALLIDO },
      );
      expect(estado.fase).toBe(FASES.FALLIDO);
      expect(estado.fuente).toBeNull();
      expect(debeProcesar(estado)).toBe(false);
    });

    it('después de una falla se puede volver a seleccionar una fuente', () => {
      const fallido = correr(
        { tipo: EVENTOS.FUENTE_SELECCIONADA, fuente: csv },
        { tipo: EVENTOS.PROCESAMIENTO_FALLIDO },
      );
      const reintento = reducirProcesamiento(fallido, {
        tipo: EVENTOS.FUENTE_SELECCIONADA,
        fuente: csv,
      });
      expect(debeProcesar(reintento)).toBe(true);
    });
  });

  describe('robustez', () => {
    it('iniciar un procesamiento que no estaba pendiente no hace nada', () => {
      const estado = reducirProcesamiento(estadoInicial, {
        tipo: EVENTOS.PROCESAMIENTO_INICIADO,
      });
      expect(estado).toBe(estadoInicial);
    });

    it('un evento desconocido devuelve el mismo estado, sin mutarlo', () => {
      const previo = correr({ tipo: EVENTOS.FUENTE_SELECCIONADA, fuente: csv });
      expect(reducirProcesamiento(previo, { tipo: 'inventado' })).toBe(previo);
    });

    it('limpiar vuelve al estado inicial desde cualquier fase', () => {
      const esperando = correr(
        { tipo: EVENTOS.FUENTE_SELECCIONADA, fuente: broker },
        { tipo: EVENTOS.REFRESH_PEDIDO, timestamp: 100 },
      );
      expect(reducirProcesamiento(esperando, { tipo: EVENTOS.LIMPIADO })).toEqual(estadoInicial);
    });

    it('tolera ser llamado sin argumentos', () => {
      expect(reducirProcesamiento()).toEqual(estadoInicial);
      expect(debeProcesar(undefined)).toBe(false);
      expect(esperaSync(undefined)).toBe(false);
    });
  });
});

describe('maquina-procesamiento: re-derivar', () => {
  const csv = { type: 'csv', file: { name: 'Operaciones.csv' } };

  it('vuelve a PENDIENTE conservando la fuente', () => {
    const listo = [
      { tipo: EVENTOS.FUENTE_SELECCIONADA, fuente: csv },
      { tipo: EVENTOS.PROCESAMIENTO_INICIADO },
      { tipo: EVENTOS.PROCESAMIENTO_OK },
    ].reduce(reducirProcesamiento, estadoInicial);

    const rederivando = reducirProcesamiento(listo, { tipo: EVENTOS.REDERIVAR });

    expect(rederivando.fase).toBe(FASES.PENDIENTE);
    expect(debeProcesar(rederivando)).toBe(true);
    // Clave: no suelta la fuente, así que se re-deriva lo mismo.
    expect(rederivando.fuente).toBe(csv);
  });

  it('no hace nada si no hay fuente', () => {
    expect(reducirProcesamiento(estadoInicial, { tipo: EVENTOS.REDERIVAR }))
      .toBe(estadoInicial);
  });

  it('no interrumpe una sync que se está esperando', () => {
    const esperando = [
      { tipo: EVENTOS.FUENTE_SELECCIONADA, fuente: { type: 'broker' } },
      { tipo: EVENTOS.REFRESH_PEDIDO, timestamp: 100 },
    ].reduce(reducirProcesamiento, estadoInicial);

    const despues = reducirProcesamiento(esperando, { tipo: EVENTOS.REDERIVAR });
    // Pasa a PENDIENTE, que es lo correcto: re-derivar es inmediato y no
    // depende de la sync.
    expect(despues.fase).toBe(FASES.PENDIENTE);
  });
});
