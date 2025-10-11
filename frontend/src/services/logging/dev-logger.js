const PREFIX = 'PO:';

const resolveEnvironment = () => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      if (typeof import.meta.env.DEV !== 'undefined') {
        return import.meta.env.DEV ? 'development' : 'production';
      }
      if (typeof import.meta.env.MODE === 'string') {
        return import.meta.env.MODE;
      }
    }
  } catch {
    // Ignore errors accessing import.meta in non-module contexts.
  }

  try {
    // eslint-disable-next-line no-undef
    if (typeof process !== 'undefined' && process.env) {
      // eslint-disable-next-line no-undef
      const { NODE_ENV } = process.env;
      if (typeof NODE_ENV === 'string' && NODE_ENV.length > 0) {
        return NODE_ENV;
      }
    }
  } catch {
    /* ignore */
  }

  return 'production';
};

const isDevelopment = () => resolveEnvironment() !== 'production';

const formatMessage = (scope, message) => (scope ? `${PREFIX} ${scope} - ${message}` : `${PREFIX} ${message}`);

const safeConsoleLog = (fn, ...args) => {
  if (typeof fn === 'function') {
    fn(...args);
  }
};

const now = () => {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
};

const round = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

export const createDevLogger = (scope = '', options = {}) => {
  const { disabled = false } = options;
  const enabled = !disabled && isDevelopment();

  const log = (message, payload) => {
    if (!enabled) return;
    const formattedMessage = formatMessage(scope, message);
    if (typeof payload !== 'undefined') {
      safeConsoleLog(console.log, formattedMessage, payload);
    } else {
      safeConsoleLog(console.log, formattedMessage);
    }
  };

  const metric = (metricName, value, metadata) => {
    if (!enabled) return;
    const descriptor = value !== undefined ? `${metricName}: ${value}` : metricName;
    const formattedMessage = formatMessage(scope, descriptor);
    if (metadata && Object.keys(metadata).length > 0) {
      safeConsoleLog(console.log, formattedMessage, metadata);
    } else {
      safeConsoleLog(console.log, formattedMessage);
    }
  };

  const warn = (message, payload) => {
    if (!enabled) return;
    const formattedMessage = formatMessage(scope, message);
    if (typeof payload !== 'undefined') {
      safeConsoleLog(console.warn, formattedMessage, payload);
    } else {
      safeConsoleLog(console.warn, formattedMessage);
    }
  };

  const time = (label) => {
    if (!enabled) {
      return () => 0;
    }

    const start = now();
    return (extraMetadata) => {
      const duration = round(now() - start);
      const formattedMessage = formatMessage(scope, `${label} duration: ${duration}ms`);
      if (extraMetadata && Object.keys(extraMetadata).length > 0) {
        safeConsoleLog(console.log, formattedMessage, extraMetadata);
      } else {
        safeConsoleLog(console.log, formattedMessage);
      }
      return duration;
    };
  };

  return {
    enabled,
    log,
    metric,
    warn,
    time,
  };
};

export const devLogger = createDevLogger('');
