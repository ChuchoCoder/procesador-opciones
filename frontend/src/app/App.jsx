import Box from '@mui/material/Box';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { Navigate, Route, Routes } from 'react-router-dom';

import { ProcessorScreen } from '../components/Processor/index.js';
import { SettingsScreen } from '../components/Settings/index.js';
import Sidebar from '../components/Sidebar.jsx';
import { useStrings } from '../strings/index.js';
import { ROUTES } from './routes.jsx';
import theme from './theme.js';

const App = () => {
  const strings = useStrings();
  
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', width: '100vw', height: '100vh' }}>
        <Sidebar strings={strings} routes={ROUTES} />
        <Box
          component="main"
          sx={{
            flex: 1,
            minHeight: '100vh',
            overflow: 'auto',
          }}
        >
          <Routes>
            <Route path={ROUTES.processor} element={<ProcessorScreen />} />
            <Route path={ROUTES.settings} element={<SettingsScreen />} />
            <Route path="/settings" element={<SettingsScreen />} />
            <Route path="/" element={<Navigate to={ROUTES.processor} replace />} />
            <Route path="*" element={<Navigate to={ROUTES.processor} replace />} />
          </Routes>
        </Box>
      </Box>
    </ThemeProvider>
  );
};

export default App;
