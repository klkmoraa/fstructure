import { RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../../design-system/components/controls';
import { applyAppUpdate, SETTLE_BEFORE_RELOAD_MS, subscribeAppUpdate } from '../../shared/appUpdate';
import { useI18n } from '../../i18n/useI18n';
import './updateNotice.css';

/** «Nueva versión lista · Recargar»: la persona decide cuándo cambiar de versión. */
export function UpdateNotice() {
  const { language } = useI18n();
  const [ready, setReady] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => subscribeAppUpdate(setReady), []);
  if (!ready || dismissed) return null;
  const text = language === 'es'
    ? { ready: 'Nueva versión lista', reload: 'Recargar', reloading: 'Recargando…', later: 'Después', note: 'Tu trabajo se guarda antes de recargar.' }
    : { ready: 'New version ready', reload: 'Reload', reloading: 'Reloading…', later: 'Later', note: 'Your work is saved before reloading.' };
  const reload = () => {
    setReloading(true);
    window.setTimeout(() => { if (!applyAppUpdate()) setReloading(false); }, SETTLE_BEFORE_RELOAD_MS);
  };
  return <aside className="app-update-notice" role="status" aria-live="polite">
    <span className="app-update-notice__copy"><strong>{text.ready}</strong><small>{text.note}</small></span>
    <Button variant="ghost" size="sm" onClick={() => setDismissed(true)} disabled={reloading}>{text.later}</Button>
    <Button variant="primary" size="sm" onClick={reload} loading={reloading} loadingLabel={text.reloading} leadingIcon={<RefreshCw size={14} aria-hidden="true" />}>{reloading ? text.reloading : text.reload}</Button>
  </aside>;
}
