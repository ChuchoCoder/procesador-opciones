import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import TimelineIcon from '@mui/icons-material/Timeline';
import { useTheme } from '@mui/material/styles';

import GroupFilter from './GroupFilter.jsx';

const ArbitrajesView = ({
  groupOptions,
  selectedGroupId,
  strings,
  onGroupChange,
}) => {
  const filterStrings = strings?.filters ?? {};
  const theme = useTheme();

  return (
    <Stack spacing={0} sx={{ flex: 1, minHeight: 0 }}>
      {groupOptions.length > 0 && (
        <GroupFilter
          options={groupOptions}
          selectedGroupId={selectedGroupId}
          onChange={onGroupChange}
          strings={filterStrings}
        />
      )}

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Paper
          elevation={2}
          sx={{
            p: 5,
            maxWidth: 550,
            textAlign: 'center',
            border: '2px dashed',
            borderColor: 'divider',
            borderRadius: 3,
            background: 'linear-gradient(135deg, rgba(0,137,123,0.05) 0%, rgba(0,137,123,0.02) 100%)',
          }}
        >
          <Stack spacing={3} alignItems="center">
            <Box
              sx={{
                position: 'relative',
                display: 'inline-flex',
              }}
            >
              <TimelineIcon
                sx={{
                  fontSize: 72,
                  color: 'arbitrajes.main',
                  opacity: 0.9,
                }}
              />
              <Typography
                sx={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  fontSize: 28,
                }}
              >
                🧪
              </Typography>
            </Box>
            
            <Chip
              icon={<TimelineIcon sx={{ fontSize: 18 }} />}
              label={strings?.tables?.arbitrajesTitle ?? 'Arbitrajes de Plazo'}
              sx={{
                backgroundColor: theme.palette.arbitrajes.main,
                color: '#fff',
                fontWeight: 600,
                fontSize: '0.95rem',
                px: 1,
                letterSpacing: '0.5px',
                '& .MuiChip-icon': {
                  color: '#fff',
                },
              }}
            />
            
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 450 }}>
              {strings?.tables?.comingSoon ?? 'Esta funcionalidad estará disponible próximamente.'}
            </Typography>
            
            <Paper
              variant="outlined"
              sx={{
                p: 2.5,
                backgroundColor: 'rgba(0, 137, 123, 0.04)',
                borderColor: 'arbitrajes.light',
                borderRadius: 2,
                width: '100%',
              }}
            >
              <Stack spacing={1} alignItems="flex-start">
                <Stack direction="row" spacing={1} alignItems="center">
                  <InfoOutlinedIcon fontSize="small" color="info" />
                  <Typography variant="subtitle2" color="text.primary" sx={{ fontWeight: 600 }}>
                    Próximamente:
                  </Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary" textAlign="left">
                  ✓ Detección automática de oportunidades de arbitraje
                </Typography>
                <Typography variant="body2" color="text.secondary" textAlign="left">
                  ✓ Análisis combinado de compras, ventas y cauciones
                </Typography>
                <Typography variant="body2" color="text.secondary" textAlign="left">
                  ✓ Cálculo de rentabilidad y costos implícitos
                </Typography>
              </Stack>
            </Paper>
          </Stack>
        </Paper>
      </Box>
    </Stack>
  );
};

export default ArbitrajesView;
