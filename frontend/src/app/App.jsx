import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import CssBaseline from '@mui/material/CssBaseline';
import Stack from '@mui/material/Stack';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { ThemeProvider } from '@mui/material/styles';
import { Navigate, NavLink, Route, Routes } from 'react-router-dom';

import { ProcessorScreen } from '../components/Processor/index.js';
import { SettingsScreen } from '../components/Settings/index.js';
import { useStrings } from '../strings/index.js';
import { APP_ROUTE_SEGMENTS, ROUTES } from './routes.jsx';
import theme from './theme.js';

const NavigationBar = () => {
  const strings = useStrings();
  return (
    <AppBar position="static" color="primary">
      <Toolbar sx={{ gap: 2 }}>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          {strings.app.title}
        </Typography>
        <Stack direction="row" spacing={1} component="nav">
          {APP_ROUTE_SEGMENTS.map(({ key, path }) => (
            <Button
              key={key}
              component={NavLink}
              to={path}
              color="inherit"
              sx={{
                '&.active': {
                  fontWeight: 700,
                  textDecoration: 'underline',
                },
              }}
            >
              {strings.navigation[key]}
            </Button>
          ))}
        </Stack>
      </Toolbar>
    </AppBar>
  );
};

const App = () => {
  const strings = useStrings();
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <NavigationBar />
        <Box component="main" sx={{ flexGrow: 1, py: 4 }}>
          <Container maxWidth="lg">
            <Routes>
              <Route path={ROUTES.processor} element={<ProcessorScreen />} />
              <Route path={ROUTES.settings} element={<SettingsScreen />} />
              <Route path="/" element={<Navigate to={ROUTES.processor} replace />} />
              <Route path="*" element={<Navigate to={ROUTES.processor} replace />} />
            </Routes>
          </Container>
        </Box>
      </Box>
    </ThemeProvider>
  );
};

export default App;
