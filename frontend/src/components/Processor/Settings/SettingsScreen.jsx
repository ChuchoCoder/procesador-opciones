import React, { useState, useEffect } from 'react';
import { Container, Box, Typography } from '@mui/material';
import AddSymbol from './AddSymbol.jsx';
import SymbolTabs from './SymbolTabs.jsx';
import SymbolSettings from './SymbolSettings.jsx';
import { getAllSymbols, loadSymbolConfig } from '../../../services/storage-settings.js';
import strings from '../../../strings/es-AR.js';

const s = strings.settings.symbolSettings;

export default function SettingsScreen() {
  const [symbols, setSymbols] = useState([]);
  const [activeSymbol, setActiveSymbol] = useState(null);
  const [config, setConfig] = useState(null);

  // Load symbols on mount
  useEffect(() => {
    refreshSymbols();
  }, []);

  // Load config when active symbol changes
  useEffect(() => {
    if (activeSymbol) {
      const loaded = loadSymbolConfig(activeSymbol);
      setConfig(loaded);
    } else {
      setConfig(null);
    }
  }, [activeSymbol]);

  const refreshSymbols = () => {
    const allSymbols = getAllSymbols();
    setSymbols(allSymbols);
    if (allSymbols.length > 0 && !activeSymbol) {
      setActiveSymbol(allSymbols[0]);
    }
  };

  const handleSymbolAdded = (symbol) => {
    refreshSymbols();
    setActiveSymbol(symbol);
  };

  const handleConfigUpdate = (updatedConfig) => {
    setConfig(updatedConfig);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            {s.title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {s.description}
          </Typography>
        </Box>
        <AddSymbol onSymbolAdded={handleSymbolAdded} />
      </Box>

      {symbols.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="body1" color="text.secondary">
            {s.noSymbolsState}
          </Typography>
        </Box>
      ) : (
        <>
          <SymbolTabs
            symbols={symbols}
            activeSymbol={activeSymbol}
            onSymbolChange={setActiveSymbol}
          />

          {config && (
            <SymbolSettings
              symbol={activeSymbol}
              config={config}
              onConfigUpdate={handleConfigUpdate}
            />
          )}
        </>
      )}
    </Container>
  );
}
