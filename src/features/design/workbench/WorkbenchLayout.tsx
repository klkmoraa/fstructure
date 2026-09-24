import { Maximize2, Minus, Plus, RotateCcw, X } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { DesignCodeId } from '../../../design/elements/codes';

export type WorkbenchPanel = 'inputs' | 'results';

export interface WorkbenchChrome {
  /** Barra flotante inferior (elementos y paneles), propiedad de `DesignWorkbench`. */
  readonly dock: ReactNode;
  /** Chip de norma sobre el lienzo. */
  readonly codeControl: ReactNode;
  /** Norma de diseño elegida para todo el taller. */
  readonly code: DesignCodeId;
  readonly panels: Readonly<Record<WorkbenchPanel, boolean>>;
  readonly setPanel: (panel: WorkbenchPanel, open: boolean) => void;
  readonly onMemo: (memo: string | null) => void;
}

type Verdict = { status: 'pass' | 'fail' | 'warning' | 'error'; label: string };

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
 * Mesa de Diseño: el lienzo ocupa todo y los datos y resultados flotan encima,
 * como los paneles del Modelo 2D. En móvil los paneles son hojas inferiores que
 * dejan ver el dibujo mientras se editan los datos.
 */
export function WorkbenchLayout({ chrome, title, inputs, stage, verdict, caption, results, memo, onReset }: {
  chrome: WorkbenchChrome;
  title: string;
  inputs: ReactNode;
  stage: ReactNode;
  verdict: Verdict;
  /** Resumen corto del elemento junto al veredicto. */
  caption?: string;
  results: ReactNode;
  memo: string | null;
  onReset: () => void;
}) {
  const { onMemo, panels, setPanel } = chrome;
  useEffect(() => onMemo(memo), [memo, onMemo]);
  const { scroller, zoom, setZoom } = useStageZoom();
  const canShowResults = verdict.status !== 'error';

  return <div className="dw-layout" data-inputs={panels.inputs ? 'open' : 'closed'} data-results={panels.results && canShowResults ? 'open' : 'closed'}>
    <form className="dw-panel dw-inputs" aria-label="Datos del elemento" data-open={panels.inputs} onSubmit={(event) => event.preventDefault()}>
      <header className="dw-panel__head">
        <h2>{title}</h2>
        <button type="button" className="dw-icon-button" onClick={onReset} aria-label="Restablecer el ejemplo" title="Restablecer el ejemplo">
          <RotateCcw size={15} aria-hidden="true" />
        </button>
        <button type="button" className="dw-icon-button" onClick={() => setPanel('inputs', false)} aria-label="Ocultar datos" title="Ocultar datos">
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
        <button type="button" className="dw-badge dw-badge--button" data-status={verdict.status}
          disabled={!canShowResults} aria-expanded={canShowResults ? panels.results : undefined}
          aria-label={canShowResults ? `${verdict.label}. ${panels.results ? 'Ocultar' : 'Ver'} resultados` : verdict.label}
          onClick={() => setPanel('results', !panels.results)}>
          <i aria-hidden="true" />{verdict.label}
        </button>
        {caption ? <span className="dw-badge dw-badge--caption">{caption}</span> : null}
      </div>
      <div className="dw-hud dw-hud--end">{chrome.codeControl}</div>
      <div className="dw-zoom" role="group" aria-label="Zoom del lienzo">
        <button type="button" onClick={() => setZoom(zoom / 1.25)} disabled={zoom <= ZOOM_MIN} aria-label="Alejar" title="Alejar"><Minus size={16} aria-hidden="true" /></button>
        <button type="button" onClick={() => setZoom(1)} disabled={zoom === 1} aria-label="Tamaño normal" title="Tamaño normal"><Maximize2 size={15} aria-hidden="true" /></button>
        <button type="button" onClick={() => setZoom(zoom * 1.25)} disabled={zoom >= ZOOM_MAX} aria-label="Acercar" title="Acercar"><Plus size={16} aria-hidden="true" /></button>
      </div>
      {chrome.dock}
    </section>

    <section className="dw-panel dw-results" aria-label="Resultados" data-open={panels.results && canShowResults}>
      <header className="dw-panel__head">
        <h2>Resultados</h2>
        <button type="button" className="dw-icon-button" onClick={() => setPanel('results', false)} aria-label="Ocultar resultados" title="Ocultar resultados">
          <X size={16} aria-hidden="true" />
        </button>
      </header>
      <div className="dw-panel__body">{results}</div>
    </section>
  </div>;
}

export function Plate({ title, note, wide = false, children }: { title: string; note?: string; wide?: boolean; children: ReactNode }) {
  return <figure className={`dw-plate${wide ? ' dw-plate--wide' : ''}`}>
    <figcaption><span className="dw-eyebrow">{title}</span>{note ? <small>{note}</small> : null}</figcaption>
    {children}
  </figure>;
}

export const verdictLabel = (status: 'pass' | 'fail' | 'warning', ratio: number) =>
  `${status === 'fail' ? 'No cumple' : 'Cumple'} · ${Math.round(ratio * 100)} %`;
