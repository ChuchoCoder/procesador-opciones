import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

const EmptyState = ({ strings, onSelectFile }) => {
  const handleFileSelection = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      onSelectFile(file);
    }
  };

  return (
    <Box
      sx={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
      }}
    >
      <Paper
        elevation={2}
        sx={{
          p: 4,
          maxWidth: 600,
          textAlign: 'center',
        }}
      >
        <Stack spacing={3} alignItems="center">
          <UploadFileIcon sx={{ fontSize: 80, color: 'primary.main' }} />
          
          <Typography variant="h5" component="h2">
            {strings?.upload?.title ?? 'Procesar operaciones'}
          </Typography>
          
          <Typography variant="body1" color="text.secondary">
            {strings?.upload?.description ?? 'Seleccioná un archivo CSV con tus operaciones para generar el informe.'}
          </Typography>

          <Stack spacing={2} sx={{ width: '100%', maxWidth: 400 }}>
            <Button
              variant="contained"
              component="label"
              size="large"
              startIcon={<UploadFileIcon />}
              fullWidth
            >
              {strings?.upload?.selectButton ?? 'Seleccionar archivo'}
              <input
                type="file"
                hidden
                accept=".csv,text/csv"
                onChange={handleFileSelection}
              />
            </Button>
          </Stack>

          <Paper
            variant="outlined"
            sx={{
              p: 2,
              mt: 2,
              backgroundColor: 'background.default',
              width: '100%',
            }}
          >
            <Stack spacing={1} alignItems="flex-start">
              <Stack direction="row" spacing={1} alignItems="center">
                <InfoOutlinedIcon fontSize="small" color="info" />
                <Typography variant="subtitle2" color="text.primary">
                  Instrucciones:
                </Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary" textAlign="left">
                • Seleccioná un archivo CSV exportado desde tu broker
              </Typography>
              <Typography variant="body2" color="text.secondary" textAlign="left">
                • El archivo debe contener las columnas de operaciones
              </Typography>
              <Typography variant="body2" color="text.secondary" textAlign="left">
                • Una vez procesado, podrás filtrar, copiar y descargar los resultados
              </Typography>
            </Stack>
          </Paper>
        </Stack>
      </Paper>
    </Box>
  );
};

export default EmptyState;
