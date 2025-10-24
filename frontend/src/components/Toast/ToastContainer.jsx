import { useEffect, useState } from 'react';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import { createPortal } from 'react-dom';

// Toast container listens to global events and manages its own internal state.
// It is safe to mount this inside the app root because its state updates do not
// cause sibling components to re-render.
const ToastContainer = () => {
  const [queue, setQueue] = useState([]);
  const [current, setCurrent] = useState(null);

  useEffect(() => {
    const onToast = (e) => {
      const detail = e?.detail;
      if (!detail) return;
      setQueue((q) => [...q, detail]);
    };

    const onDismiss = (e) => {
      const id = e?.detail?.id;
      if (!id) {
        // if no id provided, ignore
        return;
      }
      setQueue((q) => q.filter((item) => item.id !== id));
      setCurrent((c) => (c && c.id === id ? null : c));
    };

    const onDismissAll = () => {
      setQueue([]);
      setCurrent(null);
    };

    window.addEventListener('po-toast', onToast);
    window.addEventListener('po-toast-dismiss', onDismiss);
    window.addEventListener('po-toast-dismiss-all', onDismissAll);

    return () => {
      window.removeEventListener('po-toast', onToast);
      window.removeEventListener('po-toast-dismiss', onDismiss);
      window.removeEventListener('po-toast-dismiss-all', onDismissAll);
    };
  }, []);

  useEffect(() => {
    if (!current && queue.length > 0) {
      setCurrent(queue[0]);
      setQueue((q) => q.slice(1));
    }
  }, [queue, current]);

  const handleClose = (event, reason) => {
    if (reason === 'clickaway') return;
    setCurrent(null);
  };

  // Render portal so it sits at document.body level (optional but keeps layout predictable)
  return createPortal(
    <>
      {current && (
        <Snackbar
          key={current.id}
          open={Boolean(current)}
          autoHideDuration={current.autoHideDuration ?? 4000}
          onClose={handleClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert onClose={handleClose} severity={current.severity} sx={{ width: '100%' }} variant="filled">
            {current.message}
          </Alert>
        </Snackbar>
      )}
    </>,
    document.body,
  );
};

export default ToastContainer;
