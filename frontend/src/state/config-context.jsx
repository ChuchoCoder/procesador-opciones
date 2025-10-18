import { useEffect, useMemo, useReducer, useState } from 'react';
import { ConfigContext } from './config-hooks.js';

import { loadConfiguration, saveConfiguration } from '../services/storage/config-service.js';
import { reducer, createInitialState, resetDefaults as resetDefaultsFn } from './config-reducer.js';
import { storageAvailable } from '../services/storage/local-storage.js';
import { isTokenValid } from '../services/broker/token-manager.js';



const ConfigProviderComponent = ({ children }) => {
  const storageEnabled = storageAvailable();
  const [state, dispatch] = useReducer(reducer, createInitialState());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const loadAndHydrate = async () => {
      const loaded = await loadConfiguration();
      
      // Check if stored token is expired and clear it
      if (loaded.brokerAuth && !isTokenValid(loaded.brokerAuth)) {
        loaded.brokerAuth = null;
      }
      
      dispatch({ type: 'HYDRATE', payload: loaded });
      setHydrated(true);
    };
    
    loadAndHydrate();
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    saveConfiguration(state);
  }, [hydrated, state]);

  const actions = useMemo(
    () => ({
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
        const defaults = resetDefaultsFn();
        dispatch({ type: 'HYDRATE', payload: defaults });
      },
      // Broker sync actions (T016)
      setBrokerAuth: (authData) => dispatch({ type: 'SET_BROKER_AUTH', payload: authData }),
      clearBrokerAuth: () => dispatch({ type: 'CLEAR_BROKER_AUTH' }),
      startSync: (sessionId, meta = {}) =>
        dispatch({ type: 'START_SYNC', payload: { sessionId, meta } }),
      stagePage: (operations, pageIndex, meta = {}) =>
        dispatch({ type: 'STAGE_PAGE', payload: { operations, pageIndex, meta } }),
      commitSync: (operations, syncMeta) => 
        dispatch({ type: 'COMMIT_SYNC', payload: { operations, syncMeta } }),
      failSync: (error, meta = {}) => {
        if (typeof error === 'string') {
          dispatch({ type: 'FAIL_SYNC', payload: { error, ...meta } });
          return;
        }
        if (error && typeof error === 'object') {
          dispatch({ type: 'FAIL_SYNC', payload: { ...error, ...meta } });
          return;
        }
  dispatch({ type: 'FAIL_SYNC', payload: { error: 'Error de sincronización desconocido', ...meta } });
      },
      cancelSync: (meta = {}) => dispatch({ type: 'CANCEL_SYNC', payload: meta }),
      setOperations: (operations) =>
        dispatch({ type: 'SET_OPERATIONS', payload: { operations } }),
      // T067: Broker account switch - clear broker operations, retain CSV
      switchBrokerAccount: (newAuthData) =>
        dispatch({ type: 'SWITCH_BROKER_ACCOUNT', payload: newAuthData }),
      // Apply arbitrary configuration changes
      applyChanges: (changes) =>
        dispatch({ type: 'APPLY_CHANGES', payload: changes }),
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
