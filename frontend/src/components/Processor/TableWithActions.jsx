import Box from '@mui/material/Box';
import OperationsTable from './OperationsTable.jsx';

const TableWithActions = ({
  title,
  operations,
  strings,
  testId,
  onCopy,
  onDownload,
  averagingEnabled,
  onToggleAveraging,
}) => {
  return (
    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <OperationsTable
        title={title}
        operations={operations}
        strings={strings}
        testId={testId}
        onCopy={onCopy}
        onDownload={onDownload}
        averagingEnabled={averagingEnabled}
        onToggleAveraging={onToggleAveraging}
      />
    </Box>
  );
};

export default TableWithActions;
