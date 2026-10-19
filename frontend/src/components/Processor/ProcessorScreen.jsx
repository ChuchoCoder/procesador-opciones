import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { processOperations } from '../../services/csv/process-operations.js';
import { CsvDataSource, JsonDataSource } from '../../services/data-sources/index.js';
import { login as brokerLogin, setBaseUrl } from '../../services/broker/jsrofex-client.js';
import { startDailySync, refreshNewOperations } from '../../services/broker/sync-service.js';
import {
  CLIPBOARD_SCOPES,
  copyReportToClipboard,
} from '../../services/csv/clipboard-service.js';
import { exportReportToCsv, EXPORT_SCOPES } from '../../services/csv/export-service.js';
import { useConfig } from '../../state/index.js';
import { showToast, dismissAllToasts } from '../../services/toastService.js';
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
  ALL_GROUP_ID,
  OPTION_INSTRUMENT_KEY_PREFIX,
  OPTION_OPERATION_TYPES,
  getOperationGroupId,
  getOptionInstrumentToken,
  isOptionGroup,
  formatGroupLabel,
} from '../../services/clasificacion-instrumentos.js';
import { computeScopedData } from '../../services/alcance-reporte.js';
import { FUENTES, filtrarPorFuente } from '../../services/operacion.js';
import {
  EVENTOS,
  FASES,
  debeProcesar,
  esperaSync,
  estadoInicial as estadoProcesamientoInicial,
  reducirProcesamiento,
} from '../../services/maquina-procesamiento.js';
import {
  elegirPreviewInicial,
  fusionarOperacionesCsv,
  puedeSincronizar,
  resolverFuenteDeDatos,
} from '../../services/orquestacion-jornada.js';
import {
  ACCIONES_SESION,
  construirSnapshotSesion,
  interpretarSesionGuardada,
} from '../../services/sesion-jornada.js';

import OperationTypeTabs from './OperationTypeTabs.jsx';
import { OPERATION_TYPES } from './operation-types.js';
import OpcionesView from './OpcionesView.jsx';
import CompraVentaView from './CompraVentaView.jsx';
import ArbitrajesView from './ArbitrajesView.jsx';
import ReconciliationView from './ReconciliationView.jsx';
import { parseCauciones, calculateAvgTNAByCurrency } from '../../services/data-aggregation.js';
import EmptyState from './EmptyState.jsx';
import BrokerLogin from './BrokerLogin.jsx';
import DataSourceSelector from './DataSourceSelector.jsx';
import DataSourcesPanel from './DataSourcesPanel.jsx';
import FileMenu from './FileMenu.jsx';


const sanitizeForTestId = (value = '') => value.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();

const createInitialGroupSelections = () => ({
  [OPERATION_TYPES.OPCIONES]: [],
  [OPERATION_TYPES.COMPRA_VENTA]: [],
  [OPERATION_TYPES.ARBITRAJES]: [],
  [OPERATION_TYPES.RECONCILIACION]: [],
});
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
  // El ciclo de procesamiento es una máquina de estados explícita: antes
  // estaba repartido entre `report === null` como comando, `pendingRefreshRef`
  // y `lastSyncTimestampRef`.
  const [estadoProc, despachar] = useReducer(reducirProcesamiento, estadoProcesamientoInicial);
  const selectedDataSource = estadoProc.fuente;
  const [report, setReport] = useState(null);
  const isProcessing = estadoProc.fase === FASES.PROCESANDO;
  const [processingError, setProcessingError] = useState(null);
  const [warningCodes, setWarningCodes] = useState([]);
  const [activePreview, setActivePreview] = useState(CLIPBOARD_SCOPES.CALLS);
  const [activeOperationType, setActiveOperationType] = useState(OPERATION_TYPES.OPCIONES);
  const [selectedGroupIds, setSelectedGroupIds] = useState(() => createInitialGroupSelections());
  const selectedGroupId = useMemo(() => selectedGroupIds[activeOperationType] ?? [], [selectedGroupIds, activeOperationType]);
  const scopedDataCacheRef = useRef(new Map());
  const sessionRestoredRef = useRef(false);
  const [brokerLoginError, setBrokerLoginError] = useState(null);
  const [isBrokerLoginLoading, setIsBrokerLoginLoading] = useState(false);
  const syncCancellationRef = useRef(null);
  // Filas crudas de la última corrida, para re-derivar sin volver a parsear.
  const filasParseadasRef = useRef(null);
  const rederivarRef = useRef(false);
  const autoSyncTokenRef = useRef(null);

  const isAuthenticated = Boolean(brokerAuth?.token);
  // Ensure syncState has stable identity to avoid changing deps in hooks
  const syncState = useMemo(() => (sync ?? { status: 'idle', inProgress: false }), [sync]);
  const syncInProgress = Boolean(syncState.inProgress);


  const existingOperations = useMemo(
    () => (Array.isArray(syncedOperations) ? syncedOperations : []),
    [syncedOperations],
  );

  const setSelectedGroupIdForType = useCallback((type, nextValue) => {
    if (!type) {
      return;
    }

    setSelectedGroupIds((prev) => {
      const currentValue = prev[type] ?? [];
      // nextValue should be an array
      const safeValue = Array.isArray(nextValue) ? nextValue : [];
      
      // Compare arrays for equality
      if (JSON.stringify(currentValue) === JSON.stringify(safeValue)) {
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
        const targetValue = initial[key] ?? [];
        const currentValue = prev[key] ?? [];
        if (JSON.stringify(currentValue) !== JSON.stringify(targetValue)) {
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
    async (fileOrDataSource, overrides = {}) => {
      if (!fileOrDataSource) {
        return;
      }

      despachar({ tipo: EVENTOS.PROCESAMIENTO_INICIADO });
      setProcessingError(null);
      // Don't clear actionFeedback during auto-reprocessing - preserve broker sync notifications
      // setActionFeedback(null);

      try {
        const configurationPayload = buildConfiguration(overrides);
        
        const { dataSource, file, fileName } = resolverFuenteDeDatos(fileOrDataSource, {
          syncedOperations,
          brokerAccountId: brokerAuth?.accountId,
        });
        
        const reusarFilas = rederivarRef.current ? filasParseadasRef.current : null;
        rederivarRef.current = false;

        const result = await processOperations({
          dataSource,
          file,
          fileName,
          configuration: configurationPayload,
          filasYaParseadas: reusarFilas,
        });

        filasParseadasRef.current = result.filasParseadas ?? null;

        setReport(result);
        despachar({ tipo: EVENTOS.PROCESAMIENTO_OK });
        setWarningCodes(result.summary.warnings ?? []);
        
        if (fileOrDataSource.type === 'csv' && typeof setOperations === 'function') {
          const mergedOps = fusionarOperacionesCsv(existingOperations, result.normalizedOperations);
          if (mergedOps) {
            setOperations(mergedOps);
          }
        }
        
        setActivePreview(
          elegirPreviewInicial(result, configurationPayload.useAveraging) === 'puts'
            ? CLIPBOARD_SCOPES.PUTS
            : CLIPBOARD_SCOPES.CALLS,
        );
      } catch (err) {
        setReport(null);
        setWarningCodes([]);
        removeItem(storageKeys.lastReport);
        setProcessingError(err?.message ?? processorStrings.errors.processingFailed);
        // Clear the data source to prevent infinite loop when auto-processing fails
        despachar({ tipo: EVENTOS.PROCESAMIENTO_FALLIDO });
        setSelectedFile(null);
      }
    },
    [
      buildConfiguration, 
      existingOperations, 
      processorStrings.errors.processingFailed, 
      setOperations,
      syncedOperations,
      brokerAuth,
    ],
  );

  const triggerSync = useCallback(
    async ({ authOverride = null, mode = 'daily', brokerApiUrl: apiUrlOverride = null } = {}) => {
      const auth = authOverride ?? brokerAuth;
      const habilitacion = puedeSincronizar({ auth, syncInProgress });
      if (!habilitacion.puede) {
        return { success: false, error: habilitacion.motivo, mode };
      }

      // Don't clear actionFeedback when starting refresh - let success/error messages persist
      // if (mode === 'refresh') {
      //   setActionFeedback(null);
      // }

      const cancellationToken = { isCanceled: false };
      syncCancellationRef.current = cancellationToken;

      const effectiveBrokerApiUrl = apiUrlOverride || brokerApiUrl;

      const syncPayload = {
        brokerAuth: auth,
        existingOperations,
        operations: existingOperations,
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
      };

      let result;
      try {
        if (mode === 'refresh') {
          result = await refreshNewOperations(syncPayload);
        } else {
          result = await startDailySync({ ...syncPayload, mode: 'daily' });
        }

        if (result.success) {
          setBrokerLoginError(null);

          if (mode === 'refresh') {
            if (result.operationsAdded > 0) {
              const template = brokerStrings.refreshSuccess || '';
              const message = template
                ? template.replace('{count}', String(result.operationsAdded))
                : `${result.operationsAdded} operaciones nuevas.`;
              showToast({ message, severity: 'success' });
            } else {
              showToast({ message: brokerStrings.noNewOperations, severity: 'info' });
            }
          } else {
            // clear previous toasts
            dismissAllToasts();
          }
        } else if (result.needsReauth) {
          clearBrokerAuth();
          setBrokerLoginError(brokerStrings.loginError);
          if (mode === 'refresh') {
            const message = brokerStrings.sessionExpired || brokerStrings.loginError;
            showToast({ message, severity: 'error' });
          }
        } else if (mode === 'refresh' && result.rateLimited) {
          const waitMs = result.rateLimitMs ?? 60000;
          const seconds = Math.max(Math.round(waitMs / 1000), 1);
          const template = brokerStrings.rateLimitedWait || brokerStrings.rateLimited;
          const message = template
            ? template.replace('{seconds}', seconds)
            : `Límite de velocidad alcanzado. Intentá nuevamente en ~${seconds} segundos.`;
          showToast({ message, severity: 'warning' });
        } else if (mode === 'refresh' && result.error) {
          showToast({ message: brokerStrings.refreshError || 'Ocurrió un error al actualizar las operaciones.', severity: 'error' });
        }
      } catch (error) {
        const message = error?.message || 'Error de sincronización';
        failSync({ error: message, mode });
        result = { success: false, error: message, mode };
      } finally {
        syncCancellationRef.current = null;
      }

      return result;
    },
    [
      brokerApiUrl,
      brokerAuth,
      brokerStrings.loginError,
      brokerStrings.noNewOperations,
      brokerStrings.rateLimited,
      brokerStrings.rateLimitedWait,
      brokerStrings.refreshSuccess,
    brokerStrings.refreshError,
      brokerStrings.sessionExpired,
      cancelSync,
      clearBrokerAuth,
      commitSync,
      existingOperations,
      failSync,
  setBrokerAuth,
      setBrokerLoginError,
      stagePage,
      
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
  await triggerSync({ authOverride: authPayload, mode: 'daily', brokerApiUrl: effectiveApiUrl });
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
    showToast({ message: 'Sesión cerrada', severity: 'info' });
  }, [clearBrokerAuth]);

  const handleCancelSync = useCallback(() => {
    if (syncCancellationRef.current) {
      syncCancellationRef.current.isCanceled = true;
    }
    cancelSync({ mode: syncState?.mode ?? 'daily' });
    if (syncState?.mode === 'refresh') {
      showToast({ message: brokerStrings.canceled, severity: 'info' });
    }
  }, [brokerStrings.canceled, cancelSync, syncState]);
  // handleCancelSync may be used by UI slots; reference to avoid unused-var lint
  void handleCancelSync;

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
  triggerSync({ authOverride: brokerAuth, mode: 'daily', brokerApiUrl });
  }, [brokerAuth, brokerApiUrl, isAuthenticated, syncInProgress, triggerSync]);

  useEffect(() => () => {
    if (syncCancellationRef.current) {
      syncCancellationRef.current.isCanceled = true;
    }
  }, []);

  const handleFileSelected = (file) => {
    setSelectedFile(file);
    despachar({
      tipo: EVENTOS.FUENTE_SELECCIONADA,
      fuente: file ? { type: 'csv', file, name: file.name } : null,
    });
  setProcessingError(null);
  // Clear any visible toasts when selecting a new file
  dismissAllToasts();
    setWarningCodes([]);
    setActivePreview(CLIPBOARD_SCOPES.CALLS);
    resetGroupSelections();
    setReport(null);
    if (!file) {
      removeItem(storageKeys.lastReport);
    }
  };

  const construirFuenteBroker = useCallback((operaciones) => ({
    type: 'broker',
    data: operaciones,
    name: `Broker-${brokerAuth?.accountId || 'Unknown'}`,
    timestamp: Date.now(),
  }), [brokerAuth?.accountId]);

  const handleBrokerDataSelected = useCallback(() => {
    if (!isAuthenticated || !syncedOperations || syncedOperations.length === 0) {
      return;
    }
    
    // Filter to only broker operations
    const brokerOnlyOperations = filtrarPorFuente(syncedOperations, FUENTES.BROKER);
    
    const dataSource = construirFuenteBroker(brokerOnlyOperations);

    setSelectedFile(null); // Clear CSV file
    despachar({ tipo: EVENTOS.FUENTE_SELECCIONADA, fuente: dataSource });
    setProcessingError(null);
    // Don't clear actionFeedback here - let success/error messages from sync show
    // setActionFeedback(null);
    setWarningCodes([]);
    setActivePreview(CLIPBOARD_SCOPES.CALLS);
    resetGroupSelections();
    setReport(null);
  }, [isAuthenticated, syncedOperations, resetGroupSelections, construirFuenteBroker]);


  const handleBrokerRefresh = useCallback(async () => {
    if (!isAuthenticated || syncInProgress) {
      return;
    }
    
    const wasViewingBrokerData = selectedDataSource?.type === 'broker';
    
    console.log('[ProcessorScreen] handleBrokerRefresh called:', {
      wasViewingBrokerData,
      currentSyncTimestamp: sync?.lastSyncTimestamp,
      syncedOpsCount: syncedOperations?.length,
    });
    
    // Mirando datos del broker, se suspende el procesamiento hasta que la
    // sincronización traiga operaciones nuevas.
    if (wasViewingBrokerData) {
      setReport(null);
      despachar({ tipo: EVENTOS.REFRESH_PEDIDO, timestamp: sync?.lastSyncTimestamp });
    }
    
    const result = await triggerSync({ authOverride: brokerAuth, mode: 'refresh', brokerApiUrl });
    
    console.log('[ProcessorScreen] triggerSync result:', {
      success: result?.success,
      operationsAdded: result?.operationsAdded,
      newSyncTimestamp: sync?.lastSyncTimestamp,
    });
    
    return result;
  }, [isAuthenticated, syncInProgress, triggerSync, brokerAuth, brokerApiUrl, selectedDataSource?.type, sync?.lastSyncTimestamp, syncedOperations]);

  // Cuando la sincronización termina con un timestamp nuevo, la máquina
  // vuelve a PENDIENTE con la fuente del broker renovada.
  useEffect(() => {
    if (!esperaSync(estadoProc) || syncInProgress) {
      return;
    }

    despachar({
      tipo: EVENTOS.SYNC_TERMINADO,
      timestamp: sync?.lastSyncTimestamp,
      fuente: construirFuenteBroker(filtrarPorFuente(syncedOperations, FUENTES.BROKER)),
    });
  }, [estadoProc, syncInProgress, sync?.lastSyncTimestamp, syncedOperations, construirFuenteBroker]);

  // Procesar es responsabilidad de una sola fase, así que el efecto ya no
  // tiene que deducirla de `!report && !isProcessing` ni mirar refs ajenos.
  useEffect(() => {
    if (debeProcesar(estadoProc)) {
      runProcessing(estadoProc.fuente);
    }
  }, [estadoProc, runProcessing]);

  const handleToggleAveraging = async (nextValue) => {
    setAveraging(nextValue);
    // Clear visible toasts before toggling averaging
    dismissAllToasts();
    if (selectedDataSource && report && !report.views) {
      await runProcessing(selectedDataSource, { useAveraging: nextValue });
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
      // Clear any previous toasts when starting downloads
      dismissAllToasts();
    } catch {
      showToast({ message: processorStrings.actions.downloadError, severity: 'error' });
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
  // Precompute avgTNAByCurrency at processor level so the arbitrage view can receive
  // a precomputed mapping and skip recomputing it. We parse cauciones from the
  // enriched operations present in the report and derive the weighted average TNA by currency.
  const avgTNAByCurrency = useMemo(() => {
    try {
      const ops = Array.isArray(report?.operations) ? report.operations : [];
      const parsed = parseCauciones(ops);
      return calculateAvgTNAByCurrency(parsed || []);
    } catch {
      return {};
    }
  }, [report?.operations]);
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

    const operations = Array.isArray(report?.operations) ? report.operations : [];
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
  }, [prefixRules, report]);

  const groupedData = useMemo(() => {
    const map = new Map();
    const operations = Array.isArray(report?.operations) ? report.operations : [];

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
  }, [report, groups]);

  const groupedOperations = groupedData.groupedOperationsMap;
  const optionInstrumentGroups = groupedData.optionInstrumentGroups;

  useEffect(() => {
    scopedDataCacheRef.current = new Map();
  }, [report, groups, groupedOperations]);

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

  // Reconciliación filters by raw instrument symbol across BOTH sources (csv + broker),
  // independent of the options strike/expiration grouping used above (that grouping is
  // derived from the single active report, while reconciliation compares both sources at once).
  const reconciliationGroupOptions = useMemo(() => {
    if (!existingOperations.length) {
      return [];
    }
    const symbols = new Set();
    existingOperations.forEach((operation) => {
      if (operation?.symbol) {
        symbols.add(operation.symbol);
      }
    });
    if (symbols.size === 0) {
      return [];
    }
    const allEntry = {
      id: ALL_GROUP_ID,
      label: filterStrings.all ?? 'All',
      testId: 'all',
    };
    const entries = Array.from(symbols)
      .sort((a, b) => a.localeCompare(b))
      .map((symbol) => ({ id: symbol, label: symbol, testId: sanitizeForTestId(symbol) }));
    return [allEntry, ...entries];
  }, [existingOperations, filterStrings.all]);

  useEffect(() => {
    const allowedByType = {
      [OPERATION_TYPES.OPCIONES]: new Set(optionGroupOptions.map((option) => option.id)),
      [OPERATION_TYPES.COMPRA_VENTA]: new Set(compraVentaGroupOptions.map((option) => option.id)),
      [OPERATION_TYPES.ARBITRAJES]: new Set(allGroupOptions.map((option) => option.id)),
      [OPERATION_TYPES.RECONCILIACION]: new Set(reconciliationGroupOptions.map((option) => option.id)),
    };

    setSelectedGroupIds((prev) => {
      let next = prev;
      Object.entries(prev).forEach(([type, value]) => {
        const allowed = allowedByType[type];
        if (!allowed || allowed.size === 0) {
          const currentValue = value ?? [];
          if (currentValue.length > 0) {
            if (next === prev) {
              next = { ...prev };
            }
            next[type] = [];
          }
          return;
        }

        // Filter out any IDs that are no longer valid
        const currentIds = Array.isArray(value) ? value : [];
        const validIds = currentIds.filter(id => allowed.has(id));
        
        if (JSON.stringify(currentIds) !== JSON.stringify(validIds)) {
          if (next === prev) {
            next = { ...prev };
          }
          next[type] = validIds;
        }
      });
      return next;
    });
  }, [optionGroupOptions, compraVentaGroupOptions, allGroupOptions, reconciliationGroupOptions]);

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
  const opcionesSelectedGroupId = useMemo(() => selectedGroupIds[OPERATION_TYPES.OPCIONES] ?? [], [selectedGroupIds]);

  const handleGroupChange = useCallback((nextValue) => {
    // nextValue should be an array of selected IDs
    setSelectedGroupIdForType(activeOperationType, nextValue);
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
      showToast({ message: processorStrings.actions.copySuccess, severity: 'success' });
    } catch {
      showToast({ message: processorStrings.actions.copyError, severity: 'error' });
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
    const rawSelection = opcionesSelectedGroupId;
    
    // Ensure currentSelection is always an array
    const currentSelection = Array.isArray(rawSelection) ? rawSelection : [];

    // If no selection (empty array), auto-select single group if available
    if (currentSelection.length === 0) {
      if (optionGroups.length === 1) {
        const onlyGroupId = optionGroups[0].id;
        if (onlyGroupId !== ALL_GROUP_ID) {
          setSelectedGroupIdForType(OPERATION_TYPES.OPCIONES, [onlyGroupId]);
        }
      }
      return;
    }

    // Validate that at least one selected group is an option group
    const hasValidOptionGroup = currentSelection.some(selectedId => {
      const selectedGroup = groups.find((group) => group.id === selectedId);
      return isOptionGroup(selectedGroup);
    });
    
    if (hasValidOptionGroup) {
      return;
    }

    // No valid option groups selected, reset
    if (optionGroups.length === 0) {
      setSelectedGroupIdForType(OPERATION_TYPES.OPCIONES, []);
      return;
    }

    if (optionGroups.length === 1) {
      const onlyGroupId = optionGroups[0].id;
      setSelectedGroupIdForType(OPERATION_TYPES.OPCIONES, [onlyGroupId]);
      return;
    }

    setSelectedGroupIdForType(OPERATION_TYPES.OPCIONES, []);
  }, [activeOperationType, opcionesSelectedGroupId, groups, setSelectedGroupIdForType]);

  useEffect(() => {
    const restoreSession = async () => {
      if (sessionRestoredRef.current) {
        return;
      }

      try {
        const { accion, sesion } = interpretarSesionGuardada(
          await readItem(storageKeys.lastReport),
          {
            tipos: Object.values(OPERATION_TYPES),
            alcancesPreview: Object.values(CLIPBOARD_SCOPES),
          },
        );

        if (accion === ACCIONES_SESION.DESCARTAR) {
          await removeItem(storageKeys.lastReport);
          return;
        }

        if (accion !== ACCIONES_SESION.RESTAURAR) {
          return;
        }

        setReport(sesion.report);
        setWarningCodes(sesion.warnings);
        setSelectedFile({ name: sesion.fileName });

        if (sesion.selecciones) {
          setSelectedGroupIds((prev) => ({ ...prev, ...sesion.selecciones }));
        }
        if (sesion.activeOperationType) {
          setActiveOperationType(sesion.activeOperationType);
        }
        if (sesion.activePreview) {
          setActivePreview(sesion.activePreview);
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

    writeItem(storageKeys.lastReport, construirSnapshotSesion({
      fileName: selectedFile.name,
      report,
      selectedGroupId,
      selectedGroupIds,
      activeOperationType,
      activePreview,
    }));
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
            onStrikeExceptionSaved={() => {
              // Las filas crudas no cambiaron: sólo la configuración de strikes.
              // Se re-deriva reusándolas en lugar de releer y re-parsear.
              rederivarRef.current = Boolean(filasParseadasRef.current);
              despachar({ tipo: EVENTOS.REDERIVAR });
            }}
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

      case OPERATION_TYPES.ARBITRAJES: {
        // For Arbitrajes, pass all operations (unfiltered) so the view can manage its own filtering
        // This allows the filter UI to show all available instruments regardless of current selection
        const allOperations = report?.operations || [];
        return (
          <ArbitrajesView
            {...commonProps}
            groupOptions={allGroupOptions}
            operations={allOperations}
            avgTNAByCurrency={avgTNAByCurrency}
          />
        );
      }

      case OPERATION_TYPES.RECONCILIACION: {
        const selectedSymbols = Array.isArray(selectedGroupId) ? selectedGroupId : [];
        const matchesSelectedSymbol = (operation) => (
          selectedSymbols.length === 0 || selectedSymbols.includes(operation?.symbol)
        );
        return (
          <ReconciliationView
            strings={processorStrings}
            groupOptions={reconciliationGroupOptions}
            selectedGroupId={selectedGroupId}
            onGroupChange={handleGroupChange}
            csvOperations={filtrarPorFuente(existingOperations, FUENTES.CSV).filter(matchesSelectedSymbol)}
            brokerOperations={filtrarPorFuente(existingOperations, FUENTES.BROKER).filter(matchesSelectedSymbol)}
          />
        );
      }

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

      {/* Only show top-level error if we have a selected data source (during active processing) */}
      {processingError && selectedDataSource && <Alert severity="error" sx={{ mx: 3, mt: 2 }}>{processingError}</Alert>}

      {warningMessages.map((message) => (
          <Alert severity="warning" key={message} sx={{ mx: 3, mt: 2 }}>
            {message}
          </Alert>
        ))}

        <Stack spacing={0} sx={{ flex: 1, minHeight: 0 }}>
          {!selectedDataSource ? (
            <>
              <DataSourceSelector
                strings={strings}
                onSelectFile={handleFileSelected}
                onSelectBroker={handleBrokerDataSelected}
                onBrokerRefresh={handleBrokerRefresh}
                onBrokerLogin={handleBrokerLogin}
                onBrokerLogout={handleBrokerLogout}
                isBrokerLoginLoading={isBrokerLoginLoading}
                brokerLoginError={brokerLoginError}
                isAuthenticated={isAuthenticated}
                syncInProgress={syncInProgress}
                defaultApiUrl={brokerApiUrl}
                brokerAccountId={brokerAuth?.accountId}
                brokerOperationCount={filtrarPorFuente(syncedOperations, FUENTES.BROKER).length}
                csvError={processingError}
              />
            </>
          ) : report ? (
            <>
              {/* Operation Type Tabs */}
              <OperationTypeTabs
                strings={processorStrings}
                activeTab={activeOperationType}
                onTabChange={handleOperationTypeChange}
                onClose={() => {
                  despachar({ tipo: EVENTOS.LIMPIADO });
                  setSelectedFile(null);
                }}
                fileName={selectedDataSource?.name || selectedFile?.name}
                dataSourcesPanel={
                  <DataSourcesPanel
                    brokerSource={
                      isAuthenticated && selectedDataSource?.type === 'broker'
                        ? {
                            connected: true,
                            accountId: brokerAuth?.accountId || 'N/A',
                            operationCount: report?.operations?.length || 0,
                            lastSyncTimestamp: syncState?.lastSyncTimestamp,
                            syncing: syncInProgress,
                          }
                        : null
                    }
                    csvSource={
                      selectedFile && selectedDataSource?.type === 'csv'
                        ? {
                            fileName: selectedFile.name,
                            operationCount: report?.operations?.length || 0,
                          }
                        : null
                    }
                    onRefreshBroker={handleBrokerRefresh}
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

      {/* Toast notifications are handled by the global ToastContainer (mounted at app root).
          This avoids re-rendering the Processor screen when toasts are shown/hidden. */}
    </Box>
  );
};

export default ProcessorScreen;
