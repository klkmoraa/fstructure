import { BookOpen, Check, ChevronDown, Copy, FileDown, PanelRight, Redo2, Undo2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ToolButton } from '../../../design-system/components/editor';
import { DESIGN_CODE_IDS, designCode, isDesignCodeId, type DesignCodeId } from '../../../design/elements/codes';
import { ShellContribution, ShellStatusChip, type ShellStatusTone } from '../../workspace/ShellToolSlots';
import { BeamWorkbench } from './BeamWorkbench';
import { ColumnWorkbench } from './ColumnWorkbench';
import { ConcreteStudio } from './ConcreteStudio';
import { FootingWorkbench } from './FootingWorkbench';
import { FrameWorkbench } from './FrameWorkbench';
import type { DraftHistory } from './common';
import type { ExternalStructureAxes, ExternalStructureSource } from '../../../design/elements/structure';
import { MemoryDialog, MemoryStatus, useDesignMemory } from './designMemory';
import { memoText, reportHeading, type DesignReport } from './designReport';
import type { Verdict, WorkbenchChrome, WorkbenchPanel } from './WorkbenchLayout';
import { useWorkbenchStorage } from './workbenchStorage';
import './designWorkbench.css';
import type { ConcreteFrameSpec } from '../../../data/concreteFrame';

type ElementKind = 'beam' | 'column' | 'frame' | 'footing' | 'section';

const icon = (children: ReactNode) => <svg className="dw-element-icon" viewBox="0 0 24 24" aria-hidden="true">{children}</svg>;
const ELEMENTS: { id: ElementKind; label: string; icon: ReactNode }[] = [
  { id: 'frame', label: 'Estructura', icon: icon(<><path d="M5 21.5V4.5M19 21.5V4.5M3 5h18M5 12.5h14" /><path d="M2.5 21.5h5M16.5 21.5h5" /></>) },
  { id: 'beam', label: 'Viga', icon: icon(<><rect x="2" y="8" width="20" height="5" rx="1" /><path d="M4 13l-2 4h4zM20 13l-2 4h4z" /></>) },
  { id: 'column', label: 'Columna', icon: icon(<><rect x="8.5" y="2" width="7" height="17" rx="1" /><path d="M4 21.5h16" /></>) },
  { id: 'footing', label: 'Zapata', icon: icon(<><rect x="9.5" y="3" width="5" height="9" rx="1" /><rect x="3" y="12" width="18" height="6" rx="1" /></>) },
  { id: 'section', label: 'Secciones', icon: icon(<><path d="M8 2h8l6 6v8l-6 6H8l-6-6V8z" /><path d="M8 8h8v8H8z" /></>) },
];

const isElementKind = (value: unknown): value is ElementKind => ELEMENTS.some((item) => item.id === value);

const VERDICT_TONE: Record<Verdict['status'], ShellStatusTone> = { pass: 'ok', warning: 'warn', fail: 'error', error: 'warn' };

/** Anchos de la mesa: en `wide` caben los dos paneles junto al lienzo; en `narrow` sólo uno; en `phone` son hojas inferiores. */
type Room = 'wide' | 'narrow' | 'phone';
const readRoom = (): Room => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'wide';
  if (window.matchMedia('(max-width: 760px)').matches) return 'phone';
  return window.matchMedia('(max-width: 1240px)').matches ? 'narrow' : 'wide';
};
const initialPanels = (room: Room): Record<WorkbenchPanel, boolean> =>
  room === 'wide' ? { inputs: true, results: true } : room === 'narrow' ? { inputs: true, results: false } : { inputs: false, results: false };

export function DesignWorkbench({ nativeTool = true, startElement, startCode, startSource, projectName, modelSource = null, modelAxes = null, onOpenModel, onOpenSpace3D, onCreateModel }: {
  nativeTool?: boolean;
  /** Modelo 2D del proyecto traducido por la frontera; sin él la estructura sólo se genera aquí. */
  modelSource?: ExternalStructureSource | null;
  /** Ejes diseñables del Modelo 3D del proyecto, traducidos por la misma frontera. */
  modelAxes?: ExternalStructureAxes | null;
  /** Vuelve al modo 2D de la mesa. */
  onOpenModel?: () => void;
  /** Abre el modo 3D de la mesa. */
  onOpenSpace3D?: () => void;
  /** Escribe el pórtico rápido en el Modelo 2D (deshacible en Modelo). */
  onCreateModel?: (spec: ConcreteFrameSpec) => void;
  /** Fuente de la estructura pedida desde fuera («Diseñar el modelo»). */
  startSource?: 'frame' | 'model' | 'model3d';
  /** Nombre del proyecto abierto: encabeza la memoria. */
  projectName?: string;
  /** Elemento elegido en la bienvenida de Diseño; gana al último guardado. */
  startElement?: ElementKind;
  /** Norma elegida en la bienvenida de Diseño. */
  startCode?: string;
}) {
  const storage = useWorkbenchStorage();
  const [element, setElementState] = useState<ElementKind>(() => {
    if (startElement) return startElement;
    const stored = storage.read('element');
    // En la mesa de FStructure se empieza por diseñar el modelo.
    return isElementKind(stored) ? stored : 'frame';
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
  const [report, setReport] = useState<DesignReport | null>(null);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const memory = useDesignMemory(storage, element, code, report);
  const [memoryOpen, setMemoryOpen] = useState(false);
  // Abrir un elemento de la memoria vuelve a montar su formulario para que lea el borrador cargado.
  const [loadCount, setLoadCount] = useState(0);
  // Deshacer/rehacer del formulario activo; cada elemento entrega el suyo al montarse.
  const history = useRef<DraftHistory | null>(null);
  const [historyFlags, setHistoryFlags] = useState({ canUndo: false, canRedo: false });
  const onHistory = useCallback((next: DraftHistory) => {
    history.current = next;
    setHistoryFlags((current) => current.canUndo === next.canUndo && current.canRedo === next.canRedo ? current : { canUndo: next.canUndo, canRedo: next.canRedo });
  }, []);
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.defaultPrevented || !(event.ctrlKey || event.metaKey) || event.altKey || event.key.toLowerCase() !== 'z') return;
      // En un campo de texto, Ctrl/⌘+Z es del campo.
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      const current = history.current;
      if (!current) return;
      event.preventDefault();
      if (event.shiftKey) current.redo(); else current.undo();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
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

  const onReport = useCallback((next: DesignReport | null) => {
    setReport(next);
    setCopied(false);
  }, []);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const onVerdict = useCallback((next: Verdict) => setVerdict((current) =>
    current && current.status === next.status && current.label === next.label ? current : next), []);
  const anyPanelOpen = panels.inputs || panels.results;
  // «Panel» de la barra, como en las demás mesas: pliega o despliega los dos paneles.
  const togglePanels = () => setPanels(anyPanelOpen ? { inputs: false, results: false } : initialPanels(room.current === 'phone' ? 'narrow' : room.current));

  const copyMemo = async () => {
    if (!report) return;
    setExportMessage(null);
    try {
      await navigator.clipboard.writeText(memoText(report));
      setCopied(true);
    } catch {
      setCopied(false);
      setExportMessage('No se pudo copiar la memoria. Puedes exportarla en PDF o volver a intentarlo.');
    }
  };

  // El PDF se arma sólo al pedirlo: pdf-lib no entra en la carga inicial de la mesa.
  const exportPdf = async (reports: readonly DesignReport[], name: string) => {
    if (!reports.length || exporting) return;
    setExporting(true);
    setExportMessage(null);
    try {
      const [{ buildDesignMemoriaPdf }, { shareOrDownloadPortableBytes }] = await Promise.all([
        import('./designReportPdf'),
        import('../../../utils/portableDownload'),
      ]);
      const bytes = await buildDesignMemoriaPdf(reports, { projectName });
      const slug = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w -]/g, ' ').trim().replace(/\s+/g, '-').toLowerCase() || 'diseno';
      await shareOrDownloadPortableBytes(bytes, `memoria-${slug}.pdf`, 'application/pdf', 'Memoria de diseño');
    } catch {
      setExportMessage('No se pudo generar el PDF. Revisa los datos e inténtalo de nuevo.');
    } finally {
      setExporting(false);
    }
  };
  const saveToMemory = () => { if (memory.save() === 'full') setMemoryOpen(true); };
  const loadFromMemory = (id: string) => {
    const item = memory.open(id);
    if (!item) return;
    setElementState(item.element);
    if (isDesignCodeId(item.code)) setCodeState(item.code);
    setLoadCount((count) => count + 1);
    setMemoryOpen(false);
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

  const elements = <div className="dw-dock__group" role="radiogroup" aria-label="Elemento a diseñar">
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
  const codeControl = <label className="dw-code-chip" title={`${designCode(code).name} · ${designCode(code).country}`}>
    <select aria-label="Norma de diseño" value={code} onChange={(event) => setCode(event.currentTarget.value)}>
      {DESIGN_CODE_IDS.map((id) => <option key={id} value={id}>{designCode(id).name}</option>)}
    </select>
    <ChevronDown size={14} aria-hidden="true" />
  </label>;
  const memoryBar = <MemoryStatus memory={memory} element={element} onSave={saveToMemory} onOpen={() => setMemoryOpen(true)} />;
  const chrome: WorkbenchChrome = {
    elements, codeControl, code, panels, setPanel, onReport, memoryBar, onHistory, modelSource, modelAxes,
    ...(nativeTool ? { onVerdict } : {}),
    ...(onOpenModel ? { onOpenModel } : {}),
    ...(onOpenSpace3D ? { onOpenSpace3D } : {}),
    ...(onCreateModel ? { onCreateModel } : {}),
    ...(startSource ? { startSource } : {}),
  };

  return <div className="design-workbench" data-testid="design-workbench">
    {exportMessage && !memoryOpen ? <p className="dw-action-feedback" role="alert">{exportMessage}<button type="button" aria-label="Cerrar aviso" onClick={() => setExportMessage(null)}>×</button></p> : null}
    {nativeTool ? <ShellContribution slot="controls">
      <button type="button" className="workspace-topbar__icon-button dw-topbar-history" onClick={() => history.current?.undo()} disabled={!historyFlags.canUndo}
        aria-label="Deshacer" title="Deshacer (Ctrl/⌘ Z)"><Undo2 size={17} aria-hidden="true" /></button>
      <button type="button" className="workspace-topbar__icon-button dw-topbar-history" onClick={() => history.current?.redo()} disabled={!historyFlags.canRedo}
        aria-label="Rehacer" title="Rehacer (Ctrl/⌘ Mayús Z)"><Redo2 size={17} aria-hidden="true" /></button>
      <button type="button" className={'workspace-topbar__action-button workspace-topbar__inspector-button' + (anyPanelOpen ? ' is-active' : '')}
        aria-label="Paneles de datos y resultados" aria-pressed={anyPanelOpen} title="Panel" onClick={togglePanels}>
        <PanelRight size={17} aria-hidden="true" /><span>Panel</span>
      </button>
    </ShellContribution> : null}
    {nativeTool && verdict ? <ShellContribution slot="status">
      <ShellStatusChip tone={VERDICT_TONE[verdict.status]} label={verdict.label} badge="Experimental" />
    </ShellContribution> : null}
    {nativeTool ? <ShellContribution slot="action">
      <button type="button" className="workspace-topbar__action-button" onClick={() => setMemoryOpen(true)}
        aria-label={`Memoria del proyecto, ${memory.items.length} ${memory.items.length === 1 ? 'elemento' : 'elementos'}`} title="Memoria del proyecto">
        <BookOpen size={17} aria-hidden="true" /><span>Memoria{memory.items.length ? ` · ${memory.items.length}` : ''}</span>
      </button>
      <button type="button" className="workspace-topbar__action-button" disabled={!report || exporting} onClick={() => report && exportPdf([report], reportHeading(report))}
        aria-label="Exportar este elemento en PDF" title="Memoria en PDF de este elemento">
        <FileDown size={17} aria-hidden="true" /><span>{exporting ? 'Generando…' : 'PDF'}</span>
      </button>
      <button type="button" className="workspace-topbar__action-button is-primary" disabled={!report} onClick={copyMemo}
        aria-label={copied ? 'Memoria copiada' : 'Copiar memoria de cálculo'}>
        {copied ? <Check size={17} aria-hidden="true" /> : <Copy size={17} aria-hidden="true" />}
        <span>{copied ? 'Copiada' : 'Copiar memoria'}</span>
      </button>
    </ShellContribution> : null}

    {element === 'beam' ? <BeamWorkbench key={loadCount} chrome={chrome} />
      : element === 'column' ? <ColumnWorkbench key={loadCount} chrome={chrome} />
        : element === 'frame' ? <FrameWorkbench key={loadCount} chrome={chrome} />
        : element === 'footing' ? <FootingWorkbench key={loadCount} chrome={chrome} />
          : <ConcreteStudio key={loadCount} chrome={chrome} />}
    <MemoryDialog open={memoryOpen} onOpenChange={setMemoryOpen} memory={memory} element={element} onLoad={loadFromMemory}
      onExport={(reports) => void exportPdf(reports, projectName?.trim() || 'proyecto')} exporting={exporting} message={exportMessage} modelSource={modelSource} modelAxes={modelAxes} />
  </div>;
}
