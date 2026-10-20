import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChevronUp } from 'lucide-react';
import './toolDockMenu.css';

/** A small non-modal picker. Portaling keeps it clear of the canvas and rail clipping. */
export function ToolDockMenu({ label, trigger, activeTool, open, onOpenChange, children }: {
  label: string;
  trigger: ReactNode;
  activeTool?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<CSSProperties>({});

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(270, window.innerWidth - 24);
      const above = rect.top > window.innerHeight / 2;
      setPosition({
        width,
        left: Math.max(12, Math.min(window.innerWidth - width - 12, rect.left + rect.width / 2 - width / 2)),
        ...(above ? { bottom: window.innerHeight - rect.top + 10 } : { top: rect.bottom + 10 }),
        maxHeight: Math.max(120, above ? rect.top - 22 : window.innerHeight - rect.bottom - 22),
      });
    };
    place();
    panelRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true });
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: Event) => {
      const target = event.target;
      if (target instanceof Node && !panelRef.current?.contains(target) && !triggerRef.current?.contains(target)) onOpenChange(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onOpenChange(false);
      triggerRef.current?.focus({ preventScroll: true });
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('focusin', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open, onOpenChange]);

  return <>
    <button ref={triggerRef} type="button" className="tool-dock-menu__trigger"
      aria-label={label} title={label} aria-haspopup="dialog" aria-expanded={open}
      aria-controls={open ? id : undefined} aria-pressed={Boolean(activeTool)} data-active-tool={activeTool}
      onClick={() => onOpenChange(!open)}>
      {trigger}<ChevronUp size={12} aria-hidden="true" />
    </button>
    {open && createPortal(<div id={id} ref={panelRef} className="tool-dock-menu__panel" role="dialog" aria-label={label} style={position}
      onClick={(event) => {
        if (!(event.target instanceof Element) || !event.target.closest('button:not(:disabled)')) return;
        onOpenChange(false);
        triggerRef.current?.focus({ preventScroll: true });
      }}>
      {children}
    </div>, document.body)}
  </>;
}
