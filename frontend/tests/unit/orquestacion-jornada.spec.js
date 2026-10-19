/* eslint-env node */
import { describe, it, expect } from 'vitest';

import {
  MOTIVOS_SYNC,
  elegirPreviewInicial,
  fusionarOperacionesCsv,
  puedeSincronizar,
  resolverFuenteDeDatos,
} from '../../src/services/orquestacion-jornada.js';

describe('orquestacion-jornada', () => {
  describe('resolverFuenteDeDatos', () => {
    const syncedOperations = [
      { id: '1', source: 'broker', symbol: 'GGAL' },
      { id: '2', source: 'csv', symbol: 'YPF' },
      { id: '3', source: 'broker', symbol: 'PAMP' },
    ];

    it('para el broker procesa sólo las operaciones del broker', () => {
      const { dataSource, file, fileName } = resolverFuenteDeDatos(
        { type: 'broker' },
        { syncedOperations, brokerAccountId: '17825' },
      );

      expect(dataSource.getSourceType()).toBe('json');
      expect(file.map((op) => op.symbol)).toEqual(['GGAL', 'PAMP']);
      expect(fileName).toBe('Broker-17825.json');
    });

    it('usa el nombre de la selección si lo trae', () => {
      const { fileName } = resolverFuenteDeDatos(
        { type: 'broker', name: 'Mi sync.json' },
        { syncedOperations },
      );
      expect(fileName).toBe('Mi sync.json');
    });

    it('cae a Unknown cuando no hay cuenta de broker', () => {
      const { fileName } = resolverFuenteDeDatos({ type: 'broker' }, {});
      expect(fileName).toBe('Broker-Unknown.json');
    });

    it('para CSV usa el archivo y su nombre', () => {
      const archivo = { name: 'Operaciones.csv' };
      const { dataSource, file, fileName } = resolverFuenteDeDatos({ type: 'csv', file: archivo });

      expect(dataSource.getSourceType()).toBe('csv');
      expect(file).toBe(archivo);
      expect(fileName).toBe('Operaciones.csv');
    });

    it('acepta la forma legacy de un File suelto', () => {
      const archivo = { name: 'suelto.csv' };
      const { dataSource, file, fileName } = resolverFuenteDeDatos(archivo);

      expect(dataSource.getSourceType()).toBe('csv');
      expect(file).toBe(archivo);
      expect(fileName).toBe('suelto.csv');
    });

    it('cae a un nombre por defecto cuando el archivo no tiene', () => {
      expect(resolverFuenteDeDatos({ type: 'csv', file: {} }).fileName).toBe('operations.csv');
      expect(resolverFuenteDeDatos(undefined).fileName).toBe('operations.csv');
    });
  });

  describe('fusionarOperacionesCsv', () => {
    const existentes = [
      { id: 'b1', source: 'broker', order_id: 'B-1', symbol: 'GGAL', quantity: 1, price: 1 },
      { id: 'c1', source: 'csv', order_id: 'C-1', symbol: 'YPF', quantity: 1, price: 1 },
    ];
    const nuevasCsv = [
      { id: 'c2', source: 'csv', order_id: 'C-2', symbol: 'PAMP', quantity: 1, price: 1 },
    ];

    it('descarta las de CSV anteriores y conserva las del broker', () => {
      const merged = fusionarOperacionesCsv(existentes, nuevasCsv);

      const fuentes = merged.map((op) => op.source);
      expect(fuentes).toContain('broker');
      // La operación de CSV previa (C-1) no sobrevive.
      expect(merged.some((op) => op.order_id === 'C-1')).toBe(false);
      expect(merged.some((op) => op.order_id === 'C-2')).toBe(true);
    });

    it('devuelve null cuando no hay nada nuevo que fusionar', () => {
      expect(fusionarOperacionesCsv(existentes, [])).toBeNull();
      expect(fusionarOperacionesCsv(existentes, undefined)).toBeNull();
      expect(fusionarOperacionesCsv(existentes, null)).toBeNull();
    });

    it('funciona sin operaciones previas', () => {
      const merged = fusionarOperacionesCsv([], nuevasCsv);
      expect(merged.some((op) => op.order_id === 'C-2')).toBe(true);
    });
  });

  describe('elegirPreviewInicial', () => {
    const reporte = (calls, puts, vista = 'raw') => ({
      views: { [vista]: { calls: { operations: new Array(calls) }, puts: { operations: new Array(puts) } } },
    });

    it('abre en CALLS cuando hay calls', () => {
      expect(elegirPreviewInicial(reporte(3, 0), false)).toBe('calls');
      expect(elegirPreviewInicial(reporte(3, 5), false)).toBe('calls');
    });

    it('abre en PUTS sólo cuando no hay calls pero sí puts', () => {
      expect(elegirPreviewInicial(reporte(0, 5), false)).toBe('puts');
    });

    it('abre en CALLS cuando no hay ninguna de las dos', () => {
      expect(elegirPreviewInicial(reporte(0, 0), false)).toBe('calls');
    });

    it('mira la vista promediada cuando el usuario usa promedios', () => {
      expect(elegirPreviewInicial(reporte(0, 4, 'averaged'), true)).toBe('puts');
      // con useAveraging=false mira 'raw', que acá no existe
      expect(elegirPreviewInicial(reporte(0, 4, 'averaged'), false)).toBe('calls');
    });

    it('no explota con un reporte vacío', () => {
      expect(elegirPreviewInicial(undefined, false)).toBe('calls');
      expect(elegirPreviewInicial({}, true)).toBe('calls');
    });
  });

  describe('puedeSincronizar', () => {
    it('rechaza sin autenticación', () => {
      expect(puedeSincronizar({ auth: null, syncInProgress: false }))
        .toEqual({ puede: false, motivo: MOTIVOS_SYNC.NO_AUTENTICADO });
      expect(puedeSincronizar({ auth: {}, syncInProgress: false }).motivo)
        .toBe(MOTIVOS_SYNC.NO_AUTENTICADO);
    });

    it('rechaza si ya hay una sincronización en curso', () => {
      expect(puedeSincronizar({ auth: { token: 'x' }, syncInProgress: true }))
        .toEqual({ puede: false, motivo: MOTIVOS_SYNC.YA_EN_CURSO });
    });

    it('acepta con token y sin sync en curso', () => {
      expect(puedeSincronizar({ auth: { token: 'x' }, syncInProgress: false }))
        .toEqual({ puede: true });
    });

    it('rechaza sin argumentos', () => {
      expect(puedeSincronizar().puede).toBe(false);
    });
  });
});
