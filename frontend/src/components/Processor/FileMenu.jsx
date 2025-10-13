import React, { useRef } from 'react';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import ClearIcon from '@mui/icons-material/Clear';

/**
 * FileMenu provides direct file selection with auto-processing.
 * Opens native file dialog immediately on button click, then auto-processes after selection.
 */
const FileMenu = ({
  strings,
  selectedFileName,
  isProcessing,
  onSelectFile,
  onClearFile,
}) => {
  const fileInputRef = useRef(null);
  const uploadStrings = strings?.processor?.upload ?? {};

  const handleTrigger = () => {
    // Open file dialog directly
    fileInputRef.current?.click();
  };

  const handleSelectFile = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      onSelectFile(file);
    }
    // Reset input to allow selecting the same file again
    e.target.value = '';
  };

  const handleClearFile = () => {
    onClearFile?.();
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        hidden
        onChange={handleSelectFile}
        data-testid="file-menu-input"
      />
      <Tooltip title={uploadStrings.title}>
        <IconButton
          size="small"
          aria-label={uploadStrings.title}
          onClick={handleTrigger}
          disabled={isProcessing}
          data-testid="toolbar-file-menu-button"
        >
          <UploadFileIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      {selectedFileName && !isProcessing && (
        <Tooltip title="Limpiar archivo">
          <IconButton
            size="small"
            color="error"
            onClick={handleClearFile}
            data-testid="file-menu-clear-button"
          >
            <ClearIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
    </>
  );
};

export default FileMenu;
