/**
 * El ticker V no se corrompe al pasar por `enrichOperationRow`.
 *
 * Compañero de `arbitrage-v-ticker-enrich3.spec.js`. Los dos eran sesiones de
 * debug commiteadas como specs, con cero aserciones y todo `console.log`:
 * `enrich3` investigaba el token y el strike, este el **símbolo**.
 *
 * La pregunta que perseguía sí vale un test. Cuando el regex de opciones
 * matchea por accidente (`MERVXMEVV24HS`, la forma colapsada de la acción V a
 * 24 horas), el código asigna el símbolo del token —`MERVXMEV`— antes de saber
 * si el instrumento es una opción. La revisión marcó que la reparación existía
 * en una sola de las tres ramas del gate de CfiCode.
 *
 * Para la V el CfiCode se conoce (`EMXXXX`, acción), así que cae en la rama que
 * sí repara y el símbolo completo sobrevive. Esto lo fija.
 */
/* eslint-env node */
import { describe, it, expect, beforeAll } from 'vitest';
import Papa from 'papaparse';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { normalizeOperationRows } from '../../src/services/csv/legacy-normalizer.js';
import { validateAndFilterRows } from '../../src/services/csv/validators.js';
import { enrichOperationRow } from '../../src/services/csv/process-operations.js';

const dataDir = resolve(dirname(fileURLToPath(import.meta.url)), 'data');

describe('ticker V: enrichOperationRow no corrompe el símbolo', () => {
  let enriquecidas;

  beforeAll(async () => {
    const contenido = await readFile(resolve(dataDir, 'arbitrage-V-ticker.csv'), 'utf-8');
    const crudas = Papa.parse(contenido, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
    }).data.filter((row) => row.symbol);

    const { rows: normalizadas } = normalizeOperationRows(crudas, {});
    const { rows: validadas } = validateAndFilterRows({ rows: normalizadas });
    const filasV = validadas.filter((r) => String(r.symbol ?? '').includes(' - V '));

    expect(filasV.length).toBeGreaterThan(0);
    enriquecidas = await Promise.all(filasV.map((row) => enrichOperationRow(row, {})));
  }, 60000);

  it('conserva el símbolo completo del reporte', () => {
    enriquecidas.forEach((e) => {
      // Sin la reparación quedaría el símbolo del token, `MERVXMEV`.
      expect(e.symbol).toMatch(/^MERV - XMEV - V - /i);
      expect(e.symbol).not.toBe('MERVXMEV');
    });
  });

  it('no la clasifica como opción', () => {
    enriquecidas.forEach((e) => {
      expect(e.type).not.toBe('CALL');
      expect(e.type).not.toBe('PUT');
    });
  });

  it('no le inventa un strike', () => {
    // Regresión de #32: el `24` de "24hs" se leía como strike.
    enriquecidas.forEach((e) => {
      expect(e.strike, `strike fantasma en ${e.symbol}`).toBeFalsy();
    });
  });

  it('usa el venue como expiración, no una expiración de opción', () => {
    const expiraciones = new Set(enriquecidas.map((e) => e.expiration));
    expiraciones.forEach((exp) => {
      expect(['CI', '24HS']).toContain(exp);
    });
    // Las dos puntas del arbitraje tienen que estar presentes.
    expect(expiraciones.size).toBe(2);
  });
});
