/**
 * Lienzo de Space 3D: ciclo de vida React/WebGL, controles de cámara y
 * degradación honesta.
 *
 * El resumen semántico no es un extra del fallback: está siempre en el árbol,
 * porque un lienzo WebGL es opaco para un lector de pantalla incluso cuando
 * funciona. Si el visor cae, lo único que desaparece es la imagen.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, ChevronDown, Maximize2, Minimize2, Minus, Plus, RotateCcw } from 'lucide-react';
import { SPACE3D_VIEW_PRESETS, type Space3DViewPreset } from './cameraModel';
import { createSpace3DViewport, type Space3DLayerVisibility, type Space3DViewport, type Space3DWindowPick } from './threeViewport';
import type { Space3DSceneModel } from './sceneModel';
import type { Space3DSelection } from '../store/Space3DProjectContext';
import type { Space3DVector } from '../model/types';

/**
 * Modelado directo: el plano donde cae el clic, el origen de la barra en curso
 * y cómo ajustar y describir un punto. Lo decide quien aloja el lienzo.
 */
export interface Space3DCanvasDraft {
  readonly plane: { readonly axis: 'x' | 'y' | 'z'; readonly offset: number; readonly step: number } | null;
  readonly from: Space3DVector | null;
  readonly snap: (point: Space3DVector) => Space3DVector;
  readonly describe: (point: Space3DVector, nodeId: string | null) => string;
}

export interface Space3DCanvasPick {
  readonly selection: Space3DSelection | null;
  /** Punto ajustado del plano de trabajo; `null` si el clic no lo cortó. */
  readonly point: Space3DVector | null;
}

interface Space3DCanvasCopy {
  readonly label: string;
  readonly fallbackTitle: string;
  readonly fallbackBody: string;
  readonly retry: string;
  readonly summaryTitle: string;
  readonly nodes: string;
  readonly members: string;
  readonly supports: string;
  readonly loads: string;
}

export type Space3DViewportFactory = (options: {
  canvas: HTMLCanvasElement;
  model: Space3DSceneModel;
  layers: Space3DLayerVisibility;
}) => Space3DViewport;

/** Cómo se eligió: un clic simple reemplaza; con Ctrl/⌘/Mayús suma o quita. */
export interface Space3DPickModifiers {
  readonly additive: boolean;
}

interface Space3DCanvasProps {
  readonly model: Space3DSceneModel;
  readonly layers: Space3DLayerVisibility;
  readonly copy: Space3DCanvasCopy;
  readonly onSelect?: (selection: Space3DSelection | null, modifiers?: Space3DPickModifiers) => void;
  /**
   * Selección por ventana (Mayús + arrastrar, o siempre con `windowSelect`):
   * de izquierda a derecha, lo que queda dentro; de derecha a izquierda, lo
   * que la ventana toca.
   */
  readonly onWindowSelect?: (pick: Space3DWindowPick, modifiers: Space3DPickModifiers) => void;
  /** El arrastre con el botón principal selecciona por ventana en lugar de orbitar. */
  readonly windowSelect?: boolean;
  /** Anima la deformada o el modo propio. */
  readonly animate?: boolean;
  /** Sustituye el selector de vista integrado (p. ej. plantas y alzados de la rejilla). */
  readonly leadingControls?: ReactNode;
  readonly createViewport?: Space3DViewportFactory;
  readonly viewLabels?: Readonly<Record<Space3DViewPreset, string>>;
  /** Preset activo, controlado por quien aloja el lienzo (comparte estado con la lista de Vistas del panel lateral). */
  readonly activeView?: Space3DViewPreset;
  readonly onViewChange?: (preset: Space3DViewPreset) => void;
  /**
   * Cambia cuando el proyecto entero se sustituye (estructura generada,
   * ejemplo, proyecto vacío). Sólo entonces se reencuadra: una edición normal
   * conserva la cámara que la persona dejó.
   */
  readonly refitToken?: number;
  readonly zoomInLabel?: string;
  readonly zoomOutLabel?: string;
  readonly resetLabel?: string;
  readonly fullscreenEnterLabel?: string;
  readonly fullscreenExitLabel?: string;
  readonly viewSelectLabel?: string;
  /** Controles adicionales inyectados por quien aloja el lienzo (p.ej. capas). */
  readonly trailingControls?: ReactNode;
  readonly draft?: Space3DCanvasDraft | null;
  /** Con `draft`, el clic se entrega aquí en lugar de a `onSelect`. */
  readonly onDraftPick?: (pick: Space3DCanvasPick) => void;
}

const DEFAULT_VIEW_LABELS: Record<Space3DViewPreset, string> = {
  front: 'Vista frontal',
  top: 'Vista superior',
  side: 'Vista lateral',
  isometric: 'Vista isométrica',
};

const defaultFactory: Space3DViewportFactory = (options) => createSpace3DViewport(options);

export const Space3DCanvas = ({
  model,
  layers,
  copy,
  onSelect,
  createViewport = defaultFactory,
  viewLabels = DEFAULT_VIEW_LABELS,
  activeView = 'isometric',
  onViewChange,
  refitToken = 0,
  zoomInLabel = 'Acercar',
  zoomOutLabel = 'Alejar',
  resetLabel = 'Restablecer vista',
  viewSelectLabel = 'Vista',
  fullscreenEnterLabel = 'Pantalla completa',
  fullscreenExitLabel = 'Salir de pantalla completa',
  trailingControls,
  draft = null,
  onDraftPick,
  onWindowSelect,
  windowSelect = false,
  animate = false,
  leadingControls,
}: Space3DCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<Space3DViewport | null>(null);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  const pointerDownPos = useRef<{ x: number; y: number; pointerId: number; window: boolean; additive: boolean } | null>(null);
  const windowSelectRef = useRef(onWindowSelect);
  windowSelectRef.current = onWindowSelect;
  const [band, setBand] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const draftPickRef = useRef(onDraftPick);
  draftPickRef.current = onDraftPick;
  const [hover, setHover] = useState<{ x: number; y: number; label: string } | null>(null);

  /** Lo que un clic en este píxel produciría: el nudo bajo el cursor manda sobre el plano. */
  const resolvePick = (offsetX: number, offsetY: number): Space3DCanvasPick & { cursor: Space3DVector | null } => {
    const viewport = viewportRef.current;
    const current = draftRef.current;
    const selection = viewport?.pickAt(offsetX, offsetY) ?? null;
    if (selection?.kind === 'node') {
      const node = modelRef.current.nodes.find((item) => item.id === selection.id);
      return { selection, point: node?.position ?? null, cursor: node?.position ?? null };
    }
    if (!current?.plane || !viewport?.pickPlane) return { selection, point: null, cursor: null };
    const hit = viewport.pickPlane(offsetX, offsetY, current.plane.axis, current.plane.offset);
    const point = hit ? current.snap(hit) : null;
    return { selection, point, cursor: point };
  };
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [unavailable, setUnavailable] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || unavailable) return undefined;

    let releasing = false;
    const release = () => {
      releasing = true;
      viewportRef.current?.dispose();
      viewportRef.current = null;
    };

    const onContextLost = (event: Event) => {
      event.preventDefault();
      // Una pérdida disparada por nuestra propia limpieza no es una caída del
      // visor: sólo cuenta la que llega con el visor todavía vivo.
      if (releasing) return;
      release();
      setUnavailable(true);
    };

    try {
      const viewport = createViewport({
        canvas,
        model: modelRef.current,
        layers: layersRef.current,
      });
      viewportRef.current = viewport;
      canvas.addEventListener('webglcontextlost', onContextLost);
      const observer = new ResizeObserver(() => viewport.resize());
      observer.observe(canvas);
      viewport.resize();
      return () => {
        observer.disconnect();
        canvas.removeEventListener('webglcontextlost', onContextLost);
        release();
      };
    } catch {
      release();
      setUnavailable(true);
      return undefined;
    }
    // `model` y `layers` se aplican por sus propios efectos: recrear el visor en
    // cada edición tiraría la cámara del usuario al suelo en cada tecla.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [createViewport, unavailable, attempt]);

  const modelRef = useRef(model);
  const layersRef = useRef(layers);

  const planeKey = draft?.plane ? `${draft.plane.axis}:${draft.plane.offset}:${draft.plane.step}` : '';
  const fromKey = draft?.from ? draft.from.join(',') : '';
  useEffect(() => {
    const current = draftRef.current;
    viewportRef.current?.setDraft?.(current ? { plane: current.plane, cursor: null, from: null } : null);
    if (!current) setHover(null);
  }, [planeKey, fromKey, draft === null]);

  useEffect(() => {
    modelRef.current = model;
    viewportRef.current?.setModel(model);
  }, [model]);

  useEffect(() => {
    layersRef.current = layers;
    viewportRef.current?.setLayers(layers);
  }, [layers]);

  useEffect(() => {
    viewportRef.current?.setAnimation?.(animate && model.deformed !== null);
  }, [animate, model]);

  // El preset lo gobierna quien aloja el lienzo (comparte estado con la lista
  // de Vistas del panel lateral); este efecto sólo lo aplica a la cámara viva.
  useEffect(() => {
    viewportRef.current?.setView(activeView);
  }, [activeView]);

  // Declarado tras el efecto de `model`: en un mismo commit React los ejecuta en
  // orden, así que `setView` ya calcula el encuadre sobre los límites nuevos.
  const refitRef = useRef(refitToken);
  useEffect(() => {
    if (refitRef.current === refitToken) return;
    refitRef.current = refitToken;
    viewportRef.current?.setView(activeView);
    // Sólo el token decide; `activeView` ya tiene su propio efecto.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [refitToken]);

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(document.fullscreenElement === stageRef.current);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) { void document.exitFullscreen(); return; }
    void stageRef.current?.requestFullscreen();
  }, []);

  const retry = useCallback(() => {
    setUnavailable(false);
    setAttempt((current) => current + 1);
  }, []);

  const summary = <div
    className="space3d-canvas-summary"
    role="group"
    aria-label={copy.summaryTitle}
  >
    <span><b>{model.nodes.length}</b> {copy.nodes}</span>
    <span><b>{model.members.length}</b> {copy.members}</span>
    <span><b>{model.supports.length}</b> {copy.supports}</span>
    <span><b>{model.loads.length}</b> {copy.loads}</span>
  </div>;

  return <div className="space3d-canvas">
    <div className="space3d-canvas-stage" ref={stageRef} data-fullscreen={isFullscreen || undefined}>
      <div className="space3d-canvas-topbar">
        {leadingControls ?? <label className="space3d-view-select">
          <span className="space3d-visually-hidden">{viewSelectLabel}</span>
          <select
            value={activeView}
            onChange={(event) => onViewChange?.(event.target.value as Space3DViewPreset)}
          >
            {SPACE3D_VIEW_PRESETS.map((preset) => <option key={preset} value={preset}>{viewLabels[preset]}</option>)}
          </select>
          <ChevronDown size={14} aria-hidden="true" />
        </label>}
        <div className="space3d-canvas-topbar-actions">
          <button type="button" className="space3d-tool" onClick={() => viewportRef.current?.zoomBy(0.8)} title={zoomInLabel}>
            <Plus size={16} aria-hidden="true" /><span className="space3d-visually-hidden">{zoomInLabel}</span>
          </button>
          <button type="button" className="space3d-tool" onClick={() => viewportRef.current?.zoomBy(1.25)} title={zoomOutLabel}>
            <Minus size={16} aria-hidden="true" /><span className="space3d-visually-hidden">{zoomOutLabel}</span>
          </button>
          <button type="button" className="space3d-tool" onClick={() => onViewChange?.('isometric')} title={resetLabel}>
            <RotateCcw size={16} aria-hidden="true" /><span className="space3d-visually-hidden">{resetLabel}</span>
          </button>
          <button type="button" className="space3d-tool" onClick={toggleFullscreen} title={isFullscreen ? fullscreenExitLabel : fullscreenEnterLabel}>
            {isFullscreen ? <Minimize2 size={16} aria-hidden="true" /> : <Maximize2 size={16} aria-hidden="true" />}
            <span className="space3d-visually-hidden">{isFullscreen ? fullscreenExitLabel : fullscreenEnterLabel}</span>
          </button>
          {trailingControls}
        </div>
      </div>
      {unavailable
        ? <div className="space3d-canvas-fallback" role="alert">
          <AlertTriangle size={22} aria-hidden="true" />
          <div>
            <strong>{copy.fallbackTitle}</strong>
            <p>{copy.fallbackBody}</p>
          </div>
          <button type="button" className="space3d-button" onClick={retry}>
            <RotateCcw size={16} aria-hidden="true" /> {copy.retry}
          </button>
        </div>
        : <canvas
          ref={canvasRef}
          className="space3d-canvas-surface"
          role="img"
          aria-label={copy.label}
          // Enfocable para que la órbita por teclado de OrbitControls funcione;
          // la selección sin puntero se hace desde la lista de entidades.
          tabIndex={0}
          data-drafting={draft ? true : undefined}
          onPointerDown={(event) => {
            const additive = event.ctrlKey || event.metaKey || event.shiftKey;
            const windowMode = event.button === 0 && !draftRef.current && Boolean(windowSelectRef.current) && (windowSelect || event.shiftKey);
            pointerDownPos.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId, window: windowMode, additive };
            if (windowMode) viewportRef.current?.setNavigationEnabled?.(false);
          }}
          onPointerMove={(event) => {
            const start = pointerDownPos.current;
            if (start?.window && start.pointerId === event.pointerId) {
              const rect = event.currentTarget.getBoundingClientRect();
              setBand({ x0: start.x - rect.left, y0: start.y - rect.top, x1: event.clientX - rect.left, y1: event.clientY - rect.top });
              return;
            }
            const current = draftRef.current;
            if (!current || event.buttons !== 0) return;
            const rect = event.currentTarget.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            const pick = resolvePick(x, y);
            viewportRef.current?.setDraft?.({ plane: current.plane, cursor: pick.cursor, from: current.from });
            const nodeId = pick.selection?.kind === 'node' ? pick.selection.id : null;
            setHover(pick.cursor ? { x, y, label: current.describe(pick.cursor, nodeId) } : null);
          }}
          onPointerLeave={() => {
            const current = draftRef.current;
            if (current) viewportRef.current?.setDraft?.({ plane: current.plane, cursor: null, from: null });
            setHover(null);
          }}
          onPointerUp={(event) => {
            const start = pointerDownPos.current;
            if (start?.window) {
              viewportRef.current?.setNavigationEnabled?.(true);
              setBand(null);
            }
            if ((!selectRef.current && !draftPickRef.current) || !start || start.pointerId !== event.pointerId) return;
            pointerDownPos.current = null;
            const dx = event.clientX - start.x;
            const dy = event.clientY - start.y;
            const rect = event.currentTarget.getBoundingClientRect();
            if (start.window && Math.hypot(dx, dy) > 6 && windowSelectRef.current) {
              const pick = viewportRef.current?.pickRect?.(start.x - rect.left, start.y - rect.top, event.clientX - rect.left, event.clientY - rect.top, dx >= 0 ? 'window' : 'crossing');
              if (pick) windowSelectRef.current(pick, { additive: start.additive });
              return;
            }
            // Orbit/pan is movement, not duration. A stationary slow press remains
            // a valid touch selection for users with reduced motor dexterity.
            if (Math.hypot(dx, dy) > 6) return;
            if (draftRef.current && draftPickRef.current) {
              const { selection, point } = resolvePick(event.clientX - rect.left, event.clientY - rect.top);
              draftPickRef.current({ selection, point });
              return;
            }
            selectRef.current?.(viewportRef.current?.pickAt(event.clientX - rect.left, event.clientY - rect.top) ?? null, { additive: start.additive });
          }}
          onPointerCancel={(event) => {
            if (pointerDownPos.current?.pointerId === event.pointerId) {
              if (pointerDownPos.current.window) viewportRef.current?.setNavigationEnabled?.(true);
              pointerDownPos.current = null;
              setBand(null);
            }
          }}
        />}
    </div>

    {hover ? <div className="space3d-cursor-chip" aria-hidden="true" style={{ left: hover.x, top: hover.y }}>{hover.label}</div> : null}
    {band ? <div
      className="space3d-window-band"
      data-crossing={band.x1 < band.x0 || undefined}
      aria-hidden="true"
      style={{ left: Math.min(band.x0, band.x1), top: Math.min(band.y0, band.y1), width: Math.abs(band.x1 - band.x0), height: Math.abs(band.y1 - band.y0) }}
    /> : null}

    <div className="space3d-canvas-controls">
      {summary}
    </div>
  </div>;
};
