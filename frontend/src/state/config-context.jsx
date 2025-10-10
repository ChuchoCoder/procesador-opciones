import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';

import {
  readItem,
  removeItem,
  storageAvailable,
  storageKeys,
  writeItem,
} from '../services/storage/local-storage.js';

const DEFAULT_STATE = {
  symbols: ['GGAL', 'YPFD', 'PAMP'],
  expirations: {
    Enero: { suffixes: ['ENE'] },
    Febrero: { suffixes: ['FEB'] },
  },
  activeSymbol: 'GGAL',
  activeExpiration: 'Enero',
  useAveraging: false,
};

const ConfigContext = createContext(null);

const reducer = (state, action) => {
  switch (action.type) {
    case 'LOAD_STATE':
      return { ...state, ...action.payload };
    case 'SET_SYMBOLS':
      return { ...state, symbols: action.payload };
    case 'SET_EXPIRATIONS':
      return { ...state, expirations: action.payload };
    case 'SET_ACTIVE_SYMBOL':
      return { ...state, activeSymbol: action.payload };
    case 'SET_ACTIVE_EXPIRATION':
      return { ...state, activeExpiration: action.payload };
    case 'SET_AVERAGING':
      return { ...state, useAveraging: action.payload };
    case 'RESET_DEFAULTS':
      return { ...DEFAULT_STATE };
    default:
      return state;
  }
};

const persistSlice = (key, value) => {
  if (!storageAvailable()) {
    return;
  }

  writeItem(key, value);
};

const loadPersistedConfig = () => {
  if (!storageAvailable()) {
    return DEFAULT_STATE;
  }

  const persisted = {
    symbols: readItem(storageKeys.symbols) ?? DEFAULT_STATE.symbols,
    expirations: readItem(storageKeys.expirations) ?? DEFAULT_STATE.expirations,
    activeSymbol: readItem(storageKeys.activeSymbol) ?? DEFAULT_STATE.activeSymbol,
    activeExpiration:
      readItem(storageKeys.activeExpiration) ?? DEFAULT_STATE.activeExpiration,
    useAveraging: readItem(storageKeys.useAveraging) ?? DEFAULT_STATE.useAveraging,
  };

  return persisted;
};

export const ConfigProvider = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, DEFAULT_STATE);

  useEffect(() => {
    dispatch({ type: 'LOAD_STATE', payload: loadPersistedConfig() });
  }, []);

  useEffect(() => {
    persistSlice(storageKeys.symbols, state.symbols);
  }, [state.symbols]);

  useEffect(() => {
    persistSlice(storageKeys.expirations, state.expirations);
  }, [state.expirations]);

  useEffect(() => {
    persistSlice(storageKeys.activeSymbol, state.activeSymbol);
  }, [state.activeSymbol]);

  useEffect(() => {
    persistSlice(storageKeys.activeExpiration, state.activeExpiration);
  }, [state.activeExpiration]);

  useEffect(() => {
    persistSlice(storageKeys.useAveraging, state.useAveraging);
  }, [state.useAveraging]);

  const actions = useMemo(
    () => ({
      setSymbols: (symbols) => dispatch({ type: 'SET_SYMBOLS', payload: symbols }),
      setExpirations: (expirations) =>
        dispatch({ type: 'SET_EXPIRATIONS', payload: expirations }),
      setActiveSymbol: (symbol) =>
        dispatch({ type: 'SET_ACTIVE_SYMBOL', payload: symbol }),
      setActiveExpiration: (expiration) =>
        dispatch({ type: 'SET_ACTIVE_EXPIRATION', payload: expiration }),
      setAveraging: (use) => dispatch({ type: 'SET_AVERAGING', payload: use }),
      resetDefaults: () => dispatch({ type: 'RESET_DEFAULTS' }),
      clearPersisted: () => {
        removeItem(storageKeys.symbols);
        removeItem(storageKeys.expirations);
        removeItem(storageKeys.activeSymbol);
        removeItem(storageKeys.activeExpiration);
        removeItem(storageKeys.useAveraging);
      },
    }),
    [],
  );

  const value = useMemo(
    () => ({
      ...state,
      ...actions,
      storageEnabled: storageAvailable(),
    }),
    [actions, state],
  );

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
};

export const useConfig = () => {
  const context = useContext(ConfigContext);

  if (!context) {
    throw new Error('useConfig must be used within ConfigProvider');
  }

  return context;
};
