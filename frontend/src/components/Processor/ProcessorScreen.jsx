import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';

import { processOperations } from '../../services/csv/process-operations.js';
import { buildConsolidatedViews } from '../../services/csv/consolidator.js';
import {
  CLIPBOARD_SCOPES,
  copyReportToClipboard,
} from '../../services/csv/clipboard-service.js';
import { exportReportToCsv, EXPORT_SCOPES } from '../../services/csv/export-service.js';
import { useConfig } from '../../state/index.js';
import { useStrings } from '../../strings/index.js';
import { ROUTES } from '../../app/routes.jsx';

import OperationTypeTabs, { OPERATION_TYPES } from './OperationTypeTabs.jsx';
import OpcionesView from './OpcionesView.jsx';
import CompraVentaView from './CompraVentaView.jsx';
import ArbitrajesView from './ArbitrajesView.jsx';
import EmptyState from './EmptyState.jsx';

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

  const [selectedFile, setSelectedFile] = useState(null);
  const [report, setReport] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingError, setProcessingError] = useState(null);
  const [warningCodes, setWarningCodes] = useState([]);
  const [actionFeedback, setActionFeedback] = useState(null);
  const [activePreview, setActivePreview] = useState(CLIPBOARD_SCOPES.CALLS);
  const [selectedGroupId, setSelectedGroupId] = useState(ALL_GROUP_ID);
  const [activeOperationType, setActiveOperationType] = useState(OPERATION_TYPES.OPCIONES);
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

  // Auto-process when a file is selected
  useEffect(() => {
    if (selectedFile && !report && !isProcessing) {
      runProcessing(selectedFile);
    }
  }, [selectedFile, report, isProcessing, runProcessing]);

  const handleToggleAveraging = async (nextValue) => {
    setAveraging(nextValue);
    setActionFeedback(null);
    if (selectedFile && report && !report.views) {
      await runProcessing(selectedFile, { useAveraging: nextValue });
    }
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

  const callsOperations = currentView?.calls?.operations ?? [];
  const putsOperations = currentView?.puts?.operations ?? [];

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

  const handleOperationTypeChange = (newType) => {
    setActiveOperationType(newType);
  };

  const renderActiveView = () => {
    if (!report) {
      return null;
    }

    const commonProps = {
      groupOptions,
      selectedGroupId,
      strings: processorStrings,
      onGroupChange: handleGroupChange,
    };

    switch (activeOperationType) {
      case OPERATION_TYPES.OPCIONES:
        return (
          <OpcionesView
            {...commonProps}
            callsOperations={callsOperations}
            putsOperations={putsOperations}
            onCopy={handleCopy}
            onDownload={handleDownload}
            averagingEnabled={useAveraging}
            onToggleAveraging={handleToggleAveraging}
          />
        );

      case OPERATION_TYPES.COMPRA_VENTA:
        return (
          <CompraVentaView
            {...commonProps}
            operations={scopedData.filteredOperations}
          />
        );

      case OPERATION_TYPES.ARBITRAJES:
        return (
          <ArbitrajesView
            {...commonProps}
          />
        );

      default:
        return null;
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        width: '100%',
        overflow: 'auto',
      }}
    >
      {isProcessing && <LinearProgress />}

      {processingError && <Alert severity="error" sx={{ mx: 3, mt: 2 }}>{processingError}</Alert>}

      {warningMessages.map((message) => (
          <Alert severity="warning" key={message} sx={{ mx: 3, mt: 2 }}>
            {message}
          </Alert>
        ))}

        <Stack spacing={0} sx={{ flex: 1, minHeight: 0 }}>
          {actionFeedback && (
            <Alert severity={actionFeedback.type} sx={{ mx: 3, mt: 2 }}>{actionFeedback.message}</Alert>
          )}

          {!selectedFile ? (
            <EmptyState 
              strings={processorStrings}
              onSelectFile={handleFileSelected}
            />
          ) : report ? (
            <>
              {/* Operation Type Tabs */}
              <OperationTypeTabs
                strings={processorStrings}
                activeTab={activeOperationType}
                onTabChange={handleOperationTypeChange}
                onClose={() => handleFileSelected(null)}
                fileName={selectedFile?.name}
              />

              {/* Render the active view */}
              {renderActiveView()}
            </>
          ) : null}
        </Stack>
    </Box>
  );
};

export default ProcessorScreen;
