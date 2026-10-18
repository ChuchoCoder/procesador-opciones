// tooltip-adapter.js - Adapts fee breakdown data for tooltip display
// Formats numeric values to 2-decimal ARS and provides display-ready object.

import { formatMoneda } from '../formato.js';

/**
 * Formats a number to 2-decimal ARS currency string.
 * @param {number} value
 * @returns {string}
 */

/**
 * Formats a percentage (fraction) to display percentage with 4 decimals.
 * Removes unnecessary leading zeros.
 * @param {number} fraction - e.g., 0.0006 for 0.06%
 * @returns {string} - e.g., "0.06%"
 */
function formatPercentage(fraction) {
  if (!Number.isFinite(fraction)) return '—';
  const percent = (fraction * 100).toFixed(4);
  // Remove trailing zeros after decimal point, but keep at least 2 decimals
  return `${parseFloat(parseFloat(percent).toFixed(4))}%`;
}

/**
 * Maps category code to Spanish display label.
 * @param {string} category
 * @returns {string}
 */
function getCategoryLabel(category) {
  const labels = {
    accionCedear: 'Acción/CEDAR',
    letra: 'Letra',
    bonds: 'Bono/Obligación',
    option: 'Opción',
    caucion: 'Caución',
  };
  return labels[category] || 'Desconocida';
}

/**
 * Adapts fee breakdown for tooltip display.
 * @param {object} feeBreakdown - from fee-calculator
 * @param {number} grossNotional - operation gross
 * @param {number} netTotal - calculated net total (gross ± fees)
 * @param {number} totalQuantity - quantity (positive for BUY, negative for SELL)
 * @returns {object} display-ready tooltip data
 */
export function adaptFeeBreakdownForTooltip(feeBreakdown, grossNotional, netTotal, totalQuantity) {
  if (!feeBreakdown) {
    return null;
  }

  // conservative reference for an argument currently unused in this adapter
  void totalQuantity;

  const {
    commissionPct,
    rightsPct,
    vatPct,
    commissionAmount,
    rightsAmount,
    vatAmount,
    category,
    source,
  } = feeBreakdown;

  const totalFee = commissionAmount + rightsAmount + vatAmount;

  return {
    categoria: getCategoryLabel(category),
    brutoARS: formatMoneda(grossNotional),
    comisionPct: formatPercentage(commissionPct),
    derechosPct: formatPercentage(rightsPct),
    ivaPct: formatPercentage(vatPct),
    comisionARS: formatMoneda(commissionAmount),
    derechosARS: formatMoneda(rightsAmount),
    ivaARS: formatMoneda(vatAmount),
    totalARS: formatMoneda(totalFee),
    netoARS: formatMoneda(netTotal),
    fuente: source === 'placeholder' ? 'Próximamente' : 'Configuración',
  };
}
