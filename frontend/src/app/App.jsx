import Box from '@mui/material/Box';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { Navigate, Route, Routes } from 'react-router-dom';

import { ProcessorScreen } from '../components/Processor/index.js';
import { SettingsScreen } from '../components/Processor/Settings/index.js';
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
            <Route path={ROUTES.settings} element={<SettingsScreen />} />
            <Route path={ROUTES.settingsPrefixes} element={<Navigate to={ROUTES.settings} replace />} />
            <Route path={ROUTES.settingsExpirations} element={<Navigate to={ROUTES.settings} replace />} />
            <Route path={ROUTES.settingsBroker} element={<Navigate to={ROUTES.settings} replace />} />
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
