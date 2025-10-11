import { useEffect, useMemo, useReducer, useState } from 'react';
import { ConfigContext } from './config-hooks.js';
export { useConfig } from './config-hooks.js';

import {
  DEFAULT_CONFIGURATION,
  loadConfiguration,
  resetConfiguration,
  sanitizeConfiguration,
  saveConfiguration,
} from '../services/storage/config-service.js';
import { storageAvailable } from '../services/storage/local-storage.js';


const applyChanges = (state, changes) => sanitizeConfiguration({ ...state, ...changes });

const reducer = (state, action) => {
  switch (action.type) {
    case 'HYDRATE':
      return sanitizeConfiguration(action.payload);
    case 'ADD_SYMBOL': {
      const symbols = [...state.symbols, action.payload];
      return applyChanges(state, { symbols });
    }
    case 'REMOVE_SYMBOL': {
      const symbols = state.symbols.filter((symbol) => symbol !== action.payload);
      return applyChanges(state, {
        symbols,
        activeSymbol: state.activeSymbol === action.payload ? undefined : state.activeSymbol,
      });
    }
    case 'SET_ACTIVE_SYMBOL':
      return applyChanges(state, { activeSymbol: action.payload });
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
        activeExpiration:
          state.activeExpiration === from ? normalizedName : state.activeExpiration,
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
    case 'RESET_DEFAULTS':
      return sanitizeConfiguration(DEFAULT_CONFIGURATION);
    default:
      return state;
  }
};

const ConfigProviderComponent = ({ children }) => {
  const storageEnabled = storageAvailable();
  const [state, dispatch] = useReducer(reducer, sanitizeConfiguration(DEFAULT_CONFIGURATION));
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const loaded = loadConfiguration();
    dispatch({ type: 'HYDRATE', payload: loaded });
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    saveConfiguration(state);
  }, [hydrated, state]);

  const actions = useMemo(
    () => ({
      addSymbol: (symbol) => dispatch({ type: 'ADD_SYMBOL', payload: symbol }),
      removeSymbol: (symbol) => dispatch({ type: 'REMOVE_SYMBOL', payload: symbol }),
      setActiveSymbol: (symbol) => dispatch({ type: 'SET_ACTIVE_SYMBOL', payload: symbol }),
      setAveraging: (use) => dispatch({ type: 'SET_AVERAGING', payload: use }),
      addExpiration: ({ name, suffixes, setActive = false }) =>
        dispatch({ type: 'ADD_EXPIRATION', payload: { name, suffixes }, setActive }),
      removeExpiration: (name) => dispatch({ type: 'REMOVE_EXPIRATION', payload: name }),
      renameExpiration: (from, to) =>
        dispatch({ type: 'RENAME_EXPIRATION', payload: { from, to } }),
      addSuffix: (name, suffix) =>
        dispatch({ type: 'ADD_SUFFIX', payload: { name, suffix } }),
      removeSuffix: (name, suffix) =>
        dispatch({ type: 'REMOVE_SUFFIX', payload: { name, suffix } }),
      setActiveExpiration: (expiration) =>
        dispatch({ type: 'SET_ACTIVE_EXPIRATION', payload: expiration }),
      resetDefaults: () => {
        const defaults = resetConfiguration();
        dispatch({ type: 'HYDRATE', payload: defaults });
      },
    }),
    [],
  );

  const value = useMemo(
    () => ({
      ...state,
      ...actions,
      storageEnabled,
      hydrated,
    }),
    [actions, hydrated, state, storageEnabled],
  );

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
};

export const ConfigProvider = ConfigProviderComponent;
