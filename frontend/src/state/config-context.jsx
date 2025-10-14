import { useEffect, useMemo, useReducer, useState } from 'react';
import { ConfigContext } from './config-hooks.js';

import { loadConfiguration, saveConfiguration } from '../services/storage/config-service.js';
import { reducer, createInitialState, resetDefaults as resetDefaultsFn } from './config-reducer.js';
import { storageAvailable } from '../services/storage/local-storage.js';



const ConfigProviderComponent = ({ children }) => {
  const storageEnabled = storageAvailable();
  const [state, dispatch] = useReducer(reducer, createInitialState());
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
