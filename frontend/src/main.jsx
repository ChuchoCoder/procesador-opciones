import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';

import './index.css';
import App from './app/App.jsx';
import ToastContainer from './components/Toast/ToastContainer.jsx';
import { ConfigProvider } from './state/config-context.jsx';
import { bootstrapFeeServices } from './services/bootstrap-defaults.js';

const startApplication = async () => {
  try {
    await bootstrapFeeServices();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('PO: bootstrapFeeServices failed', error);
  }

  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <HashRouter>
        <ConfigProvider>
          <App />
          {/* Global toast container listens for events and renders toasts without
              causing re-renders in other components. */}
          <ToastContainer />
        </ConfigProvider>
      </HashRouter>
    </StrictMode>,
  );
};

startApplication();
