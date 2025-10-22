import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { processOperations } from '../../services/csv/process-operations.js';
import { buildConsolidatedViews } from '../../services/csv/consolidator.js';
import { login as brokerLogin, setBaseUrl } from '../../services/broker/jsrofex-client.js';
import { startDailySync, refreshNewOperations } from '../../services/broker/sync-service.js';
import { dedupeOperations, mergeBrokerBatch } from '../../services/broker/dedupe-utils.js';
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
import { DEFAULT_PREFIX_SYMBOL_MAP } from '../../services/prefix-defaults.js';
import {
  resolveExpirationLabel,
  normalizeExpirationToken,
  DEFAULT_EXPIRATION_TOKEN,
} from '../../services/csv/expiration-labels.js';

import OperationTypeTabs from './OperationTypeTabs.jsx';
import { OPERATION_TYPES } from './operation-types.js';
import OpcionesView from './OpcionesView.jsx';
import CompraVentaView from './CompraVentaView.jsx';
import ArbitrajesView from './ArbitrajesView.jsx';
import EmptyState from './EmptyState.jsx';
import BrokerLogin from './BrokerLogin.jsx';
import DataSourceSelector from './DataSourceSelector.jsx';
import DataSourcesPanel from './DataSourcesPanel.jsx';
import FileMenu from './FileMenu.jsx';

const ALL_GROUP_ID = '__ALL__';
const LAST_SESSION_STORAGE_VERSION = 1;

const createInitialGroupSelections = () => ({
  [OPERATION_TYPES.OPCIONES]: ALL_GROUP_ID,
  [OPERATION_TYPES.COMPRA_VENTA]: ALL_GROUP_ID,
  [OPERATION_TYPES.ARBITRAJES]: ALL_GROUP_ID,
});

const OPTION_INSTRUMENT_KEY_PREFIX = 'optionInstrument::';
const OPTION_TOKEN_PREFIX_REGEX = /^([A-Z0-9]+?)[CV]\d+/i;

const sanitizeForTestId = (value = '') => value.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();

const buildGroupKey = (symbol = '', expiration = DEFAULT_EXPIRATION_TOKEN) => `${symbol}::${expiration}`;

const OPTION_OPERATION_TYPES = new Set(['CALL', 'PUT']);

const normalizeGroupSymbol = (value = '') => {
  if (typeof value !== 'string') {
    return String(value ?? '').trim().toUpperCase() || 'UNKNOWN';
  }
  const trimmed = value.trim();
  return trimmed ? trimmed.toUpperCase() : 'UNKNOWN';
};

const normalizeGroupExpiration = (value = '') => normalizeExpirationToken(value);

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

const extractOptionPrefixToken = (value = '') => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim().toUpperCase();
  if (!trimmed) {
    return null;
  }

  const tokenMatch = trimmed.match(OPTION_TOKEN_PREFIX_REGEX);
  if (tokenMatch) {
    return tokenMatch[1];
  }

  const [firstSegment] = trimmed.split(/\s+/);
  if (firstSegment && /^[A-Z0-9]{2,6}$/.test(firstSegment)) {
    return firstSegment;
  }

  if (/^[A-Z0-9]{2,6}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
};

const getOperationGroupId = (operation = {}) => {
  const normalizedSymbol = normalizeGroupSymbol(operation.symbol);
  if (OPTION_OPERATION_TYPES.has(operation.optionType)) {
    const normalizedExpiration = normalizeGroupExpiration(operation.expiration);
    const expiration = normalizedExpiration || DEFAULT_EXPIRATION_TOKEN;
    return buildGroupKey(normalizedSymbol, expiration);
  }

  const baseSymbol = splitInstrumentSymbol(normalizedSymbol);
  return buildGroupKey(baseSymbol, DEFAULT_EXPIRATION_TOKEN);
};

const getOptionInstrumentToken = (operation = {}) => {
  if (!operation || !OPTION_OPERATION_TYPES.has(operation.optionType)) {
    return null;
  }

  const candidates = [
    operation?.meta?.sourceToken,
    operation?.originalSymbol,
    operation?.raw?.symbol,
    operation?.symbol,
  ];

  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      if (trimmed) {
        return trimmed.toUpperCase();
      }
    }
  }

  return null;
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

const formatExpirationLabel = (expiration = '', { expirationLabels } = {}) =>
  resolveExpirationLabel(expiration, { expirationLabels });

const formatGroupLabel = (group, { prefixLabels, expirationLabels } = {}) => {
  if (!group) {
    return '';
  }

  if (!isOptionGroup(group)) {
    const [baseIdSymbol] = (group.id ?? '').split('::');
    if (baseIdSymbol) {
      return baseIdSymbol;
    }
    const baseSymbol = extractBaseSymbol(group.symbol ?? '');
    return baseSymbol || group.symbol || '';
  }

  const baseSymbol = extractBaseSymbol(group.symbol ?? '') || group.symbol || '';
  const symbolCandidates = [group.symbol, baseSymbol, (group.id ?? '').split('::')[0]];

  let displaySymbol = baseSymbol;

  for (let index = 0; index < symbolCandidates.length; index += 1) {
    const candidate = symbolCandidates[index];
    const prefix = extractOptionPrefixToken(candidate ?? '');
    if (!prefix) {
      continue;
    }
    const normalizedPrefix = prefix.toUpperCase();
    if (prefixLabels?.has(normalizedPrefix)) {
      displaySymbol = prefixLabels.get(normalizedPrefix);
      break;
    }
    displaySymbol = normalizedPrefix;
    break;
  }

  if (!displaySymbol) {
    displaySymbol = baseSymbol || group.symbol || '';
  }

  const expirationLabel = formatExpirationLabel(group.expiration ?? '', { expirationLabels });

  if (expirationLabel) {
    return `${displaySymbol} ${expirationLabel}`.trim();
  }

  return displaySymbol;
};

const computeScopedData = ({
  report,
  groups,
  selectedGroupId,
  useAveraging,
  groupedOperations,
  cache,
  allOperations = [],
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

  // Prioritize report.operations (processed data) over allOperations (raw storage)
  const operations = Array.isArray(report.operations) && report.operations.length > 0
    ? report.operations
    : Array.isArray(allOperations) && allOperations.length > 0
      ? allOperations
      : [];
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
  const brokerStrings = strings.brokerSync;
  const {
    prefixRules,
    expirations,
    activeExpiration,
    useAveraging,
    setAveraging,
    brokerAuth,
    brokerApiUrl,
    sync,
    operations: syncedOperations,
    brokerOperations,
    setOperations,
    setBrokerAuth,
    clearBrokerAuth,
    startSync,
    stagePage,
    commitSync,
    failSync,
    cancelSync,
    applyChanges,
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
  const [brokerLoginError, setBrokerLoginError] = useState(null);
  const [isBrokerLoginLoading, setIsBrokerLoginLoading] = useState(false);
  const syncCancellationRef = useRef(null);
  const autoSyncTokenRef = useRef(null);

  const isAuthenticated = Boolean(brokerAuth?.token);
  const syncState = sync ?? { status: 'idle', inProgress: false };
  const syncInProgress = Boolean(syncState.inProgress);

  const localizedSyncState = useMemo(() => {
    if (!syncState || !syncState.error) {
      return syncState;
    }

    const waitMsFromState = syncState.rateLimitMs;
    let message = syncState.error;

    if (typeof syncState.error === 'string' && syncState.error.startsWith('RATE_LIMITED')) {
      const rawValue = syncState.error.split(':')[1];
      const waitMs = Number.isFinite(Number.parseInt(rawValue, 10))
        ? Number.parseInt(rawValue, 10)
        : waitMsFromState;
      const seconds = Number.isFinite(waitMs) ? Math.max(Math.round(waitMs / 1000), 1) : 60;
      const template = brokerStrings.rateLimitedWait || brokerStrings.rateLimited || message;
      message = template.replace('{seconds}', seconds);
    } else if (
      typeof syncState.error === 'string'
      && syncState.error.startsWith('TOKEN_EXPIRED')
    ) {
      message = brokerStrings.sessionExpired || brokerStrings.loginError || message;
    }

    return {
      ...syncState,
      error: message,
    };
  }, [brokerStrings.loginError, brokerStrings.rateLimited, brokerStrings.rateLimitedWait, brokerStrings.sessionExpired, syncState]);

  const existingOperations = useMemo(
    () => (Array.isArray(syncedOperations) ? syncedOperations : []),
    [syncedOperations],
  );

  // Combine CSV and broker operations for unified processing and display
  const allOperations = useMemo(() => {
    const csvOps = Array.isArray(syncedOperations) ? syncedOperations : [];
    const brokerOps = Array.isArray(brokerOperations) ? brokerOperations : [];
    return [...csvOps, ...brokerOps];
  }, [syncedOperations, brokerOperations]);

  const sourceCounts = useMemo(() => {
    return allOperations.reduce(
      (acc, operation) => {
        const sourceKey = operation?.source;
        if (sourceKey === 'broker') {
          acc.broker += 1;
        } else if (sourceKey === 'csv') {
          acc.csv += 1;
        } else {
          acc.other += 1;
        }
        acc.total += 1;
        return acc;
      },
      { broker: 0, csv: 0, other: 0, total: 0 },
    );
  }, [allOperations]);

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
        if (
          typeof setOperations === 'function'
          && Array.isArray(result.normalizedOperations)
          && result.normalizedOperations.length > 0
        ) {
          const incomingCsv = dedupeOperations(existingOperations, result.normalizedOperations);
          if (incomingCsv.length > 0) {
            const { mergedOps } = mergeBrokerBatch(existingOperations, incomingCsv);
            setOperations(mergedOps);
          }
        }
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
    [buildConfiguration, existingOperations, processorStrings.errors.processingFailed, setOperations],
  );

  const triggerSync = useCallback(
    async ({ authOverride = null, brokerApiUrl: apiUrlOverride = null } = {}) => {
      const auth = authOverride ?? brokerAuth;
      if (!auth || !auth.token) {
        return { success: false, error: 'NOT_AUTHENTICATED' };
      }

      if (syncInProgress) {
        return { success: false, error: 'SYNC_IN_PROGRESS' };
      }

      setActionFeedback(null);

      const cancellationToken = { isCanceled: false };
      syncCancellationRef.current = cancellationToken;

      const effectiveBrokerApiUrl = apiUrlOverride || brokerApiUrl;

      // Build configuration for unified pipeline processing
      const configuration = buildConfiguration();

      const syncPayload = {
        brokerAuth: auth,
        setBrokerAuth,
        startSync,
        stagePage,
        commitSync,
        failSync,
        cancelSync,
        tradingDay: 'today',
        cancellationToken,
        sync: syncState,
        brokerApiUrl: effectiveBrokerApiUrl,
        configuration, // Pass configuration to unified pipeline
      };

      let result;
      try {
        result = await startDailySync(syncPayload);

        if (result.success) {
          setBrokerLoginError(null);
          setActionFeedback(null);
        } else if (result.needsReauth) {
          clearBrokerAuth();
          setBrokerLoginError(brokerStrings.loginError);
          const message = brokerStrings.sessionExpired || brokerStrings.loginError;
          setActionFeedback({ type: 'error', message });
        } else if (result.rateLimited) {
          const waitMs = result.rateLimitMs ?? 60000;
          const seconds = Math.max(Math.round(waitMs / 1000), 1);
          const template = brokerStrings.rateLimitedWait || brokerStrings.rateLimited;
          const message = template
            ? template.replace('{seconds}', seconds)
            : `Límite de velocidad alcanzado. Intentá nuevamente en ~${seconds} segundos.`;
          setActionFeedback({ type: 'warning', message });
        } else if (result.error) {
          setActionFeedback({
            type: 'error',
            message: brokerStrings.refreshError || 'Ocurrió un error al sincronizar las operaciones.',
          });
        }
      } catch (error) {
        const message = error?.message || 'Error de sincronización';
        failSync({ error: message });
        result = { success: false, error: message };
      } finally {
        syncCancellationRef.current = null;
      }

      return result;
    },
    [
      brokerApiUrl,
      brokerAuth,
      brokerStrings.loginError,
      brokerStrings.rateLimited,
      brokerStrings.rateLimitedWait,
      brokerStrings.sessionExpired,
      brokerStrings.refreshError,
      buildConfiguration,
      cancelSync,
      clearBrokerAuth,
      commitSync,
      failSync,
      setActionFeedback,
      setBrokerAuth,
      setBrokerLoginError,
      stagePage,
      startDailySync,
      startSync,
      syncInProgress,
      syncState,
    ],
  );

  const handleBrokerLogin = useCallback(
    async (username, password, apiUrl) => {
      setIsBrokerLoginLoading(true);
      setBrokerLoginError(null);
      try {
        // Update the API URL in config if provided and different
        if (apiUrl && apiUrl !== brokerApiUrl) {
          applyChanges({ brokerApiUrl: apiUrl });
        }

        // Set the base URL in the jsrofex client before login
        const effectiveApiUrl = apiUrl || brokerApiUrl;
        if (effectiveApiUrl) {
          setBaseUrl(effectiveApiUrl);
        }

        const authResponse = await brokerLogin({ username, password });
        const authPayload = {
          token: authResponse.token,
          expiry: authResponse.expiry,
          accountId: username,
        };

  setBrokerAuth(authPayload);
  autoSyncTokenRef.current = authPayload.token;
  await triggerSync({ authOverride: authPayload, brokerApiUrl: effectiveApiUrl });
      } catch (error) {
        console.warn('PO: Broker login failed', error?.message || error);
        clearBrokerAuth();
        setBrokerLoginError(brokerStrings.loginError);
      } finally {
        setIsBrokerLoginLoading(false);
      }
    },
    [applyChanges, brokerApiUrl, brokerStrings.loginError, clearBrokerAuth, setBrokerAuth, triggerSync],
  );

  const handleBrokerLogout = useCallback(() => {
    clearBrokerAuth();
    setActionFeedback({ type: 'info', message: 'Sesión cerrada' });
  }, [clearBrokerAuth, setActionFeedback]);

  const handleCancelSync = useCallback(() => {
    if (syncCancellationRef.current) {
      syncCancellationRef.current.isCanceled = true;
    }
    cancelSync({ mode: syncState?.mode ?? 'daily' });
    if (syncState?.mode === 'refresh') {
      setActionFeedback({ type: 'info', message: brokerStrings.canceled });
    }
  }, [brokerStrings.canceled, cancelSync, setActionFeedback, syncState]);

  useEffect(() => {
    if (!isAuthenticated) {
      autoSyncTokenRef.current = null;
      return;
    }

    if (syncInProgress) {
      return;
    }

    if (autoSyncTokenRef.current === brokerAuth.token) {
      return;
    }

  autoSyncTokenRef.current = brokerAuth.token;
  triggerSync({ authOverride: brokerAuth, brokerApiUrl });
  }, [brokerAuth, brokerApiUrl, isAuthenticated, syncInProgress, triggerSync]);

  useEffect(() => () => {
    if (syncCancellationRef.current) {
      syncCancellationRef.current.isCanceled = true;
    }
  }, []);

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

  const handleProcessBrokerOperations = useCallback(async () => {
    if (!brokerOperations || brokerOperations.length === 0) {
      setActionFeedback({ 
        type: 'warning', 
        message: 'No hay operaciones del broker para procesar' 
      });
      return;
    }

    setIsProcessing(true);
    setProcessingError(null);
    setActionFeedback(null);

    try {
      const configurationPayload = buildConfiguration();
      
      // Import broker operations through unified pipeline
      const { importBrokerOperations } = await import('../../services/broker/broker-import-pipeline.js');
      
      const result = await importBrokerOperations({
        operationsJson: brokerOperations,
        configuration: configurationPayload,
        existingOperations: [],
      });

      // Set the report from pipeline processing result
      setReport(result);
      setWarningCodes(result.summary?.warnings ?? []);
      
      // Determine initial view
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

      setActionFeedback({ 
        type: 'success', 
        message: `${brokerOperations.length} operaciones del broker procesadas exitosamente` 
      });
      
      // Create a virtual file object to ensure the UI switches to results view
      // This allows broker operations to be displayed the same way as CSV uploads
      const virtualFile = new File([], 'broker-operations.json', { type: 'application/json' });
      setSelectedFile(virtualFile);
      
    } catch (err) {
      setReport(null);
      setWarningCodes([]);
      removeItem(storageKeys.lastReport);
      setProcessingError(err?.message ?? 'Error al procesar operaciones del broker');
      setActionFeedback({ 
        type: 'error', 
        message: err?.message ?? 'Error al procesar operaciones del broker' 
      });
    } finally {
      setIsProcessing(false);
    }
  }, [brokerOperations, buildConfiguration]);

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
    }
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

  const expirationLabelMap = useMemo(() => {
    const map = new Map();
    if (!expirations || typeof expirations !== 'object') {
      return map;
    }

    Object.entries(expirations).forEach(([name, config]) => {
      const normalizedName = typeof name === 'string' ? name.trim() : '';
      if (!normalizedName) {
        return;
      }

      const suffixes = Array.isArray(config?.suffixes) ? config.suffixes : [];
      suffixes.forEach((suffix) => {
        const normalizedSuffix = typeof suffix === 'string' ? suffix.trim().toUpperCase() : '';
        if (normalizedSuffix && !map.has(normalizedSuffix)) {
          map.set(normalizedSuffix, normalizedName);
        }
      });
    });

    return map;
  }, [expirations]);

  const prefixDisplayMap = useMemo(() => {
    const map = new Map();

    if (prefixRules && typeof prefixRules === 'object') {
      Object.entries(prefixRules).forEach(([prefix, rule]) => {
        const normalizedPrefix = typeof prefix === 'string' ? prefix.trim().toUpperCase() : '';
        const ruleSymbol = rule && typeof rule.symbol === 'string' ? rule.symbol.trim().toUpperCase() : '';
        if (normalizedPrefix && ruleSymbol) {
          map.set(normalizedPrefix, ruleSymbol);
        }
      });
    }

    // Use report.operations if available (fresh processing), otherwise use allOperations (persisted state)
    const operations = (report && Array.isArray(report.operations) && report.operations.length > 0)
      ? report.operations
      : allOperations;
    operations.forEach((operation) => {
      const prefix = typeof operation?.meta?.prefixRule === 'string'
        ? operation.meta.prefixRule.trim().toUpperCase()
        : '';
      const symbol = typeof operation?.symbol === 'string'
        ? operation.symbol.trim().toUpperCase()
        : '';

      if (prefix && symbol && prefix !== symbol && !map.has(prefix)) {
        map.set(prefix, symbol);
      }
    });

    Object.entries(DEFAULT_PREFIX_SYMBOL_MAP).forEach(([prefix, symbol]) => {
      const normalizedPrefix = prefix.trim().toUpperCase();
      const normalizedSymbol = typeof symbol === 'string' ? symbol.trim().toUpperCase() : '';
      if (normalizedPrefix && normalizedSymbol && !map.has(normalizedPrefix)) {
        map.set(normalizedPrefix, normalizedSymbol);
      }
    });

    return map;
  }, [prefixRules, report, allOperations]);

  const groupedData = useMemo(() => {
    const map = new Map();
    // Use report.operations if available (fresh processing), otherwise use allOperations (persisted state)
    const operations = (report && Array.isArray(report.operations) && report.operations.length > 0)
      ? report.operations
      : allOperations;

    map.set(ALL_GROUP_ID, operations);

    if (!groups.length || operations.length === 0) {
      return {
        groupedOperationsMap: map,
        optionInstrumentGroups: [],
      };
    }

    const operationsByKey = new Map();
    const optionInstrumentMap = new Map();
    const optionInstrumentGroups = [];

    operations.forEach((operation) => {
      if (!operation) {
        return;
      }

      const groupKey = getOperationGroupId(operation);
      if (!operationsByKey.has(groupKey)) {
        operationsByKey.set(groupKey, []);
      }
      operationsByKey.get(groupKey).push(operation);

      const instrumentToken = getOptionInstrumentToken(operation);
      if (instrumentToken) {
        const instrumentKey = `${OPTION_INSTRUMENT_KEY_PREFIX}${instrumentToken}`;
        let entry = optionInstrumentMap.get(instrumentKey);
        if (!entry) {
          entry = { id: instrumentKey, token: instrumentToken, operations: [] };
          optionInstrumentMap.set(instrumentKey, entry);
          optionInstrumentGroups.push(entry);
        }
        entry.operations.push(operation);
      }
    });

    groups.forEach((group) => {
      map.set(group.id, operationsByKey.get(group.id) ?? []);
    });

    optionInstrumentGroups.forEach((entry) => {
      map.set(entry.id, entry.operations);
    });

    return {
      groupedOperationsMap: map,
      optionInstrumentGroups,
    };
  }, [report, groups, allOperations]);

  const groupedOperations = groupedData.groupedOperationsMap;
  const optionInstrumentGroups = groupedData.optionInstrumentGroups;

  useEffect(() => {
    scopedDataCacheRef.current = new Map();
  }, [report, groups, groupedOperations, allOperations]);

  const { optionGroupOptions, compraVentaGroupOptions, allGroupOptions } = useMemo(() => {
    if (!groups.length) {
      return {
        optionGroupOptions: [],
        compraVentaGroupOptions: [],
        allGroupOptions: [],
      };
    }

    const allEntry = {
      id: ALL_GROUP_ID,
      label: filterStrings.all ?? 'All',
      testId: 'all',
    };

    const buildOptionEntry = (group) => ({
      id: group.id,
      label: formatGroupLabel(group, { prefixLabels: prefixDisplayMap, expirationLabels: expirationLabelMap }),
      testId: sanitizeForTestId(group.id),
    });

    const optionGroups = groups.filter((group) => {
      if (!isOptionGroup(group)) {
        return false;
      }
      const groupOperations = groupedOperations.get(group.id) ?? [];
      return groupOperations.some((operation) => OPTION_OPERATION_TYPES.has(operation?.optionType));
    });

    const optionGroupEntries = optionGroups
      .map(buildOptionEntry)
      .sort((a, b) => a.label.localeCompare(b.label));

    if (optionGroupEntries.length > 0) {
      optionGroupEntries.unshift(allEntry);
    }

    const allGroupEntries = groups
      .map(buildOptionEntry)
      .sort((a, b) => a.label.localeCompare(b.label));

    if (allGroupEntries.length > 0) {
      allGroupEntries.unshift(allEntry);
    }

    const optionInstrumentEntries = optionInstrumentGroups
      .map((entry) => ({
        id: entry.id,
        label: entry.token,
        testId: sanitizeForTestId(entry.token),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    const nonOptionGroupEntries = groups
      .filter((group) => !isOptionGroup(group))
      .map(buildOptionEntry)
      .sort((a, b) => a.label.localeCompare(b.label));

    const compraVentaEntries = [allEntry];

    if (optionInstrumentEntries.length > 0) {
      compraVentaEntries.push(...optionInstrumentEntries);
    } else if (optionGroupEntries.length > 0) {
      compraVentaEntries.push(...optionGroupEntries.slice(1));
    }

    compraVentaEntries.push(...nonOptionGroupEntries);

    return {
      optionGroupOptions: optionGroupEntries,
      compraVentaGroupOptions: compraVentaEntries,
      allGroupOptions: allGroupEntries,
    };
  }, [
    groups,
    filterStrings.all,
    groupedOperations,
    optionInstrumentGroups,
    prefixDisplayMap,
    expirationLabelMap,
  ]);

  useEffect(() => {
    const allowedByType = {
      [OPERATION_TYPES.OPCIONES]: new Set(optionGroupOptions.map((option) => option.id)),
      [OPERATION_TYPES.COMPRA_VENTA]: new Set(compraVentaGroupOptions.map((option) => option.id)),
      [OPERATION_TYPES.ARBITRAJES]: new Set(allGroupOptions.map((option) => option.id)),
    };

    setSelectedGroupIds((prev) => {
      let next = prev;
      Object.entries(prev).forEach(([type, value]) => {
        const allowed = allowedByType[type];
        if (!allowed || allowed.size === 0) {
          if (value !== ALL_GROUP_ID) {
            if (next === prev) {
              next = { ...prev };
            }
            next[type] = ALL_GROUP_ID;
          }
          return;
        }

        if (!allowed.has(value)) {
          if (next === prev) {
            next = { ...prev };
          }
          next[type] = ALL_GROUP_ID;
        }
      });
      return next;
    });
  }, [optionGroupOptions, compraVentaGroupOptions, allGroupOptions]);

  const scopedData = useMemo(
    () => computeScopedData({
      report,
      groups,
      selectedGroupId,
      useAveraging,
      groupedOperations,
      cache: scopedDataCacheRef.current,
      allOperations,
    }),
    [report, groups, selectedGroupId, useAveraging, groupedOperations, allOperations],
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
    const restoreSession = async () => {
      if (sessionRestoredRef.current) {
        return;
      }

      const stored = await readItem(storageKeys.lastReport);
      if (!stored || typeof stored !== 'object') {
        sessionRestoredRef.current = true;
        return;
      }

      if (stored.version !== LAST_SESSION_STORAGE_VERSION || !stored.report) {
        await removeItem(storageKeys.lastReport);
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
        
        // Restore selectedGroupIds (new multi-type format) with backward compatibility
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
          // Backward compatibility: migrate old selectedGroupId to selectedGroupIds
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
        await removeItem(storageKeys.lastReport);
      } finally {
        sessionRestoredRef.current = true;
      }
    };
    
    restoreSession();
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
            groupOptions={compraVentaGroupOptions}
            operations={scopedData.filteredOperations}
            expirationLabels={expirationLabelMap}
          />
        );

      case OPERATION_TYPES.ARBITRAJES:
        return (
          <ArbitrajesView
            {...commonProps}
            groupOptions={allGroupOptions}
            operations={scopedData.filteredOperations || []}
            cauciones={[]} // TODO: Integrate cauciones data source
          />
        );

      default:
        return null;
    }
  };

  const renderSourceSummary = () => {
    if (!sourceCounts.total) {
      return null;
    }

    const indicatorStrings = processorStrings.sourcesIndicator ?? {};

    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          px: 3,
          pt: 2,
        }}
        data-testid="processor-source-indicator"
      >
        <Typography variant="caption" color="text.secondary">
          {indicatorStrings.title ?? 'Operaciones cargadas'}
        </Typography>
        <Stack direction="row" spacing={2}>
          <Typography variant="caption" color="text.secondary">
            {(indicatorStrings.brokerLabel ?? 'Broker')}: {sourceCounts.broker}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {(indicatorStrings.csvLabel ?? 'CSV')}: {sourceCounts.csv}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {(indicatorStrings.totalLabel ?? 'Total')}: {sourceCounts.total}
          </Typography>
          {sourceCounts.other > 0 && (
            <Typography variant="caption" color="text.secondary">
              {(indicatorStrings.otherLabel ?? 'Otros')}: {sourceCounts.other}
            </Typography>
          )}
        </Stack>
      </Box>
    );
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
          {!selectedFile ? (
            <>
              <DataSourceSelector
                strings={strings}
                onSelectFile={handleFileSelected}
                onBrokerLogin={handleBrokerLogin}
                onBrokerLogout={handleBrokerLogout}
                onBrokerSync={() => triggerSync()}
                onBrokerProcess={handleProcessBrokerOperations}
                isBrokerLoginLoading={isBrokerLoginLoading}
                brokerLoginError={brokerLoginError}
                isAuthenticated={isAuthenticated}
                syncInProgress={syncInProgress}
                defaultApiUrl={brokerApiUrl}
                brokerAccountId={brokerAuth?.accountId}
                brokerOperationCount={sourceCounts.broker}
              />
            </>
          ) : report ? (
            <>
              {/* Operation Type Tabs */}
              <OperationTypeTabs
                strings={processorStrings}
                activeTab={activeOperationType}
                onTabChange={handleOperationTypeChange}
                onClose={() => handleFileSelected(null)}
                fileName={selectedFile?.name}
                dataSourcesPanel={
                  <DataSourcesPanel
                    brokerSource={
                      isAuthenticated
                        ? {
                            connected: true,
                            accountId: brokerAuth?.accountId || 'N/A',
                            operationCount: sourceCounts.broker,
                            lastSyncTimestamp: syncState?.lastSyncTimestamp,
                            syncing: syncInProgress,
                          }
                        : null
                    }
                    csvSource={
                      selectedFile
                        ? {
                            fileName: selectedFile.name,
                            operationCount: sourceCounts.csv,
                          }
                        : null
                    }
                    onRefreshBroker={() => triggerSync()}
                    onProcessBroker={handleProcessBrokerOperations}
                    onRemoveCsv={() => setSelectedFile(null)}
                  />
                }
                fileMenuSlot={
                  <FileMenu
                    strings={strings}
                    selectedFileName={null}
                    isProcessing={isProcessing}
                    onSelectFile={handleFileSelected}
                    onClearFile={() => {}}
                  />
                }
              />

              {/* Render the active view */}
              {renderActiveView()}
            </>
          ) : null}
        </Stack>

      {/* Toast Notifications */}
      <Snackbar
        open={Boolean(actionFeedback)}
        autoHideDuration={4000}
        onClose={() => setActionFeedback(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {actionFeedback ? (
          <Alert 
            onClose={() => setActionFeedback(null)} 
            severity={actionFeedback.type} 
            sx={{ width: '100%' }}
            variant="filled"
          >
            {actionFeedback.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  );
};

export default ProcessorScreen;
