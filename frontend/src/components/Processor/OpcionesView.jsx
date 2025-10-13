import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';

import GroupFilter from './GroupFilter.jsx';
import TableWithActions from './TableWithActions.jsx';
import { CLIPBOARD_SCOPES } from '../../services/csv/clipboard-service.js';
import { EXPORT_SCOPES } from '../../services/csv/export-service.js';

const OpcionesView = ({
  callsOperations,
  putsOperations,
  groupOptions,
  selectedGroupId,
  strings,
  onGroupChange,
  onCopy,
  onDownload,
  averagingEnabled,
  onToggleAveraging,
}) => {
  const filterStrings = strings?.filters ?? {};

  return (
    <Stack spacing={0} sx={{ flex: 1, minHeight: 0 }}>
      {groupOptions.length > 0 && (
        <GroupFilter
          options={groupOptions}
          selectedGroupId={selectedGroupId}
          onChange={onGroupChange}
          strings={filterStrings}
        />
      )}

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: { xs: 'column', lg: 'row' },
          gap: 0,
        }}
      >
        {/* CALLS table */}
        <TableWithActions
          title={strings?.tables?.callsTitle ?? 'Operaciones CALLS'}
          operations={callsOperations}
          strings={strings}
          testId="processor-calls-table"
          onCopy={() => onCopy(CLIPBOARD_SCOPES.CALLS)}
          onDownload={() => onDownload(EXPORT_SCOPES.CALLS)}
          averagingEnabled={averagingEnabled}
          onToggleAveraging={onToggleAveraging}
        />

        {/* PUTS table */}
        <TableWithActions
          title={strings?.tables?.putsTitle ?? 'Operaciones PUTS'}
          operations={putsOperations}
          strings={strings}
          testId="processor-puts-table"
          onCopy={() => onCopy(CLIPBOARD_SCOPES.PUTS)}
          onDownload={() => onDownload(EXPORT_SCOPES.PUTS)}
          averagingEnabled={averagingEnabled}
          onToggleAveraging={onToggleAveraging}
        />
      </Box>
    </Stack>
  );
};

export default OpcionesView;
