import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import Alert from '@mui/material/Alert';
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
import { ROUTES } from '../../app/routes.jsx';
import FilePicker from './FilePicker.jsx';
import OperationsTable from './OperationsTable.jsx';
import ProcessorActions from './ProcessorActions.jsx';
import SummaryPanel from './SummaryPanel.jsx';
import ProcessorTabs from './ProcessorTabs.jsx';

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

  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState(null);
  const [report, setReport] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingError, setProcessingError] = useState(null);
  const [warningCodes, setWarningCodes] = useState([]);
  const [actionFeedback, setActionFeedback] = useState(null);
  const [activePreview, setActivePreview] = useState(CLIPBOARD_SCOPES.CALLS);

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
        const configurationPayload = buildConfiguration(overrides);
        const result = await processOperations({
          file,
          fileName: file.name,
          configuration: configurationPayload,
        });

        setReport(result);
        setWarningCodes(result.summary.warnings ?? []);
        const initialViewKey = configurationPayload.useAveraging ? 'averaged' : 'raw';
        const initialView = result.views?.[initialViewKey];
        const initialCalls = initialView?.calls?.operations?.length ?? 0;
        const initialPuts = initialView?.puts?.operations?.length ?? 0;
        if (initialCalls > 0) {
          setActivePreview(CLIPBOARD_SCOPES.CALLS);
        } else if (initialPuts > 0) {
          setActivePreview(CLIPBOARD_SCOPES.PUTS);
        } else {
          setActivePreview(CLIPBOARD_SCOPES.CALLS);
        }
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
    setActivePreview(CLIPBOARD_SCOPES.CALLS);
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
    setActionFeedback(null);
    if (selectedFile && report && !report.views) {
      await runProcessing(selectedFile, { useAveraging: nextValue });
    }
  };

  const handleCopy = async (scope) => {
    if (!report) {
      return;
    }
    try {
      const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
      const view = useAveraging ? 'averaged' : 'raw';
      await copyReportToClipboard({ report, scope, view, clipboard });
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
      const view = useAveraging ? 'averaged' : 'raw';
      await exportReportToCsv({ report, scope, view });
      setActionFeedback(null);
    } catch (error) {
      setActionFeedback({ type: 'error', message: processorStrings.actions.downloadError });
    }
  };

  const handleCopyActive = () => {
    const scope = activePreview === CLIPBOARD_SCOPES.PUTS
      ? CLIPBOARD_SCOPES.PUTS
      : CLIPBOARD_SCOPES.CALLS;
    handleCopy(scope);
  };

  const handleDownloadActive = () => {
    const scope = activePreview === CLIPBOARD_SCOPES.PUTS
      ? EXPORT_SCOPES.PUTS
      : EXPORT_SCOPES.CALLS;
    handleDownload(scope);
  };

  const handlePreviewChange = (_event, value) => {
    if (value !== activePreview) {
      setActivePreview(value);
    }
  };

  const handleNavigateSettings = () => {
    navigate(ROUTES.settings);
  };

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

  const currentViewKey = useAveraging ? 'averaged' : 'raw';
  const currentView = report?.views?.[currentViewKey] ?? null;
  const callsOperations = currentView?.calls?.operations ?? report?.calls?.operations ?? [];
  const putsOperations = currentView?.puts?.operations ?? report?.puts?.operations ?? [];
  const summary = currentView?.summary ?? report?.summary ?? null;

  const hasCalls = callsOperations.length > 0;
  const hasPuts = putsOperations.length > 0;
  const hasData = hasCalls || hasPuts;

  useEffect(() => {
    if (!report) {
      setActivePreview(CLIPBOARD_SCOPES.CALLS);
      return;
    }

    const callsCount = callsOperations.length;
    const putsCount = putsOperations.length;

    if (activePreview === CLIPBOARD_SCOPES.CALLS && callsCount === 0 && putsCount > 0) {
      setActivePreview(CLIPBOARD_SCOPES.PUTS);
    } else if (activePreview === CLIPBOARD_SCOPES.PUTS && putsCount === 0 && callsCount > 0) {
      setActivePreview(CLIPBOARD_SCOPES.CALLS);
    }
  }, [report, currentViewKey, activePreview, callsOperations.length, putsOperations.length]);

  const displayedOperations = activePreview === CLIPBOARD_SCOPES.PUTS ? putsOperations : callsOperations;
  const activeScope = activePreview === CLIPBOARD_SCOPES.PUTS
    ? CLIPBOARD_SCOPES.PUTS
    : CLIPBOARD_SCOPES.CALLS;
  const tabStrings = processorStrings.viewControls ?? {};
  const activeScopeLabel = activePreview === CLIPBOARD_SCOPES.PUTS
    ? tabStrings.putsTab ?? processorStrings.tables.putsTitle
    : tabStrings.callsTab ?? processorStrings.tables.callsTitle;
  const activeHasData = displayedOperations.length > 0;

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
          <SummaryPanel summary={summary} strings={processorStrings} />

          <ProcessorTabs
            strings={tabStrings}
            activePreview={activePreview}
            onPreviewChange={handlePreviewChange}
            onNavigateSettings={handleNavigateSettings}
          />

          <ProcessorActions
            strings={processorStrings}
            disabled={isProcessing}
            hasCalls={hasCalls}
            hasPuts={hasPuts}
            hasData={hasData}
            activeScope={activeScope}
            activeScopeLabel={activeScopeLabel}
            activeHasData={activeHasData}
            onCopyActive={handleCopyActive}
            onDownloadActive={handleDownloadActive}
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

          <OperationsTable
            title={activePreview === CLIPBOARD_SCOPES.PUTS
              ? processorStrings.tables.putsTitle
              : processorStrings.tables.callsTitle}
            operations={displayedOperations}
            strings={processorStrings}
            testId="processor-results-table"
          />
        </Stack>
      )}
    </Stack>
  );
};

export default ProcessorScreen;
