import { Check, Copy, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Select } from '../../../design-system/components/controls';
import { ToolButton } from '../../../design-system/components/editor';
import { DESIGN_CODE_IDS, designCode, isDesignCodeId, type DesignCodeId } from '../../../design/elements/codes';
import { ShellContribution } from '../../workspace/ShellToolSlots';
import { BeamWorkbench } from './BeamWorkbench';
import { ColumnWorkbench } from './ColumnWorkbench';
import { FootingWorkbench } from './FootingWorkbench';
import type { WorkbenchChrome } from './WorkbenchLayout';
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

export type DesignElementKind = ElementKind;

export function DesignWorkbench({ nativeTool = true, onClose, startElement, startCode }: {
  nativeTool?: boolean;
  onClose?: () => void;
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
  const [status, setStatus] = useState('');
  const [memo, setMemo] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  // Cada elemento monta su propia barra; el foco del teclado se mueve cuando ya existe la nueva.
  const [focusRequest, setFocusRequest] = useState(0);
  useEffect(() => {
    if (focusRequest > 0) buttons.current[ELEMENTS.findIndex((item) => item.id === element)]?.focus();
  }, [element, focusRequest]);

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

  const onStatus = useCallback((text: string, nextMemo: string | null) => {
    setStatus(text);
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

  const dock = <div className="dw-dock" role="radiogroup" aria-label="Elemento a diseñar">
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
  </div>;
  const close = onClose
    ? <button type="button" className="dw-float-button dw-close" aria-label="Cerrar Diseño" title="Volver al inicio" onClick={onClose}><X size={17} aria-hidden="true" /></button>
    : null;
  const codeControl = <div className="dw-code">
    <Select label="Norma de diseño" value={code} onChange={(event) => setCode(event.currentTarget.value)}>
      {DESIGN_CODE_IDS.map((id) => <option key={id} value={id}>{`${designCode(id).name} · ${designCode(id).country}`}</option>)}
    </Select>
    <small>{designCode(code).summary}</small>
  </div>;
  const chrome: WorkbenchChrome = { overlay: <>{dock}{close}</>, onStatus, code, codeControl };

  return <div className="design-workbench" data-testid="design-workbench">
    {nativeTool ? <>
      <ShellContribution slot="action">
        <button type="button" className="workspace-topbar__action-button is-primary" disabled={!memo} onClick={copyMemo}>
          {copied ? <Check size={17} aria-hidden="true" /> : <Copy size={17} aria-hidden="true" />}
          <span>{copied ? 'Memoria copiada' : 'Copiar memoria'}</span>
        </button>
      </ShellContribution>
      <ShellContribution slot="status"><span role="status">{status}</span></ShellContribution>
    </> : null}

    {element === 'beam' ? <BeamWorkbench chrome={chrome} />
      : element === 'column' ? <ColumnWorkbench chrome={chrome} />
        : <FootingWorkbench chrome={chrome} />}
  </div>;
}
