import { ClipboardCheck, Maximize2, Minus, PenLine, Plus, RotateCcw, SlidersHorizontal, X } from 'lucide-react';
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { DesignCodeId } from '../../../design/elements/codes';
import type { ExternalStructureAxes, ExternalStructureSource } from '../../../design/elements/structure';
import { verdictHeadline, type DraftHistory } from './common';
import type { DesignReport } from './designReport';
import type { ProposalStep } from './frameProposal';
import type { FrameDraft, StructureOutcome } from './frameModel';
import type { ConcreteSectionGroup, ConcreteFrameSpec } from '../../../data/concreteFrame';

export type WorkbenchPanel = 'inputs' | 'results';

export interface WorkbenchChrome {
  /** Selector de elemento, propiedad de `DesignWorkbench`. */
  readonly elements: ReactNode;
  /** Chip de norma sobre el lienzo. */
  readonly codeControl: ReactNode;
  /** Norma de diseño elegida para todo el taller. */
  readonly code: DesignCodeId;
  readonly panels: Readonly<Record<WorkbenchPanel, boolean>>;
  readonly setPanel: (panel: WorkbenchPanel, open: boolean) => void;
  /** Instantánea del diseño vigente, para copiar la memoria o exportar el PDF. */
  readonly onReport: (report: DesignReport | null) => void;
  /** Estado del elemento en la memoria del proyecto, sobre los resultados. */
  readonly memoryBar?: ReactNode;
  /** El formulario activo entrega aquí su deshacer/rehacer. */
  readonly onHistory?: (history: DraftHistory) => void;
  /**
   * Con la mesa dentro del shell, el veredicto sube a la barra superior —donde
   * las cuatro mesas dicen su estado— y deja de repetirse sobre el lienzo.
   */
  readonly onVerdict?: (verdict: Verdict) => void;
  /** Modelo 2D del proyecto, traducido por la frontera de la app. */
  readonly modelSource?: ExternalStructureSource | null;
  /** Vuelve al modo Modelo de la mesa (sólo dentro de la app). */
  readonly onOpenModel?: () => void;
  /** Escribe el pórtico rápido en el Modelo 2D como un cambio deshacible (sólo dentro de la app). */
  readonly onCreateModel?: (spec: ConcreteFrameSpec) => void;
  /** Ejes diseñables del Modelo 3D del proyecto, por la misma frontera. */
  readonly modelAxes?: ExternalStructureAxes | null;
  /** Guarda en la memoria la Estructura de varios ejes del Modelo 3D. */
  readonly onSaveAxes?: (axes: readonly { readonly id: string; readonly tag: string }[]) => 'saved' | 'full';
  /** Abre el modo 3D de la mesa (sólo dentro de la app). */
  readonly onOpenSpace3D?: (axisId?: string) => void;
  /** Fuente pedida al abrir el taller. */
  readonly startSource?: 'frame' | 'model' | 'model3d';
  /** Barra del modelo cuyo diseño se abre al llegar (la elegida en el 2D o el 3D). */
  readonly focusMember?: string;
  /** Selecciona esas barras en su modo y lo abre; con `axisId`, en el 3D. */
  readonly onShowMembers?: (memberIds: readonly string[], axisId?: string) => void;
  /** Las vigas y columnas de concreto del Modelo 2D, para proponer sus secciones y escribirlas en él. */
  readonly modelSections?: ModelSectionsBridge | null;
  readonly space3dSections?: ModelSectionsBridge | null;
  /** Revisión adicional suministrada por el workspace, independiente del concreto. */
  readonly modelReview?: ReactNode;
}

/** Secciones rectangulares, cm. */
export interface ModelSection { readonly width: number; readonly height: number }

export interface ModelSectionsBridge {
  readonly groups?: readonly ConcreteSectionGroup[];
  propose?(code: DesignCodeId, draft: FrameDraft, onStep: (step: ProposalStep) => void): (() => void) | null;
  /** Revisión del candidato completo (varios ejes, si procede). */
  evaluate?(code: DesignCodeId, draft: FrameDraft, beam: ModelSection, column: ModelSection, groups?: readonly ConcreteSectionGroup[]): StructureOutcome;
  readonly beams: number;
  readonly columns: number;
  readonly beamLengthM: number;
  readonly columnLengthM: number;
  /** Volumen de concreto de esas barras con sus secciones actuales, m³. */
  readonly volumeM3: number;
  /** La fuente del modelo con esas secciones en todas sus vigas y columnas (sin cambiarlo). */
  variant(beam: ModelSection, column: ModelSection, groups?: readonly ConcreteSectionGroup[]): ExternalStructureSource;
  /** Las escribe en el modelo, como un cambio deshacible en el modo 2D. */
  apply(beam: ModelSection, column: ModelSection, groups?: readonly ConcreteSectionGroup[]): void;
}

export type Verdict = { status: 'pass' | 'fail' | 'warning' | 'error'; label: string };

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;
const clampZoom = (value: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value));

/**
 * Zoom del lienzo: botones, Ctrl/⌘ + rueda (también el pellizco del trackpad) y
 * pellizco con dos dedos. Conserva bajo el cursor el punto que se amplía.
 */
function useStageZoom() {
  const scroller = useRef<HTMLDivElement>(null);
  const [zoom, setZoomState] = useState(1);
  const zoomRef = useRef(1);
  const anchor = useRef<{ x: number; y: number; left: number; top: number; ratio: number } | null>(null);

  const setZoom = useCallback((next: number, point?: { x: number; y: number }) => {
    const element = scroller.current;
    const value = clampZoom(next);
    if (value === zoomRef.current) return;
    if (element) {
      const rect = element.getBoundingClientRect();
      const x = point ? point.x - rect.left : element.clientWidth / 2;
      const y = point ? point.y - rect.top : element.clientHeight / 2;
      anchor.current = { x, y, left: element.scrollLeft + x, top: element.scrollTop + y, ratio: value / zoomRef.current };
    }
    zoomRef.current = value;
    setZoomState(value);
  }, []);

  useLayoutEffect(() => {
    const element = scroller.current;
    const target = anchor.current;
    anchor.current = null;
    if (!element || !target) return;
    element.scrollLeft = target.left * target.ratio - target.x;
    element.scrollTop = target.top * target.ratio - target.y;
  }, [zoom]);

  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      setZoom(zoomRef.current * Math.exp(-event.deltaY * 0.004), { x: event.clientX, y: event.clientY });
    };
    let pinch: { distance: number; zoom: number } | null = null;
    const measure = (touches: TouchList) => {
      const [a, b] = [touches[0]!, touches[1]!];
      return { distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
    };
    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 2) pinch = { distance: measure(event.touches).distance, zoom: zoomRef.current };
    };
    const onTouchMove = (event: TouchEvent) => {
      if (!pinch || event.touches.length !== 2) return;
      event.preventDefault();
      const { distance, x, y } = measure(event.touches);
      if (pinch.distance > 0) setZoom(pinch.zoom * distance / pinch.distance, { x, y });
    };
    const onTouchEnd = (event: TouchEvent) => { if (event.touches.length < 2) pinch = null; };
    element.addEventListener('wheel', onWheel, { passive: false });
    element.addEventListener('touchstart', onTouchStart, { passive: true });
    element.addEventListener('touchmove', onTouchMove, { passive: false });
    element.addEventListener('touchend', onTouchEnd);
    element.addEventListener('touchcancel', onTouchEnd);
    return () => {
      element.removeEventListener('wheel', onWheel);
      element.removeEventListener('touchstart', onTouchStart);
      element.removeEventListener('touchmove', onTouchMove);
      element.removeEventListener('touchend', onTouchEnd);
      element.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [setZoom]);

  return { scroller, zoom, setZoom };
}

/**
 * Mesa de Diseño. En escritorio el lienzo ocupa todo y los datos y resultados
 * flotan encima, como los paneles del Modelo 2D. En móvil son tres vistas a
 * pantalla completa —Dibujo, Datos, Resultados— con pestañas fijas abajo y el
 * elemento arriba.
 */
export function WorkbenchLayout({ chrome, title, inputs, stage, verdict, caption, results, report, onReset }: {
  chrome: WorkbenchChrome;
  title: string;
  inputs: ReactNode;
  stage: ReactNode;
  verdict: Verdict;
  /** Resumen corto del elemento junto al veredicto. */
  caption?: string;
  results: ReactNode;
  report: DesignReport | null;
  onReset: () => void;
}) {
  const { onReport, onVerdict, panels, setPanel } = chrome;
  useEffect(() => onReport(report), [report, onReport]);
  useEffect(() => { onVerdict?.({ status: verdict.status, label: verdict.label }); }, [verdict.status, verdict.label, onVerdict]);
  const { scroller, zoom, setZoom } = useStageZoom();
  const canShowResults = verdict.status !== 'error';
  const percent = verdict.label.split(' · ')[1];
  const inputsRef = useRef<HTMLFormElement>(null);
  const inputId = useId();
  const resultsId = useId();
  const reviewInputs = () => {
    setPanel('inputs', true);
    window.requestAnimationFrame(() => {
      const target = inputsRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')
        ?? inputsRef.current?.querySelector<HTMLElement>('input, select');
      target?.focus({ preventScroll: true });
      target?.scrollIntoView?.({ block: 'nearest' });
    });
  };

  return <div className="dw-layout" data-inputs={panels.inputs ? 'open' : 'closed'} data-results={panels.results && canShowResults ? 'open' : 'closed'}>
    <form ref={inputsRef} id={inputId} className="dw-panel dw-inputs" aria-label="Datos del elemento" data-open={panels.inputs} onSubmit={(event) => event.preventDefault()}>
      <header className="dw-panel__head">
        <h2>{title}</h2>
        <button type="button" className="dw-icon-button" onClick={onReset} aria-label="Restablecer el ejemplo" title="Restablecer el ejemplo">
          <RotateCcw size={15} aria-hidden="true" />
        </button>
        <button type="button" className="dw-icon-button dw-panel__close" onClick={() => setPanel('inputs', false)} aria-label="Ocultar datos" title="Ocultar datos">
          <X size={16} aria-hidden="true" />
        </button>
      </header>
      <div className="dw-panel__body">{inputs}</div>
    </form>

    <section className="dw-stage" aria-label="Lámina de diseño">
      <div className="dw-stage__scroll" ref={scroller}>
        <div className="dw-stage__content" style={{ '--dw-zoom': zoom } as CSSProperties}>{stage}</div>
      </div>
      <div className="dw-hud dw-hud--start">
        {onVerdict ? null : <button type="button" className="dw-badge dw-badge--button" data-status={verdict.status}
          disabled={!canShowResults} aria-expanded={canShowResults ? panels.results : undefined}
          aria-label={canShowResults ? `${verdict.label}. ${panels.results ? 'Ocultar' : 'Ver'} resultados` : verdict.label}
          onClick={() => setPanel('results', !panels.results)}>
          <i aria-hidden="true" />{verdict.label}
        </button>}
        {caption ? <span className="dw-badge dw-badge--caption">{caption}</span> : null}
      </div>
      <div className="dw-hud dw-hud--end">{chrome.codeControl}</div>
      {!canShowResults ? <div className="dw-review-inputs"><button type="button" onClick={reviewInputs}>Revisar datos</button></div> : null}
      <div className="dw-zoom" role="group" aria-label="Zoom del lienzo" data-zoomed={zoom !== 1}>
        <button type="button" className="dw-zoom__step" onClick={() => setZoom(zoom / 1.25)} disabled={zoom <= ZOOM_MIN} aria-label="Alejar" title="Alejar"><Minus size={16} aria-hidden="true" /></button>
        <button type="button" onClick={() => setZoom(1)} disabled={zoom === 1} aria-label="Tamaño normal" title="Tamaño normal"><Maximize2 size={15} aria-hidden="true" /></button>
        <button type="button" className="dw-zoom__step" onClick={() => setZoom(zoom * 1.25)} disabled={zoom >= ZOOM_MAX} aria-label="Acercar" title="Acercar"><Plus size={16} aria-hidden="true" /></button>
      </div>
    </section>

    <section id={resultsId} className="dw-panel dw-results" aria-label="Resultados" data-open={panels.results && canShowResults}>
      <header className="dw-panel__head dw-panel__head--results">
        <h2>Resultados</h2>
        <button type="button" className="dw-icon-button dw-panel__close" onClick={() => setPanel('results', false)} aria-label="Ocultar resultados" title="Ocultar resultados">
          <X size={16} aria-hidden="true" />
        </button>
      </header>
      <div className="dw-panel__body">{report ? chrome.memoryBar : null}{results}</div>
    </section>

    {/* Escritorio: barra flotante. Móvil: el elemento arriba y las vistas como pestañas abajo. */}
    <div className="dw-dock">
      {chrome.elements}
      <span className="dw-dock__divider" aria-hidden="true" />
      <div className="dw-views" role="group" aria-label="Vistas">
        <button type="button" className="dw-view dw-view--stage" aria-pressed={!panels.inputs && !(panels.results && canShowResults)}
          onClick={() => { setPanel('inputs', false); setPanel('results', false); }}>
          <PenLine size={18} aria-hidden="true" /><span>Dibujo</span>
        </button>
        <button type="button" className="dw-view" aria-pressed={panels.inputs} aria-controls={inputId} title="Editar geometría, materiales y demandas" onClick={() => setPanel('inputs', !panels.inputs)}>
          <SlidersHorizontal size={18} aria-hidden="true" /><span>Datos</span>
        </button>
        <button type="button" className="dw-view" aria-pressed={panels.results && canShowResults} aria-label="Resultados" aria-controls={resultsId} title={canShowResults ? 'Consultar comprobaciones y memoria' : 'Corrige los datos del elemento para consultar los resultados'}
          disabled={!canShowResults} data-status={verdict.status} onClick={() => setPanel('results', !panels.results)}>
          <ClipboardCheck size={18} aria-hidden="true" /><span>Resultados</span>
          {percent ? <em aria-hidden="true"><i />{percent}</em> : null}
        </button>
      </div>
    </div>
  </div>;
}

export function Plate({ title, note, wide = false, children }: { title: string; note?: string; wide?: boolean; children: ReactNode }) {
  return <figure className={`dw-plate${wide ? ' dw-plate--wide' : ''}`}>
    <figcaption><span className="dw-eyebrow">{title}</span>{note ? <small>{note}</small> : null}</figcaption>
    {children}
  </figure>;
}

export const verdictLabel = (status: 'pass' | 'fail' | 'warning', ratio: number, incomplete = false) =>
  `${status === 'warning' ? 'Cumple' : verdictHeadline(status, incomplete)} · ${Math.round(ratio * 100)} %`;
