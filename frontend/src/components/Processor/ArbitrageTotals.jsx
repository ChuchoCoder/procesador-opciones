/**
 * ArbitrageTotals - Display daily totals for P&L
 * Implements User Story 3 from specs/006-arbitraje-de-plazos
 */

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import { formatCurrency } from '../../services/pnl-calculations.js';

/**
 * Get color for total value
 * @param {number} value
 * @returns {string}
 */
function getTotalColor(value) {
  if (value > 0) return 'success.main';
  if (value < 0) return 'error.main';
  return 'text.secondary';
}

/**
 * ArbitrageTotals component
 */
const ArbitrageTotals = ({ data = [], strings = {} }) => {
  const arbitrageStrings = strings?.arbitrage || {};
  const totalsStrings = arbitrageStrings?.totals || {};

  // Calculate totals
  const totals = data.reduce(
    (acc, row) => {
      acc.pnlTrade += row.pnl_trade || 0;
      acc.pnlCaucion += row.pnl_caucion || 0;
      acc.pnlTotal += row.pnl_total || 0;
      return acc;
    },
    { pnlTrade: 0, pnlCaucion: 0, pnlTotal: 0 }
  );

  if (!data || data.length === 0) {
    return null;
  }

  return (
    <Paper
      elevation={2}
      sx={{
        p: 2,
        backgroundColor: 'background.default',
        borderRadius: 2,
      }}
    >
      <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
        {totalsStrings.title || 'Totales del día'}
      </Typography>
      
      <Stack spacing={1.5}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            {totalsStrings.pnlTradeTotal || 'Total P&L Trade'}
          </Typography>
          <Typography
            variant="body1"
            sx={{
              color: getTotalColor(totals.pnlTrade),
              fontWeight: 600,
            }}
          >
            {formatCurrency(totals.pnlTrade)}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            {totalsStrings.pnlCaucionTotal || 'Total P&L Caución'}
          </Typography>
          <Typography
            variant="body1"
            sx={{
              color: getTotalColor(totals.pnlCaucion),
              fontWeight: 600,
            }}
          >
            {formatCurrency(totals.pnlCaucion)}
          </Typography>
        </Box>

        <Divider sx={{ my: 1 }} />

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {totalsStrings.pnlGrandTotal || 'Total General'}
          </Typography>
          <Typography
            variant="h6"
            sx={{
              color: getTotalColor(totals.pnlTotal),
              fontWeight: 700,
            }}
          >
            {formatCurrency(totals.pnlTotal)}
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
};

export default ArbitrageTotals;
