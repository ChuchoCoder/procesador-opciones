import { useCallback, useMemo, useState } from 'react';

import Alert from '@mui/material/Alert';
import Grid from '@mui/material/Grid';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';

import { processOperations } from '../../services/csv/process-operations.js';
import {
  CLIPBOARD_SCOPES,
  copyReportToClipboard,
} from '../../services/csv/clipboard-service.js';
import { exportReportToCsv, EXPORT_SCOPES } from '../../services/csv/export-service.js';
import { useConfig } from '../../state/config-context.jsx';
import { useStrings } from '../../strings/index.js';
import FilePicker from './FilePicker.jsx';
import OperationsTable from './OperationsTable.jsx';
import ProcessorActions from './ProcessorActions.jsx';
import SummaryPanel from './SummaryPanel.jsx';

const ProcessorScreen = () => {
  const strings = useStrings();
  const processorStrings = strings.processor;
  const {
    symbols,
    expirations,
    activeSymbol,
    activeExpiration,
    useAveraging,
    setActiveSymbol,
    setActiveExpiration,
    setAveraging,
  } = useConfig();

  const [selectedFile, setSelectedFile] = useState(null);
  const [report, setReport] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingError, setProcessingError] = useState(null);
  const [warningCodes, setWarningCodes] = useState([]);
  const [actionFeedback, setActionFeedback] = useState(null);

  const buildConfiguration = useCallback(
    (overrides = {}) => ({
      symbols,
      expirations,
      activeSymbol,
      activeExpiration,
      useAveraging,
      ...overrides,
    }),
    [symbols, expirations, activeSymbol, activeExpiration, useAveraging],
  );

  const runProcessing = useCallback(
    async (file, overrides = {}) => {
      if (!file) {
        return;
      }

      setIsProcessing(true);
      setProcessingError(null);
      setActionFeedback(null);

      try {
        const result = await processOperations({
          file,
          fileName: file.name,
          configuration: buildConfiguration(overrides),
        });

        setReport(result);
        setWarningCodes(result.summary.warnings ?? []);
      } catch (error) {
        setReport(null);
        setWarningCodes([]);
        setProcessingError(error?.message ?? processorStrings.errors.processingFailed);
      } finally {
        setIsProcessing(false);
      }
    },
    [buildConfiguration, processorStrings.errors.processingFailed],
  );

  const handleFileSelected = (file) => {
    setSelectedFile(file);
    setProcessingError(null);
    setActionFeedback(null);
    setWarningCodes([]);
    if (!file) {
      setReport(null);
    }
  };

  const handleProcess = async () => {
    if (!selectedFile) {
      return;
    }
    await runProcessing(selectedFile);
  };

  const handleSymbolChange = async (symbol) => {
    setActiveSymbol(symbol);
    if (selectedFile) {
      await runProcessing(selectedFile, { activeSymbol: symbol });
    }
  };

  const handleExpirationChange = async (expiration) => {
    setActiveExpiration(expiration);
    if (selectedFile) {
      await runProcessing(selectedFile, { activeExpiration: expiration });
    }
  };

  const handleToggleAveraging = async (nextValue) => {
    setAveraging(nextValue);
    if (selectedFile) {
      await runProcessing(selectedFile, { useAveraging: nextValue });
    }
  };

  const handleCopy = async (scope) => {
    if (!report) {
      return;
    }
    try {
      const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
      await copyReportToClipboard({ report, scope, clipboard });
      setActionFeedback({ type: 'success', message: processorStrings.actions.copySuccess });
    } catch (error) {
      setActionFeedback({ type: 'error', message: processorStrings.actions.copyError });
    }
  };

  const handleDownload = async (scope) => {
    if (!report) {
      return;
    }
    try {
      await exportReportToCsv({ report, scope });
      setActionFeedback(null);
    } catch (error) {
      setActionFeedback({ type: 'error', message: processorStrings.actions.downloadError });
    }
  };

  const hasCalls = report?.calls?.operations?.length > 0;
  const hasPuts = report?.puts?.operations?.length > 0;
  const hasData = hasCalls || hasPuts;

  const warningMessages = useMemo(() => {
    if (!warningCodes || warningCodes.length === 0) {
      return [];
    }

    return warningCodes
      .map((code) => {
        switch (code) {
          case 'largeFileThreshold':
            return processorStrings.warnings.largeFile;
          case 'parseErrors':
            return processorStrings.warnings.parseErrors;
          case 'maxRowsExceeded':
            return processorStrings.warnings.maxRowsExceeded;
          default:
            return null;
        }
      })
      .filter(Boolean);
  }, [warningCodes, processorStrings.warnings]);

  return (
    <Stack spacing={3}>
      {isProcessing && <LinearProgress />}

      {processingError && <Alert severity="error">{processingError}</Alert>}

      {warningMessages.map((message) => (
        <Alert severity="warning" key={message}>
          {message}
        </Alert>
      ))}

      <FilePicker
        strings={processorStrings}
        symbols={symbols}
        activeSymbol={activeSymbol}
        onSymbolChange={handleSymbolChange}
        expirations={expirations}
        activeExpiration={activeExpiration}
        onExpirationChange={handleExpirationChange}
        useAveraging={useAveraging}
        onToggleAveraging={handleToggleAveraging}
        isProcessing={isProcessing}
        onProcess={handleProcess}
        onFileSelected={handleFileSelected}
        selectedFileName={selectedFile?.name ?? ''}
        canProcess={Boolean(selectedFile)}
      />

      {report && (
        <Stack spacing={3}>
          <SummaryPanel summary={report.summary} strings={processorStrings} />

          <ProcessorActions
            strings={processorStrings}
            disabled={isProcessing}
            hasCalls={hasCalls}
            hasPuts={hasPuts}
            hasData={hasData}
            onCopyCalls={() => handleCopy(CLIPBOARD_SCOPES.CALLS)}
            onCopyPuts={() => handleCopy(CLIPBOARD_SCOPES.PUTS)}
            onCopyCombined={() => handleCopy(CLIPBOARD_SCOPES.COMBINED)}
            onDownloadCalls={() => handleDownload(EXPORT_SCOPES.CALLS)}
            onDownloadPuts={() => handleDownload(EXPORT_SCOPES.PUTS)}
            onDownloadCombined={() => handleDownload(EXPORT_SCOPES.COMBINED)}
          />

          {actionFeedback && (
            <Alert severity={actionFeedback.type}>{actionFeedback.message}</Alert>
          )}

          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <OperationsTable
                title={processorStrings.tables.callsTitle}
                operations={report.calls?.operations ?? []}
                strings={processorStrings}
                testId="calls-table"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <OperationsTable
                title={processorStrings.tables.putsTitle}
                operations={report.puts?.operations ?? []}
                strings={processorStrings}
                testId="puts-table"
              />
            </Grid>
          </Grid>
        </Stack>
      )}
    </Stack>
  );
};

export default ProcessorScreen;
