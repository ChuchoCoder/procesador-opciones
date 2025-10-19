const PREFIX = 'PO:';

const isObject = (value) => value !== null && typeof value === 'object';

const formatMessage = (scope, message) => {
  const safeMessage = typeof message === 'string' && message.length > 0
    ? message
    : String(message ?? '');

  return scope ? `${PREFIX} ${scope} - ${safeMessage}` : `${PREFIX} ${safeMessage}`;
};

const resolveWarnTransport = (transport) => {
  if (transport && typeof transport.warn === 'function') {
    return transport.warn.bind(transport);
  }

  if (typeof console !== 'undefined' && typeof console.warn === 'function') {
    return console.warn.bind(console);
  }

  return null;
};

export const createWarnLogger = (scope = '', options = {}) => {
  const { transport } = options;
  const warnTransport = resolveWarnTransport(transport);

  const warn = (message, metadata) => {
    if (!warnTransport) {
      return;
    }

    const formattedMessage = formatMessage(scope, message);

    if (metadata === undefined) {
      warnTransport(formattedMessage);
      return;
    }

    if (isObject(metadata) && Object.keys(metadata).length === 0) {
      warnTransport(formattedMessage);
      return;
    }

    warnTransport(formattedMessage, metadata);
  };

  return {
    warn,
  };
};
