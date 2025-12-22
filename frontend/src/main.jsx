import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';

import './index.css';
import App from './app/App.jsx';
import ToastContainer from './components/Toast/ToastContainer.jsx';
import { ConfigProvider } from './state/config-context.jsx';
import { bootstrapFeeServices, seedDefaultSymbols } from './services/bootstrap-defaults.js';

const startApplication = async () => {
  try {
    await bootstrapFeeServices();
    await seedDefaultSymbols();
  } catch (error) {
     
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
