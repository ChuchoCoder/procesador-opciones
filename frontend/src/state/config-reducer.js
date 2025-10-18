import { sanitizeConfiguration, resetConfiguration } from '../services/storage/config-service.js';
import { DEFAULT_CONFIGURATION } from '../services/storage/config-service.js';

const DEFAULT_SYNC_STATE = {
  status: 'idle',
  lastSyncTimestamp: null,
  inProgress: false,
  pagesFetched: 0,
  operationsImportedCount: 0,
  mode: 'daily',
  estimatedTotal: null,
  lastSummary: null,
  error: null,
  rateLimitMs: null,
};

export const applyChanges = (state, changes) => sanitizeConfiguration({ ...state, ...changes });

export const reducer = (state, action) => {
  switch (action.type) {
    case 'HYDRATE':
      return sanitizeConfiguration({
        ...action.payload,
        brokerAuth: action.payload.brokerAuth || null,
        sync: {
          ...DEFAULT_SYNC_STATE,
          ...(action.payload.sync || {}),
        },
        stagingOps: action.payload.stagingOps || [],
        syncSessions: action.payload.syncSessions || [], // T061: append-only sync session log
      });
    case 'SET_AVERAGING':
      return applyChanges(state, { useAveraging: action.payload });
    case 'ADD_EXPIRATION': {
      const { name, suffixes } = action.payload;
      const expirations = {
        ...state.expirations,
        [name]: { suffixes },
      };
      return applyChanges(state, {
        expirations,
        activeExpiration: action.setActive ? name : state.activeExpiration,
      });
    }
    case 'REMOVE_EXPIRATION': {
      const { [action.payload]: _, ...remaining } = state.expirations;  
      return applyChanges(state, {
        expirations: remaining,
        activeExpiration: state.activeExpiration === action.payload ? undefined : state.activeExpiration,
      });
    }
    case 'RENAME_EXPIRATION': {
      const { from, to } = action.payload;
      const current = state.expirations[from];
      if (!current) {
        return state;
      }
      const normalizedName = typeof to === 'string' ? to.trim() : '';
      if (!normalizedName || normalizedName === from) {
        return state;
      }
      const nextExpirations = { ...state.expirations };
      delete nextExpirations[from];
      nextExpirations[normalizedName] = current;
      return applyChanges(state, {
        expirations: nextExpirations,
        activeExpiration: state.activeExpiration === from ? normalizedName : state.activeExpiration,
      });
    }
    case 'ADD_SUFFIX': {
      const { name, suffix } = action.payload;
      const existing = state.expirations[name];
      if (!existing) {
        return state;
      }
      const updated = {
        ...state.expirations,
        [name]: { suffixes: [...existing.suffixes, suffix] },
      };
      return applyChanges(state, { expirations: updated });
    }
    case 'REMOVE_SUFFIX': {
      const { name, suffix } = action.payload;
      const existing = state.expirations[name];
      if (!existing) {
        return state;
      }
      const updatedSuffixes = existing.suffixes.filter((value) => value !== suffix);
      const nextExpirations = {
        ...state.expirations,
        [name]: { suffixes: updatedSuffixes },
      };
      return applyChanges(state, { expirations: nextExpirations });
    }
    case 'SET_ACTIVE_EXPIRATION':
      return applyChanges(state, { activeExpiration: action.payload });
    case 'SET_OPERATIONS': {
      const operations = Array.isArray(action.payload?.operations)
        ? action.payload.operations
        : [];
      return applyChanges(state, { operations });
    }
    case 'RESET_DEFAULTS':
      return sanitizeConfiguration(DEFAULT_CONFIGURATION);
    
    // Broker sync actions (T012)
    case 'SET_BROKER_AUTH': {
      // payload: { token, expiry, accountId?, displayName? }
      return applyChanges(state, { brokerAuth: action.payload });
    }
    case 'CLEAR_BROKER_AUTH':
      return applyChanges(state, { brokerAuth: null });
    case 'START_SYNC': {
      // payload: { sessionId, meta }
      const meta = action.payload.meta || {};
      return applyChanges(state, {
        sync: {
          status: 'in-progress',
          sessionId: action.payload.sessionId,
          startTime: Date.now(),
          pagesFetched: 0,
          operationsImportedCount: 0,
          lastUpdateTime: Date.now(),
          inProgress: true,
          lastSyncTimestamp: state.sync.lastSyncTimestamp,
          mode: meta.mode || 'daily',
          estimatedTotal: meta.estimatedTotal ?? null,
          error: null,
        },
        stagingOps: [], // reset staging
      });
    }
    case 'STAGE_PAGE': {
      // payload: { operations: Array, pageIndex: number, meta?: Object }
      const newStaging = [...state.stagingOps, ...action.payload.operations];
      return applyChanges(state, {
        stagingOps: newStaging,
        sync: {
          ...state.sync,
          pagesFetched: (state.sync.pagesFetched || 0) + 1,
          operationsImportedCount: newStaging.length,
          lastUpdateTime: Date.now(),
          estimatedTotal: action.payload.meta?.estimatedTotal ?? state.sync.estimatedTotal ?? null,
        },
      });
    }
    case 'COMMIT_SYNC': {
      // payload: { operations: Array (final operations list), syncMeta: Object }
      const endTime = Date.now();
      const newOperationsCount = Math.max(
        action.payload.syncMeta?.newOperationsCount ??
          action.payload.operations.length - (state.operations?.length || 0),
        0,
      );
      const newOrdersCount = action.payload.syncMeta?.newOrdersCount ?? 0;
      const mode = action.payload.syncMeta?.mode || state.sync.mode || 'daily';
      const syncSession = {
        sessionId: state.sync.sessionId,
        startTime: state.sync.startTime,
        endTime,
        status: 'success',
        operationsImportedCount: newOperationsCount,
        source: 'broker',
        message: null,
        retryAttempts: action.payload.syncMeta?.retryAttempts || 0,
        mode,
      };
      return applyChanges(state, {
        operations: action.payload.operations,
        sync: {
          ...state.sync,
          status: 'success',
          inProgress: false,
          lastSyncTimestamp: endTime,
          endTime,
          operationsImportedCount: newOperationsCount,
          pagesFetched: action.payload.syncMeta?.pagesFetched ?? state.sync.pagesFetched,
          estimatedTotal: action.payload.syncMeta?.estimatedTotal ?? state.sync.estimatedTotal,
          lastSummary: {
            operationsAdded: newOperationsCount,
            newOrders: newOrdersCount,
            totalOperations: action.payload.syncMeta?.totalOperations ?? action.payload.operations.length,
            mode,
          },
          mode,
          error: null,
        },
        stagingOps: [], // clear staging after commit
        syncSessions: [...(state.syncSessions || []), syncSession], // T061: append to log
      });
    }
    case 'FAIL_SYNC': {
      // payload: { error: string }
      const endTime = Date.now();
      const mode = action.payload.mode || state.sync.mode || 'daily';
      const syncSession = {
        sessionId: state.sync.sessionId,
        startTime: state.sync.startTime,
        endTime,
        status: 'failed',
        operationsImportedCount: 0,
        source: 'broker',
        message: action.payload.error,
        retryAttempts: action.payload.retryAttempts || 0,
        mode,
      };
      return applyChanges(state, {
        sync: {
          ...state.sync,
          status: 'failed',
          inProgress: false,
          error: action.payload.error,
          endTime,
          mode,
          lastSummary: null,
          rateLimitMs: action.payload.rateLimitMs ?? null,
        },
        stagingOps: [], // discard staging
        syncSessions: [...(state.syncSessions || []), syncSession], // T061: append to log
      });
    }
    case 'CANCEL_SYNC': {
      const endTime = Date.now();
      const mode = action.payload?.mode || state.sync.mode || 'daily';
      const syncSession = {
        sessionId: state.sync.sessionId,
        startTime: state.sync.startTime,
        endTime,
        status: 'canceled',
        operationsImportedCount: 0,
  source: 'broker',
  message: 'Sincronización cancelada por el usuario',
        retryAttempts: 0,
        mode,
      };
      return applyChanges(state, {
        sync: {
          ...state.sync,
          status: 'canceled',
          inProgress: false,
          endTime,
          mode,
          lastSummary: null,
        },
        stagingOps: [], // discard staging
        syncSessions: [...(state.syncSessions || []), syncSession], // T061: append to log
      });
    }
    case 'SWITCH_BROKER_ACCOUNT': {
      // T067: Clear broker-sourced operations, retain CSV-sourced operations
      const csvOperations = (state.operations || []).filter(
        (op) => op.source === 'csv'
      );
      
      return applyChanges(state, {
        brokerAuth: action.payload,
        operations: csvOperations,
        sync: {
          ...DEFAULT_SYNC_STATE,
        },
        stagingOps: [],
        // Keep sync sessions for audit trail
      });
    }
    case 'APPLY_CHANGES': {
      // Generic action to apply arbitrary configuration changes
      return applyChanges(state, action.payload);
    }
    
    default:
      return state;
  }
};

export const createInitialState = () => sanitizeConfiguration(DEFAULT_CONFIGURATION);
// Provide initial extension for new slices (Phase 1 Setup T003)
// brokerAuth: { token, expiry }
// sync: { status, lastSyncTimestamp, inProgress }
// stagingOps: []
export const resetDefaults = () => resetConfiguration();
