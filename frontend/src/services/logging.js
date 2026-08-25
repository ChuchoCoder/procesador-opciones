// Simple observability helper for instruments-sync related logs
const PREFIX = 'PO:instruments-sync';

function info(phase, step, message, meta) {
  try {
    console.info(`${PREFIX} [INFO] ${phase}:${step} - ${message}`, meta || {});
  } catch (e) {
    // swallow
  }
}

function warn(phase, step, message, meta) {
  try {
    console.warn(`${PREFIX} [WARN] ${phase}:${step} - ${message}`, meta || {});
  } catch (e) {}
}

function error(phase, step, message, meta) {
  try {
    console.error(`${PREFIX} [ERROR] ${phase}:${step} - ${message}`, meta || {});
  } catch (e) {}
}

export default {
  info,
  warn,
  error,
};
