/**
 * Viewport Three.js de Space 3D, con el vocabulario de ETABS/SAP2000.
 *
 *   · Vistas: 3D en perspectiva y planta/alzados ortográficos. En una vista
 *     plana no se gira: se desplaza y se acerca, como en un plano.
 *   · Rejilla de ejes con burbujas (A, B, C · 1, 2, 3) y niveles de piso.
 *   · Barras como línea analítica o extruidas con su perfil real (I, cajón,
 *     tubo, rectángulo). Lo extruido lleva una luz suave para leer el volumen;
 *     el resto del dibujo sigue siendo plano. Es la única excepción a la regla
 *     visual del lienzo, y la pide el propio modo: un perfil I sin sombreado
 *     es una mancha.
 *   · Diagramas rellenos de P, V2, V3, T, M2 y M3 en el plano de cada barra,
 *     del lado traccionado; deformada curva desde la elástica de cada barra,
 *     animable; cargas en barra como filas de flechas.
 *   · Selección por clic y por ventana (izquierda→derecha: dentro;
 *     derecha→izquierda: cruzando).
 *
 * Los colores se leen de los tokens del sistema en tiempo de ejecución, de modo
 * que el tema Día/Noche del producto gobierna también la escena.
 *
 * Render bajo demanda: no hay bucle de animación salvo mientras se anima la
 * deformada. Un marco espacial estático no cambia entre fotogramas.
 */
// Importaciones nombradas, no `import * as THREE`: el paquete `three` exporta
// cientos de clases que este visor nunca toca.
import {
  ArrowHelper, BoxGeometry, BufferGeometry, CanvasTexture, Color, ConeGeometry, CylinderGeometry, DirectionalLight,
  DoubleSide, ExtrudeGeometry, Float32BufferAttribute, Group, HemisphereLight, InstancedMesh, LineBasicMaterial,
  LineSegments, MathUtils, Matrix4, Mesh, MeshBasicMaterial, MeshLambertMaterial, OrthographicCamera, Path,
  PerspectiveCamera, Plane, Points, PointsMaterial, Quaternion, Raycaster, Scene, Shape, SphereGeometry, Sprite,
  SpriteMaterial, Vector2, Vector3, WebGLRenderer,
  type Camera, type Material, type Object3D,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { computeSpace3DCameraPlacement, type Space3DViewPreset } from './cameraModel';
import type { Space3DSceneMember, Space3DSceneModel, Space3DSceneSection } from './sceneModel';
import type { Space3DSelection } from '../store/Space3DProjectContext';

const SPACE3D_SCENE_LAYERS = Object.freeze([
  'grid', 'ghost', 'members', 'extruded', 'hinges', 'nodes', 'supports', 'loads', 'reactions', 'local-axes',
  'diagrams', 'deformed', 'labels',
] as const);
type Space3DSceneLayer = (typeof SPACE3D_SCENE_LAYERS)[number];

export interface Space3DLayerVisibility {
  readonly grid: boolean;
  readonly loads: boolean;
  readonly supports: boolean;
  readonly labels: boolean;
  readonly deformed: boolean;
  /** Barras con su perfil real en lugar de la línea analítica. */
  readonly extruded?: boolean;
}

export const SPACE3D_DEFAULT_LAYERS: Space3DLayerVisibility = Object.freeze({
  grid: true, loads: true, supports: true, labels: true, deformed: true, extruded: false,
});

export interface Space3DRendererLike {
  setPixelRatio(value: number): void;
  setSize(width: number, height: number, updateStyle?: boolean): void;
  render(scene: Scene, camera: Camera): void;
  dispose(): void;
  forceContextLoss?(): void;
  /* Los cuatro de la brújula de ejes, opcionales a propósito: sin ellos el
     visor dibuja el modelo igual y se queda sin el recuadro de la esquina. */
  setViewport?(x: number, y: number, width: number, height: number): void;
  setScissor?(x: number, y: number, width: number, height: number): void;
  setScissorTest?(enabled: boolean): void;
  clearDepth?(): void;
}

export interface Space3DControlsLike {
  target: Vector3;
  enableDamping: boolean;
  /** Desactiva la órbita mientras se arrastra una ventana de selección. */
  enabled?: boolean;
  /** Cámara gobernada; se cambia al pasar de perspectiva a ortográfica. */
  object?: Camera;
  enableRotate?: boolean;
  mouseButtons?: { LEFT?: number | null; MIDDLE?: number | null; RIGHT?: number | null };
  touches?: { ONE?: number | null; TWO?: number | null };
  update(): void;
  addEventListener(type: 'change', listener: () => void): void;
  removeEventListener(type: 'change', listener: () => void): void;
  dispose(): void;
}

interface Space3DViewportOptions {
  readonly canvas: HTMLCanvasElement;
  readonly model: Space3DSceneModel;
  readonly layers?: Space3DLayerVisibility;
  readonly initialView?: Space3DViewPreset;
  readonly createRenderer?: (canvas: HTMLCanvasElement) => Space3DRendererLike;
  readonly createControls?: (camera: PerspectiveCamera, canvas: HTMLCanvasElement) => Space3DControlsLike;
}

/** Ayudas del modelado directo: plano de trabajo, punto bajo el cursor y barra en curso. */
export interface Space3DDraftOverlay {
  readonly plane: { readonly axis: 'x' | 'y' | 'z'; readonly offset: number; readonly step: number } | null;
  readonly cursor: readonly [number, number, number] | null;
  readonly from: readonly [number, number, number] | null;
}

/** Resultado de una selección por ventana. */
export interface Space3DWindowPick {
  readonly nodes: readonly string[];
  readonly members: readonly string[];
}

export interface Space3DViewport {
  readonly scene: Scene;
  readonly camera: PerspectiveCamera | OrthographicCamera;
  readonly controlsTarget: Vector3;
  setModel(model: Space3DSceneModel): void;
  setLayers(layers: Space3DLayerVisibility): void;
  setView(preset: Space3DViewPreset): void;
  zoomBy(factor: number): void;
  resize(): void;
  render(): void;
  requestRender(): void;
  pickAt(offsetX: number, offsetY: number): Space3DSelection | null;
  /** Punto donde el rayo del puntero corta el plano de trabajo, o `null` si el plano se ve de canto. */
  pickPlane?(offsetX: number, offsetY: number, axis: 'x' | 'y' | 'z', offset: number): [number, number, number] | null;
  /** Nudos y barras dentro (`window`) o tocados (`crossing`) por un rectángulo de pantalla. */
  pickRect?(x0: number, y0: number, x1: number, y1: number, mode: 'window' | 'crossing'): Space3DWindowPick;
  setDraft?(draft: Space3DDraftOverlay | null): void;
  /** Anima la deformada (o el modo) oscilando entre la geometría original y la deformada. */
  setAnimation?(active: boolean): void;
  /** Suspende la órbita/desplazamiento (selección por ventana en curso). */
  setNavigationEnabled?(enabled: boolean): void;
  dispose(): void;
}

/**
 * Paleta técnica. Los valores por defecto son los tokens del sistema; en el
 * navegador se sobreescriben con el valor calculado.
 *
 * `axisY` usa el TRAZO de marca, no el relleno: el relleno lima mide 1,8:1
 * contra el lienzo claro y un eje pintado con él desaparecería.
 */
const TOKEN_COLORS = {
  member: ['--sc-color-canvas-member', '#23312c'],
  /* La selección usa el acento de acción, no `selection-stroke`: en Día ese
     trazo es el mismo casi negro que las barras y en una escena con cientos de
     ellas no distinguía nada. Es el mismo color del borrador de dibujo. */
  memberSelected: ['--sc-color-action-primary', '#f0503f'],
  node: ['--sc-color-text-primary', '#23312c'],
  nodeSelected: ['--sc-color-action-primary', '#f0503f'],
  support: ['--sc-color-technical-reaction', '#3a72e3'],
  load: ['--sc-color-technical-load', '#1a4fe0'],
  loadDistributed: ['--sc-color-technical-distributed', '#c0565b'],
  /* El momento APLICADO es una carga, no una respuesta: tiene su propio verde. */
  loadMoment: ['--sc-color-load-moment-applied', '#009b7a'],
  axial: ['--sc-color-technical-axial', '#276b76'],
  shear: ['--sc-color-technical-shear', '#a66b24'],
  moment: ['--sc-color-technical-moment', '#b34d55'],
  reaction: ['--sc-color-technical-reaction', '#3a72e3'],
  deformed: ['--sc-color-technical-deformed', '#8b5cf6'],
  grid: ['--sc-color-canvas-grid', '#e8e1d7'],
  gridStrong: ['--sc-color-canvas-grid-strong', '#d9d0c4'],
  gridInk: ['--sc-color-text-secondary', '#607068'],
  axisX: ['--sc-color-technical-axis', '#ad5e18'],
  axisY: ['--sc-color-action-ink', '#468c09'],
  axisZ: ['--sc-color-brand-secondary', '#0f95d1'],
  label: ['--sc-color-text-secondary', '#607068'],
  draft: ['--sc-color-action-primary', '#ff8e80'],
  surface: ['--sc-color-surface-elevated', '#fbfbf8'],
} as const;

type ColorRole = keyof typeof TOKEN_COLORS;

const readPalette = (): Record<ColorRole, Color> => {
  let computed: CSSStyleDeclaration | null = null;
  try {
    computed = typeof document === 'undefined'
      ? null
      : getComputedStyle(document.querySelector('.space3d-screen') ?? document.documentElement);
  } catch {
    computed = null;
  }
  const entries = Object.entries(TOKEN_COLORS).map(([role, [token, fallback]]) => {
    const raw = computed?.getPropertyValue(token).trim();
    let color: Color;
    try {
      color = new Color(raw && raw.length > 0 ? raw : fallback);
    } catch {
      color = new Color(fallback);
    }
    return [role, color] as const;
  });
  return Object.fromEntries(entries) as Record<ColorRole, Color>;
};

const lineGeometry = (values: readonly number[]): BufferGeometry => {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(values.length > 0 ? [...values] : [], 3));
  return geometry;
};

/**
 * Etiqueta como sprite de textura. Devuelve `null` cuando el entorno no ofrece
 * un contexto 2D (jsdom, algunos webviews): el visor sigue siendo usable sin
 * texto y no se cae por un accesorio.
 */
let labelsSupported: boolean | null = null;

/**
 * Recuadro de la brújula de ejes, en coordenadas de WebGL —origen abajo a la
 * izquierda—, dentro del lienzo.
 */
export const worldAxesViewport = (
  width: number,
  height: number,
  bottomInset = 0,
): { x: number; y: number; size: number } => {
  const safeWidth = Number.isFinite(width) && width > 0 ? width : 1;
  const safeHeight = Number.isFinite(height) && height > 0 ? height : 1;
  const shortest = Math.min(safeWidth, safeHeight);
  const size = Math.round(Math.max(64, Math.min(124, shortest * 0.19)));
  const margin = Math.round(Math.min(16, shortest * 0.03));
  const inset = Number.isFinite(bottomInset) && bottomInset > 0 ? Math.round(bottomInset) : 0;
  return {
    x: margin,
    y: margin + inset,
    size: Math.max(1, Math.min(size, Math.floor(shortest) - margin * 2)),
  };
};

/** `62px` → 62. Cualquier otra cosa, incluido el valor sin declarar, → 0. */
export const parseGizmoInset = (declared: string): number => {
  const parsed = Number.parseFloat(declared);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const LABEL_FONT_PX = 44;
const LABEL_FONT = `600 ${LABEL_FONT_PX}px "IBM Plex Mono", ui-monospace, monospace`;
const LABEL_PADDING_PX = 16;
const LABEL_MAX_WIDTH_PX = 768;

/**
 * Tamaño de la textura de una etiqueta y la relación que debe tener su sprite:
 * la caja nunca es más estrecha que la tinta y el sprite hereda la relación
 * real de la textura, para que «42,7 kN» no se lea «2,7 k».
 */
export const labelTextureMetrics = (
  measuredWidth: number,
): { width: number; height: number; aspect: number; inkWidth: number } => {
  const ink = Number.isFinite(measuredWidth) && measuredWidth > 0 ? measuredWidth : LABEL_FONT_PX;
  const height = Math.round(LABEL_FONT_PX * 1.5);
  const width = Math.min(LABEL_MAX_WIDTH_PX, Math.max(height, Math.ceil(ink + LABEL_PADDING_PX * 2)));
  return { width, height, aspect: width / height, inkWidth: Math.max(1, width - LABEL_PADDING_PX * 2) };
};

/** Tamaño de un rótulo en píxeles de pantalla; los sprites no se atenúan con la distancia. */
const LABEL_SCREEN_PX = 15;

const makeLabel = (text: string, color: Color, size: number, options: { background?: Color; ring?: boolean } = {}): Sprite | null => {
  if (typeof document === 'undefined' || labelsSupported === false) return null;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  labelsSupported = context !== null;
  if (!context) return null;

  context.font = LABEL_FONT;
  const metrics = labelTextureMetrics(context.measureText(text).width);
  const width = options.ring ? metrics.height : metrics.width;
  const { height, inkWidth } = metrics;
  canvas.width = width;
  canvas.height = height;
  context.clearRect(0, 0, width, height);
  if (options.ring) {
    // Burbuja de eje: círculo con el rótulo dentro.
    context.beginPath();
    context.arc(width / 2, height / 2, height / 2 - 4, 0, Math.PI * 2);
    context.fillStyle = `#${(options.background ?? new Color('#ffffff')).getHexString()}`;
    context.fill();
    context.lineWidth = 4;
    context.strokeStyle = `#${color.getHexString()}`;
    context.stroke();
  } else if (options.background) {
    context.fillStyle = `#${options.background.getHexString()}`;
    context.globalAlpha = 0.82;
    const radius = 14;
    context.beginPath();
    context.roundRect?.(0, 6, width, height - 12, radius);
    context.fill();
    context.globalAlpha = 1;
  }
  context.font = LABEL_FONT;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = `#${color.getHexString()}`;
  context.fillText(text, width / 2, height / 2 + 2, options.ring ? height - 20 : inkWidth);

  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  const sprite = new Sprite(new SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  // `size` es la altura en fracción del alto de vista; el visor la convierte
  // en unidades de mundo en cada cuadro (`fitLabels`). En la brújula, que
  // tiene cámara fija, es directamente la altura en mundo.
  sprite.userData.screenHeight = size;
  sprite.userData.aspect = width / height;
  sprite.scale.set(size * (width / height), size, 1);
  sprite.renderOrder = 20;
  return sprite;
};

type Vec3 = readonly [number, number, number];

const vec = (value: Vec3) => new Vector3(value[0], value[1], value[2]);

/**
 * Perfil 2D de una sección, en el plano (ancho, canto) del eje local
 * (3, 2). Se extruye a lo largo de `+Z` con longitud 1 y se escala por barra.
 */
const sectionShape = (section: Space3DSceneSection): Shape => {
  const d = section.depth;
  const b = section.width;
  const shape = new Shape();
  if (section.shape === 'I') {
    const tf = Math.min(section.thickness ?? d * 0.06, d / 3);
    const tw = Math.min(section.web ?? d * 0.035, b / 2);
    const hd = d / 2;
    const hb = b / 2;
    shape.moveTo(-hb, -hd);
    shape.lineTo(hb, -hd);
    shape.lineTo(hb, -hd + tf);
    shape.lineTo(tw / 2, -hd + tf);
    shape.lineTo(tw / 2, hd - tf);
    shape.lineTo(hb, hd - tf);
    shape.lineTo(hb, hd);
    shape.lineTo(-hb, hd);
    shape.lineTo(-hb, hd - tf);
    shape.lineTo(-tw / 2, hd - tf);
    shape.lineTo(-tw / 2, -hd + tf);
    shape.lineTo(-hb, -hd + tf);
    shape.closePath();
    return shape;
  }
  if (section.shape === 'pipe' || section.shape === 'circle') {
    const r = d / 2;
    shape.absarc(0, 0, r, 0, Math.PI * 2, false);
    if (section.shape === 'pipe') {
      const hole = new Path();
      hole.absarc(0, 0, Math.max(r * 0.2, r - (section.thickness ?? r * 0.1)), 0, Math.PI * 2, true);
      shape.holes.push(hole);
    }
    return shape;
  }
  shape.moveTo(-b / 2, -d / 2);
  shape.lineTo(b / 2, -d / 2);
  shape.lineTo(b / 2, d / 2);
  shape.lineTo(-b / 2, d / 2);
  shape.closePath();
  if (section.shape === 'box') {
    const t = Math.min(section.thickness ?? Math.min(b, d) * 0.08, Math.min(b, d) / 3);
    const hole = new Path();
    hole.moveTo(-b / 2 + t, -d / 2 + t);
    hole.lineTo(-b / 2 + t, d / 2 - t);
    hole.lineTo(b / 2 - t, d / 2 - t);
    hole.lineTo(b / 2 - t, -d / 2 + t);
    hole.closePath();
    shape.holes.push(hole);
  }
  return shape;
};

/** Matriz que lleva el perfil extruido (x=ancho, y=canto, z=eje) a la barra. */
const memberFrameMatrix = (member: Space3DSceneMember, matrix: Matrix4): boolean => {
  if (!member.basis) return false;
  const { x, y, z } = member.basis;
  const L = member.length;
  // Columnas: −z_local (ancho, con el signo que conserva la orientación), y_local, x_local·L.
  matrix.set(
    -z[0], y[0], x[0] * L, member.start[0],
    -z[1], y[1], x[1] * L, member.start[1],
    -z[2], y[2], x[2] * L, member.start[2],
    0, 0, 0, 1,
  );
  return true;
};

export const createSpace3DViewport = (options: Space3DViewportOptions): Space3DViewport => {
  const { canvas } = options;
  let model = options.model;
  let layers = options.layers ?? SPACE3D_DEFAULT_LAYERS;
  let palette = readPalette();

  const scene = new Scene();
  const perspective = new PerspectiveCamera(45, 1, 0.1, 1_000);
  const orthographic = new OrthographicCamera(-1, 1, 1, -1, 0.1, 1_000);
  let camera: PerspectiveCamera | OrthographicCamera = perspective;
  // Escena aparte para la brújula de ejes: no comparte cámara, ni escala, ni
  // profundidad con el modelo, que es justo lo que la mantiene fuera de él.
  const gizmoScene = new Scene();
  const gizmoGroup = new Group();
  gizmoScene.add(gizmoGroup);
  const gizmoCamera = new PerspectiveCamera(45, 1, 0.1, 20);
  let viewportSize = { width: 1, height: 1 };
  let gizmoInset = 0;
  const renderer = (options.createRenderer ?? defaultRenderer)(canvas);
  const controls = (options.createControls ?? defaultControls)(perspective, canvas);
  controls.enableDamping = false;

  renderer.setPixelRatio(Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, 2));

  // Luz sólo para lo extruido: los materiales básicos la ignoran.
  const hemisphere = new HemisphereLight(0xffffff, 0x8a8f8c, 2.2);
  const keyLight = new DirectionalLight(0xffffff, 1.4);
  keyLight.position.set(0.5, 1, 0.8);
  scene.add(hemisphere);
  scene.add(keyLight);

  const groups = new Map<Space3DSceneLayer, Group>();
  for (const name of SPACE3D_SCENE_LAYERS) {
    const group = new Group();
    group.name = name;
    groups.set(name, group);
    scene.add(group);
  }

  // Índices paralelos: el picking traduce el vértice tocado a un identificador
  // de dominio sin buscar por coordenadas ni por tolerancias inventadas.
  let nodeIds: string[] = [];
  let memberIds: string[] = [];
  let nodePoints: Points | null = null;
  let memberLines: LineSegments | null = null;
  let activeView: Space3DViewPreset = options.initialView ?? 'isometric';

  let disposed = false;
  let frame = 0;
  let animationFrame = 0;
  let animating = false;
  let animationStart = 0;
  /** Segmentos de la deformada: origen y destino para animar. */
  let deformedSegments: { base: Vector3[]; target: Vector3[] } = { base: [], target: [] };
  let deformedMesh: InstancedMesh | null = null;

  const labelHolders: readonly Space3DSceneLayer[] = ['grid', 'labels', 'local-axes'];
  const spritePosition = new Vector3();
  /**
   * Rótulos de tamaño constante en pantalla: la altura de mundo que cubre una
   * fracción de la vista depende de la distancia (perspectiva) o del zoom
   * (ortográfica).
   */
  const fitLabels = () => {
    const perspectiveCamera = camera instanceof PerspectiveCamera ? camera : null;
    const tangent = perspectiveCamera ? 2 * Math.tan(MathUtils.degToRad(perspectiveCamera.fov / 2)) : 0;
    const orthographicHeight = camera instanceof OrthographicCamera ? (camera.top - camera.bottom) / camera.zoom : 0;
    for (const name of labelHolders) {
      for (const child of groups.get(name)!.children) {
        if (!(child instanceof Sprite)) continue;
        const fraction = child.userData.screenHeight as number | undefined;
        if (!fraction) continue;
        const worldHeight = perspectiveCamera
          ? child.getWorldPosition(spritePosition).distanceTo(camera.position) * tangent
          : orthographicHeight;
        const height = fraction * worldHeight;
        child.scale.set(height * (child.userData.aspect as number), height, 1);
      }
    }
  };

  const render = () => {
    if (disposed) return;
    keyLight.position.copy(camera.position).sub(controls.target).normalize().add(new Vector3(0.3, 0.8, 0.2));
    fitLabels();
    renderer.render(scene, camera);
    renderWorldAxes();
  };

  /**
   * Segunda pasada en un recuadro de la esquina. Los cuatro métodos que hacen
   * falta son OPCIONALES en `Space3DRendererLike`.
   */
  const renderWorldAxes = () => {
    if (!renderer.setViewport || !renderer.setScissor || !renderer.setScissorTest || !renderer.clearDepth) return;
    const box = worldAxesViewport(viewportSize.width, viewportSize.height, gizmoInset);
    gizmoCamera.position.copy(camera.position).sub(controls.target).normalize().multiplyScalar(4.2);
    gizmoCamera.up.copy(camera.up);
    gizmoCamera.lookAt(0, 0, 0);
    gizmoCamera.updateMatrixWorld(true);

    renderer.clearDepth();
    renderer.setScissorTest(true);
    renderer.setScissor(box.x, box.y, box.size, box.size);
    renderer.setViewport(box.x, box.y, box.size, box.size);
    renderer.render(gizmoScene, gizmoCamera);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, viewportSize.width, viewportSize.height);
  };

  const requestRender = () => {
    if (disposed || frame !== 0 || animating) return;
    frame = requestAnimationFrame(() => { frame = 0; render(); });
  };

  const clearGroup = (name: Space3DSceneLayer) => {
    const group = groups.get(name)!;
    for (const child of [...group.children]) {
      group.remove(child);
      disposeObject(child);
    }
  };

  const buildWorldAxes = () => {
    for (const child of [...gizmoGroup.children]) {
      gizmoGroup.remove(child);
      disposeObject(child);
    }
    const origin = new Vector3(0, 0, 0);
    const axes: [Vector3, Color, string][] = [
      [new Vector3(1, 0, 0), palette.axisX, 'X'],
      [new Vector3(0, 1, 0), palette.axisY, 'Y'],
      [new Vector3(0, 0, 1), palette.axisZ, 'Z'],
    ];
    for (const [direction, color, letter] of axes) {
      gizmoGroup.add(new ArrowHelper(direction, origin, 1, color, 0.28, 0.16));
      const label = makeLabel(letter, color, 0.3);
      if (label) {
        label.position.copy(direction).multiplyScalar(1.3);
        gizmoGroup.add(label);
      }
    }
  };

  /** Tamaño de un rótulo, en fracción del alto de vista. */
  const labelSize = (scale = 1) => (LABEL_SCREEN_PX / Math.max(viewportSize.height, 240)) * scale;

  // ────────────────────────────── Rejilla ──────────────────────────────

  const buildGrid = () => {
    clearGroup('grid');
    const grid = model.grid;
    const group = groups.get('grid')!;
    const span = Math.max(model.bounds.span, 4);
    const margin = span * 0.08;
    const scope = model.scope ?? { kind: '3d' as const };
    const xs = grid?.xLines ?? [];
    const zs = grid?.zLines ?? [];
    const stories = grid?.stories ?? [];
    if (!grid || (xs.length === 0 && zs.length === 0)) return;
    const xMin = Math.min(...xs.map((line) => line.coordinate), model.bounds.min[0]) - margin;
    const xMax = Math.max(...xs.map((line) => line.coordinate), model.bounds.max[0]) + margin;
    const zMin = Math.min(...zs.map((line) => line.coordinate), model.bounds.min[2]) - margin;
    const zMax = Math.max(...zs.map((line) => line.coordinate), model.bounds.max[2]) + margin;
    const yMin = stories.length ? Math.min(...stories.map((story) => story.elevation)) : model.bounds.min[1];
    const yMax = (stories.length ? Math.max(...stories.map((story) => story.elevation)) : model.bounds.max[1]) + margin;
    const positions: number[] = [];
    const bubbleSize = labelSize(1.9);
    const bubbles: { text: string; position: Vector3 }[] = [];

    if (scope.kind === 'elevation') {
      // Alzado: ejes transversales verticales y niveles horizontales.
      const along = scope.axis === 'z' ? xs : zs;
      const fixed = scope.coordinate;
      const low = along.length ? Math.min(...along.map((line) => line.coordinate)) - margin : 0;
      const high = along.length ? Math.max(...along.map((line) => line.coordinate)) + margin : 0;
      const at = (u: number, y: number): [number, number, number] => (scope.axis === 'z' ? [u, y, fixed] : [fixed, y, u]);
      for (const line of along) {
        positions.push(...at(line.coordinate, yMin - margin), ...at(line.coordinate, yMax));
        bubbles.push({ text: line.id, position: vec(at(line.coordinate, yMax + margin * 0.6)) });
      }
      for (const story of stories) {
        positions.push(...at(low, story.elevation), ...at(high, story.elevation));
        bubbles.push({ text: story.name, position: vec(at(low - margin * 0.9, story.elevation)) });
      }
    } else {
      const y = grid.elevation;
      for (const line of xs) {
        positions.push(line.coordinate, y, zMin, line.coordinate, y, zMax);
        bubbles.push({ text: line.id, position: new Vector3(line.coordinate, y, zMin - margin * 0.7) });
      }
      for (const line of zs) {
        positions.push(xMin, y, line.coordinate, xMax, y, line.coordinate);
        bubbles.push({ text: line.id, position: new Vector3(xMin - margin * 0.7, y, line.coordinate) });
      }
    }
    const lines = new LineSegments(lineGeometry(positions), new LineBasicMaterial({
      color: palette.gridInk, transparent: true, opacity: 0.32, depthWrite: false,
    }));
    lines.name = 'grid-lines';
    group.add(lines);
    for (const bubble of bubbles) {
      const ring = bubble.text.length <= 3;
      const label = makeLabel(bubble.text, palette.gridInk, ring ? bubbleSize : labelSize(1.1), ring ? { ring: true, background: palette.surface } : {});
      if (!label) break;
      label.position.copy(bubble.position);
      group.add(label);
    }
  };

  // ────────────────────────────── Modelo ──────────────────────────────

  const memberColor = (member: Space3DSceneMember): Color => {
    if (member.selected) return palette.memberSelected;
    return palette.member;
  };

  const extrudedColor = (member: Space3DSceneMember): Color => {
    if (member.selected) return palette.memberSelected;
    const base = new Color(0xb8bdb9);
    if (member.role === 'column') return base.clone().lerp(palette.member, 0.25);
    if (member.role === 'brace') return base.clone().lerp(palette.axial, 0.35);
    return base.clone().lerp(palette.surface, 0.2);
  };

  const buildModel = () => {
    for (const name of ['ghost', 'members', 'extruded', 'hinges', 'nodes', 'supports', 'loads', 'reactions', 'local-axes', 'diagrams', 'deformed', 'labels'] as const) clearGroup(name);
    deformedMesh = null;
    deformedSegments = { base: [], target: [] };

    const span = model.bounds.span;
    const scoped = model.members.filter((member) => member.inScope !== false);
    const ghosts = model.members.filter((member) => member.inScope === false);
    const extruded = Boolean(layers.extruded);

    // Contexto: lo que no está en la planta o el alzado, tenue y sin picking.
    if (ghosts.length > 0) {
      const ghostLines = new LineSegments(
        lineGeometry(ghosts.flatMap((member) => [...member.start, ...member.end])),
        new LineBasicMaterial({ color: palette.member, transparent: true, opacity: 0.1, depthWrite: false }),
      );
      ghostLines.name = 'ghost-lines';
      groups.get('ghost')!.add(ghostLines);
    }

    memberIds = scoped.map((member) => member.id);
    const memberGeometry = lineGeometry(scoped.flatMap((member) => [...member.start, ...member.end]));
    memberLines = new LineSegments(memberGeometry, new LineBasicMaterial({ transparent: true, opacity: 0 }));
    memberLines.name = 'member-lines';
    groups.get('members')!.add(memberLines);

    // Trazo analítico con espesor de pantalla legible: no representa la sección.
    const memberRadius = Math.max(span * 0.0045, 0.018);
    if (scoped.length > 0 && !extruded) {
      const memberInstances = new InstancedMesh(new CylinderGeometry(1, 1, 1, 8, 1), new MeshBasicMaterial({ color: 0xffffff }), scoped.length);
      memberInstances.name = 'member-instances';
      const yAxis = new Vector3(0, 1, 0);
      const matrix = new Matrix4();
      const quaternion = new Quaternion();
      const position = new Vector3();
      const scale = new Vector3();
      const direction = new Vector3();
      scoped.forEach((member, index) => {
        const start = vec(member.start);
        direction.copy(vec(member.end)).sub(start);
        const length = direction.length();
        const radius = member.selected ? memberRadius * 1.6 : member.kind === 'truss' ? memberRadius * 0.75 : memberRadius;
        position.copy(start).addScaledVector(direction, 0.5);
        quaternion.setFromUnitVectors(yAxis, direction.normalize());
        scale.set(radius, length, radius);
        matrix.compose(position, quaternion, scale);
        memberInstances.setMatrixAt(index, matrix);
        memberInstances.setColorAt(index, memberColor(member));
      });
      memberInstances.instanceMatrix.needsUpdate = true;
      if (memberInstances.instanceColor) memberInstances.instanceColor.needsUpdate = true;
      groups.get('members')!.add(memberInstances);
    }

    if (extruded) buildExtruded(scoped);

    // Rótulas: un anillo cerca del extremo liberado, como en ETABS.
    const hinged = scoped.flatMap((member) => [
      ...(member.hinges?.i ? [{ member, t: Math.min(0.08, 0.35 * span * 0.02 / Math.max(member.length, 1e-6) + 0.04) }] : []),
      ...(member.hinges?.j ? [{ member, t: 1 - Math.min(0.08, 0.35 * span * 0.02 / Math.max(member.length, 1e-6) + 0.04) }] : []),
    ]);
    if (hinged.length > 0) {
      const hinges = new InstancedMesh(new SphereGeometry(1, 12, 8), new MeshBasicMaterial({ color: palette.surface }), hinged.length);
      hinges.name = 'hinge-instances';
      const matrix = new Matrix4();
      const radius = Math.max(span * 0.008, 0.03) * (extruded ? 2.2 : 1);
      hinged.forEach(({ member, t }, index) => {
        const position = vec(member.start).lerp(vec(member.end), t);
        matrix.compose(position, new Quaternion(), new Vector3(radius, radius, radius));
        hinges.setMatrixAt(index, matrix);
      });
      hinges.instanceMatrix.needsUpdate = true;
      groups.get('hinges')!.add(hinges);
      const rims = new InstancedMesh(new SphereGeometry(1, 12, 8), new MeshBasicMaterial({ color: palette.member, wireframe: true }), hinged.length);
      hinged.forEach(({ member, t }, index) => {
        const position = vec(member.start).lerp(vec(member.end), t);
        matrix.compose(position, new Quaternion(), new Vector3(radius * 1.05, radius * 1.05, radius * 1.05));
        rims.setMatrixAt(index, matrix);
      });
      rims.instanceMatrix.needsUpdate = true;
      groups.get('hinges')!.add(rims);
    }

    const scopedNodes = model.nodes.filter((node) => node.inScope !== false);
    nodeIds = scopedNodes.map((node) => node.id);
    const nodeGeometry = lineGeometry(scopedNodes.flatMap((node) => [...node.position]));
    nodeGeometry.setAttribute('color', new Float32BufferAttribute(scopedNodes.flatMap((node) => {
      const color = node.selected ? palette.nodeSelected : palette.node;
      return [color.r, color.g, color.b];
    }), 3));
    nodePoints = new Points(nodeGeometry, new PointsMaterial({
      size: Math.max(span * 0.02, 0.05), sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0,
    }));
    nodePoints.name = 'node-points';
    groups.get('nodes')!.add(nodePoints);

    const nodeRadius = Math.max(span * 0.0075, 0.03) * (extruded ? 1.4 : 1);
    if (scopedNodes.length > 0) {
      const nodeInstances = new InstancedMesh(new SphereGeometry(1, 12, 8), new MeshBasicMaterial({ color: 0xffffff }), scopedNodes.length);
      nodeInstances.name = 'node-instances';
      const matrix = new Matrix4();
      const quaternion = new Quaternion();
      const position = new Vector3();
      const scale = new Vector3();
      scopedNodes.forEach((node, index) => {
        const radius = node.selected ? nodeRadius * 1.7 : nodeRadius;
        position.set(...node.position);
        scale.setScalar(radius);
        matrix.compose(position, quaternion.identity(), scale);
        nodeInstances.setMatrixAt(index, matrix);
        nodeInstances.setColorAt(index, node.selected ? palette.nodeSelected : palette.node);
      });
      nodeInstances.instanceMatrix.needsUpdate = true;
      if (nodeInstances.instanceColor) nodeInstances.instanceColor.needsUpdate = true;
      groups.get('nodes')!.add(nodeInstances);
    }

    buildSupports();
    buildLoads();
    buildReactions();
    buildLocalAxes();
    buildDiagrams(scoped);
    buildDeformed();
    buildLabels(scoped, scopedNodes);
    applyLayers();
  };

  const extrudedGeometries = new Map<string, ExtrudeGeometry>();
  const buildExtruded = (scoped: readonly Space3DSceneMember[]) => {
    const bySection = new Map<string, Space3DSceneMember[]>();
    for (const member of scoped) {
      if (!member.section || !member.basis) continue;
      const list = bySection.get(member.section.key);
      if (list) list.push(member);
      else bySection.set(member.section.key, [member]);
    }
    const matrix = new Matrix4();
    for (const [key, members] of bySection) {
      let geometry = extrudedGeometries.get(key);
      if (!geometry) {
        geometry = new ExtrudeGeometry(sectionShape(members[0].section!), { depth: 1, bevelEnabled: false, curveSegments: 16 });
        extrudedGeometries.set(key, geometry);
      }
      // La geometría se comparte entre reconstrucciones: el InstancedMesh se
      // libera sin ella (ver `disposeObject`).
      const mesh = new InstancedMesh(geometry, new MeshLambertMaterial({ color: 0xffffff }), members.length);
      mesh.name = `extruded:${key}`;
      mesh.userData.sharedGeometry = true;
      members.forEach((member, index) => {
        memberFrameMatrix(member, matrix);
        mesh.setMatrixAt(index, matrix);
        mesh.setColorAt(index, extrudedColor(member));
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      groups.get('extruded')!.add(mesh);
    }
  };

  const buildSupports = () => {
    const supportsGroup = groups.get('supports')!;
    const span = model.bounds.span;
    const inScope = new Set(model.nodes.filter((node) => node.inScope !== false).map((node) => node.id));
    const supports = model.supports.filter((support) => inScope.has(support.nodeId));
    if (supports.length === 0) return;
    const size = Math.max(span * 0.022, 0.07);
    const fixed = supports.filter((support) => support.fullyFixed);
    const other = supports.filter((support) => !support.fullyFixed);
    const matrix = new Matrix4();
    const quaternion = new Quaternion();
    if (fixed.length > 0) {
      const mesh = new InstancedMesh(new BoxGeometry(2, 0.6, 2), new MeshBasicMaterial({ color: palette.support, transparent: true, opacity: 0.75 }), fixed.length);
      fixed.forEach((support, index) => {
        matrix.compose(new Vector3(support.position[0], support.position[1] - size * 0.3, support.position[2]), quaternion, new Vector3(size, size, size));
        mesh.setMatrixAt(index, matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      supportsGroup.add(mesh);
    }
    if (other.length > 0) {
      const mesh = new InstancedMesh(new ConeGeometry(1.1, 1.4, 4), new MeshBasicMaterial({ color: palette.support, transparent: true, opacity: 0.9 }), other.length);
      other.forEach((support, index) => {
        matrix.compose(new Vector3(support.position[0], support.position[1] - size * 0.7, support.position[2]), quaternion, new Vector3(size, size, size));
        mesh.setMatrixAt(index, matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      supportsGroup.add(mesh);
    }
  };

  /**
   * Flechas por lotes: un segmento por astil y una punta instanciada. Una fila
   * de flechas de carga distribuida en un edificio son miles de flechas; un
   * `ArrowHelper` por cada una se come el presupuesto de objetos.
   */
  const addArrowBatch = (group: Group, arrows: readonly { tail: Vector3; head: Vector3 }[], color: Color, headSize: number, name: string) => {
    if (arrows.length === 0) return;
    const shafts = new LineSegments(lineGeometry(arrows.flatMap(({ tail, head }) => [tail.x, tail.y, tail.z, head.x, head.y, head.z])), new LineBasicMaterial({ color }));
    shafts.name = `${name}-shafts`;
    group.add(shafts);
    const cones = new InstancedMesh(new ConeGeometry(0.35, 1, 10), new MeshBasicMaterial({ color }), arrows.length);
    cones.name = `${name}-heads`;
    const matrix = new Matrix4();
    const quaternion = new Quaternion();
    const yAxis = new Vector3(0, 1, 0);
    const direction = new Vector3();
    arrows.forEach(({ tail, head }, index) => {
      direction.copy(head).sub(tail);
      const length = direction.length();
      if (length === 0) { matrix.makeScale(0, 0, 0); cones.setMatrixAt(index, matrix); return; }
      direction.divideScalar(length);
      quaternion.setFromUnitVectors(yAxis, direction);
      const size = Math.min(headSize, length * 0.45);
      const position = head.clone().addScaledVector(direction, -size / 2);
      matrix.compose(position, quaternion, new Vector3(size, size, size));
      cones.setMatrixAt(index, matrix);
    });
    cones.instanceMatrix.needsUpdate = true;
    group.add(cones);
  };

  const buildLoads = () => {
    const loadsGroup = groups.get('loads')!;
    const span = model.bounds.span;
    const loadLength = Math.max(span * 0.12, 0.3);
    const inScopeNodes = new Set(model.nodes.filter((node) => node.inScope !== false).map((node) => node.id));
    const inScopeMembers = new Set(model.members.filter((member) => member.inScope !== false).map((member) => member.id));

    const forceArrows: { tail: Vector3; head: Vector3 }[] = [];
    const momentArrows: { tail: Vector3; head: Vector3 }[] = [];
    for (const load of model.loads) {
      if (!inScopeNodes.has(load.nodeId)) continue;
      const direction = vec(load.direction);
      const length = loadLength * (0.45 + 0.55 * load.relative);
      const head = vec(load.origin);
      const tail = head.clone().addScaledVector(direction, -length);
      if (load.kind === 'force') forceArrows.push({ tail, head });
      else {
        // Doble punta: la convención de la regla de la mano derecha.
        momentArrows.push({ tail, head });
        momentArrows.push({ tail, head: head.clone().addScaledVector(direction, -length * 0.22) });
      }
    }
    addArrowBatch(loadsGroup, forceArrows, palette.load, loadLength * 0.22, 'nodal-force');
    addArrowBatch(loadsGroup, momentArrows, palette.loadMoment, loadLength * 0.22, 'nodal-moment');

    // Cargas en barra: filas de flechas que acaban en la barra y una línea que
    // une sus colas, como el diagrama de carga de ETABS.
    const distributed: { tail: Vector3; head: Vector3 }[] = [];
    const outline: number[] = [];
    const pointArrows: { tail: Vector3; head: Vector3 }[] = [];
    const memberLoads = (model.memberLoads ?? []).filter((load) => inScopeMembers.has(load.memberId));
    const budget = 4000;
    let used = 0;
    for (const load of memberLoads) {
      if (used > budget) break;
      if (load.kind === 'distributed') {
        const maxMagnitude = Math.max(load.magnitude, 1e-12);
        const reference = loadLength * 0.8 * (0.35 + 0.65 * load.relative);
        const tails: Vector3[] = [];
        for (const sample of load.points) {
          const magnitude = Math.hypot(...sample.vector);
          const head = vec(sample.position);
          if (magnitude === 0) { tails.push(head); continue; }
          const direction = vec(sample.vector).divideScalar(magnitude);
          const tail = head.clone().addScaledVector(direction, -reference * (magnitude / maxMagnitude));
          tails.push(tail);
          distributed.push({ tail, head });
          used += 1;
        }
        for (let index = 1; index < tails.length; index += 1) outline.push(tails[index - 1].x, tails[index - 1].y, tails[index - 1].z, tails[index].x, tails[index].y, tails[index].z);
      } else if (load.kind === 'point') {
        const sample = load.points[0];
        const magnitude = Math.hypot(...sample.vector);
        if (magnitude === 0) continue;
        const head = vec(sample.position);
        pointArrows.push({ tail: head.clone().addScaledVector(vec(sample.vector).divideScalar(magnitude), -loadLength * (0.45 + 0.55 * load.relative)), head });
        used += 1;
      }
    }
    addArrowBatch(loadsGroup, distributed, palette.loadDistributed, loadLength * 0.12, 'member-distributed');
    addArrowBatch(loadsGroup, pointArrows, palette.load, loadLength * 0.2, 'member-point');
    if (outline.length > 0) {
      const lines = new LineSegments(lineGeometry(outline), new LineBasicMaterial({ color: palette.loadDistributed }));
      lines.name = 'member-distributed-outline';
      loadsGroup.add(lines);
    }
  };

  const buildReactions = () => {
    const reactionsGroup = groups.get('reactions')!;
    const reactionLength = Math.max(model.bounds.span * 0.14, 0.35);
    const arrows = model.reactions.map((reaction) => {
      const direction = vec(reaction.direction);
      const length = reactionLength * (0.5 + 0.5 * reaction.relative);
      const tail = vec(reaction.origin).addScaledVector(direction, -length - reactionLength * 0.12);
      return { tail, head: tail.clone().addScaledVector(direction, length) };
    });
    addArrowBatch(reactionsGroup, arrows, palette.reaction, reactionLength * 0.2, 'reaction');
  };

  const buildLocalAxes = () => {
    const axesGroup = groups.get('local-axes')!;
    if (!model.localAxes) return;
    const origin = vec(model.localAxes.origin);
    const length = Math.max(model.localAxes.length, model.bounds.span * 0.06);
    const triad: [readonly number[], Color, string][] = [
      [model.localAxes.basis.x, palette.axisX, '1'],
      [model.localAxes.basis.y, palette.axisY, '2'],
      [model.localAxes.basis.z, palette.axisZ, '3'],
    ];
    for (const [vector, color, letter] of triad) {
      const direction = new Vector3(vector[0], vector[1], vector[2]).normalize();
      axesGroup.add(new ArrowHelper(direction, origin, length, color, length * 0.22, length * 0.12));
      const label = makeLabel(letter, color, labelSize(1.1));
      if (label) {
        label.position.copy(origin).addScaledVector(direction, length * 1.16);
        axesGroup.add(label);
      }
    }
  };

  const componentColor = (component: string): Color => (component === 'N' ? palette.axial
    : component === 'Vy' || component === 'Vz' ? palette.shear : palette.moment);

  /**
   * Diagramas rellenos, fusionados en una sola malla y un solo contorno: un
   * edificio entero cuesta dos objetos de GPU, no dos por barra.
   */
  const buildDiagrams = (scoped: readonly Space3DSceneMember[]) => {
    const diagram = model.diagram;
    if (!diagram) return;
    const group = groups.get('diagrams')!;
    const color = componentColor(diagram.component);
    const negative = color.clone().lerp(palette.surface, 0.45);
    const fill: number[] = [];
    const colors: number[] = [];
    const outline: number[] = [];
    const pushTriangle = (a: Vector3, b: Vector3, c: Vector3, tone: Color) => {
      fill.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
      for (let index = 0; index < 3; index += 1) colors.push(tone.r, tone.g, tone.b);
    };
    for (const member of scoped) {
      const data = member.diagram;
      if (!data || data.stations.length < 2) continue;
      const start = vec(member.start);
      const axis = vec(member.end).sub(start).divideScalar(member.length);
      const offset = vec(data.direction).multiplyScalar(diagram.scale);
      const base = (x: number) => start.clone().addScaledVector(axis, x);
      const tip = (x: number, value: number) => base(x).addScaledVector(offset, value);
      for (let index = 1; index < data.stations.length; index += 1) {
        const a = data.stations[index - 1];
        const b = data.stations[index];
        const ta = tip(a.x, a.value);
        const tb = tip(b.x, b.value);
        outline.push(ta.x, ta.y, ta.z, tb.x, tb.y, tb.z);
        if (b.x - a.x <= 1e-12) continue;
        const ba = base(a.x);
        const bb = base(b.x);
        if (a.value * b.value >= 0) {
          const tone = a.value + b.value >= 0 ? color : negative;
          pushTriangle(ba, bb, tb, tone);
          pushTriangle(ba, tb, ta, tone);
        } else {
          const x0 = a.x + (b.x - a.x) * (a.value / (a.value - b.value));
          const b0 = base(x0);
          pushTriangle(ba, b0, ta, a.value >= 0 ? color : negative);
          pushTriangle(b0, bb, tb, b.value >= 0 ? color : negative);
        }
      }
      const first = data.stations[0];
      const last = data.stations[data.stations.length - 1];
      const f0 = base(first.x);
      const f1 = tip(first.x, first.value);
      const l0 = base(last.x);
      const l1 = tip(last.x, last.value);
      outline.push(f0.x, f0.y, f0.z, f1.x, f1.y, f1.z, l0.x, l0.y, l0.z, l1.x, l1.y, l1.z);
    }
    if (fill.length > 0) {
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new Float32BufferAttribute(fill, 3));
      geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
      const mesh = new Mesh(geometry, new MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.42, side: DoubleSide, depthWrite: false }));
      mesh.name = 'diagram-fill';
      mesh.renderOrder = 5;
      group.add(mesh);
    }
    if (outline.length > 0) {
      const lines = new LineSegments(lineGeometry(outline), new LineBasicMaterial({ color }));
      lines.name = 'diagram-outline';
      lines.renderOrder = 6;
      group.add(lines);
    }
  };

  /**
   * Deformada como tubos finos instanciados a lo largo de la elástica. Guarda
   * origen y destino de cada tramo para poder animarla sin reconstruirla.
   */
  const buildDeformed = () => {
    const deformed = model.deformed;
    if (!deformed) return;
    const inScope = new Set(model.members.filter((member) => member.inScope !== false).map((member) => member.id));
    const baseById = new Map(model.members.map((member) => [member.id, member]));
    const base: Vector3[] = [];
    const target: Vector3[] = [];
    for (const item of deformed.members) {
      if (!inScope.has(item.id)) continue;
      const member = baseById.get(item.id);
      if (!member) continue;
      const points = item.points && item.points.length > 1 ? item.points : [item.start, item.end];
      const count = points.length;
      for (let index = 0; index < count; index += 1) {
        const t = count === 1 ? 0 : index / (count - 1);
        // El punto de origen de cada vértice es su posición sin deformar.
        const original = vec(member.start).lerp(vec(member.end), t);
        if (index > 0) {
          base.push(vec(member.start).lerp(vec(member.end), (index - 1) / (count - 1)), original);
          target.push(vec(points[index - 1]), vec(points[index]));
        }
      }
    }
    if (base.length === 0) return;
    const segments = base.length / 2;
    const mesh = new InstancedMesh(new CylinderGeometry(1, 1, 1, 6, 1), new MeshBasicMaterial({ color: palette.deformed }), segments);
    mesh.name = 'deformed-instances';
    deformedSegments = { base, target };
    deformedMesh = mesh;
    placeDeformed(1);
    groups.get('deformed')!.add(mesh);
  };

  const placeDeformed = (factor: number) => {
    if (!deformedMesh) return;
    const radius = Math.max(model.bounds.span * 0.0032, 0.012);
    const matrix = new Matrix4();
    const quaternion = new Quaternion();
    const yAxis = new Vector3(0, 1, 0);
    const a = new Vector3();
    const b = new Vector3();
    const direction = new Vector3();
    const { base, target } = deformedSegments;
    for (let segment = 0; segment < base.length / 2; segment += 1) {
      a.copy(base[segment * 2]).lerp(target[segment * 2], factor);
      b.copy(base[segment * 2 + 1]).lerp(target[segment * 2 + 1], factor);
      direction.copy(b).sub(a);
      const length = direction.length();
      if (length === 0) { matrix.makeScale(0, 0, 0); deformedMesh.setMatrixAt(segment, matrix); continue; }
      quaternion.setFromUnitVectors(yAxis, direction.divideScalar(length));
      matrix.compose(a.clone().add(b).multiplyScalar(0.5), quaternion, new Vector3(radius, length, radius));
      deformedMesh.setMatrixAt(segment, matrix);
    }
    deformedMesh.instanceMatrix.needsUpdate = true;
  };

  /** Rótulos con presupuesto: un edificio con todas sus etiquetas es ilegible y lento. */
  const buildLabels = (scoped: readonly Space3DSceneMember[], scopedNodes: readonly Space3DSceneModel['nodes'][number][]) => {
    const labelsGroup = groups.get('labels')!;
    const size = labelSize();
    const lift = model.bounds.span * 0.012;
    if (layers.labels) {
      const showNodes = scopedNodes.length <= 160;
      const showMembers = scoped.length <= 220;
      if (showNodes) {
        for (const node of scopedNodes) {
          const label = makeLabel(node.id, palette.label, size * 0.85);
          if (!label) break;
          label.position.set(node.position[0], node.position[1] + lift * 2, node.position[2]);
          labelsGroup.add(label);
        }
      }
      if (showMembers) {
        for (const member of scoped) {
          const label = makeLabel(member.id, palette.label, size * 0.8);
          if (!label) break;
          label.position.set(member.midpoint[0], member.midpoint[1] + lift, member.midpoint[2]);
          labelsGroup.add(label);
        }
      }
    }

    if (layers.loads) {
      const inScopeNodes = new Set(scopedNodes.map((node) => node.id));
      const loadLength = Math.max(model.bounds.span * 0.12, 0.3);
      const nodal = model.loads.filter((load) => inScopeNodes.has(load.nodeId)).slice(0, 80);
      for (const load of nodal) {
        const value = `${formatLabel(load.magnitude)} ${load.kind === 'force' ? 'kN' : 'kN·m'}`;
        const label = makeLabel(value, load.kind === 'force' ? palette.load : palette.loadMoment, size, { background: palette.surface });
        if (!label) break;
        label.position.copy(vec(load.origin)).addScaledVector(vec(load.direction), -loadLength * (0.45 + 0.55 * load.relative) * 1.12);
        labelsGroup.add(label);
      }
      const inScopeMembers = new Set(scoped.map((member) => member.id));
      const memberLoads = (model.memberLoads ?? []).filter((load) => inScopeMembers.has(load.memberId) && load.kind === 'distributed');
      if (memberLoads.length <= 60) {
        for (const load of memberLoads) {
          const peak = load.points.reduce((best, sample) => (Math.hypot(...sample.vector) > Math.hypot(...best.vector) ? sample : best), load.points[0]);
          const magnitude = Math.hypot(...peak.vector);
          if (magnitude === 0) continue;
          const reference = loadLength * 0.8 * (0.35 + 0.65 * load.relative);
          const label = makeLabel(`${formatLabel(load.magnitude)} kN/m`, palette.loadDistributed, size * 0.9, { background: palette.surface });
          if (!label) break;
          label.position.copy(vec(peak.position)).addScaledVector(vec(peak.vector).divideScalar(magnitude), -reference * 1.18);
          labelsGroup.add(label);
        }
      }
    }

    // Valores de diagrama: el pico de cada barra, con prioridad a los mayores.
    const diagram = model.diagram;
    if (diagram) {
      const color = componentColor(diagram.component);
      const candidates = scoped
        .filter((member) => member.diagram && Math.abs(member.diagram.peak.value) > diagram.maxAbs * 0.02)
        .sort((a, b) => Math.abs(b.diagram!.peak.value) - Math.abs(a.diagram!.peak.value));
      const selected = candidates.filter((member) => member.selected);
      // En un lienzo de teléfono caben muchos menos rótulos legibles.
      const budget = viewportSize.width < 640 ? 8 : scoped.length <= 40 ? 40 : 24;
      const shown = [...selected, ...candidates.filter((member) => !member.selected).slice(0, budget)];
      for (const member of shown) {
        const data = member.diagram!;
        const values = member.selected
          ? [data.stations[0], data.peak, data.stations[data.stations.length - 1]]
          : [data.peak];
        const seen = new Set<string>();
        for (const station of values) {
          const key = `${station.x.toFixed(3)}:${station.value.toPrecision(4)}`;
          if (seen.has(key) || Math.abs(station.value) < diagram.maxAbs * 0.01) continue;
          seen.add(key);
          const label = makeLabel(formatLabel(station.value), color, size * 0.9, { background: palette.surface });
          if (!label) break;
          const along = vec(member.start).lerp(vec(member.end), member.length > 0 ? station.x / member.length : 0);
          label.position.copy(along).addScaledVector(vec(data.direction), station.value * diagram.scale * 1.12 + Math.sign(station.value || 1) * model.bounds.span * 0.01);
          labelsGroup.add(label);
        }
      }
    }

    if (model.reactions.length > 0 && model.reactions.length <= 60) {
      const reactionLength = Math.max(model.bounds.span * 0.14, 0.35);
      for (const reaction of model.reactions) {
        const label = makeLabel(`${formatLabel(reaction.magnitude)} kN`, palette.reaction, size, { background: palette.surface });
        if (!label) break;
        const length = reactionLength * (0.5 + 0.5 * reaction.relative);
        label.position.copy(vec(reaction.origin)).addScaledVector(vec(reaction.direction), -length - reactionLength * 0.3);
        labelsGroup.add(label);
      }
    }
  };

  const applyLayers = () => {
    groups.get('grid')!.visible = layers.grid;
    groups.get('loads')!.visible = layers.loads;
    groups.get('reactions')!.visible = model.reactions.length > 0;
    groups.get('supports')!.visible = layers.supports;
    groups.get('local-axes')!.visible = model.localAxes !== null;
    groups.get('deformed')!.visible = layers.deformed && model.deformed !== null;
  };

  // ────────────────────────────── Cámara ──────────────────────────────

  const ORTHOGRAPHIC_VIEWS: ReadonlySet<Space3DViewPreset> = new Set(['front', 'top', 'side']);

  const setView = (preset: Space3DViewPreset) => {
    activeView = preset;
    const placement = computeSpace3DCameraPlacement(model.bounds, preset);
    const plane = ORTHOGRAPHIC_VIEWS.has(preset);
    camera = plane ? orthographic : perspective;
    if (controls.object !== undefined) controls.object = camera;
    controls.enableRotate = !plane;
    // En una vista plana el botón izquierdo desplaza, como en un plano.
    if (controls.mouseButtons) controls.mouseButtons.LEFT = plane ? 2 : 0;
    if (controls.touches) controls.touches.ONE = plane ? 1 : 0;

    const aspect = viewportSize.width / Math.max(viewportSize.height, 1);
    // En retrato la FOV vertical no protege el ancho: se aleja la cámara.
    const horizontalFit = aspect < 1 ? 1 / Math.max(aspect, 0.35) : 1;
    camera.position.set(
      placement.target[0] + (placement.position[0] - placement.target[0]) * horizontalFit,
      placement.target[1] + (placement.position[1] - placement.target[1]) * horizontalFit,
      placement.target[2] + (placement.position[2] - placement.target[2]) * horizontalFit,
    );
    camera.up.set(...placement.up);
    camera.near = placement.near;
    camera.far = placement.far;
    if (camera instanceof PerspectiveCamera) {
      camera.fov = placement.fovDegrees;
      camera.aspect = aspect;
    } else {
      const radius = placement.radius * 1.12;
      const halfHeight = aspect >= 1 ? radius : radius / aspect;
      camera.left = -halfHeight * aspect;
      camera.right = halfHeight * aspect;
      camera.top = halfHeight;
      camera.bottom = -halfHeight;
      camera.zoom = 1;
    }
    camera.updateProjectionMatrix();
    controls.target.set(...placement.target);
    controls.update();
    camera.lookAt(controls.target);
    camera.updateMatrixWorld(true);
    // Los rótulos se miden en píxeles: con otro alto de vista se rehacen.
    render();
  };

  const resize = () => {
    const width = Math.max(1, canvas.clientWidth || canvas.parentElement?.clientWidth || 1);
    const height = Math.max(1, canvas.clientHeight || canvas.parentElement?.clientHeight || 1);
    const changedHeight = height !== viewportSize.height;
    viewportSize = { width, height };
    gizmoInset = typeof getComputedStyle === 'undefined'
      ? 0
      : parseGizmoInset(getComputedStyle(canvas).getPropertyValue('--space3d-gizmo-inset'));
    renderer.setSize(width, height, false);
    if (changedHeight) {
      buildGrid();
      buildModel();
    }
    setView(activeView);
  };

  const zoomBy = (factor: number) => {
    if (camera instanceof OrthographicCamera) {
      camera.zoom = MathUtils.clamp(camera.zoom / factor, 0.02, 200);
      camera.updateProjectionMatrix();
      controls.update();
      render();
      return;
    }
    const offset = camera.position.clone().sub(controls.target);
    const current = Math.max(offset.length(), 1e-4);
    const next = MathUtils.clamp(
      current * factor,
      Math.max(model.bounds.span * 0.05, 0.05),
      Math.max(model.bounds.span * 80, 80),
    );
    offset.setLength(next);
    camera.position.copy(controls.target).add(offset);
    camera.updateMatrixWorld(true);
    controls.update();
    render();
  };

  // ────────────────────────────── Picking ──────────────────────────────

  const raycaster = new Raycaster();
  const pointer = new Vector2();

  const toPointer = (offsetX: number, offsetY: number): boolean => {
    const rect = canvas.getBoundingClientRect();
    const width = rect.width || canvas.clientWidth || 1;
    const height = rect.height || canvas.clientHeight || 1;
    pointer.set((offsetX / width) * 2 - 1, -(offsetY / height) * 2 + 1);
    return Math.abs(pointer.x) <= 1 && Math.abs(pointer.y) <= 1;
  };

  /** Unidades de mundo por píxel alrededor del objetivo: umbral de picking estable. */
  const worldPerPixel = (): number => {
    const height = Math.max(viewportSize.height, 1);
    if (camera instanceof OrthographicCamera) return (camera.top - camera.bottom) / camera.zoom / height;
    const distance = camera.position.distanceTo(controls.target);
    return (2 * distance * Math.tan(MathUtils.degToRad(camera.fov / 2))) / height;
  };

  const pickAt = (offsetX: number, offsetY: number): Space3DSelection | null => {
    if (disposed || !toPointer(offsetX, offsetY)) return null;
    camera.updateMatrixWorld(true);
    raycaster.setFromCamera(pointer, camera);
    const pixel = worldPerPixel();
    raycaster.params.Points.threshold = Math.max(pixel * 9, 1e-4);
    raycaster.params.Line.threshold = Math.max(pixel * 6, 1e-4);

    // El nudo gana al miembro cuando ambos caen bajo el puntero: es el objetivo
    // más pequeño y el que el usuario apunta deliberadamente.
    if (nodePoints) {
      const hit = raycaster.intersectObject(nodePoints, false)[0];
      if (hit?.index !== undefined && nodeIds[hit.index]) return { kind: 'node', id: nodeIds[hit.index] };
    }
    if (memberLines) {
      const hit = raycaster.intersectObject(memberLines, false)[0];
      if (hit?.index !== undefined) {
        const id = memberIds[Math.floor(hit.index / 2)];
        if (id) return { kind: 'member', id };
      }
    }
    return null;
  };

  const project = (position: readonly number[]): { x: number; y: number } | null => {
    const v = new Vector3(position[0], position[1], position[2]).project(camera);
    if (v.z < -1 || v.z > 1) return null;
    return { x: (v.x + 1) / 2 * viewportSize.width, y: (1 - v.y) / 2 * viewportSize.height };
  };

  const segmentHitsRect = (a: { x: number; y: number }, b: { x: number; y: number }, r: { x0: number; y0: number; x1: number; y1: number }): boolean => {
    const inside = (p: { x: number; y: number }) => p.x >= r.x0 && p.x <= r.x1 && p.y >= r.y0 && p.y <= r.y1;
    if (inside(a) || inside(b)) return true;
    // Liang–Barsky contra el rectángulo.
    let t0 = 0;
    let t1 = 1;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const clip = (p: number, q: number) => {
      if (p === 0) return q >= 0;
      const t = q / p;
      if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; }
      return true;
    };
    return clip(-dx, a.x - r.x0) && clip(dx, r.x1 - a.x) && clip(-dy, a.y - r.y0) && clip(dy, r.y1 - a.y) && t0 <= t1;
  };

  const pickRect = (x0: number, y0: number, x1: number, y1: number, mode: 'window' | 'crossing'): Space3DWindowPick => {
    camera.updateMatrixWorld(true);
    const rect = { x0: Math.min(x0, x1), y0: Math.min(y0, y1), x1: Math.max(x0, x1), y1: Math.max(y0, y1) };
    const inside = (p: { x: number; y: number } | null) => p !== null && p.x >= rect.x0 && p.x <= rect.x1 && p.y >= rect.y0 && p.y <= rect.y1;
    const nodes = model.nodes.filter((node) => node.inScope !== false && inside(project(node.position))).map((node) => node.id);
    const members = model.members.filter((member) => {
      if (member.inScope === false) return false;
      const a = project(member.start);
      const b = project(member.end);
      if (!a || !b) return false;
      return mode === 'window' ? inside(a) && inside(b) : segmentHitsRect(a, b, rect);
    }).map((member) => member.id);
    return { nodes, members };
  };

  const NORMALS = { x: new Vector3(1, 0, 0), y: new Vector3(0, 1, 0), z: new Vector3(0, 0, 1) } as const;
  const workPlane = new Plane();
  const planeHit = new Vector3();

  const pickPlane = (offsetX: number, offsetY: number, axis: 'x' | 'y' | 'z', offset: number): [number, number, number] | null => {
    if (disposed || !toPointer(offsetX, offsetY)) return null;
    camera.updateMatrixWorld(true);
    raycaster.setFromCamera(pointer, camera);
    const normal = NORMALS[axis];
    // Un plano visto casi de canto convierte un píxel en kilómetros: se rechaza.
    if (Math.abs(raycaster.ray.direction.dot(normal)) < 0.08) return null;
    workPlane.set(normal, -offset);
    const hit = raycaster.ray.intersectPlane(workPlane, planeHit);
    if (!hit) return null;
    return [hit.x, hit.y, hit.z];
  };

  // ────────────────────────────── Borrador ──────────────────────────────

  const draftGroup = new Group();
  draftGroup.name = 'draft';
  draftGroup.renderOrder = 10;
  scene.add(draftGroup);
  let draftPlaneKey = '';
  let draftGrid: LineSegments | null = null;
  let draftCursor: Mesh | null = null;
  let draftLine: LineSegments | null = null;

  const setDraft = (draft: Space3DDraftOverlay | null) => {
    if (disposed) return;
    const plane = draft?.plane ?? null;
    const span = Math.max(model.bounds.span, 1);
    const key = plane ? `${plane.axis}:${plane.offset}:${plane.step}:${span}` : '';
    if (key !== draftPlaneKey) {
      draftPlaneKey = key;
      if (draftGrid) { draftGroup.remove(draftGrid); disposeObject(draftGrid); draftGrid = null; }
      if (plane) {
        const divisions = Math.min(200, Math.max(4, Math.ceil(Math.max(span * 2, 12) / plane.step / 2) * 2));
        const size = divisions * plane.step;
        const snapCenter = (value: number) => Math.round(value / plane.step) * plane.step;
        const [cx, cy, cz] = model.bounds.center;
        const positions: number[] = [];
        const half = size / 2;
        for (let index = 0; index <= divisions; index += 1) {
          const offsetValue = -half + index * plane.step;
          if (plane.axis === 'y') {
            const x = snapCenter(cx) + offsetValue;
            const z = snapCenter(cz) + offsetValue;
            positions.push(x, plane.offset, snapCenter(cz) - half, x, plane.offset, snapCenter(cz) + half);
            positions.push(snapCenter(cx) - half, plane.offset, z, snapCenter(cx) + half, plane.offset, z);
          } else if (plane.axis === 'z') {
            const x = snapCenter(cx) + offsetValue;
            const y = snapCenter(cy) + offsetValue;
            positions.push(x, snapCenter(cy) - half, plane.offset, x, snapCenter(cy) + half, plane.offset);
            positions.push(snapCenter(cx) - half, y, plane.offset, snapCenter(cx) + half, y, plane.offset);
          } else {
            const y = snapCenter(cy) + offsetValue;
            const z = snapCenter(cz) + offsetValue;
            positions.push(plane.offset, y, snapCenter(cz) - half, plane.offset, y, snapCenter(cz) + half);
            positions.push(plane.offset, snapCenter(cy) - half, z, plane.offset, snapCenter(cy) + half, z);
          }
        }
        draftGrid = new LineSegments(lineGeometry(positions), new LineBasicMaterial({ color: palette.draft, transparent: true, opacity: 0.22, depthWrite: false }));
        draftGroup.add(draftGrid);
      }
    }

    const cursor = draft?.cursor ?? null;
    if (cursor) {
      if (!draftCursor) {
        draftCursor = new Mesh(new SphereGeometry(1, 16, 12), new MeshBasicMaterial({ color: palette.draft, depthTest: false, transparent: true, opacity: 0.9 }));
        draftGroup.add(draftCursor);
      }
      draftCursor.scale.setScalar(Math.max(span * 0.01, 0.04));
      draftCursor.position.set(cursor[0], cursor[1], cursor[2]);
      draftCursor.visible = true;
    } else if (draftCursor) {
      draftCursor.visible = false;
    }

    if (draftLine) { draftGroup.remove(draftLine); disposeObject(draftLine); draftLine = null; }
    const from = draft?.from ?? null;
    if (from && cursor) {
      const line = new LineSegments(lineGeometry([...from, ...cursor]), new LineBasicMaterial({ color: palette.draft, depthTest: false }));
      draftGroup.add(line);
      draftLine = line;
    }
    requestRender();
  };

  // ────────────────────────────── Animación ──────────────────────────────

  const ANIMATION_PERIOD_MS = 1600;
  const animate = (time: number) => {
    if (!animating || disposed) return;
    if (animationStart === 0) animationStart = time;
    const phase = ((time - animationStart) % ANIMATION_PERIOD_MS) / ANIMATION_PERIOD_MS;
    placeDeformed(Math.sin(phase * Math.PI * 2));
    render();
    animationFrame = requestAnimationFrame(animate);
  };

  const setAnimation = (active: boolean) => {
    if (disposed || active === animating) return;
    animating = active;
    if (active) {
      animationStart = 0;
      if (frame !== 0) { cancelAnimationFrame(frame); frame = 0; }
      animationFrame = requestAnimationFrame(animate);
    } else {
      if (animationFrame !== 0) cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      placeDeformed(1);
      requestRender();
    }
  };

  const onControlsChange = () => requestRender();
  controls.addEventListener('change', onControlsChange);

  buildWorldAxes();
  buildGrid();
  buildModel();
  resize();

  /* La escena lee los tokens y se reconstruye si el tema cambia con la escena montada. */
  const onThemeChange = () => {
    if (disposed) return;
    palette = readPalette();
    draftPlaneKey = '';
    buildWorldAxes();
    buildGrid();
    buildModel();
    requestRender();
  };
  const themeObserver = typeof MutationObserver === 'undefined' ? null : new MutationObserver(onThemeChange);
  themeObserver?.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  return {
    scene,
    get camera() { return camera; },
    get controlsTarget() { return controls.target; },
    setModel(next) {
      if (disposed) return;
      // `setModel` corre en CADA edición, así que no toca la cámara: el
      // reencuadre tras sustituir el proyecto entero lo pide quien aloja el lienzo.
      model = next;
      buildGrid();
      buildModel();
      if (animating) placeDeformed(0);
      requestRender();
    },
    setLayers(next) {
      if (disposed) return;
      const rebuild = next.extruded !== layers.extruded || next.labels !== layers.labels || next.loads !== layers.loads;
      layers = next;
      if (rebuild) buildModel();
      else applyLayers();
      requestRender();
    },
    setView(preset) { if (!disposed) setView(preset); },
    zoomBy(factor) { if (!disposed) zoomBy(factor); },
    resize() { if (!disposed) resize(); },
    render() { render(); },
    requestRender,
    pickAt,
    pickPlane,
    pickRect,
    setDraft,
    setAnimation,
    setNavigationEnabled(enabled) { if ('enabled' in controls || enabled === false) controls.enabled = enabled; },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (frame !== 0) cancelAnimationFrame(frame);
      if (animationFrame !== 0) cancelAnimationFrame(animationFrame);
      frame = 0;
      animationFrame = 0;
      controls.removeEventListener('change', onControlsChange);
      themeObserver?.disconnect();
      controls.dispose();
      disposeObject(scene);
      for (const geometry of extrudedGeometries.values()) geometry.dispose();
      extrudedGeometries.clear();
      // La brújula vive en su propia escena: `scene` no la alcanza.
      disposeObject(gizmoScene);
      renderer.dispose();
      // Deliberadamente NO se llama a `forceContextLoss()`: React vuelve a
      // montar sobre el mismo `<canvas>` y el contexto se va con el elemento.
    },
  };
};

const formatLabel = (value: number): string => {
  const magnitude = Math.abs(value);
  if (magnitude !== 0 && (magnitude >= 1e5 || magnitude < 1e-2)) return value.toExponential(2);
  return Number(value.toPrecision(magnitude >= 100 ? 4 : 3)).toString();
};

/**
 * Libera geometría, material Y TEXTURA de un árbol. La geometría compartida
 * de los perfiles extruidos se libera aparte, una vez, al cerrar el visor.
 */
const disposeMaterial = (material: Material) => {
  const withMap = material as Material & { map?: { dispose?: () => void } | null };
  withMap.map?.dispose?.();
  material.dispose();
};

const disposeObject = (root: Object3D) => {
  root.traverse((object) => {
    const holder = object as Object3D & {
      geometry?: BufferGeometry;
      material?: Material | Material[];
      isInstancedMesh?: boolean;
      dispose?: () => void;
    };
    if (!holder.userData?.sharedGeometry) holder.geometry?.dispose();
    const material = holder.material;
    if (Array.isArray(material)) material.forEach(disposeMaterial);
    else if (material) disposeMaterial(material);
    // `instanceMatrix` e `instanceColor` los posee el propio InstancedMesh y
    // sólo los libera su `dispose()`.
    if (holder.isInstancedMesh) holder.dispose?.();
  });
};

const defaultRenderer = (canvas: HTMLCanvasElement): Space3DRendererLike => {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  return renderer;
};

const defaultControls = (camera: PerspectiveCamera, canvas: HTMLCanvasElement): Space3DControlsLike => {
  const controls = new OrbitControls(camera, canvas);
  controls.screenSpacePanning = true;
  controls.enableDamping = false;
  return controls as unknown as Space3DControlsLike;
};
