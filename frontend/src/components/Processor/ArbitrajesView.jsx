import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

import GroupFilter from './GroupFilter.jsx';

const ArbitrajesView = ({
  groupOptions,
  selectedGroupId,
  filtersVisible,
  strings,
  onGroupChange,
}) => {
  const filterStrings = strings?.filters ?? {};

  return (
    <Stack spacing={2} sx={{ flex: 1, minHeight: 0 }}>
      {filtersVisible && groupOptions.length > 0 && (
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
            p: 4,
            maxWidth: 500,
            textAlign: 'center',
          }}
        >
          <Stack spacing={2} alignItems="center">
            <InfoOutlinedIcon sx={{ fontSize: 60, color: 'text.secondary' }} />
            <Typography variant="h5" component="h3">
              {strings?.tables?.arbitrajesTitle ?? 'Arbitrajes de Plazo'}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {strings?.tables?.comingSoon ?? 'Esta funcionalidad estará disponible próximamente.'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Aquí podrás ver operaciones que incluyen compras, ventas y cauciones para identificar oportunidades de arbitraje.
            </Typography>
          </Stack>
        </Paper>
      </Box>
    </Stack>
  );
};

export default ArbitrajesView;
