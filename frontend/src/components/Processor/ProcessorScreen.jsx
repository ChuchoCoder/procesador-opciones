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
import {
  readItem,
  writeItem,
  removeItem,
  storageKeys,
} from '../../services/storage/local-storage.js';

import OperationTypeTabs, { OPERATION_TYPES } from './OperationTypeTabs.jsx';
import OpcionesView from './OpcionesView.jsx';
import CompraVentaView from './CompraVentaView.jsx';
import ArbitrajesView from './ArbitrajesView.jsx';
import EmptyState from './EmptyState.jsx';

const ALL_GROUP_ID = '__ALL__';
const LAST_SESSION_STORAGE_VERSION = 1;

const createInitialGroupSelections = () => ({
  [OPERATION_TYPES.OPCIONES]: ALL_GROUP_ID,
  [OPERATION_TYPES.COMPRA_VENTA]: ALL_GROUP_ID,
  [OPERATION_TYPES.ARBITRAJES]: ALL_GROUP_ID,
});

const sanitizeForTestId = (value = '') => value.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();

const buildGroupKey = (symbol = '', expiration = 'NONE') => `${symbol}::${expiration}`;

const DEFAULT_EXPIRATION = 'NONE';
const UNKNOWN_EXPIRATION = 'UNKNOWN';

const OPTION_OPERATION_TYPES = new Set(['CALL', 'PUT']);

const normalizeGroupSymbol = (value = '') => {
  if (typeof value !== 'string') {
    return String(value ?? '').trim().toUpperCase() || 'UNKNOWN';
  }
  const trimmed = value.trim();
  return trimmed ? trimmed.toUpperCase() : 'UNKNOWN';
};

const normalizeGroupExpiration = (value = '') => {
  if (typeof value !== 'string') {
    return DEFAULT_EXPIRATION;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return DEFAULT_EXPIRATION;
  }
  return trimmed.toUpperCase();
};

const SETTLEMENT_TOKENS = new Set([
  'CI', 'CONTADO', '24HS', '48HS', '72HS', '24H', '48H', '72H', 'T0', 'T1', 'T2', 'T+1', 'T+2',
  '1D', '2D', '3D', '4D', '5D', '6D', '7D', '8D', '9D', '10D', '11D', '12D', '13D', '14D', '15D',
]);

const MARKET_TOKENS = new Set([
  'MERV', 'XMEV', 'BCBA', 'BYMA', 'ROFEX', 'MATBA', 'MAE', 'NYSE', 'NASDAQ', 'CME', 'ICE',
]);

const MONTH_TOKENS = new Set([
  'EN', 'ENE', 'ENERO',
  'FE', 'FEB', 'FEBRERO',
  'MR', 'MAR', 'MARZO',
  'AB', 'ABR', 'ABRIL',
  'MY', 'MAY', 'MAYO',
  'JN', 'JUN', 'JUNIO',
  'JL', 'JUL', 'JULIO', 'JU',
  'AG', 'AGO', 'AGOSTO',
  'SE', 'SEP', 'SET', 'SEPT', 'SEPTIEMBRE',
  'OC', 'OCT', 'OCTUBRE',
  'NV', 'NOV', 'NOVIEMBRE',
  'DC', 'DIC', 'DICIEMBRE',
  'DU', 'DEU',
]);

const sanitizeInstrumentSegments = (symbol) => {
  if (!symbol) {
    return [];
  }

  const normalized = normalizeGroupSymbol(symbol);
  if (!normalized || normalized === 'UNKNOWN') {
    return normalized ? [normalized] : [];
  }

  const segments = normalized
    .split('-')
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (!segments.length) {
    return [normalized];
  }

  const filtered = segments.slice();

  while (filtered.length > 1 && MARKET_TOKENS.has(filtered[0])) {
    filtered.shift();
  }

  while (filtered.length > 1 && MARKET_TOKENS.has(filtered[0])) {
    filtered.shift();
  }

  while (filtered.length > 1 && SETTLEMENT_TOKENS.has(filtered[filtered.length - 1])) {
    filtered.pop();
  }

  return filtered.length ? filtered : segments;
};

const splitInstrumentSymbol = (symbol = '') => {
  const segments = sanitizeInstrumentSegments(symbol);

  if (segments.length === 0) {
    return 'UNKNOWN';
  }

  if (segments.length === 1) {
    return segments[0];
  }

  if (segments.length === 2 && MONTH_TOKENS.has(segments[1])) {
    return segments.join(' ');
  }

  if (segments.length >= 2) {
    const last = segments[segments.length - 1];
    if (MONTH_TOKENS.has(last)) {
      return `${segments[segments.length - 2]} ${last}`;
    }
  }

  return segments[segments.length - 1];
};

const getOperationGroupId = (operation = {}) => {
  const normalizedSymbol = normalizeGroupSymbol(operation.symbol);
  if (OPTION_OPERATION_TYPES.has(operation.optionType)) {
    const normalizedExpiration = normalizeGroupExpiration(operation.expiration);
    const expiration = normalizedExpiration || DEFAULT_EXPIRATION;
    return buildGroupKey(normalizedSymbol, expiration);
  }

  const baseSymbol = splitInstrumentSymbol(normalizedSymbol);
  return buildGroupKey(baseSymbol, DEFAULT_EXPIRATION);
};

const isOptionGroup = (group) => {
  if (!group) {
    return false;
  }

  if (group.kind === 'option') {
    return true;
  }

  const calls = group.counts?.calls ?? 0;
  const puts = group.counts?.puts ?? 0;
  return calls + puts > 0;
};

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

  if (!isOptionGroup(group)) {
    const [baseIdSymbol] = (group.id ?? '').split('::');
    if (baseIdSymbol) {
      return baseIdSymbol;
    }
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
    prefixRules,
    expirations,
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
  const [activeOperationType, setActiveOperationType] = useState(OPERATION_TYPES.OPCIONES);
  const [selectedGroupIds, setSelectedGroupIds] = useState(() => createInitialGroupSelections());
  const selectedGroupId = selectedGroupIds[activeOperationType] ?? ALL_GROUP_ID;
  const scopedDataCacheRef = useRef(new Map());
  const sessionRestoredRef = useRef(false);

  const setSelectedGroupIdForType = useCallback((type, nextValue) => {
    if (!type) {
      return;
    }

    setSelectedGroupIds((prev) => {
      const currentValue = prev[type] ?? ALL_GROUP_ID;
      const safeValue = nextValue ?? ALL_GROUP_ID;
      if (currentValue === safeValue) {
        return prev;
      }
      return {
        ...prev,
        [type]: safeValue,
      };
    });
  }, []);

  const resetGroupSelections = useCallback(() => {
    setSelectedGroupIds((prev) => {
      const initial = createInitialGroupSelections();
      const keys = new Set([...Object.keys(prev), ...Object.keys(initial)]);
      let next = prev;

      keys.forEach((key) => {
        const targetValue = initial[key] ?? ALL_GROUP_ID;
        if ((next[key] ?? ALL_GROUP_ID) !== targetValue) {
          if (next === prev) {
            next = { ...prev };
          }
          next[key] = targetValue;
        }
      });

      return next;
    });
  }, []);

  const buildConfiguration = useCallback(
    (overrides = {}) => ({
      expirations,
      activeExpiration,
      useAveraging,
      prefixRules,
      ...overrides,
    }),
    [prefixRules, expirations, activeExpiration, useAveraging],
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
        removeItem(storageKeys.lastReport);
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
    resetGroupSelections();
    if (!file) {
      setReport(null);
      removeItem(storageKeys.lastReport);
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
    const reportGroups = Array.isArray(report?.groups) ? report.groups : [];
    if (reportGroups.length === 0) {
      resetGroupSelections();
      return;
    }

    const validIds = new Set(reportGroups.map((group) => group.id));
    validIds.add(ALL_GROUP_ID);

    setSelectedGroupIds((prev) => {
      let next = prev;
      Object.entries(prev).forEach(([type, value]) => {
        if (!validIds.has(value)) {
          if (next === prev) {
            next = { ...prev };
          }
          next[type] = ALL_GROUP_ID;
        }
      });
      return next;
    });
  }, [report, resetGroupSelections]);

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

  const groups = useMemo(() => report?.groups ?? [], [report]);
  const filterStrings = processorStrings.filters ?? {};

  const groupedOperations = useMemo(() => {
    const map = new Map();
    const operations = Array.isArray(report?.operations) ? report.operations : [];

    map.set(ALL_GROUP_ID, operations);

    if (!groups.length || operations.length === 0) {
      return map;
    }

    const operationsByKey = operations.reduce((acc, operation) => {
      if (!operation) {
        return acc;
      }
      const key = getOperationGroupId(operation);
      if (!acc.has(key)) {
        acc.set(key, []);
      }
      acc.get(key).push(operation);
      return acc;
    }, new Map());

    groups.forEach((group) => {
      map.set(group.id, operationsByKey.get(group.id) ?? []);
    });

    return map;
  }, [report, groups]);

  useEffect(() => {
    scopedDataCacheRef.current = new Map();
  }, [report, groups, groupedOperations]);

  const { optionGroupOptions, allGroupOptions } = useMemo(() => {
    if (!groups.length) {
      return { optionGroupOptions: [], allGroupOptions: [] };
    }

    const buildOptions = (sourceGroups) => {
      if (!sourceGroups.length) {
        return [];
      }

      const mapped = sourceGroups.map((group) => ({
        id: group.id,
        label: formatGroupLabel(group),
        testId: sanitizeForTestId(group.id),
      }));

      mapped.unshift({
        id: ALL_GROUP_ID,
        label: filterStrings.all ?? 'All',
        testId: 'all',
      });

      return mapped;
    };

    const optionGroups = groups.filter((group) => {
      if (!isOptionGroup(group)) {
        return false;
      }

      const groupOperations = groupedOperations.get(group.id) ?? [];
      return groupOperations.some((operation) => OPTION_OPERATION_TYPES.has(operation?.optionType));
    });

    return {
      optionGroupOptions: buildOptions(optionGroups),
      allGroupOptions: buildOptions(groups),
    };
  }, [groups, filterStrings.all, groupedOperations]);

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
  const opcionesSelectedGroupId = selectedGroupIds[OPERATION_TYPES.OPCIONES] ?? ALL_GROUP_ID;

  const handleGroupChange = useCallback((nextValue) => {
    if (nextValue) {
      setSelectedGroupIdForType(activeOperationType, nextValue);
    }
  }, [activeOperationType, setSelectedGroupIdForType]);

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

  useEffect(() => {
    if (activeOperationType !== OPERATION_TYPES.OPCIONES) {
      return;
    }

    const optionGroups = groups.filter(isOptionGroup);
    const currentSelection = opcionesSelectedGroupId;

    if (currentSelection === ALL_GROUP_ID) {
      if (optionGroups.length === 1) {
        const onlyGroupId = optionGroups[0].id;
        if (onlyGroupId !== ALL_GROUP_ID) {
          setSelectedGroupIdForType(OPERATION_TYPES.OPCIONES, onlyGroupId);
        }
      }
      return;
    }

    const selectedGroup = groups.find((group) => group.id === currentSelection);
    if (isOptionGroup(selectedGroup)) {
      return;
    }

    if (optionGroups.length === 0) {
      setSelectedGroupIdForType(OPERATION_TYPES.OPCIONES, ALL_GROUP_ID);
      return;
    }

    if (optionGroups.length === 1) {
      const onlyGroupId = optionGroups[0].id;
      if (currentSelection !== onlyGroupId) {
        setSelectedGroupIdForType(OPERATION_TYPES.OPCIONES, onlyGroupId);
      }
      return;
    }

    setSelectedGroupIdForType(OPERATION_TYPES.OPCIONES, ALL_GROUP_ID);
  }, [activeOperationType, opcionesSelectedGroupId, groups, setSelectedGroupIdForType]);

  useEffect(() => {
    if (sessionRestoredRef.current) {
      return;
    }

    const stored = readItem(storageKeys.lastReport);
    if (!stored || typeof stored !== 'object') {
      sessionRestoredRef.current = true;
      return;
    }

    if (stored.version !== LAST_SESSION_STORAGE_VERSION || !stored.report) {
      removeItem(storageKeys.lastReport);
      sessionRestoredRef.current = true;
      return;
    }

    try {
      const storedReport = stored.report;
      if (!storedReport || typeof storedReport !== 'object') {
        throw new Error('invalid report');
      }

      setReport(storedReport);
      setWarningCodes(Array.isArray(storedReport?.summary?.warnings) ? storedReport.summary.warnings : []);
      setSelectedFile(stored.fileName ? { name: stored.fileName } : { name: 'Operaciones previas' });
      if (stored.selectedGroupIds && typeof stored.selectedGroupIds === 'object') {
        const entries = Object.entries(stored.selectedGroupIds).filter(([, value]) => typeof value === 'string');
        if (entries.length > 0) {
          setSelectedGroupIds((prev) => {
            let next = prev;
            entries.forEach(([type, value]) => {
              const currentValue = next[type] ?? ALL_GROUP_ID;
              if (currentValue !== value) {
                if (next === prev) {
                  next = { ...prev };
                }
                next[type] = value;
              }
            });
            return next;
          });
        }
      } else if (typeof stored.selectedGroupId === 'string') {
        const fallbackValue = stored.selectedGroupId;
        setSelectedGroupIds((prev) => {
          const keys = Object.keys(prev).length > 0
            ? Object.keys(prev)
            : Object.keys(createInitialGroupSelections());
          let next = prev;
          keys.forEach((key) => {
            if ((next[key] ?? ALL_GROUP_ID) !== fallbackValue) {
              if (next === prev) {
                next = { ...prev };
              }
              next[key] = fallbackValue;
            }
          });
          return next;
        });
      }

      if (Object.values(OPERATION_TYPES).includes(stored.activeOperationType)) {
        setActiveOperationType(stored.activeOperationType);
      }

      if (Object.values(CLIPBOARD_SCOPES).includes(stored.activePreview)) {
        setActivePreview(stored.activePreview);
      }
    } catch (restoreError) {
      console.warn('PO: Failed to restore last session', restoreError);
      removeItem(storageKeys.lastReport);
    } finally {
      sessionRestoredRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (!report || !selectedFile) {
      return;
    }

    const snapshot = {
      version: LAST_SESSION_STORAGE_VERSION,
      savedAt: Date.now(),
      fileName: selectedFile.name ?? null,
      report,
      selectedGroupId,
      selectedGroupIds,
      activeOperationType,
      activePreview,
    };

    writeItem(storageKeys.lastReport, snapshot);
  }, [report, selectedFile, selectedGroupId, selectedGroupIds, activeOperationType, activePreview]);

  const renderActiveView = () => {
    if (!report) {
      return null;
    }

    const commonProps = {
      selectedGroupId,
      strings: processorStrings,
      onGroupChange: handleGroupChange,
    };

    switch (activeOperationType) {
      case OPERATION_TYPES.OPCIONES:
        return (
          <OpcionesView
            {...commonProps}
            groupOptions={optionGroupOptions}
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
            groupOptions={allGroupOptions}
            operations={scopedData.filteredOperations}
          />
        );

      case OPERATION_TYPES.ARBITRAJES:
        return (
          <ArbitrajesView
            {...commonProps}
            groupOptions={allGroupOptions}
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
