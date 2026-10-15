import { BookOpen, Check, ChevronDown, Copy, FileDown, PanelRight, Plus, Redo2, Undo2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ToolButton } from '../../../design-system/components/editor';
import { DESIGN_CODE_IDS, designCode, isDesignCodeId, type DesignCodeId } from '../../../design/elements/codes';
import { ShellContribution, ShellStatusChip, type ShellStatusTone } from '../../workspace/ShellToolSlots';
import { BeamWorkbench } from './BeamWorkbench';
import { ColumnWorkbench } from './ColumnWorkbench';
import { ConcreteStudio } from './ConcreteStudio';
import { FootingWorkbench } from './FootingWorkbench';
import { FrameWorkbench } from './FrameWorkbench';
import { FlexureWorkbench } from './FlexureWorkbench';
import type { DraftHistory } from './common';
import type { ExternalStructureAxes, ExternalStructureSource } from '../../../design/elements/structure';
import { MemoryStatus, useDesignMemory } from './designMemory';
import { DesignMemoryDialog } from './DesignMemoryDialog';
import { memoText, reportHeading, withReportOrigin, type DesignReport } from './designReport';
import type { ModelSectionsBridge, Verdict, WorkbenchChrome, WorkbenchPanel } from './WorkbenchLayout';
import { commitWorkbenchBatch, useWorkbenchStorage } from './workbenchStorage';
import { DesignStartDialog } from './DesignStartDialog';
import { DESIGN_STARTS, type DesignStart } from './designStarts';
import './designWorkbench.css';
import type { ConcreteFrameSpec } from '../../../data/concreteFrame';
import type { JsonValue } from '../../../shared/project/unifiedProjectBundle';
import type { ModelResultKind } from '../../../design/elements/modelResultSnapshot';
import { ModelMemberNavigator } from './ModelMemberNavigator';
import { LinkedPieceOriginView } from './LinkedPieceOriginView';
import { originForElement, originState, withElementOrigin } from './LinkedPieceOrigin';
import { linkedPieceTransfer } from './linkedPieceTransfer';
import { COLUMN_DEFAULTS } from './columnModel';
import { FLEXURE_DEFAULTS } from './flexureModel';
import { FRAME_DEFAULTS, type FrameDraft } from './frameCalculation';

type ElementKind = 'beam' | 'column' | 'frame' | 'footing' | 'section' | 'flexure';

const icon = (children: ReactNode) => <svg className="dw-element-icon" viewBox="0 0 24 24" aria-hidden="true">{children}</svg>;
const ELEMENTS: { id: ElementKind; label: string; icon: ReactNode }[] = [
  { id: 'frame', label: 'Estructura', icon: icon(<><path d="M5 21.5V4.5M19 21.5V4.5M3 5h18M5 12.5h14" /><path d="M2.5 21.5h5M16.5 21.5h5" /></>) },
  { id: 'beam', label: 'Viga', icon: icon(<><rect x="2" y="8" width="20" height="5" rx="1" /><path d="M4 13l-2 4h4zM20 13l-2 4h4z" /></>) },
  { id: 'column', label: 'Columna', icon: icon(<><rect x="8.5" y="2" width="7" height="17" rx="1" /><path d="M4 21.5h16" /></>) },
  { id: 'footing', label: 'Zapata', icon: icon(<><rect x="9.5" y="3" width="5" height="9" rx="1" /><rect x="3" y="12" width="18" height="6" rx="1" /></>) },
  { id: 'flexure', label: 'Flexión', icon: icon(<><path d="M4 5h16v14H4z" /><path d="M7 16h10" /><circle cx="9" cy="16" r="1" /><circle cx="15" cy="16" r="1" /></>) },
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

/**
 * Pieza individual recién creada cuyo formulario vacío no calcularía nada: se
 * abre con su inicio del catálogo (datos completos y editables).
 */
const SINGLE_SEEDS: Partial<Record<ElementKind, string>> = { flexure: 'piece-flexure' };

/** Inicios del selector «Nuevo diseño» que ofrece cada apartado. */
const SCOPE_CATEGORIES = {
  project: ['project', 'piece'],
  single: ['piece', 'exercise'],
} as const;

export function DesignWorkbench({ scope, elements: allowedElements, nativeTool = true, startElement, startCode, startSource, startPicker = false, startCategory, projectName, modelSource = null, modelAxes = null, onOpenModel, onOpenSpace3D, onCreateBuilding, onCreateModel, focusMember, onShowMembers, modelSections = null, space3dSections = null, modelReview }: {
  nativeTool?: boolean;
  /**
   * Cómo se usa el taller: en un proyecto completo los inicios son el modelo y
   * las piezas; en un cálculo individual, la pieza con datos completos o con
   * formularios para tus propios datos. Sin él se ofrecen todos.
   */
  scope?: 'project' | 'single';
  /** Elementos que ofrece el selector; por omisión, todos. */
  elements?: readonly ElementKind[];
  /** Modelo 2D del proyecto traducido por la frontera; sin él la estructura sólo se genera aquí. */
  modelSource?: ExternalStructureSource | null;
  /** Ejes diseñables del Modelo 3D del proyecto, traducidos por la misma frontera. */
  modelAxes?: ExternalStructureAxes | null;
  /** Vuelve al modo 2D de la mesa. */
  onOpenModel?: () => void;
  /** Abre el modo 3D de la mesa. */
  onOpenSpace3D?: (axisId?: string) => void;
  onCreateBuilding?: () => void;
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
  /** Abre el selector inicial, sin elegir una pieza ni cambiar el origen guardado. */
  startPicker?: boolean;
  startCategory?: 'project' | 'piece' | 'exercise';
  /** Barra del modelo cuyo diseño abre Estructura (la elegida en el 2D o el 3D). */
  focusMember?: string;
  /** «Ver en el Modelo» / «Ver en 3D»: selecciona las barras del elemento en su modo. */
  onShowMembers?: (memberIds: readonly string[], axisId?: string, kind?: ModelResultKind) => void;
  /** Proponer y escribir las secciones de las vigas y columnas del Modelo 2D. */
  modelSections?: ModelSectionsBridge | null;
  space3dSections?: ModelSectionsBridge | null;
  modelReview?: ReactNode;
}) {
  const storage = useWorkbenchStorage();
  const offered = allowedElements ? ELEMENTS.filter((item) => allowedElements.includes(item.id)) : ELEMENTS;
  const allowed = (value: unknown): value is ElementKind => isElementKind(value) && offered.some((item) => item.id === value);
  const [element, setElementState] = useState<ElementKind>(() => {
    if (allowed(startElement)) return startElement;
    if ((startSource === 'model' || startSource === 'model3d') && allowed('frame')) return 'frame';
    const stored = storage.read('element');
    // En la mesa de FStructure se empieza por diseñar el modelo.
    return allowed(stored) ? stored : offered[0]!.id;
  });
  const [code, setCodeState] = useState<DesignCodeId>(() => {
    const stored = storage.read('code');
    return isDesignCodeId(stored) ? stored : 'ntc-2023';
  });
  // La selección de inicio se acepta como un lote antes de publicarla.
  useEffect(() => {
    const storedFrame = storage.read('frame');
    const currentFrame = storedFrame && typeof storedFrame === 'object' && !Array.isArray(storedFrame)
      ? Object.fromEntries(Object.entries(storedFrame as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
      : {};
    const writes = {
      ...(allowed(startElement) ? { element: startElement } : {}),
      ...(isDesignCodeId(startCode) ? { code: startCode } : {}),
      ...(startSource ? { frame: { ...currentFrame, source: startSource } } : {}),
    };
    if (Object.keys(writes).length === 0) return;
    const accepted = commitWorkbenchBatch(storage, writes as Record<string, JsonValue>);
    if (!accepted.accepted) return;
    if (allowed(startElement)) setElementState(startElement);
    if (isDesignCodeId(startCode)) setCodeState(startCode);
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [report, setReport] = useState<DesignReport | null>(null);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const memory = useDesignMemory(storage, element, code, report);
  // Un cálculo individual nuevo abre con datos completos; lo guardado nunca se toca.
  const seed = scope === 'single' ? DESIGN_STARTS.find((item) => item.id === SINGLE_SEEDS[element]) : undefined;
  const [seeding, setSeeding] = useState(() => Boolean(seed && storage.read(element) === undefined));
  useEffect(() => {
    if (!seeding) return;
    // El doble efecto de desarrollo no debe guardar la receta como un borrador previo.
    if (seed && storage.read(element) === undefined) memory.start(seed);
    setSeeding(false);
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [navigatorOpen, setNavigatorOpen] = useState(false);
  const [startOpen, setStartOpen] = useState(() => startPicker);
  const [initialIntentConsumed, setInitialIntentConsumed] = useState(false);
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
    if (focusRequest > 0) buttons.current[offered.findIndex((item) => item.id === element)]?.focus();
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
    if (!commitWorkbenchBatch(storage, { element: next }).accepted) return;
    setElementState(next);
    setCopied(false);
  };

  const setCode = (next: string) => {
    if (!isDesignCodeId(next)) return;
    if (!commitWorkbenchBatch(storage, { code: next }).accepted) return;
    setCodeState(next);
  };

  const onReport = useCallback((next: DesignReport | null) => {
    const origin = next && (next.element === 'column' || next.element === 'flexure') ? originForElement(storage.read('piece-origin'), next.element) : undefined;
    let provider = undefined;
    if (origin?.snapshot.source.kind === 'model2d') provider = modelSource?.resultProvider;
    else provider = modelAxes?.resultProvider ?? (() => { try { return origin?.snapshot.source.axisId ? modelAxes?.source(origin.snapshot.source.axisId).resultProvider : undefined; } catch { return undefined; } })();
    const raw = next ? storage.read(next.element) : undefined;
    const fields = raw && typeof raw === 'object' && !Array.isArray(raw) ? Object.fromEntries(Object.entries(raw as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === 'string')) : {};
    setReport(next ? withReportOrigin(next, origin, origin ? originState(origin, provider, fields) : undefined) : null);
    setCopied(false);
  }, [storage, modelSource, modelAxes]);
  const createLinkedPiece = (snapshot: import('../../../design/elements/modelResultSnapshot').ModelDemandSnapshot, target: 'column' | 'flexure', preserveCurrent = true): { ok: true } | { ok: false; reason: string } => {
    try {
      const defaults = target === 'column' ? COLUMN_DEFAULTS : FLEXURE_DEFAULTS;
      const stored = storage.read(target);
      const base = stored && typeof stored === 'object' && !Array.isArray(stored)
        ? Object.fromEntries(Object.entries(stored as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
        : defaults;
      const transfer = linkedPieceTransfer(snapshot, target, base);
      const origins = withElementOrigin(storage.read('piece-origin'), target, transfer.origin);
      const switched = memory.switchDraft({ [target]: transfer.fields, 'piece-origin': origins as unknown as JsonValue }, target, preserveCurrent);
      if (switched === 'full') return { ok: false, reason: 'La memoria está llena. Libera una pieza guardada antes de crear otra.' };
      setElementState(target);
      setReport(null); setVerdict(null); setCopied(false);
      setInitialIntentConsumed(true); setNavigatorOpen(false); setLoadCount((count) => count + 1);
      history.current = null; setHistoryFlags({ canUndo: false, canRedo: false });
      return { ok: true };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'No se pudo crear la pieza vinculada.';
      setExportMessage(reason);
      return { ok: false, reason };
    }
  };
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const onVerdict = useCallback((next: Verdict) => setVerdict((current) =>
    current && current.status === next.status && current.label === next.label && current.detail === next.detail ? current : next), []);
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
  const saveToMemory = () => {
    if (memory.save() === 'full') {
      setExportMessage('No hay espacio suficiente para guardar la pieza. Quita elementos o libera espacio en el documento.');
      setMemoryOpen(true);
    }
  };
  const loadFromMemory = (id: string) => {
    const item = memory.open(id);
    if (item === 'full') {
      setExportMessage('No hay espacio suficiente para abrir esta pieza y conservar los borradores actuales. Quita elementos o libera espacio en el documento.');
      return;
    }
    if (!item) return;
    setExportMessage(null);
    setInitialIntentConsumed(true);
    setElementState(item.element);
    if (isDesignCodeId(item.code)) setCodeState(item.code);
    setLoadCount((count) => count + 1);
    setMemoryOpen(false);
  };

  const startRecipe = (start: DesignStart): 'started' | 'full' => {
    const result = memory.start(start);
    if (result === 'full') return 'full';
    // La receta es la nueva fuente de verdad: no se reaplican el origen ni la
    // barra que venían del modo anterior al volver a montar el formulario.
    setInitialIntentConsumed(true);
    setElementState(start.element);
    setReport(null);
    setVerdict(null);
    setCopied(false);
    history.current = null;
    setHistoryFlags({ canUndo: false, canRedo: false });
    setLoadCount((count) => count + 1);
    setStartOpen(false);
    return 'started';
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const steps: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    let next = index;
    if (event.key in steps) next = (index + steps[event.key]! + offered.length) % offered.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = offered.length - 1;
    else return;
    event.preventDefault();
    setElement(offered[next]!.id);
    setFocusRequest((count) => count + 1);
  };

  // Con un solo elemento (cálculo individual) el selector sobra: la barra ya nombra la pieza.
  const elements = <div className={'dw-dock__elements' + (offered.length > 1 ? '' : ' is-single')}>
    {offered.length > 1 ? <div className="dw-dock__group" role="radiogroup" aria-label="Elemento a diseñar">
      {offered.map((item, index) => <ToolButton
        key={item.id}
        ref={(node) => { buttons.current[index] = node; }}
        role="radio"
        aria-checked={element === item.id}
        tabIndex={element === item.id ? 0 : -1}
        label={item.label}
        title={item.label}
        icon={item.icon}
        active={element === item.id}
        className="dw-dock__button"
        onClick={() => setElement(item.id)}
        onKeyDown={(event) => onKeyDown(event, index)}
      />)}
    </div> : null}
    <button type="button" className="dw-dock__new-design" aria-label="Nuevo diseño" title="Nuevo diseño" onClick={() => setStartOpen(true)}>
      <Plus size={16} aria-hidden="true" /><span>Nuevo</span>
    </button>
    {(modelSource?.resultProvider || modelAxes?.resultProvider || modelAxes?.axes.some((axis) => { try { return Boolean(modelAxes.source(axis.id).resultProvider); } catch { return false; } })) ? <button type="button" className="dw-dock__new-design dw-dock__building-action" data-testid="open-building-navigator" onClick={() => setNavigatorOpen(true)}>Edificio</button> : null}
  </div>;
  const codeControl = <label className="dw-code-chip" title={`${designCode(code).name} · ${designCode(code).country}`}>
    <select aria-label="Norma de diseño" value={code} onChange={(event) => setCode(event.currentTarget.value)}>
      {DESIGN_CODE_IDS.map((id) => <option key={id} value={id}>{designCode(id).name}</option>)}
    </select>
    <ChevronDown size={14} aria-hidden="true" />
  </label>;
  const memoryBar = <MemoryStatus memory={memory} element={element} onSave={saveToMemory} onOpen={() => setMemoryOpen(true)} />;
  const activeOrigin = element === 'column' || element === 'flexure' ? originForElement(storage.read('piece-origin'), element) : undefined;
  const activeProvider = activeOrigin ? activeOrigin.snapshot.source.kind === 'model2d' ? modelSource?.resultProvider : modelAxes?.resultProvider ?? (() => {
    try { return activeOrigin.snapshot.source.axisId ? modelAxes?.source(activeOrigin.snapshot.source.axisId).resultProvider : undefined; } catch { return undefined; }
  })() : undefined;
  const activeFieldsRaw = storage.read(element);
  const refreshProviderIds = useRef(new WeakMap<object, number>());
  const refreshProviderSequence = useRef(1);
  const refreshProviderId = activeProvider ? (() => {
    let id = refreshProviderIds.current.get(activeProvider);
    if (id === undefined) { id = refreshProviderSequence.current++; refreshProviderIds.current.set(activeProvider, id); }
    return id;
  })() : '';
  const refreshContext = `${element}|${activeOrigin ? JSON.stringify(activeOrigin) : ''}|${activeProvider?.inventory.revision ?? ''}:${refreshProviderId}|${JSON.stringify(activeFieldsRaw)}`;
  const refreshContextRef = useRef(refreshContext); refreshContextRef.current = refreshContext;
  const refreshRequest = useRef<{ id: number; controller: AbortController } | null>(null);
  const refreshSequence = useRef(0);
  useEffect(() => {
    refreshSequence.current++;
    refreshRequest.current?.controller.abort(); refreshRequest.current = null;
  }, [element, refreshContext]);
  const activeFields = activeFieldsRaw && typeof activeFieldsRaw === 'object' && !Array.isArray(activeFieldsRaw) ? Object.fromEntries(Object.entries(activeFieldsRaw as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === 'string')) : {};
  const frameRaw = storage.read('frame');
  const frameDraft = { ...FRAME_DEFAULTS, ...(frameRaw && typeof frameRaw === 'object' && !Array.isArray(frameRaw) ? Object.fromEntries(Object.entries(frameRaw as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === 'string')) : {}) } as FrameDraft;
  const contextualOrigin = activeOrigin ? <LinkedPieceOriginView origin={activeOrigin} provider={activeProvider} currentFields={activeFields}
    onShowSource={() => onShowMembers?.([activeOrigin.snapshot.source.memberId], activeOrigin.snapshot.source.axisId, activeOrigin.snapshot.source.kind)}
    onRefresh={() => {
      const provider = activeProvider;
      if (!provider) { setExportMessage('El origen no está disponible en el proyecto actual.'); return; }
      const snapshot = activeOrigin.snapshot;
      const abort = new AbortController();
      const id = ++refreshSequence.current, context = refreshContext;
      refreshRequest.current?.controller.abort(); refreshRequest.current = { id, controller: abort };
      void provider.member({ memberId: snapshot.source.memberId, targetId: snapshot.target.id, xM: snapshot.station.xM, side: snapshot.station.side, ...(snapshot.source.axisId ? { axisId: snapshot.source.axisId } : {}) }, abort.signal)
        .then((fresh) => {
          if (abort.signal.aborted || refreshRequest.current?.id !== id || refreshContextRef.current !== context) return;
          createLinkedPiece(fresh, element as 'column' | 'flexure', false);
          refreshRequest.current = null;
        })
        .catch((error: unknown) => {
          if (abort.signal.aborted || refreshRequest.current?.id !== id || refreshContextRef.current !== context) return;
          setExportMessage(error instanceof Error ? error.message : 'No se pudo actualizar el origen.'); refreshRequest.current = null;
        });
    }} /> : null;
  const chrome: WorkbenchChrome = {
    elements, codeControl, code, panels, setPanel, onReport, memoryBar, onHistory, modelSource, modelAxes, contextualOrigin,
    onSaveAxes: (axes) => memory.saveAxes(axes),
    ...(nativeTool ? { onVerdict } : {}),
    ...(onOpenModel ? { onOpenModel } : {}),
    ...(onOpenSpace3D ? { onOpenSpace3D } : {}),
    ...(onCreateBuilding ? { onCreateBuilding } : {}),
    ...(onCreateModel ? { onCreateModel } : {}),
    ...(!initialIntentConsumed && startSource ? { startSource } : {}),
    ...(!initialIntentConsumed && focusMember ? { focusMember } : {}),
    ...(startPicker && startOpen && !initialIntentConsumed ? { deferSourceNormalization: true } : {}),
    ...(onShowMembers ? { onShowMembers } : {}),
    modelSections, space3dSections, ...(modelReview ? { modelReview } : {}),
    ...(scope === 'single' ? { standalone: true } : {}),
  };

  return <div className="design-workbench" data-testid="design-workbench">
    {exportMessage && !memoryOpen ? <p className="dw-action-feedback" role="alert">{exportMessage}<button type="button" aria-label="Cerrar aviso" onClick={() => setExportMessage(null)}>×</button></p> : null}
    {navigatorOpen ? <ModelMemberNavigator modelSource={modelSource} modelAxes={modelAxes} modelSections={modelSections} space3dSections={space3dSections} code={code} frameDraft={frameDraft} onShowMembers={onShowMembers}
      origins={[...memory.items.flatMap((item) => item.origin ? [item.origin.snapshot] : []), ...(activeOrigin ? [activeOrigin.snapshot] : [])]}
      onCreateLinked={createLinkedPiece} onClose={() => setNavigatorOpen(false)} /> : null}
    {nativeTool ? <ShellContribution slot="controls">
      <button type="button" className="workspace-topbar__icon-button" onClick={() => history.current?.undo()} disabled={!historyFlags.canUndo}
        aria-label="Deshacer" title="Deshacer (Ctrl/⌘ Z)"><Undo2 size={17} aria-hidden="true" /></button>
      <button type="button" className="workspace-topbar__icon-button" onClick={() => history.current?.redo()} disabled={!historyFlags.canRedo}
        aria-label="Rehacer" title="Rehacer (Ctrl/⌘ Mayús Z)"><Redo2 size={17} aria-hidden="true" /></button>
      <button type="button" className={'workspace-topbar__action-button workspace-topbar__inspector-button' + (anyPanelOpen ? ' is-active' : '')} data-mobile-hide
        aria-label="Paneles de datos y resultados" aria-pressed={anyPanelOpen} title="Panel" onClick={togglePanels}>
        <PanelRight size={17} aria-hidden="true" /><span>Panel</span>
      </button>
    </ShellContribution> : null}
    {nativeTool && verdict ? <ShellContribution slot="status">
      <ShellStatusChip tone={VERDICT_TONE[verdict.status]} label={verdict.label} badge="Experimental" {...(verdict.detail ? { detail: verdict.detail } : {})} />
    </ShellContribution> : null}
    {nativeTool ? <ShellContribution slot="statusbar">
      <footer className="mesa-statusbar" data-mesa-foot="" aria-label="Estado de Diseño">
        <span><b>{ELEMENTS.find((item) => item.id === element)?.label}</b></span>
        <span>{designCode(code).name}</span>
        <span className="mesa-statusbar__grow">{memory.items.length} {memory.items.length === 1 ? 'elemento' : 'elementos'} en la memoria</span>
        <span>{verdict ? verdict.label : 'Sin revisar'}</span>
        <span>Local</span>
      </footer>
    </ShellContribution> : null}
    {nativeTool ? <ShellContribution slot="action">
      <button type="button" className="workspace-topbar__action-button" data-mobile-hide disabled={!report} onClick={copyMemo}
        aria-label={copied ? 'Memoria copiada' : 'Copiar memoria de cálculo'} title={copied ? 'Memoria copiada' : 'Copiar memoria de cálculo'}>
        {copied ? <Check size={17} aria-hidden="true" /> : <Copy size={17} aria-hidden="true" />}
        <span>{copied ? 'Copiada' : 'Copiar'}</span>
      </button>
      <button type="button" className="workspace-topbar__action-button" data-wide-label onClick={() => setMemoryOpen(true)}
        aria-label={`Memoria del proyecto, ${memory.items.length} ${memory.items.length === 1 ? 'elemento' : 'elementos'}`} title="Memoria del proyecto">
        <BookOpen size={17} aria-hidden="true" /><span>Memoria{memory.items.length ? ` · ${memory.items.length}` : ''}</span>
      </button>
      <button type="button" className="workspace-topbar__action-button is-primary" disabled={!report || exporting} onClick={() => report && exportPdf([report], reportHeading(report))}
        aria-label="Exportar este elemento en PDF" title="Memoria en PDF de este elemento">
        <FileDown size={17} aria-hidden="true" /><span>{exporting ? 'Generando…' : 'PDF'}</span>
      </button>
    </ShellContribution> : null}

    {seeding ? null : element === 'beam' ? <BeamWorkbench key={loadCount} chrome={chrome} />
      : element === 'column' ? <ColumnWorkbench key={loadCount} chrome={chrome} />
        : element === 'frame' ? <FrameWorkbench key={loadCount} chrome={chrome} />
        : element === 'footing' ? <FootingWorkbench key={loadCount} chrome={chrome} />
        : element === 'flexure' ? <FlexureWorkbench key={loadCount} chrome={chrome} />
          : <ConcreteStudio key={loadCount} chrome={chrome} />}
    <DesignStartDialog open={startOpen} onOpenChange={setStartOpen}
      hasModel2d={Boolean(modelSource && !modelSource.errors.length && modelSource.summary.beams + modelSource.summary.columns > 0)}
      hasModel3d={Boolean(modelAxes?.axes.some((axis) => {
        try {
          const source = modelAxes.source(axis.id);
          return !source.errors.length && source.summary.beams + source.summary.columns > 0;
        } catch { return false; }
      }))}
      code={code} projectName={projectName} onStart={startRecipe} onOpenModel={onOpenModel}
      onOpenSpace3D={onOpenSpace3D ? () => onOpenSpace3D() : undefined} onCreateBuilding={onCreateBuilding}
      onOpenMemory={() => { setStartOpen(false); setMemoryOpen(true); }} initialCategory={startCategory}
      {...(scope ? { categories: SCOPE_CATEGORIES[scope] } : {})}
      elements={offered.map((item) => item.id)} />
    <DesignMemoryDialog open={memoryOpen} onOpenChange={setMemoryOpen} memory={memory} element={element} onLoad={loadFromMemory}
      onExport={(reports) => void exportPdf(reports, projectName?.trim() || 'proyecto')} exporting={exporting} message={exportMessage} onClearMessage={() => setExportMessage(null)} modelSource={modelSource} modelAxes={modelAxes} />
  </div>;
}
