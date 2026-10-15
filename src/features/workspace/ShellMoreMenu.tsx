import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CircleHelp, Moon, MoreHorizontal, Sun } from 'lucide-react';
import { useI18n } from '../../i18n/useI18n';
import { useWorkspaceUI } from '../../store/WorkspaceUIContext';
import { OPEN_HELP_EVENT } from './WorkspaceHelp';
import './workspaceUtilities.css';

/**
 * Menú «⋯» de las mesas que no tienen uno propio (3D y Diseño): el tema, y la
 * guía en teléfono. El 2D tiene el suyo, con el documento y la vista.
 *
 * `tools`: en teléfono, los controles de la herramienta (deshacer, traer del
 * 2D, panel, memoria…) que en escritorio van en la barra. Elegir uno cierra el
 * menú y devuelve el foco a «⋯» (un diálogo que se abra lo toma después).
 */
export function ShellMoreMenu({ tools }: { tools?: ReactNode } = {}) {
  const { t } = useI18n();
  const { theme, setTheme } = useWorkspaceUI();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const toolGroup = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return undefined;
    const outside = (event: PointerEvent) => { if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false); };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setOpen(false);
      trigger.current?.focus({ preventScroll: true });
    };
    // Los controles llegan por portal desde la herramienta: su clic no burbujea
    // por React hasta aquí, así que se escucha en el documento, después del suyo.
    const picked = (event: MouseEvent) => {
      const button = event.target instanceof Element ? event.target.closest('button') : null;
      if (!button || !toolGroup.current?.contains(button)) return;
      setOpen(false);
      trigger.current?.focus({ preventScroll: true });
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    document.addEventListener('click', picked);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); document.removeEventListener('click', picked); };
  }, [open]);
  const themeLabel = t(theme === 'dark' ? 'theme.light' : 'theme.dark');
  return <div className="workspace-utilities" ref={root}>
    <button ref={trigger} type="button" className={'workspace-topbar__icon-button workspace-utilities__trigger' + (open ? ' is-active' : '')}
      aria-label={t('topbar.more')} title={t('topbar.more')} aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((current) => !current)}>
      <MoreHorizontal size={19} aria-hidden="true" />
    </button>
    {open ? <section className="workspace-utilities__panel" role="dialog" aria-label={t('topbar.more')}>
      {tools ? <div ref={toolGroup} className="workspace-utilities__tools" role="group" aria-label={t('toolbar.primary')}>{tools}</div> : null}
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
