import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildSuiteScene } from '../features/structural-assets/suiteScenes';
import { buildThreeTechnicalGroup } from '../features/structural-assets/threeTechnicalAssets';

export interface ScenePreviewProps {
  mode: string;
  theme: 'light' | 'dark';
  orientation: string;
  geometry: boolean;
  grid: boolean;
  selected: boolean;
  onSelect: () => void;
}

type PreviewInstance = {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  camera: THREE.OrthographicCamera;
  controls: OrbitControls;
  geometry: THREE.Group;
  grid: THREE.GridHelper;
  selection: THREE.Box3Helper;
  bounds: THREE.Box3;
  center: THREE.Vector3;
  render: () => void;
  resize: () => void;
};

type PointerGesture = { id: number; x: number; y: number; startedAt: number; moved: boolean };

const FALLBACK_COLORS = {
  light: { background: '#fffefa', grid: '#edece6', gridStrong: '#dfded6', selection: '#ed4b46' },
  dark: { background: '#0e1113', grid: '#212528', gridStrong: '#2d3336', selection: '#ff8e80' },
} as const;

function cssColor(element: HTMLElement, token: string, fallback: string): THREE.Color {
  try {
    const value = getComputedStyle(element).getPropertyValue(token).trim();
    return new THREE.Color(value || fallback);
  } catch {
    return new THREE.Color(fallback);
  }
}

function sceneBoundsFrame(
  camera: THREE.OrthographicCamera,
  bounds: THREE.Box3,
  aspect: number,
) {
  camera.updateMatrixWorld(true);
  const corners = [
    [bounds.min.x, bounds.min.y, bounds.min.z], [bounds.min.x, bounds.min.y, bounds.max.z],
    [bounds.min.x, bounds.max.y, bounds.min.z], [bounds.min.x, bounds.max.y, bounds.max.z],
    [bounds.max.x, bounds.min.y, bounds.min.z], [bounds.max.x, bounds.min.y, bounds.max.z],
    [bounds.max.x, bounds.max.y, bounds.min.z], [bounds.max.x, bounds.max.y, bounds.max.z],
  ].map(([x, y, z]) => new THREE.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse));
  const minX = Math.min(...corners.map(({ x }) => x));
  const maxX = Math.max(...corners.map(({ x }) => x));
  const minY = Math.min(...corners.map(({ y }) => y));
  const maxY = Math.max(...corners.map(({ y }) => y));
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const contentHalfWidth = Math.max(1.2, (maxX - minX) * 0.5 * 1.16);
  const contentHalfHeight = Math.max(1.05, (maxY - minY) * 0.5 * 1.16);
  const halfHeight = Math.max(contentHalfHeight, contentHalfWidth / Math.max(aspect, 0.1));
  const halfWidth = halfHeight * Math.max(aspect, 0.1);
  camera.left = centerX - halfWidth;
  camera.right = centerX + halfWidth;
  camera.top = centerY + halfHeight;
  camera.bottom = centerY - halfHeight;
  camera.updateProjectionMatrix();
}

function disposeSceneResources(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse((object) => {
    const renderable = object as THREE.Object3D & {
      geometry?: THREE.BufferGeometry;
      material?: THREE.Material | THREE.Material[];
    };
    if (renderable.geometry) geometries.add(renderable.geometry);
    const objectMaterials = Array.isArray(renderable.material)
      ? renderable.material
      : renderable.material ? [renderable.material] : [];
    objectMaterials.forEach((material) => {
      materials.add(material);
      Object.values(material).forEach((value) => {
        if (value instanceof THREE.Texture) textures.add(value);
      });
    });
  });
  textures.forEach((texture) => texture.dispose());
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

function isDesignMode(mode: string) {
  const normalized = mode.toLocaleLowerCase('es');
  return normalized === 'diseño' || normalized === 'diseno' || normalized === 'design';
}

const publicAssetBase = import.meta.env.BASE_URL.endsWith('/')
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`;

export default function ScenePreview({
  mode,
  theme,
  orientation,
  geometry,
  grid,
  selected,
  onSelect,
}: ScenePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const instanceRef = useRef<PreviewInstance | null>(null);
  const pointerRef = useRef<PointerGesture | null>(null);
  const onSelectRef = useRef(onSelect);
  const orientationRef = useRef(orientation);
  const geometryVisibleRef = useRef(geometry);
  const gridVisibleRef = useRef(grid);
  const selectedRef = useRef(selected);
  const [webglUnavailable, setWebglUnavailable] = useState(false);
  onSelectRef.current = onSelect;
  orientationRef.current = orientation;
  geometryVisibleRef.current = geometry;
  gridVisibleRef.current = grid;
  selectedRef.current = selected;

  const design = isDesignMode(mode);
  const fallbackScene = design ? 'design' : 'space3d';
  const fallbackTheme = theme === 'dark' ? 'night' : 'day';
  const fallbackSrc = `${publicAssetBase}assets/suite/${fallbackScene}-${fallbackTheme}.png`;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    let active = true;
    let renderer: THREE.WebGLRenderer | null = null;
    let scene: THREE.Scene | null = null;
    let controls: OrbitControls | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let render: (() => void) | null = null;
    let resize: (() => void) | null = null;
    let cleaned = false;

    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      resizeObserver?.disconnect();
      if (controls && render) controls.removeEventListener('change', render);
      controls?.dispose();
      if (scene) disposeSceneResources(scene);
      if (renderer) {
        renderer.dispose();
        if (!canvas.isConnected) renderer.forceContextLoss();
      }
      if (instanceRef.current?.scene === scene) instanceRef.current = null;
    };

    try {
      const palette = FALLBACK_COLORS[theme];
      const background = cssColor(canvas, '--sc-color-bg-canvas', palette.background);
      const gridColor = cssColor(canvas, '--sc-color-canvas-grid', palette.grid);
      const gridStrongColor = cssColor(canvas, '--sc-color-canvas-grid-strong', palette.gridStrong);
      const selectionColor = cssColor(canvas, '--fs-family-analisis', palette.selection);

      renderer = new THREE.WebGLRenderer({ canvas, alpha: false, antialias: true, powerPreference: 'low-power' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = theme === 'light' ? 1.16 : 1.06;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFShadowMap;
      renderer.setClearColor(background, 1);

      scene = new THREE.Scene();
      scene.background = background;
      const structuralTheme = theme === 'dark' ? 'night' : 'day';
      const sourceGroup = design
        ? buildSuiteScene('suite:design', structuralTheme)
        : buildThreeTechnicalGroup('space-frame:two-story', structuralTheme);
      const geometryGroup = new THREE.Group();
      geometryGroup.name = 'proposal-scene-geometry';
      geometryGroup.add(sourceGroup);
      scene.add(geometryGroup);

      const bounds = new THREE.Box3().setFromObject(geometryGroup);
      const center = bounds.getCenter(new THREE.Vector3());
      const floorY = bounds.min.y - 0.055;
      const shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(Math.max(4, bounds.max.x - bounds.min.x + 1.15), Math.max(3.4, bounds.max.z - bounds.min.z + 1.15)),
        new THREE.ShadowMaterial({ color: 0x0a0a0a, opacity: theme === 'light' ? 0.08 : 0.18 }),
      );
      shadow.name = 'proposal-scene-shadow-plane';
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.set(center.x, floorY, center.z);
      shadow.receiveShadow = true;
      scene.add(shadow);

      const gridHelper = new THREE.GridHelper(12, 24, gridStrongColor, gridColor);
      gridHelper.name = 'proposal-scene-grid';
      gridHelper.position.set(center.x, floorY + 0.008, center.z);
      gridHelper.visible = gridVisibleRef.current;
      scene.add(gridHelper);

      const ambient = new THREE.HemisphereLight(
        theme === 'light' ? 0xffffff : 0xf2f2f2,
        theme === 'light' ? 0x737373 : 0x0b0b0b,
        theme === 'light' ? 2.6 : 2.25,
      );
      scene.add(ambient);
      const keyLight = new THREE.DirectionalLight(theme === 'light' ? 0xffffff : 0xf2f2f2, theme === 'light' ? 4.2 : 3.5);
      keyLight.position.set(-4.5, 7, 5.5);
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.left = -6;
      keyLight.shadow.camera.right = 6;
      keyLight.shadow.camera.top = 6;
      keyLight.shadow.camera.bottom = -6;
      scene.add(keyLight);
      const rimLight = new THREE.DirectionalLight(theme === 'light' ? 0xdcdcdc : 0x8a8a8a, 1.55);
      rimLight.position.set(5, 3, -5);
      scene.add(rimLight);

      const selection = new THREE.Box3Helper(bounds.clone(), selectionColor);
      selection.name = 'proposal-scene-selection';
      selection.visible = selectedRef.current && geometryVisibleRef.current;
      selection.renderOrder = 3;
      scene.add(selection);

      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
      camera.up.set(0, 1, 0);
      const initialDirection = orientationRef.current === 'front'
        ? new THREE.Vector3(0, 0, 1)
        : new THREE.Vector3(5.4, 4.1, 6.2);
      camera.position.copy(center).add(initialDirection.normalize().multiplyScalar(10));
      camera.lookAt(center);
      camera.updateMatrixWorld(true);

      controls = new OrbitControls(camera, canvas);
      controls.screenSpacePanning = true;
      controls.enableDamping = false;
      controls.target.copy(center);

      render = () => {
        if (active && renderer && scene && camera) renderer.render(scene, camera);
      };
      controls.addEventListener('change', render);

      resize = () => {
        if (!active || !renderer || !controls) return;
        const host = canvas.parentElement;
        const width = Math.max(1, host?.clientWidth || canvas.clientWidth || 1);
        const height = Math.max(1, host?.clientHeight || canvas.clientHeight || 1);
        renderer.setSize(width, height, false);
        controls.update();
        sceneBoundsFrame(camera, bounds, width / height);
        render?.();
      };

      instanceRef.current = { scene, renderer, camera, controls, geometry: geometryGroup, grid: gridHelper, selection, bounds, center, render, resize };
      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => resize?.());
        resizeObserver.observe(canvas.parentElement ?? canvas);
      } else {
        window.addEventListener('resize', resize);
      }
      resize();
      setWebglUnavailable(false);
    } catch {
      cleanup();
      if (active) setWebglUnavailable(true);
    }

    return () => {
      active = false;
      window.removeEventListener('resize', resize ?? (() => undefined));
      cleanup();
    };
  }, [design, theme]);

  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance) return;
    instance.geometry.visible = geometry;
    instance.grid.visible = grid;
    instance.selection.visible = selected && geometry;
    instance.render();
  }, [geometry, grid, selected]);

  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance) return;
    const direction = orientation === 'front'
      ? new THREE.Vector3(0, 0, 1)
      : new THREE.Vector3(5.4, 4.1, 6.2);
    instance.camera.position.copy(instance.center).add(direction.normalize().multiplyScalar(10));
    instance.camera.up.set(0, 1, 0);
    instance.camera.lookAt(instance.center);
    instance.controls.target.copy(instance.center);
    instance.controls.update();
    instance.resize();
  }, [orientation]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) return;
    pointerRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, startedAt: performance.now(), moved: false };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const gesture = pointerRef.current;
    if (!gesture || gesture.id !== event.pointerId) return;
    if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 5) gesture.moved = true;
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const gesture = pointerRef.current;
    pointerRef.current = null;
    if (!gesture || gesture.id !== event.pointerId) return;
    if (!gesture.moved && performance.now() - gesture.startedAt < 350) onSelectRef.current();
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLCanvasElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') return;
    event.preventDefault();
    onSelectRef.current();
  };

  const label = design ? 'vista interactiva del diseño de una viga con armado expuesto' : 'vista interactiva de un marco espacial de dos niveles';
  const canvasStyle = {
    position: 'absolute' as const,
    inset: 0,
    display: webglUnavailable ? 'none' : 'block',
    width: '100%',
    height: '100%',
    touchAction: 'none',
    background: 'var(--sc-color-bg-canvas)',
    cursor: 'grab',
  };

  return (
    <div className="proposal-scene-preview" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', minHeight: 0, overflow: 'hidden', background: 'var(--sc-color-bg-canvas)' }}>
      <canvas
        ref={canvasRef}
        className="proposal-scene-canvas"
        style={canvasStyle}
        role="button"
        tabIndex={webglUnavailable ? -1 : 0}
        aria-label={`Seleccionar ${label}; arrastra para orbitar la vista`}
        aria-pressed={selected}
        aria-hidden={webglUnavailable || undefined}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => { pointerRef.current = null; }}
        onKeyDown={handleKeyDown}
      />
      {webglUnavailable ? (
        <button
          type="button"
          className="proposal-scene-fallback"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'grid', placeItems: 'center', padding: 0, border: 0, background: 'transparent' }}
          aria-label={`Seleccionar ${label}`}
          aria-pressed={selected}
          onClick={() => onSelectRef.current()}
        >
          <img
            src={fallbackSrc}
            alt=""
            width="700"
            height="600"
            style={{ display: 'block', width: '86%', maxWidth: 700, height: 'auto', maxHeight: '100%', objectFit: 'contain' }}
          />
        </button>
      ) : null}
    </div>
  );
}
