import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { PanelRight, X } from 'lucide-react';

/**
 * `statusbar` y `dock` viven al pie del shell, donde FStructure 2D pinta su
 * franja de estado y su dock móvil: una herramienta aislada los ocupa sin
 * conocer el shell.
 */
type Slot = 'controls' | 'action' | 'status' | 'inspector' | 'mobile' | 'statusbar' | 'dock';
interface Slots {
  hosts: Partial<Record<Slot, HTMLElement | null>>;
  register: (slot: Slot, host: HTMLElement | null) => void;
  mobile: boolean;
  open: boolean;
  show: (trigger: HTMLElement) => void;
  close: () => void;
  /** Escritorio: el inspector se pliega para dar el ancho al lienzo, como en 2D. */
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  /** Muestra el inspector: abre la hoja en un teléfono o lo despliega en escritorio. */
  reveal: (trigger: HTMLElement) => void;
}
const Context = createContext<Slots | null>(null);
// oxlint-disable-next-line react/only-export-components
export const useShellInspector = () => useContext(Context);

/** Neutral DOM destinations: lazy adapters retain their own state and React context. */
export function ShellToolSlotsProvider({ mobile, children, tool }: { mobile: boolean; children: ReactNode; tool?: string }) {
  const [hosts, setHosts] = useState<Slots['hosts']>({});
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => { setOpen(false); setCollapsed(false); }, [tool]);
  const trigger = useRef<HTMLElement | null>(null);
  const register = useCallback((slot: Slot, host: HTMLElement | null) => setHosts((current) => current[slot] === host ? current : { ...current, [slot]: host }), []);
  const show = useCallback((element: HTMLElement) => { trigger.current = element; setOpen(true); }, []);
  const close = useCallback(() => { setOpen(false); trigger.current?.focus({ preventScroll: true }); }, []);
  const reveal = useCallback((element: HTMLElement) => { if (mobile) show(element); else setCollapsed(false); }, [mobile, show]);
  const value = useMemo(() => ({ hosts, register, mobile, open, show, close, collapsed, setCollapsed, reveal }),
    [hosts, register, mobile, open, show, close, collapsed, reveal]);
  return <Context value={value}>{children}</Context>;
}
export function ShellSlotHost({ slot }: { slot: Slot }) {
  const register = useContext(Context)?.register;
  const ref = useCallback((host: HTMLDivElement | null) => register?.(slot, host), [register, slot]);
  return <div ref={ref} data-shell-slot={slot} className={`shell-tool-slot shell-tool-slot--${slot}`} />;
}
export function ShellContribution({ slot, children }: { slot: Slot; children: ReactNode }) {
  const host = useContext(Context)?.hosts[slot];
  return host ? createPortal(children, host) : null;
}
export function ShellMobileSurface({ children }: { children: ReactNode }) {
  const slots = useContext(Context);
  return slots?.mobile ? slots.hosts.mobile ? createPortal(children, slots.hosts.mobile) : null : children;
}
export type ShellStatusTone = 'neutral' | 'running' | 'ok' | 'warn' | 'error';

/**
 * Estado de una herramienta en la barra superior, con la misma forma que el
 * del Modelo 2D: un punto de color, una palabra y, si toca, la insignia
 * «Experimental» aparte. En un teléfono queda sólo el punto junto al nombre
 * del proyecto; la frase completa sigue en el título y en el lector.
 */
export function ShellStatusChip({ tone, label, badge, detail }: { tone: ShellStatusTone; label: string; badge?: string; detail?: string }) {
  return <span className="workspace-topbar__status-chip workspace-topbar__tool-status" data-tone={tone} role="status"
    title={[label, badge, detail].filter(Boolean).join(' · ')}>
    <span className="workspace-topbar__status-dot" aria-hidden="true" />
    <span className="workspace-topbar__tool-status-copy"><strong>{label}</strong></span>
    {badge ? <em className="workspace-topbar__status-badge">{badge}</em> : null}
  </span>;
}

export function ShellInspectorTrigger({ label = 'Panel' }: { label?: string }) {
  const slots = useContext(Context);
  if (!slots) return null;
  // En escritorio es el mismo interruptor que «Experiencia de cálculo» en 2D:
  // pliega o despliega el panel lateral y dice su estado.
  if (!slots.mobile) return <button type="button" className={'workspace-topbar__action-button workspace-topbar__inspector-button' + (slots.collapsed ? '' : ' is-active')}
    aria-label="Inspector de herramienta" aria-pressed={!slots.collapsed} title={label}
    onClick={() => slots.setCollapsed(!slots.collapsed)}><PanelRight size={17} aria-hidden="true" /><span>{label}</span></button>;
  return <button type="button" className="workspace-topbar__icon-button" aria-label="Inspector de herramienta"
    aria-haspopup="dialog" aria-expanded={slots.open} onClick={(event) => slots.show(event.currentTarget)}><PanelRight size={17} aria-hidden="true" /></button>;
}
export function ShellInspectorHost() {
  const slots = useContext(Context);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element || !slots?.mobile) return;
    if (slots.open) {
      if (element.showModal) element.showModal();
      else element.setAttribute('open', '');
      element.querySelector<HTMLButtonElement>('button')?.focus();
    } else if (element.close) element.close();
    else element.removeAttribute('open');
  }, [slots?.open, slots?.mobile]);
  if (!slots) return null;
  if (!slots.mobile) return <aside className="shell-tool-inspector" data-collapsed={slots.collapsed || undefined}><ShellSlotHost slot="inspector" /></aside>;
  return <ShellMobileSurface><dialog ref={dialog} className="shell-mobile-sheet" aria-label="Inspector de herramienta" aria-modal="true"
    onCancel={(event) => { event.preventDefault(); slots.close(); }}
    onKeyDown={(event) => {
      if (event.key === 'Escape') { event.preventDefault(); slots.close(); }
      if (event.key !== 'Tab') return;
      const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), input, select, textarea, a[href], [tabindex="0"]')];
      const first = controls[0]; const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>
    <button type="button" className="workspace-topbar__icon-button" aria-label="Cerrar inspector de herramienta" onClick={slots.close}><X size={18} aria-hidden="true" /></button>
    <ShellSlotHost slot="inspector" />
  </dialog></ShellMobileSurface>;
}
