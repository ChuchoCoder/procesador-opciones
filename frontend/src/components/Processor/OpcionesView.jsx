import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';

import GroupFilter from './GroupFilter.jsx';
import OperationsTable from './OperationsTable.jsx';
import { CLIPBOARD_SCOPES } from '../../services/csv/clipboard-service.js';
import { EXPORT_SCOPES } from '../../services/csv/export-service.js';

// Lo único que aportaba TableWithActions: un wrapper de columna por tabla.
const COLUMNA_TABLA = { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' };

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
  onStrikeExceptionSaved,
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
          '& > :first-of-type': {
            borderRight: { lg: 1, xs: 0 },
            borderColor: 'divider',
          },
        }}
      >
        {/* CALLS table */}
        <Box sx={COLUMNA_TABLA}>
          <OperationsTable
            title={strings?.tables?.callsTitle ?? 'Operaciones CALLS'}
            operations={callsOperations}
            strings={strings}
            testId="processor-calls-table"
            onCopy={() => onCopy(CLIPBOARD_SCOPES.CALLS)}
            onDownload={() => onDownload(EXPORT_SCOPES.CALLS)}
            averagingEnabled={averagingEnabled}
            onToggleAveraging={onToggleAveraging}
            onStrikeExceptionSaved={onStrikeExceptionSaved}
          />
        </Box>

        {/* PUTS table */}
        <Box sx={COLUMNA_TABLA}>
          <OperationsTable
            title={strings?.tables?.putsTitle ?? 'Operaciones PUTS'}
            operations={putsOperations}
            strings={strings}
            testId="processor-puts-table"
            onCopy={() => onCopy(CLIPBOARD_SCOPES.PUTS)}
            onDownload={() => onDownload(EXPORT_SCOPES.PUTS)}
            averagingEnabled={averagingEnabled}
            onToggleAveraging={onToggleAveraging}
            onStrikeExceptionSaved={onStrikeExceptionSaved}
          />
        </Box>
      </Box>
    </Stack>
  );
};

export default OpcionesView;
