import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { PanelRight, X } from 'lucide-react';

type Slot = 'controls' | 'action' | 'status' | 'inspector' | 'mobile';
interface Slots {
  hosts: Partial<Record<Slot, HTMLElement | null>>;
  register: (slot: Slot, host: HTMLElement | null) => void;
  mobile: boolean;
  open: boolean;
  show: (trigger: HTMLElement) => void;
  close: () => void;
}
const Context = createContext<Slots | null>(null);
// oxlint-disable-next-line react/only-export-components
export const useShellInspector = () => useContext(Context);

/** Neutral DOM destinations: lazy adapters retain their own state and React context. */
export function ShellToolSlotsProvider({ mobile, children, tool }: { mobile: boolean; children: ReactNode; tool?: string }) {
  const [hosts, setHosts] = useState<Slots['hosts']>({});
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [tool]);
  const trigger = useRef<HTMLElement | null>(null);
  const register = useCallback((slot: Slot, host: HTMLElement | null) => setHosts((current) => current[slot] === host ? current : { ...current, [slot]: host }), []);
  const show = useCallback((element: HTMLElement) => { trigger.current = element; setOpen(true); }, []);
  const close = useCallback(() => { setOpen(false); trigger.current?.focus({ preventScroll: true }); }, []);
  const value = useMemo(() => ({ hosts, register, mobile, open, show, close }), [hosts, register, mobile, open, show, close]);
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
export function ShellInspectorTrigger() {
  const slots = useContext(Context);
  if (!slots?.mobile) return null;
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
  if (!slots.mobile) return <aside className="shell-tool-inspector"><ShellSlotHost slot="inspector" /></aside>;
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
