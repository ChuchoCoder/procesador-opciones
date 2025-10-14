import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';

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
          p: 5,
          maxWidth: 600,
          textAlign: 'center',
          border: '2px dashed',
          borderColor: 'divider',
          borderRadius: 3,
          background: 'linear-gradient(135deg, rgba(13,71,161,0.02) 0%, rgba(103,58,183,0.02) 100%)',
        }}
      >
        <Stack spacing={3} alignItems="center">
          <Box
            sx={{
              position: 'relative',
              display: 'inline-flex',
            }}
          >
            <InboxOutlinedIcon
              sx={{
                fontSize: 80,
                color: 'primary.main',
                opacity: 0.9,
              }}
            />
            <Typography
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                fontSize: 32,
              }}
            >
              📂
            </Typography>
          </Box>
          
          <Typography variant="h5" component="h2" sx={{ fontWeight: 600 }}>
            {strings?.upload?.title ?? 'Procesar operaciones'}
          </Typography>
          
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 480 }}>
            {strings?.upload?.description ?? 'Seleccioná un archivo CSV con tus operaciones para generar el informe.'}
          </Typography>

          <Stack spacing={2} sx={{ width: '100%', maxWidth: 400 }}>
            <Button
              variant="contained"
              component="label"
              size="large"
              startIcon={<UploadFileIcon />}
              fullWidth
              sx={{
                py: 1.5,
                fontSize: '1rem',
                background: 'linear-gradient(135deg, #0d47a1, #1976d2)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #002171, #0d47a1)',
                },
              }}
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
              p: 2.5,
              mt: 2,
              backgroundColor: 'rgba(25, 118, 210, 0.04)',
              borderColor: 'primary.light',
              borderRadius: 2,
              width: '100%',
            }}
          >
            <Stack spacing={1.5} alignItems="flex-start">
              <Stack direction="row" spacing={1} alignItems="center">
                <InfoOutlinedIcon fontSize="small" color="info" />
                <Typography variant="subtitle2" color="text.primary" sx={{ fontWeight: 600 }}>
                  {strings?.upload?.instructions?.title ?? 'Instrucciones:'}
                </Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary" textAlign="left">
                {strings?.upload?.instructions?.step1 ?? '✓ Descargá el archivo CSV desde Matriz (ej: https://matriz.cocos.xoms.com.ar/)'}
              </Typography>
              <Typography variant="body2" color="text.secondary" textAlign="left">
                {strings?.upload?.instructions?.step2 ?? '✓ Usá el ícono de descarga a la derecha de "Reporte de operaciones" ("Descargar reporte de operaciones")'}
              </Typography>
              <Typography variant="body2" color="text.secondary" textAlign="left">
                {strings?.upload?.instructions?.step3 ?? '✓ Seleccioná el archivo CSV descargado'}
              </Typography>
              <Typography variant="body2" color="text.secondary" textAlign="left">
                {strings?.upload?.instructions?.step4 ?? '✓ Una vez procesado, podrás filtrar, copiar y descargar los resultados'}
              </Typography>
            </Stack>
          </Paper>
        </Stack>
      </Paper>
    </Box>
  );
};

export default EmptyState;
