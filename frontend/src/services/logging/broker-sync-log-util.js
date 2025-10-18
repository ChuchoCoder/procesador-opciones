// Logging utility for broker sync messages (Phase 1 Setup T005)
// Provides consistent prefix PO:SYNC and leveled logging wrappers.

const PREFIX = 'PO:SYNC';

function log(level, message, meta) {
  const payload = meta ? { ...meta } : undefined;
  console[level](`${PREFIX} ${message}`, payload ?? '');
}

export const syncLog = {
  info: (msg, meta) => log('info', msg, meta),
  warn: (msg, meta) => log('warn', msg, meta),
  error: (msg, meta) => log('error', msg, meta),
};
