import { Check, ChevronDown, Copy, PanelLeft, PanelRight } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ToolButton } from '../../../design-system/components/editor';
import { DESIGN_CODE_IDS, designCode, isDesignCodeId, type DesignCodeId } from '../../../design/elements/codes';
import { ShellContribution } from '../../workspace/ShellToolSlots';
import { BeamWorkbench } from './BeamWorkbench';
import { ColumnWorkbench } from './ColumnWorkbench';
import { FootingWorkbench } from './FootingWorkbench';
import type { WorkbenchChrome, WorkbenchPanel } from './WorkbenchLayout';
import { useWorkbenchStorage } from './workbenchStorage';
import './designWorkbench.css';

type ElementKind = 'beam' | 'column' | 'footing';

const icon = (children: ReactNode) => <svg className="dw-element-icon" viewBox="0 0 24 24" aria-hidden="true">{children}</svg>;
const ELEMENTS: { id: ElementKind; label: string; icon: ReactNode }[] = [
  { id: 'beam', label: 'Viga', icon: icon(<><rect x="2" y="8" width="20" height="5" rx="1" /><path d="M4 13l-2 4h4zM20 13l-2 4h4z" /></>) },
  { id: 'column', label: 'Columna', icon: icon(<><rect x="8.5" y="2" width="7" height="17" rx="1" /><path d="M4 21.5h16" /></>) },
  { id: 'footing', label: 'Zapata', icon: icon(<><rect x="9.5" y="3" width="5" height="9" rx="1" /><rect x="3" y="12" width="18" height="6" rx="1" /></>) },
];

const isElementKind = (value: unknown): value is ElementKind => ELEMENTS.some((item) => item.id === value);

/** Anchos de la mesa: en `wide` caben los dos paneles junto al lienzo; en `narrow` sólo uno; en `phone` son hojas inferiores. */
type Room = 'wide' | 'narrow' | 'phone';
const readRoom = (): Room => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'wide';
  if (window.matchMedia('(max-width: 760px)').matches) return 'phone';
  return window.matchMedia('(max-width: 1240px)').matches ? 'narrow' : 'wide';
};
const initialPanels = (room: Room): Record<WorkbenchPanel, boolean> =>
  room === 'wide' ? { inputs: true, results: true } : room === 'narrow' ? { inputs: true, results: false } : { inputs: false, results: false };

export function DesignWorkbench({ nativeTool = true, startElement, startCode }: {
  nativeTool?: boolean;
  /** Elemento elegido en la bienvenida de Diseño; gana al último guardado. */
  startElement?: ElementKind;
  /** Norma elegida en la bienvenida de Diseño. */
  startCode?: string;
}) {
  const storage = useWorkbenchStorage();
  const [element, setElementState] = useState<ElementKind>(() => {
    if (startElement) return startElement;
    const stored = storage.read('element');
    return isElementKind(stored) ? stored : 'beam';
  });
  const [code, setCodeState] = useState<DesignCodeId>(() => {
    if (isDesignCodeId(startCode)) return startCode;
    const stored = storage.read('code');
    return isDesignCodeId(stored) ? stored : 'ntc-2023';
  });
  // Lo elegido en la bienvenida se guarda como el nuevo último estado del taller.
  useEffect(() => {
    if (startElement) storage.write('element', startElement);
    if (isDesignCodeId(startCode)) storage.write('code', startCode);
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [memo, setMemo] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  // Cada elemento monta su propia barra; el foco del teclado se mueve cuando ya existe la nueva.
  const [focusRequest, setFocusRequest] = useState(0);
  useEffect(() => {
    if (focusRequest > 0) buttons.current[ELEMENTS.findIndex((item) => item.id === element)]?.focus();
  }, [element, focusRequest]);

  // Paneles: preferencia de la sesión, no se guarda en el proyecto.
  const room = useRef<Room>(readRoom());
  const [panels, setPanels] = useState(() => initialPanels(room.current));
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const queries = [window.matchMedia('(max-width: 760px)'), window.matchMedia('(max-width: 1240px)')];
    const onChange = () => {
      const next = readRoom();
      if (next === room.current) return;
      room.current = next;
      setPanels(initialPanels(next));
    };
    queries.forEach((query) => query.addEventListener('change', onChange));
    return () => queries.forEach((query) => query.removeEventListener('change', onChange));
  }, []);
  const setPanel = useCallback((panel: WorkbenchPanel, open: boolean) => setPanels((current) => {
    // Sin espacio para los dos, abrir uno cierra el otro.
    if (open && room.current !== 'wide') return { inputs: panel === 'inputs', results: panel === 'results' };
    return { ...current, [panel]: open };
  }), []);

  const setElement = (next: ElementKind) => {
    setElementState(next);
    setCopied(false);
    storage.write('element', next);
  };

  const setCode = (next: string) => {
    if (!isDesignCodeId(next)) return;
    setCodeState(next);
    storage.write('code', next);
  };

  const onMemo = useCallback((nextMemo: string | null) => {
    setMemo(nextMemo);
    setCopied(false);
  }, []);

  const copyMemo = async () => {
    if (!memo) return;
    try {
      await navigator.clipboard.writeText(memo);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const steps: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    let next = index;
    if (event.key in steps) next = (index + steps[event.key]! + ELEMENTS.length) % ELEMENTS.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = ELEMENTS.length - 1;
    else return;
    event.preventDefault();
    setElement(ELEMENTS[next]!.id);
    setFocusRequest((count) => count + 1);
  };

  const dock = <div className="dw-dock">
    <div className="dw-dock__group" role="radiogroup" aria-label="Elemento a diseñar">
      {ELEMENTS.map((item, index) => <ToolButton
        key={item.id}
        ref={(node) => { buttons.current[index] = node; }}
        role="radio"
        aria-checked={element === item.id}
        tabIndex={element === item.id ? 0 : -1}
        label={item.label}
        icon={item.icon}
        active={element === item.id}
        className="dw-dock__button"
        onClick={() => setElement(item.id)}
        onKeyDown={(event) => onKeyDown(event, index)}
      />)}
    </div>
    <span className="dw-dock__divider" aria-hidden="true" />
    <ToolButton label="Datos" icon={<PanelLeft size={18} />} active={panels.inputs} className="dw-dock__toggle" onClick={() => setPanel('inputs', !panels.inputs)} />
    <ToolButton label="Resultados" icon={<PanelRight size={18} />} active={panels.results} className="dw-dock__toggle" onClick={() => setPanel('results', !panels.results)} />
  </div>;
  const codeControl = <label className="dw-code-chip" title={`${designCode(code).name} · ${designCode(code).country}`}>
    <select aria-label="Norma de diseño" value={code} onChange={(event) => setCode(event.currentTarget.value)}>
      {DESIGN_CODE_IDS.map((id) => <option key={id} value={id}>{designCode(id).name}</option>)}
    </select>
    <ChevronDown size={14} aria-hidden="true" />
  </label>;
  const chrome: WorkbenchChrome = { dock, codeControl, code, panels, setPanel, onMemo };

  return <div className="design-workbench" data-testid="design-workbench">
    {nativeTool ? <ShellContribution slot="action">
      <button type="button" className="workspace-topbar__action-button is-primary" disabled={!memo} onClick={copyMemo}
        aria-label={copied ? 'Memoria copiada' : 'Copiar memoria de cálculo'}>
        {copied ? <Check size={17} aria-hidden="true" /> : <Copy size={17} aria-hidden="true" />}
        <span>{copied ? 'Copiada' : 'Copiar memoria'}</span>
      </button>
    </ShellContribution> : null}

    {element === 'beam' ? <BeamWorkbench chrome={chrome} />
      : element === 'column' ? <ColumnWorkbench chrome={chrome} />
        : <FootingWorkbench chrome={chrome} />}
  </div>;
}
