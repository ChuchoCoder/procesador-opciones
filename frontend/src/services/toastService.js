// Lightweight global toast service using window events to avoid re-rendering unrelated components
export const showToast = ({ message = '', severity = 'info', autoHideDuration = 4000 } = {}) => {
  try {
    const detail = { id: `${Date.now()}-${Math.random()}`, message, severity, autoHideDuration };
    window.dispatchEvent(new CustomEvent('po-toast', { detail }));
    return detail.id;
  } catch (e) {
    // fallback: no-op
    // eslint-disable-next-line no-console
    console.warn('Toast service failed to dispatch toast', e);
    return null;
  }
};

export const dismissToast = (id) => {
  try {
    window.dispatchEvent(new CustomEvent('po-toast-dismiss', { detail: { id } }));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('Toast service dismiss failed', e);
  }
};

export const dismissAllToasts = () => {
  try {
    window.dispatchEvent(new CustomEvent('po-toast-dismiss-all'));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('Toast service dismissAll failed', e);
  }
};

export default {
  show: showToast,
  dismiss: dismissToast,
  dismissAll: dismissAllToasts,
};
