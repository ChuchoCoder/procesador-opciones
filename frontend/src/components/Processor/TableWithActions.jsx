import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Stack from '@mui/material/Stack';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import OperationsTable from './OperationsTable.jsx';

const TableWithActions = ({
  title,
  operations,
  strings,
  testId,
  onCopy,
  onDownload,
}) => {
  const hasData = operations.length > 0;

  return (
    <Box
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        gap: 1,
      }}
    >
      {/* Action buttons at the top of each table */}
      {hasData && (
        <Stack direction="row" spacing={1} justifyContent="flex-end">
          <Tooltip title={strings.actions?.copy ?? 'Copiar'}>
            <IconButton
              onClick={onCopy}
              size="small"
              data-testid={`${testId}-copy-button`}
            >
              <ContentCopyIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title={strings.actions?.download ?? 'Descargar'}>
            <IconButton
              onClick={onDownload}
              size="small"
              data-testid={`${testId}-download-button`}
            >
              <DownloadIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      )}
      
      {/* Table */}
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <OperationsTable
          title={title}
          operations={operations}
          strings={strings}
          testId={testId}
        />
      </Box>
    </Box>
  );
};

export default TableWithActions;
