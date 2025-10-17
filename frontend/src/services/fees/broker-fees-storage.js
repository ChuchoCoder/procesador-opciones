import feeConfigJson from './fees-config.json';
import {
  readItem,
  writeItem,
  removeItem,
  storageAvailable,
  storageKeys,
} from '../storage/local-storage.js';

const DEFAULT_BROKER_FEES = Object.freeze({
  commission: feeConfigJson?.broker?.commission ?? 0,
  arancelCaucionColocadora: feeConfigJson?.broker?.arancelCaucionColocadora ?? 0,
  arancelCaucionTomadora: feeConfigJson?.broker?.arancelCaucionTomadora ?? 0,
});

const normalizePercentage = (value) => {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric >= 0) {
    return numeric;
  }
  return null;
};

export const getDefaultBrokerFees = () => ({ ...DEFAULT_BROKER_FEES });

export const sanitizeBrokerFees = (candidate = {}) => {
  const defaults = getDefaultBrokerFees();
  const commission = normalizePercentage(candidate.commission);
  const arancelCaucionColocadora = normalizePercentage(candidate.arancelCaucionColocadora);
  const arancelCaucionTomadora = normalizePercentage(candidate.arancelCaucionTomadora);

  return {
    commission: commission ?? defaults.commission,
    arancelCaucionColocadora: arancelCaucionColocadora ?? defaults.arancelCaucionColocadora,
    arancelCaucionTomadora: arancelCaucionTomadora ?? defaults.arancelCaucionTomadora,
  };
};

export const loadBrokerFees = async () => {
  if (!storageAvailable()) {
    return getDefaultBrokerFees();
  }

  const stored = await readItem(storageKeys.brokerFees);
  if (!stored) {
    return getDefaultBrokerFees();
  }

  return sanitizeBrokerFees(stored);
};

export const saveBrokerFees = async (candidate) => {
  const sanitized = sanitizeBrokerFees(candidate);

  if (storageAvailable()) {
    await writeItem(storageKeys.brokerFees, sanitized);
  }

  return sanitized;
};

export const clearBrokerFees = async () => {
  if (!storageAvailable()) {
    return getDefaultBrokerFees();
  }

  await removeItem(storageKeys.brokerFees);
  return getDefaultBrokerFees();
};
