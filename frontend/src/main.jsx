import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';

import './index.css';
import App from './app/App.jsx';
import { ConfigProvider } from './state/config-context.jsx';
import { bootstrapFeeServices } from './services/bootstrap-defaults.js';

// Initialize fee services once at app startup (Feature 004)
bootstrapFeeServices();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HashRouter>
      <ConfigProvider>
        <App />
      </ConfigProvider>
    </HashRouter>
  </StrictMode>,
);
