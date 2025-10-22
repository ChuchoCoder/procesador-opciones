import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CloudSyncIcon from '@mui/icons-material/CloudSync';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RefreshIcon from '@mui/icons-material/Refresh';

import BrokerLogin from './BrokerLogin.jsx';

/**
 * Component that displays both CSV upload and Broker login options side by side
 */
const DataSourceSelector = ({
  strings,
  onSelectFile,
  onBrokerLogin,
  onBrokerLogout,
  onBrokerSync,
  onBrokerProcess,
  isBrokerLoginLoading,
  brokerLoginError,
  isAuthenticated,
  syncInProgress,
  defaultApiUrl,
  brokerAccountId,
  brokerOperationCount = 0,
}) => {
  const handleFileSelection = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      onSelectFile(file);
    }
  };

  const uploadStrings = strings?.processor?.upload ?? {};

  return (
    <Box
      sx={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        px: 3,
        py: 4,
      }}
    >
      <Box sx={{ maxWidth: 1400, width: '100%' }}>
        {/* Header */}
        <Stack spacing={2} alignItems="center" sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
            {uploadStrings.chooseMethodTitle || 'Cargá tus operaciones'}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {uploadStrings.chooseMethodDescription || 'Elegí una de las siguientes opciones para importar tus operaciones:'}
          </Typography>
        </Stack>

        {/* Two Options Side by Side with centered divider */}
        <Box 
          sx={{ 
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr auto 1fr' },
            gap: 4,
            alignItems: 'stretch',
          }}
        >
          {/* CSV Upload Option */}
          <Box>
            <Paper
              elevation={3}
              sx={{
                p: 4,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                border: '2px solid',
                borderColor: 'primary.light',
                borderRadius: 3,
                transition: 'all 0.3s',
                '&:hover': {
                  boxShadow: 6,
                  borderColor: 'primary.main',
                },
              }}
            >
              <Stack spacing={3} sx={{ flex: 1 }}>
                <Box sx={{ textAlign: 'center' }}>
                  <UploadFileIcon
                    sx={{
                      fontSize: 64,
                      color: 'primary.main',
                      mb: 2,
                    }}
                  />
                  <Typography variant="h5" component="h2" sx={{ fontWeight: 600, mb: 1 }}>
                    {uploadStrings.csvOption || 'Subir archivo CSV'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {uploadStrings.description || 'Seleccioná un archivo CSV con tus operaciones'}
                  </Typography>
                </Box>

                <Divider />

                <Button
                  variant="contained"
                  component="label"
                  size="large"
                  startIcon={<UploadFileIcon />}
                  fullWidth
                  sx={{
                    py: 1.5,
                    fontSize: '1rem',
                  }}
                >
                  {uploadStrings.selectButton || 'Seleccionar archivo'}
                  <input
                    type="file"
                    hidden
                    accept=".csv,text/csv"
                    onChange={handleFileSelection}
                  />
                </Button>

                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    backgroundColor: 'rgba(25, 118, 210, 0.04)',
                    borderColor: 'primary.light',
                    flex: 1,
                  }}
                >
                  <Stack spacing={1} alignItems="flex-start">
                    <Stack direction="row" spacing={1} alignItems="center">
                      <InfoOutlinedIcon fontSize="small" color="info" />
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        {uploadStrings.instructions?.title || 'Instrucciones:'}
                      </Typography>
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {uploadStrings.instructions?.step1 || '✓ Descargá el archivo CSV desde Matriz'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {uploadStrings.instructions?.step2 || '✓ Usá el ícono de descarga'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {uploadStrings.instructions?.step3 || '✓ Seleccioná el archivo CSV'}
                    </Typography>
                  </Stack>
                </Paper>
              </Stack>
            </Paper>
          </Box>

          {/* Divider with OR - visible only on desktop */}
          <Box
            sx={{
              display: { xs: 'none', md: 'flex' },
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '80px',
            }}
          >
            <Paper 
              elevation={8}
              sx={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'background.paper',
                border: '2px solid',
                borderColor: 'divider',
              }}
            >
              <Typography 
                variant="h5"
                sx={{ 
                  fontWeight: 900, 
                  color: 'text.secondary',
                  lineHeight: 1,
                }}
              >
                {uploadStrings.orDivider || 'ó'}
              </Typography>
            </Paper>
          </Box>

          {/* Divider with OR - visible only on mobile */}
          <Box
            sx={{
              display: { xs: 'flex', md: 'none' },
              justifyContent: 'center',
              alignItems: 'center',
              my: 2,
            }}
          >
            <Divider sx={{ width: '100%' }}>
              <Typography variant="body1" color="text.secondary" sx={{ px: 2, fontWeight: 600 }}>
                {uploadStrings.orDivider || 'ó'}
              </Typography>
            </Divider>
          </Box>

          {/* Broker Login Option */}
          <Box>
            <Paper
              elevation={3}
              sx={{
                p: 4,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                border: '2px solid',
                borderColor: isAuthenticated ? 'success.light' : 'secondary.light',
                borderRadius: 3,
                transition: 'all 0.3s',
                '&:hover': {
                  boxShadow: 6,
                  borderColor: isAuthenticated ? 'success.main' : 'secondary.main',
                },
              }}
            >
              <Stack spacing={3} sx={{ flex: 1 }}>
                <Box sx={{ textAlign: 'center' }}>
                  <CloudSyncIcon
                    sx={{
                      fontSize: 64,
                      color: isAuthenticated ? 'success.main' : 'secondary.main',
                      mb: 2,
                    }}
                  />
                  <Typography variant="h5" component="h2" sx={{ fontWeight: 600, mb: 1 }}>
                    {uploadStrings.brokerOption || 'Conectar con Broker'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Sincronizá automáticamente tus operaciones del broker
                  </Typography>
                </Box>

                <Divider />

                {!isAuthenticated ? (
                  <BrokerLogin
                    strings={strings}
                    onLogin={onBrokerLogin}
                    isLoading={isBrokerLoginLoading}
                    error={brokerLoginError}
                    disabled={syncInProgress}
                    defaultApiUrl={defaultApiUrl}
                  />
                ) : (
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 3,
                      backgroundColor: 'rgba(46, 125, 50, 0.04)',
                      borderColor: 'success.light',
                    }}
                  >
                    <Stack spacing={2} alignItems="center">
                      <Typography variant="body1" color="success.main" sx={{ fontWeight: 600 }}>
                        ✓ Conectado al broker
                      </Typography>
                      {brokerAccountId && (
                        <Typography variant="body2" color="text.secondary">
                          Cuenta: {brokerAccountId}
                        </Typography>
                      )}
                      <Typography variant="body2" color="text.secondary">
                        Tus operaciones se sincronizarán automáticamente
                      </Typography>
                      
                      {brokerOperationCount > 0 && (
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                          {brokerOperationCount} operaciones sincronizadas
                        </Typography>
                      )}

                      <Stack direction="row" spacing={1} sx={{ width: '100%' }}>
                        <Button
                          variant="outlined"
                          startIcon={syncInProgress ? <RefreshIcon sx={{ animation: 'spin 1s linear infinite' }} /> : <RefreshIcon />}
                          onClick={onBrokerSync}
                          disabled={syncInProgress}
                          fullWidth
                          sx={{
                            '@keyframes spin': {
                              '0%': { transform: 'rotate(0deg)' },
                              '100%': { transform: 'rotate(360deg)' },
                            },
                          }}
                        >
                          Sincronizar
                        </Button>
                        <Button
                          variant="contained"
                          color="primary"
                          startIcon={<PlayArrowIcon />}
                          onClick={onBrokerProcess}
                          disabled={syncInProgress || brokerOperationCount === 0}
                          fullWidth
                        >
                          Procesar
                        </Button>
                      </Stack>

                      <Button
                        variant="outlined"
                        color="error"
                        onClick={onBrokerLogout}
                        disabled={syncInProgress}
                        fullWidth
                        size="small"
                      >
                        Cerrar sesión
                      </Button>
                    </Stack>
                  </Paper>
                )}
              </Stack>
            </Paper>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default DataSourceSelector;
