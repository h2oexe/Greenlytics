import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
  type ReactNode
} from "react";

type ToastTone = "success" | "error" | "info";
type ConfirmTone = "default" | "danger";

interface ToastOptions {
  title: string;
  message?: string;
  tone?: ToastTone;
  durationMs?: number;
}

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
}

interface ToastItem extends Required<Omit<ToastOptions, "durationMs">> {
  id: number;
}

interface ConfirmState extends Required<Omit<ConfirmOptions, "tone">> {
  tone: ConfirmTone;
  resolve: (result: boolean) => void;
}

interface FeedbackContextValue {
  showToast: (options: ToastOptions) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const FeedbackContext = createContext<FeedbackContextValue | undefined>(undefined);

export function FeedbackProvider({ children }: PropsWithChildren) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  const removeToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    ({ title, message = "", tone = "info", durationMs = 3200 }: ToastOptions) => {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      const nextToast: ToastItem = { id, title, message, tone };

      setToasts((current) => [...current, nextToast]);
      window.setTimeout(() => removeToast(id), durationMs);
    },
    [removeToast]
  );

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({
        title: options.title,
        message: options.message,
        confirmLabel: options.confirmLabel ?? "Onayla",
        cancelLabel: options.cancelLabel ?? "Vazgeç",
        tone: options.tone ?? "default",
        resolve
      });
    });
  }, []);

  const closeConfirm = useCallback((result: boolean) => {
    setConfirmState((current) => {
      current?.resolve(result);
      return null;
    });
  }, []);

  const value = useMemo<FeedbackContextValue>(
    () => ({
      showToast,
      confirm
    }),
    [confirm, showToast]
  );

  return (
    <FeedbackContext.Provider value={value}>
      {children}

      <ToastViewport toasts={toasts} onDismiss={removeToast} />
      <ConfirmDialog state={confirmState} onClose={closeConfirm} />
    </FeedbackContext.Provider>
  );
}

function ToastViewport({
  toasts,
  onDismiss
}: {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}) {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="toast-stack" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <article key={toast.id} className={`toast toast--${toast.tone}`}>
          <div className="toast-copy">
            <strong>{toast.title}</strong>
            {toast.message ? <span>{toast.message}</span> : null}
          </div>

          <button
            type="button"
            className="toast-dismiss"
            aria-label="Bildirimi kapat"
            onClick={() => onDismiss(toast.id)}
          >
            ×
          </button>
        </article>
      ))}
    </div>
  );
}

function ConfirmDialog({
  state,
  onClose
}: {
  state: ConfirmState | null;
  onClose: (result: boolean) => void;
}) {
  if (!state) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={() => onClose(false)}>
      <section
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="confirm-kicker">İşlem onayı</p>
        <h2 id="confirm-dialog-title">{state.title}</h2>
        <p id="confirm-dialog-description" className="muted">
          {state.message}
        </p>

        <div className="confirm-actions">
          <button type="button" className="secondary-button" onClick={() => onClose(false)}>
            {state.cancelLabel}
          </button>
          <button
            type="button"
            className={state.tone === "danger" ? "danger-button" : "primary-button"}
            onClick={() => onClose(true)}
          >
            {state.confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

export function useFeedback() {
  const context = useContext(FeedbackContext);

  if (!context) {
    throw new Error("useFeedback must be used inside FeedbackProvider");
  }

  return context;
}
