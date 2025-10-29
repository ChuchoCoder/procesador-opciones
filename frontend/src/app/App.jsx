import Box from '@mui/material/Box';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';

import { ProcessorScreen } from '../components/Processor/index.js';
import { SettingsScreen, BrokerFeesScreen } from '../components/Processor/Settings/index.js';
import { AccionesPage } from '../components/Acciones/index.js';
import Sidebar from '../components/Sidebar.jsx';
import { useStrings } from '../strings/index.js';
import { useConfig } from '../state/index.js';
import { ROUTES } from './routes.jsx';
import theme from './theme.js';

const App = () => {
  const strings = useStrings();
  const { brokerAuth, sync, operations, clearBrokerAuth } = useConfig();
  
  const brokerStatus = {
    isAuthenticated: Boolean(brokerAuth?.token),
    accountId: brokerAuth?.accountId,
    syncInProgress: sync?.inProgress || false,
    lastSyncTime: sync?.lastSyncTimestamp,
    operationsCount: operations?.length,
    pagesFetched: sync?.pagesFetched,
  };

  const handleBrokerLogout = () => {
    clearBrokerAuth();
  };
  
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', width: '100vw', height: '100vh' }}>
        <Sidebar 
          strings={strings} 
          routes={ROUTES} 
          brokerStatus={brokerStatus}
          onBrokerLogout={handleBrokerLogout}
        />
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
            <Route path={ROUTES.acciones} element={<AccionesPage />} />
            <Route path={ROUTES.settings} element={<Outlet />}>
              <Route index element={<SettingsScreen />} />
              <Route path="comisiones" element={<BrokerFeesScreen />} />
              <Route path="prefijos" element={<Navigate to={ROUTES.settings} replace />} />
              <Route path="vencimientos" element={<Navigate to={ROUTES.settings} replace />} />
              <Route path="broker" element={<Navigate to={ROUTES.settings} replace />} />
            </Route>
            <Route path="/settings/*" element={<Navigate to={ROUTES.settings} replace />} />
            <Route path="/" element={<Navigate to={ROUTES.processor} replace />} />
            <Route path="*" element={<Navigate to={ROUTES.processor} replace />} />
          </Routes>
        </Box>
      </Box>
    </ThemeProvider>
  );
};

export default App;
