import React from 'react';
import { Tabs, Tab, Box } from '@mui/material';
import strings from '../../../strings/es-AR.js';

const s = strings.settings.symbolSettings;

export default function SymbolTabs({ symbols, activeSymbol, onSymbolChange }) {
  const handleChange = (event, newValue) => {
    onSymbolChange(newValue);
  };

  if (symbols.length === 0) {
    return null;
  }

  return (
    <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
      <Tabs
        value={activeSymbol || symbols[0]}
        onChange={handleChange}
        aria-label={s.tabAriaLabel}
        variant="scrollable"
        scrollButtons="auto"
      >
        {symbols.map((symbol) => (
          <Tab key={symbol} label={symbol} value={symbol} />
        ))}
      </Tabs>
    </Box>
  );
}
