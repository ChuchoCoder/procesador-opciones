import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import Alert from '@mui/material/Alert';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';

import { processOperations } from '../../services/csv/process-operations.js';
import { buildConsolidatedViews } from '../../services/csv/consolidator.js';
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
import GroupFilter from './GroupFilter.jsx';

const ALL_GROUP_ID = '__ALL__';

const sanitizeForTestId = (value = '') => value.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();

const buildGroupKey = (symbol = '', expiration = 'NONE') => `${symbol}::${expiration}`;

const DEFAULT_EXPIRATION = 'NONE';
const UNKNOWN_EXPIRATION = 'UNKNOWN';

const extractBaseSymbol = (symbol = '') => {
  const trimmed = symbol.trim();
  if (!trimmed) {
    return '';
  }

  const parts = trimmed
    .split(/\s*-\s*/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length > 1) {
    const candidate = parts
      .slice(0, -1)
      .reverse()
      .find((part) => /[A-Z]/i.test(part) && !/^\d+$/.test(part));

    if (candidate) {
      const tokenMatch = candidate.match(/^([A-Z0-9]+?)[CV]\d+/i);
      if (tokenMatch) {
        return tokenMatch[1];
      }
      return candidate;
    }
  }

  return parts[0] ?? trimmed;
};

const formatExpirationLabel = (expiration = '') => {
  const normalized = expiration.trim();
  if (!normalized || normalized === DEFAULT_EXPIRATION) {
    return '';
  }

  if (/^\d+HS$/i.test(normalized)) {
    return `${normalized.slice(0, -2)}hs`;
  }

  if (normalized === UNKNOWN_EXPIRATION) {
    return '??';
  }

  return normalized;
};

const formatGroupLabel = (group) => {
  if (!group) {
    return '';
  }

  const baseSymbol = extractBaseSymbol(group.symbol ?? '');
  const expirationLabel = formatExpirationLabel(group.expiration ?? '');

  if (expirationLabel) {
    return `${baseSymbol} ${expirationLabel}`.trim();
  }

  return baseSymbol || group.symbol || '';
};

const computeScopedData = ({
  report,
  groups,
  selectedGroupId,
  useAveraging,
  groupedOperations,
  cache,
}) => {
  if (!report) {
    return {
      scopedReport: null,
      activeView: null,
      summary: null,
      selectedGroup: null,
      filteredOperations: [],
      allSelected: true,
    };
  }

  const operations = Array.isArray(report.operations) ? report.operations : [];
  const allSelected = !selectedGroupId || selectedGroupId === ALL_GROUP_ID;
  const selectedGroup = allSelected
    ? null
    : groups.find((group) => group.id === selectedGroupId) ?? null;

  const groupKey = allSelected ? ALL_GROUP_ID : selectedGroupId;
  const filteredOperations = groupedOperations.get(groupKey) ?? operations;

  let cachedEntry = cache.get(groupKey);
  if (!cachedEntry || cachedEntry.reportToken !== report) {
    const optionOperations = filteredOperations.filter(
      (operation) => operation.optionType === 'CALL' || operation.optionType === 'PUT',
    );
    cachedEntry = {
      reportToken: report,
      optionOperations,
      consolidatedViews: buildConsolidatedViews(optionOperations),
    };
    cache.set(groupKey, cachedEntry);
  }

  const { consolidatedViews } = cachedEntry;

  const buildView = (key) => {
    const consolidated = consolidatedViews[key] ?? { calls: [], puts: [], exclusions: {} };
    const originalView = report.views?.[key] ?? null;
    const callsOperations = Array.isArray(consolidated.calls) ? consolidated.calls : [];
    const putsOperations = Array.isArray(consolidated.puts) ? consolidated.puts : [];

    const summarySource = originalView?.summary ?? report.summary ?? {};
    const summary = {
      ...summarySource,
      callsRows: callsOperations.length,
      putsRows: putsOperations.length,
      totalRows: callsOperations.length + putsOperations.length,
      groups,
    };

    if (selectedGroup && !allSelected) {
      summary.activeSymbol = extractBaseSymbol(selectedGroup.symbol);
      summary.activeExpiration = selectedGroup.expiration;
    }

    return {
      key,
      averagingEnabled:
        consolidated.useAveraging
        ?? originalView?.averagingEnabled
        ?? (key === 'averaged'),
      calls: {
        operations: callsOperations,
        stats: originalView?.calls?.stats ?? {},
      },
      puts: {
        operations: putsOperations,
        stats: originalView?.puts?.stats ?? {},
      },
      summary,
      exclusions: originalView?.exclusions ?? { combined: {}, validation: {}, consolidation: {} },
    };
  };

  const scopedViews = {
    raw: buildView('raw'),
    averaged: buildView('averaged'),
  };

  const activeKey = useAveraging ? 'averaged' : 'raw';
  const activeView = scopedViews[activeKey];

  return {
    scopedReport: {
      ...report,
      operations: filteredOperations,
      summary: activeView.summary,
      calls: activeView.calls,
      puts: activeView.puts,
      views: {
        ...(report.views ?? {}),
        raw: scopedViews.raw,
        averaged: scopedViews.averaged,
      },
      groups,
    },
    activeView,
    summary: activeView.summary,
    selectedGroup,
    filteredOperations,
    allSelected,
  };
};

const ProcessorScreen = () => {
  const strings = useStrings();
  const processorStrings = strings.processor;
  const {
    symbols,
    expirations,
    activeSymbol,
    activeExpiration,
    useAveraging,
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
  const [selectedGroupId, setSelectedGroupId] = useState(ALL_GROUP_ID);
  const scopedDataCacheRef = useRef(new Map());

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
      } catch (err) {
        setReport(null);
        setWarningCodes([]);
        setProcessingError(err?.message ?? processorStrings.errors.processingFailed);
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
    setSelectedGroupId(ALL_GROUP_ID);
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

  const handleToggleAveraging = async (nextValue) => {
    setAveraging(nextValue);
    setActionFeedback(null);
    if (selectedFile && report && !report.views) {
      await runProcessing(selectedFile, { useAveraging: nextValue });
    }
  };

  const handleCopyActive = () => {
    const scope = activePreview === CLIPBOARD_SCOPES.PUTS
      ? CLIPBOARD_SCOPES.PUTS
      : CLIPBOARD_SCOPES.CALLS;
    handleCopy(scope);
  };

  const handleDownload = async (scope, { reportOverride } = {}) => {
    const targetReport = reportOverride ?? scopedReport;
    if (!targetReport) {
      return;
    }

    try {
      await exportReportToCsv({
        report: targetReport,
        scope,
        view: currentViewKey,
      });
      setActionFeedback(null);
    } catch {
      setActionFeedback({ type: 'error', message: processorStrings.actions.downloadError });
    }
  };

  const handleDownloadActive = () => {
    const scope = activePreview === CLIPBOARD_SCOPES.PUTS
      ? EXPORT_SCOPES.PUTS
      : EXPORT_SCOPES.CALLS;
    handleDownload(scope);
  };

  const handleDownloadAll = () => {
    if (!report) {
      return;
    }
    handleDownload(EXPORT_SCOPES.COMBINED, { reportOverride: report });
  };

  const handlePreviewChange = (_event, value) => {
    if (value !== activePreview) {
      setActivePreview(value);
    }
  };

  const handleNavigateSettings = () => {
    navigate(ROUTES.settings);
  };

  useEffect(() => {
    if (!report?.groups || report.groups.length === 0) {
      if (selectedGroupId !== ALL_GROUP_ID) {
        setSelectedGroupId(ALL_GROUP_ID);
      }
      return;
    }

    if (report.groups.length === 1) {
      const onlyGroupId = report.groups[0].id;
      if (selectedGroupId !== onlyGroupId) {
        setSelectedGroupId(onlyGroupId);
      }
      return;
    }

    const exists = report.groups.some((group) => group.id === selectedGroupId);
    if (!exists) {
      setSelectedGroupId(ALL_GROUP_ID);
    }
  }, [report, selectedGroupId]);

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

  const groups = report?.groups ?? [];
  const filterStrings = processorStrings.filters ?? {};

  const groupedOperations = useMemo(() => {
    const map = new Map();
    const operations = Array.isArray(report?.operations) ? report.operations : [];

    map.set(ALL_GROUP_ID, operations);

    if (!groups.length || operations.length === 0) {
      return map;
    }

    const operationsByKey = operations.reduce((acc, operation) => {
      const key = buildGroupKey(operation.symbol ?? '', operation.expiration ?? 'NONE');
      if (!acc.has(key)) {
        acc.set(key, []);
      }
      acc.get(key).push(operation);
      return acc;
    }, new Map());

    groups.forEach((group) => {
      const key = buildGroupKey(group.symbol ?? '', group.expiration ?? 'NONE');
      map.set(group.id, operationsByKey.get(key) ?? []);
    });

    return map;
  }, [report, groups]);

  useEffect(() => {
    scopedDataCacheRef.current = new Map();
  }, [report, groups, groupedOperations]);

  const groupOptions = useMemo(() => {
    if (!groups.length) {
      return [];
    }

    const mapped = groups.map((group) => ({
      id: group.id,
      label: formatGroupLabel(group),
      testId: sanitizeForTestId(group.id),
    }));

    if (groups.length > 1) {
      mapped.unshift({
        id: ALL_GROUP_ID,
          label: filterStrings.all ?? 'All',
        testId: 'all',
      });
    }

    return mapped;
  }, [groups, filterStrings.all]);

  const scopedData = useMemo(
    () => computeScopedData({
      report,
      groups,
      selectedGroupId,
      useAveraging,
      groupedOperations,
      cache: scopedDataCacheRef.current,
    }),
    [report, groups, selectedGroupId, useAveraging, groupedOperations],
  );

  const currentViewKey = useAveraging ? 'averaged' : 'raw';
  const scopedReport = scopedData.scopedReport ?? report;
  const currentView =
    scopedData.activeView
    ?? scopedReport?.views?.[currentViewKey]
    ?? report?.views?.[currentViewKey]
    ?? null;
  const summary =
    scopedData.summary
    ?? currentView?.summary
    ?? scopedReport?.summary
    ?? report?.summary
    ?? null;

  const callsOperations = currentView?.calls?.operations ?? [];
  const putsOperations = currentView?.puts?.operations ?? [];
  const hasCalls = callsOperations.length > 0;
  const hasPuts = putsOperations.length > 0;
  const hasData = hasCalls || hasPuts;
  const hasAnyData = (report?.operations?.length ?? 0) > 0;

  const handleGroupChange = useCallback((nextValue) => {
    if (nextValue) {
      setSelectedGroupId(nextValue);
    }
  }, []);

  const handleCopy = async (scope) => {
    if (!scopedReport) {
      return;
    }
    try {
      const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
      await copyReportToClipboard({
        report: scopedReport,
        scope,
        view: currentViewKey,
        clipboard,
      });
      setActionFeedback({ type: 'success', message: processorStrings.actions.copySuccess });
    } catch {
      setActionFeedback({ type: 'error', message: processorStrings.actions.copyError });
    }
  };

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
          <GroupFilter
            options={groupOptions}
            selectedGroupId={selectedGroupId}
            onChange={handleGroupChange}
            strings={filterStrings}
          />

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
            hasAnyData={hasAnyData}
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
            onDownloadAll={handleDownloadAll}
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
