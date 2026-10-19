/**
 * Las rutas de strings que los componentes leen, fijadas.
 *
 * El prop-drilling de `strings` había entregado la slice equivocada a dos
 * componentes, y los `?? 'literal'` lo tapaban por completo:
 *
 *  - `TooltipRepoFees` recibía `strings.processor` y leía `strings.repo.tooltip`,
 *    pero `repo` vive en el top level. Todas las etiquetas del tooltip de
 *    caución caían al literal hardcodeado.
 *  - `FeeTooltip` recibía `strings.processor` y leía `strings.feeTooltipLabels`,
 *    que en realidad está en `processor.tables.feeTooltipLabels`.
 *
 * Ningún test podía fallar por eso, porque el fallback renderiza un texto
 * plausible. Esto hace que mover una clave en `es-AR.js` rompa un test en
 * lugar de apagar una etiqueta en silencio.
 */
/* eslint-env node */
import { describe, it, expect } from 'vitest';

import strings from '../../src/strings/es-AR.js';

/** Resuelve "a.b.c" sobre un objeto. */
const en = (ruta) => ruta.split('.').reduce((o, k) => o?.[k], strings);

describe('rutas de strings', () => {
  it.each([
    // [ruta, componente que la lee]
    ['repo.tooltip', 'TooltipRepoFees'],
    ['repo.roles', 'TooltipRepoFees'],
    ['repo.currencies', 'TooltipRepoFees'],
    ['processor.tables.feeTooltipLabels', 'FeeTooltip'],
    ['processor.addStrikeException', 'AddStrikeExceptionButton'],
    ['processor.arbitrage', 'ArbitrageTable'],
    ['processor.tables', 'OperationsTable'],
    ['processor.actions', 'OperationsTable'],
    ['processor.filters', 'GroupFilter'],
    ['processor.reconciliation', 'ReconciliationView'],
    ['processor.errors', 'ProcessorScreen'],
    ['processor.warnings', 'ProcessorScreen'],
  ])('%s existe (la lee %s)', (ruta) => {
    expect(en(ruta)).toBeTypeOf('object');
  });

  it('repo NO está bajo processor: es top-level', () => {
    // Si alguien lo mueve, TooltipRepoFees deja de encontrarlo.
    expect(strings.repo).toBeTypeOf('object');
    expect(strings.processor.repo).toBeUndefined();
  });

  it('feeTooltipLabels NO está en la raíz de processor', () => {
    expect(strings.processor.feeTooltipLabels).toBeUndefined();
    expect(strings.processor.tables.feeTooltipLabels).toBeTypeOf('object');
  });

  it('el tooltip de caución tiene las etiquetas que el componente pide', () => {
    const t = strings.repo.tooltip;
    ['arancel', 'derechos', 'gastosGarantia', 'iva', 'totalExpenses',
      'accruedInterest', 'baseAmount', 'netSettlement'].forEach((clave) => {
      expect(t[clave], `falta repo.tooltip.${clave}`).toBeTypeOf('string');
    });
  });
});
