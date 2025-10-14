import React from 'react';
import { Tabs, Tab, Box } from '@mui/material';
import strings from '../../../strings';

/**
 * Vertical tabs component for expiration navigation.
 * Displays available expiration codes (DIC, FEB, ABR, JUN, AGO, OCT).
 * 
 * @param {Object} props
 * @param {Array<string>} props.expirationCodes - List of expiration codes
 * @param {string} props.activeExpiration - Currently selected expiration code
 * @param {Function} props.onExpirationChange - Callback when expiration changes
 */
export default function ExpirationTabs({ expirationCodes, activeExpiration, onExpirationChange }) {
  const s = strings.settings.symbolSettings.expirationTabs;

  const handleChange = (event, newValue) => {
    onExpirationChange(newValue);
  };

  if (!expirationCodes || expirationCodes.length === 0) {
    return null;
  }

  return (
    <Box sx={{ borderRight: 1, borderColor: 'divider', minWidth: 120 }}>
      <Tabs
        orientation="vertical"
        value={activeExpiration}
        onChange={handleChange}
        aria-label={s.title}
        sx={{ '.MuiTab-root': { minWidth: 100 } }}
      >
        {expirationCodes.map((code) => (
          <Tab
            key={code}
            label={code}
            value={code}
            sx={{
              alignItems: 'flex-start',
              textAlign: 'left',
              px: 2,
            }}
          />
        ))}
      </Tabs>
    </Box>
  );
}
