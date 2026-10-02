import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import { useUI } from '../../store/ui';

export function ConfirmDialog() {
  const dialog = useUI((s) => s.dialog);
  const close = () => useUI.getState().setDialog(null);
  return (
    <AnimatePresence>
      {dialog && (
        <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close}>
          <motion.div
            className="panel dialog"
            role="alertdialog"
            aria-modal="true"
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.key === 'Escape' && close()}
          >
            <p>{dialog.message}</p>
            <div className="actions">
              <button className="btn ghost" onClick={close}>
                Cancel
              </button>
              <button
                className={`btn ${dialog.danger ? 'danger' : 'primary'}`}
                autoFocus
                onClick={() => {
                  close();
                  dialog.onConfirm();
                }}
              >
                {dialog.confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Toast() {
  const toast = useUI((s) => s.toast);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => useUI.getState().showToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);
  return (
    <AnimatePresence>
      {toast && (
        <motion.div className="panel toast" role="status" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }}>
          {toast}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
