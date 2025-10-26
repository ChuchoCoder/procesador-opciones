import { useEffect } from 'react';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

import { createWarnLogger } from '../../services/logging/index.js';

const tooltipLogger = createWarnLogger('tooltip-repo-fees');

const getRoleLabel = (role, strings) => {
  if (!role) return '';
  const roles = strings?.repo?.roles ?? {};
  return roles[role] || role;
};

const getCurrencyLabel = (currency, strings) => {
  if (!currency) return '';
  const currencies = strings?.repo?.currencies ?? {};
  return currencies[currency] || currency;
};

const buildMissingConfigMessage = (breakdown, strings) => {
  if (typeof breakdown?.errorMessage === 'string' && breakdown.errorMessage.length > 0) {
    return breakdown.errorMessage;
  }

  const template = strings?.repo?.tooltip?.missingConfigDescription;
  const currencyLabel = getCurrencyLabel(breakdown?.currency, strings) || '---';
  const roleLabel = getRoleLabel(breakdown?.role, strings) || '---';

  if (typeof template === 'string' && template.length > 0) {
    const missingList = Array.isArray(breakdown?.warnings?.[0]?.missingRates)
      ? breakdown.warnings[0].missingRates.join(', ')
      : strings?.repo?.tooltip?.missingRatesFallback;

    return template
      .replace('{currency}', currencyLabel)
      .replace('{role}', roleLabel)
      .replace('{missing}', missingList || '---');
  }

  return `Faltan tasas de caución para ${currencyLabel} ${roleLabel}. Abrí Configuración para completarlas.`;
};

const resolveDisplayDecimals = (breakdown) => {
  const candidate = breakdown?.rounding?.displayDecimals;
  if (Number.isInteger(candidate) && candidate >= 0 && candidate <= 4) {
    return candidate;
  }
  return 2;
};

const createCurrencyFormatter = (decimals) => new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: decimals,
  maximumFractionDigits: decimals,
});

const formatAmount = (value, formatter) => {
  if (!Number.isFinite(value)) {
    return '—';
  }
  return formatter.format(value);
};

const formatSigned = (value, formatter) => {
  if (!Number.isFinite(value)) return '—';
  const formatted = formatter.format(Math.abs(value));
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `-${formatted}`;
  return formatted;
};

const buildSuccessTooltip = (breakdown, strings) => {
  const labels = strings?.repo?.tooltip ?? {};
  const roleLabel = getRoleLabel(breakdown?.role, strings);
  const currencyLabel = getCurrencyLabel(breakdown?.currency, strings);
  const decimals = resolveDisplayDecimals(breakdown);
  const formatter = createCurrencyFormatter(decimals);
  const showGastosGarantia = Number.isFinite(breakdown?.gastosGarantiaAmount)
    && Math.abs(breakdown.gastosGarantiaAmount) > 0;

  return (
    <Box sx={{ p: 0.5 }}>
      <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
        {roleLabel || 'Caución'}
        {currencyLabel ? ` · ${currencyLabel}` : ''}
      </Typography>
      {/* Optional TNA Promedio / Plazo lines (only shown when present in breakdown) */}
      {Number.isFinite(breakdown?.avgTNA) && (
        <Typography variant="caption" sx={{ display: 'block', color: 'primary.light', fontWeight: 500 }}>
          {labels.tnaAvg || 'TNA Promedio'}: {Number(breakdown.avgTNA).toFixed(2)}%
        </Typography>
      )}
      {Number.isFinite(breakdown?.tenorDays) && (
        <Typography variant="caption" sx={{ display: 'block' }}>
          {labels.tenor || 'Plazo'}: {breakdown.tenorDays} {labels.daysLabel || 'días'}
        </Typography>
      )}
      <Typography variant="caption" sx={{ display: 'block' }}>
        {labels.baseAmount || 'Monto base'}: {formatAmount(breakdown?.baseAmount, formatter)}
      </Typography>
      <Typography variant="caption" sx={{ display: 'block' }}>
        {labels.accruedInterest || 'Interés devengado'}: {formatSigned(breakdown?.accruedInterest, formatter)}
      </Typography>
      <Box sx={{ borderTop: '1px solid', borderColor: 'divider', my: 0.5 }} />
      <Typography variant="caption" sx={{ display: 'block' }}>
        {labels.arancel || 'Arancel'}: {formatAmount(breakdown?.arancelAmount, formatter)}
      </Typography>
      <Typography variant="caption" sx={{ display: 'block' }}>
        {labels.derechos || 'Derechos de mercado'}: {formatAmount(breakdown?.derechosMercadoAmount, formatter)}
      </Typography>
      {showGastosGarantia && (
        <Typography variant="caption" sx={{ display: 'block' }}>
          {labels.gastosGarantia || 'Gastos de garantía'}: {formatAmount(breakdown?.gastosGarantiaAmount, formatter)}
        </Typography>
      )}
      <Typography variant="caption" sx={{ display: 'block' }}>
        {labels.iva || 'IVA sobre gastos'}: {formatSigned(breakdown?.ivaAmount, formatter)}
      </Typography>
      <Box sx={{ borderTop: '1px solid', borderColor: 'divider', my: 0.5 }} />
      <Typography variant="caption" sx={{ fontWeight: 600, display: 'block' }}>
        {labels.totalExpenses || 'Gastos totales'}: {formatSigned(breakdown?.totalExpenses, formatter)}
      </Typography>
      <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mt: 0.25 }}>
        {labels.netSettlement || 'Neto de liquidación'}: {formatAmount(breakdown?.netSettlement, formatter)}
      </Typography>
    </Box>
  );
};

const TooltipRepoFees = ({ breakdown, strings, children }) => {
  useEffect(() => {
    if (breakdown?.status === 'error' && breakdown?.source === 'repo-config-error') {
      tooltipLogger.warn('Repo tooltip rendering configuration warning', {
        repoOperationId: breakdown.repoOperationId ?? null,
        currency: breakdown.currency ?? null,
        role: breakdown.role ?? null,
        warnings: breakdown.warnings ?? [],
      });
    }
  }, [
    breakdown?.status,
    breakdown?.source,
    breakdown?.repoOperationId,
    breakdown?.currency,
    breakdown?.role,
    breakdown?.warnings,
  ]);

  if (!breakdown) {
    return children;
  }

  if (breakdown.status === 'error' && breakdown.source === 'repo-config-error') {
    const title = strings?.repo?.tooltip?.missingConfigTitle || 'Configurá las tasas de caución';
    const description = buildMissingConfigMessage(breakdown, strings);

    const content = (
      <Box sx={{ p: 0.5 }}>
        <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
          {title}
        </Typography>
        <Typography variant="caption" sx={{ display: 'block', maxWidth: 220 }}>
          {description}
        </Typography>
      </Box>
    );

    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
        {children}
        <Tooltip title={content} arrow placement="top">
          <ErrorOutlineIcon sx={{ fontSize: 16, color: 'warning.main', cursor: 'help' }} />
        </Tooltip>
      </Box>
    );
  }

  if (breakdown.status === 'ok' && !breakdown.blocked) {
    const tooltipContent = buildSuccessTooltip(breakdown, strings);

    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
        {children}
        <Tooltip title={tooltipContent} arrow placement="top">
          <InfoOutlinedIcon sx={{ fontSize: 14, color: 'text.secondary', cursor: 'help' }} />
        </Tooltip>
      </Box>
    );
  }

  return children;
};

export default TooltipRepoFees;
