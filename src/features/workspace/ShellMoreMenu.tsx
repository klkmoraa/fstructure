import { useEffect, useRef, useState } from 'react';
import { CircleHelp, Moon, MoreHorizontal, Sun } from 'lucide-react';
import { useI18n } from '../../i18n/useI18n';
import { useWorkspaceUI } from '../../store/WorkspaceUIContext';
import { OPEN_HELP_EVENT } from './WorkspaceHelp';
import './workspaceUtilities.css';

/**
 * Menú «⋯» de las mesas que no tienen uno propio (3D, Diseño, FEM): el tema, y la
 * guía en teléfono. El 2D tiene el suyo, con el documento y la vista.
 */
export function ShellMoreMenu() {
  const { t } = useI18n();
  const { theme, setTheme } = useWorkspaceUI();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return undefined;
    const outside = (event: PointerEvent) => { if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false); };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setOpen(false);
      trigger.current?.focus({ preventScroll: true });
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  const themeLabel = t(theme === 'dark' ? 'theme.light' : 'theme.dark');
  return <div className="workspace-utilities" ref={root}>
    <button ref={trigger} type="button" className={'workspace-topbar__icon-button workspace-utilities__trigger' + (open ? ' is-active' : '')}
      aria-label={t('topbar.more')} title={t('topbar.more')} aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((current) => !current)}>
      <MoreHorizontal size={19} aria-hidden="true" />
    </button>
    {open ? <section className="workspace-utilities__panel" role="dialog" aria-label={t('topbar.more')}>
      <div className="workspace-utilities__list" role="menu">
        <button type="button" role="menuitem" className="workspace-utilities__item workspace-utilities__phone-only" onClick={() => { setOpen(false); window.dispatchEvent(new Event(OPEN_HELP_EVENT)); }}>
          <CircleHelp size={17} aria-hidden="true" /><span>{t('workspace.utilityHelp')}</span>
        </button>
        <button type="button" role="menuitem" className="workspace-utilities__item" onClick={() => { setTheme(theme === 'dark' ? 'light' : 'dark'); setOpen(false); }}>
          {theme === 'dark' ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}<span>{themeLabel}</span>
        </button>
      </div>
    </section> : null}
  </div>;
}
