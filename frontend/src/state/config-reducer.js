import { sanitizeConfiguration, resetConfiguration } from '../services/storage/config-service.js';
import { DEFAULT_CONFIGURATION } from '../services/storage/config-service.js';

export const applyChanges = (state, changes) => sanitizeConfiguration({ ...state, ...changes });

export const reducer = (state, action) => {
  switch (action.type) {
    case 'HYDRATE':
      return sanitizeConfiguration(action.payload);
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
    case 'RESET_DEFAULTS':
      return sanitizeConfiguration(DEFAULT_CONFIGURATION);
    default:
      return state;
  }
};

export const createInitialState = () => sanitizeConfiguration(DEFAULT_CONFIGURATION);
export const resetDefaults = () => resetConfiguration();
