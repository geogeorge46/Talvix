/* eslint-disable react-refresh/only-export-components -- Provider and hook intentionally share their typed context. */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Button, IconButton } from '../components';
export interface ToastItem {
  id: string;
  title: string;
  message?: string;
  tone?: 'info' | 'success' | 'warning' | 'danger';
  action?: { label: string; onAction: () => void };
  duration?: number;
  persistent?: boolean;
}
interface Api {
  toasts: ToastItem[];
  push: (t: Omit<ToastItem, 'id'> & { id?: string }) => string;
  update: (id: string, t: Partial<ToastItem>) => void;
  dismiss: (id: string) => void;
}
const ToastContext = createContext<Api | null>(null);
export function ToastProvider({
  children,
  max = 4,
}: {
  children: ReactNode;
  max?: number;
}) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const dismiss = useCallback(
    (id: string) => setToasts((v) => v.filter((t) => t.id !== id)),
    [],
  );
  const push = useCallback(
    (t: Omit<ToastItem, 'id'> & { id?: string }) => {
      const id = t.id ?? crypto.randomUUID();
      setToasts((v) =>
        [...v.filter((x) => x.id !== id), { ...t, id }].slice(-max),
      );
      return id;
    },
    [max],
  );
  const update = useCallback(
    (id: string, t: Partial<ToastItem>) =>
      setToasts((v) => v.map((x) => (x.id === id ? { ...x, ...t } : x))),
    [],
  );
  const api = useMemo(
    () => ({ toasts, push, update, dismiss }),
    [toasts, push, update, dismiss],
  );
  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastRegion />
    </ToastContext.Provider>
  );
}
export function useToast() {
  const v = useContext(ToastContext);
  if (!v) throw new Error('useToast must be used inside ToastProvider');
  return v;
}
export function Toast({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: () => void;
}) {
  const [paused, setPaused] = useState(false);
  const [documentHidden, setDocumentHidden] = useState(document.hidden);
  const remaining = useRef(toast.duration ?? 5000);
  const started = useRef(0);
  useEffect(() => {
    const handle = () => setDocumentHidden(document.hidden);
    document.addEventListener('visibilitychange', handle);
    return () => document.removeEventListener('visibilitychange', handle);
  }, []);
  useEffect(() => {
    if (toast.persistent || paused || documentHidden) return;
    started.current = Date.now();
    const timer = window.setTimeout(onDismiss, remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current = Math.max(
        0,
        remaining.current - (Date.now() - started.current),
      );
    };
  }, [paused, documentHidden, onDismiss, toast.persistent]);
  return (
    <article
      className={`tvx-toast tvx-toast--${toast.tone ?? 'info'}`}
      role={toast.tone === 'danger' ? 'alert' : 'status'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div>
        <strong>{toast.title}</strong>
        {toast.message && <p>{toast.message}</p>}
        {toast.action && (
          <Button variant="quiet" onClick={toast.action.onAction}>
            {toast.action.label}
          </Button>
        )}
      </div>
      <IconButton
        icon="×"
        aria-label="Dismiss notification"
        variant="quiet"
        onClick={onDismiss}
      />
    </article>
  );
}
export function ToastRegion() {
  const { toasts, dismiss } = useToast();
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        const latest = toasts.at(-1);
        if (latest) dismiss(latest.id);
      }
    };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [toasts, dismiss]);
  return (
    <div className="tvx-toast-region" role="region" aria-label="Notifications">
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  );
}
