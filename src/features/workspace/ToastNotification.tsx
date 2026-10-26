import { useCallback, useEffect, useState, type Ref } from 'react';
import { CheckCircle2, CircleAlert, Info, TriangleAlert, X } from 'lucide-react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import './analysisFeedback.css';
import { useI18n } from '../../i18n/useI18n';
import { emitWorkspaceCommand, onWorkspaceCommand, type WorkspaceToast } from './workspaceCommands';

interface ToastItem extends WorkspaceToast {
  id: string;
  tone: 'success' | 'info' | 'warning' | 'error';
  durationMs: number;
}

/** Timers belong to the visible notice; focus and hover pause expiration. */
function ToastCard({ toast, dismiss, closeLabel, ref }: {
  ref?: Ref<HTMLDivElement>;
  toast: ToastItem;
  dismiss: (id: string) => void;
  closeLabel: string;
}) {
  const reducedMotion = useReducedMotion();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (toast.durationMs <= 0 || hovered || focused) return;
    const timer = window.setTimeout(() => dismiss(toast.id), toast.durationMs);
    return () => window.clearTimeout(timer);
  }, [toast, dismiss, hovered, focused]);
  const Icon = toast.tone === 'success' ? CheckCircle2
    : toast.tone === 'warning' ? TriangleAlert : toast.tone === 'error' ? CircleAlert : Info;
  return (
    <m.div
      ref={ref}
      layout
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.94 }}
      animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
      exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: -10 }}
      transition={reducedMotion ? { duration: 0.01 } : { type: 'spring', stiffness: 420, damping: 28 }}
      className={`sc-toast-card sc-toast-card--${toast.tone}`}
      role={toast.tone === 'error' ? 'alert' : 'status'}
      aria-live={toast.tone === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false); }}
    >
      <span className="sc-toast-card__icon" aria-hidden="true"><Icon size={18} /></span>
      <div className="sc-toast-card__content">
        <strong className="sc-toast-card__title">{toast.message}</strong>
        {toast.description ? <p className="sc-toast-card__desc">{toast.description}</p> : null}
        {toast.action ? (
          <button type="button" className="sc-toast-card__action" onClick={event => {
            if (toast.action?.command === 'open-model-doctor') emitWorkspaceCommand('open-model-doctor');
            else if (toast.action?.command === 'open-results') emitWorkspaceCommand('open-results', { trigger: event.currentTarget });
            dismiss(toast.id);
          }}>{toast.action.label}</button>
        ) : null}
      </div>
      <button type="button" className="sc-toast-card__close" aria-label={closeLabel} onClick={() => dismiss(toast.id)}>
        <X size={14} />
      </button>
    </m.div>
  );
}

/** Max four notices. A stable id replaces a notice instead of covering the canvas again. */
export const ToastNotification = () => {
  const { t } = useI18n();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const dismiss = useCallback((id: string) => setToasts(previous => previous.filter(item => item.id !== id)), []);
  useEffect(() => onWorkspaceCommand('show-toast', payload => {
    const id = payload.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const toast: ToastItem = { ...payload, id, tone: payload.tone ?? 'success', durationMs: payload.durationMs ?? 3200 };
    setToasts(previous => [...previous.filter(item => item.id !== id).slice(-3), toast]);
  }), []);
  return (
    <div className="sc-toast-container" role="region" aria-label={t('toast.regionLabel')}>
      <AnimatePresence mode="popLayout">
        {toasts.map(toast => <ToastCard key={toast.id} toast={toast} dismiss={dismiss} closeLabel={t('toast.dismiss')} />)}
      </AnimatePresence>
    </div>
  );
};
