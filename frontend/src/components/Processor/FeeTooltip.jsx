import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { adaptFeeBreakdownForTooltip } from '../../services/fees/tooltip-adapter.js';

/**
 * FeeTooltip - Displays fee breakdown tooltip on hover
 * @param {object} props
 * @param {object} props.feeBreakdown - from fee-calculator
 * @param {number} props.grossNotional - operation gross
 * @param {number} props.netTotal - calculated net total (gross ± fees)
 * @param {number} props.totalQuantity - quantity (positive for BUY, negative for SELL)
 * @param {object} props.strings - localized strings
 * @param {React.ReactNode} props.children - trigger element (usually fee amount cell content)
 */
const FeeTooltip = ({ feeBreakdown, grossNotional, netTotal, totalQuantity, strings, children }) => {
  if (!feeBreakdown || feeBreakdown.source === 'placeholder') {
    // Caucion placeholder tooltip
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
        {children}
        <Tooltip
          title={strings?.feeTooltipLabels?.proximamente || 'Próximamente'}
          arrow
          placement="top"
        >
          <InfoOutlinedIcon sx={{ fontSize: 14, color: 'text.secondary', cursor: 'help' }} />
        </Tooltip>
      </Box>
    );
  }

  const tooltipData = adaptFeeBreakdownForTooltip(feeBreakdown, grossNotional, netTotal, totalQuantity);
  if (!tooltipData) {
    return children;
  }

  const labels = strings?.feeTooltipLabels || {};

  const tooltipContent = (
    <Box sx={{ p: 0.5 }}>
      <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
        {labels.categoria || 'Categoría'}: {tooltipData.categoria}
      </Typography>
      <Typography variant="caption" sx={{ display: 'block' }}>
        {labels.bruto || 'Bruto'}: {tooltipData.brutoARS}
      </Typography>
      <Box sx={{ borderTop: '1px solid', borderColor: 'divider', my: 0.5 }} />
      <Typography variant="caption" sx={{ display: 'block' }}>
        {labels.comision || 'Comisión'} ({tooltipData.comisionPct}): {tooltipData.comisionARS}
      </Typography>
      <Typography variant="caption" sx={{ display: 'block' }}>
        {labels.derechos || 'Derechos'} ({tooltipData.derechosPct}): {tooltipData.derechosARS}
      </Typography>
      <Typography variant="caption" sx={{ display: 'block' }}>
        {labels.iva || 'IVA'} ({tooltipData.ivaPct}): {tooltipData.ivaARS}
      </Typography>
      <Box sx={{ borderTop: '1px solid', borderColor: 'divider', my: 0.5 }} />
      <Typography variant="caption" sx={{ fontWeight: 600, display: 'block' }}>
        {labels.total || 'Total'}: {tooltipData.totalARS}
      </Typography>
      <Box sx={{ borderTop: '1px solid', borderColor: 'divider', my: 0.5 }} />
      <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', color: '#90caf9' }}>
        {labels.neto || 'Neto'}: {tooltipData.netoARS}
      </Typography>
      <Typography variant="caption" sx={{ display: 'block', fontSize: 10, color: 'rgba(255, 255, 255, 0.7)', mt: 0.5 }}>
        {labels.fuente || 'Fuente'}: {tooltipData.fuente}
      </Typography>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
      {children}
      <Tooltip title={tooltipContent} arrow placement="top">
        <InfoOutlinedIcon sx={{ fontSize: 14, color: 'text.secondary', cursor: 'help' }} />
      </Tooltip>
    </Box>
  );
};

export default FeeTooltip;
