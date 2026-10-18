/* eslint-env node */
import { describe, it, expect } from 'vitest';

import {
  ACCIONES_SESION,
  LAST_SESSION_STORAGE_VERSION,
  construirSnapshotSesion,
  interpretarSesionGuardada,
  normalizarSeleccionesGuardadas,
} from '../../src/services/sesion-jornada.js';

const TIPOS = ['opciones', 'compraVenta', 'arbitrajes', 'reconciliacion'];
const PREVIEWS = ['calls', 'puts', 'combined'];
const opciones = { tipos: TIPOS, alcancesPreview: PREVIEWS };

const snapshotValido = (extra = {}) => ({
  version: LAST_SESSION_STORAGE_VERSION,
  savedAt: 1,
  fileName: 'Operaciones.csv',
  report: { summary: { warnings: ['LARGE_FILE'] }, operations: [] },
  ...extra,
});

describe('sesion-jornada', () => {
  describe('interpretarSesionGuardada', () => {
    it('ignora cuando no hay nada guardado', () => {
      expect(interpretarSesionGuardada(null, opciones).accion).toBe(ACCIONES_SESION.IGNORAR);
      expect(interpretarSesionGuardada(undefined, opciones).accion).toBe(ACCIONES_SESION.IGNORAR);
      expect(interpretarSesionGuardada('no es un objeto', opciones).accion)
        .toBe(ACCIONES_SESION.IGNORAR);
    });

    it('descarta un snapshot de otra versión', () => {
      const viejo = snapshotValido({ version: 999 });
      expect(interpretarSesionGuardada(viejo, opciones).accion).toBe(ACCIONES_SESION.DESCARTAR);
    });

    it('descarta un snapshot sin report', () => {
      const sinReport = snapshotValido({ report: undefined });
      expect(interpretarSesionGuardada(sinReport, opciones).accion)
        .toBe(ACCIONES_SESION.DESCARTAR);
    });

    it('restaura un snapshot válido con sus warnings', () => {
      const { accion, sesion } = interpretarSesionGuardada(snapshotValido(), opciones);
      expect(accion).toBe(ACCIONES_SESION.RESTAURAR);
      expect(sesion.warnings).toEqual(['LARGE_FILE']);
      expect(sesion.fileName).toBe('Operaciones.csv');
    });

    it('usa un nombre por defecto cuando el snapshot vino de una sync del broker', () => {
      const { sesion } = interpretarSesionGuardada(
        snapshotValido({ fileName: null }),
        opciones,
      );
      expect(sesion.fileName).toBe('Operaciones previas');
    });

    it('devuelve warnings vacíos si el report no los trae', () => {
      const { sesion } = interpretarSesionGuardada(
        snapshotValido({ report: { operations: [] } }),
        opciones,
      );
      expect(sesion.warnings).toEqual([]);
    });

    it('descarta un activeOperationType que ya no existe', () => {
      const { sesion } = interpretarSesionGuardada(
        snapshotValido({ activeOperationType: 'un-tipo-borrado' }),
        opciones,
      );
      expect(sesion.activeOperationType).toBeNull();
    });

    it('conserva un activeOperationType válido', () => {
      const { sesion } = interpretarSesionGuardada(
        snapshotValido({ activeOperationType: 'arbitrajes' }),
        opciones,
      );
      expect(sesion.activeOperationType).toBe('arbitrajes');
    });

    it('descarta un activePreview desconocido y conserva uno válido', () => {
      expect(interpretarSesionGuardada(
        snapshotValido({ activePreview: 'inventado' }), opciones,
      ).sesion.activePreview).toBeNull();

      expect(interpretarSesionGuardada(
        snapshotValido({ activePreview: 'puts' }), opciones,
      ).sesion.activePreview).toBe('puts');
    });
  });

  describe('normalizarSeleccionesGuardadas', () => {
    it('toma el formato actual, un valor por tipo', () => {
      const selecciones = normalizarSeleccionesGuardadas(
        { selectedGroupIds: { opciones: 'GGAL::OC', arbitrajes: '__ALL__' } },
        TIPOS,
      );
      expect(selecciones).toEqual({ opciones: 'GGAL::OC', arbitrajes: '__ALL__' });
    });

    it('descarta valores que no son strings', () => {
      const selecciones = normalizarSeleccionesGuardadas(
        { selectedGroupIds: { opciones: 'GGAL::OC', arbitrajes: ['no', 'string'] } },
        TIPOS,
      );
      expect(selecciones).toEqual({ opciones: 'GGAL::OC' });
    });

    it('migra el formato viejo replicando el único valor a todos los tipos', () => {
      const selecciones = normalizarSeleccionesGuardadas(
        { selectedGroupId: 'GGAL::OC' },
        TIPOS,
      );
      expect(selecciones).toEqual({
        opciones: 'GGAL::OC',
        compraVenta: 'GGAL::OC',
        arbitrajes: 'GGAL::OC',
        reconciliacion: 'GGAL::OC',
      });
    });

    it('prefiere el formato actual sobre el viejo cuando están los dos', () => {
      const selecciones = normalizarSeleccionesGuardadas(
        { selectedGroupIds: { opciones: 'NUEVO' }, selectedGroupId: 'VIEJO' },
        TIPOS,
      );
      expect(selecciones).toEqual({ opciones: 'NUEVO' });
    });

    it('devuelve null cuando no hay nada que restaurar', () => {
      expect(normalizarSeleccionesGuardadas({}, TIPOS)).toBeNull();
      expect(normalizarSeleccionesGuardadas({ selectedGroupIds: {} }, TIPOS)).toBeNull();
      expect(normalizarSeleccionesGuardadas({ selectedGroupId: 42 }, TIPOS)).toBeNull();
    });
  });

  describe('construirSnapshotSesion', () => {
    it('sella la versión actual', () => {
      const snapshot = construirSnapshotSesion({ report: {}, ahora: 123 });
      expect(snapshot.version).toBe(LAST_SESSION_STORAGE_VERSION);
      expect(snapshot.savedAt).toBe(123);
    });

    it('normaliza un fileName ausente a null', () => {
      expect(construirSnapshotSesion({ report: {} }).fileName).toBeNull();
    });

    it('da la vuelta completa: lo que se guarda se puede restaurar', () => {
      const snapshot = construirSnapshotSesion({
        fileName: 'Operaciones.csv',
        report: { summary: { warnings: [] } },
        selectedGroupIds: { opciones: 'GGAL::OC' },
        activeOperationType: 'opciones',
        activePreview: 'calls',
      });

      const { accion, sesion } = interpretarSesionGuardada(snapshot, opciones);
      expect(accion).toBe(ACCIONES_SESION.RESTAURAR);
      expect(sesion.selecciones).toEqual({ opciones: 'GGAL::OC' });
      expect(sesion.activeOperationType).toBe('opciones');
      expect(sesion.activePreview).toBe('calls');
    });
  });
});
