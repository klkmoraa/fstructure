import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { InstancedMesh, Vector3 } from 'three';
import type { Space3DSceneModel } from './sceneModel';
import {
  createSpace3DViewport,
  type Space3DControlsLike,
  type Space3DRendererLike,
} from './threeViewport';

const makeModel = (nodeCount: number, offsetX = 0): Space3DSceneModel => {
  const nodes = Array.from({ length: nodeCount }, (_, index) => ({
    id: `N${index + 1}`,
    position: [index + offsetX, 0, 0] as const,
    restrained: false,
    selected: false,
  }));
  const members = Array.from({ length: Math.max(0, nodeCount - 1) }, (_, index) => ({
    id: `M${index + 1}`,
    nodeI: nodes[index].id,
    nodeJ: nodes[index + 1].id,
    start: nodes[index].position,
    end: nodes[index + 1].position,
    midpoint: [index + 0.5 + offsetX, 0, 0] as const,
    length: 1,
    basis: null,
    selected: false,
    result: null,
  }));

  return {
    nodes,
    members,
    supports: [],
    loads: [],
    reactions: [],
    localAxes: null,
    deformed: null,
    bounds: {
      min: [offsetX, 0, 0],
      max: [Math.max(1, nodeCount - 1) + offsetX, 0, 0],
      center: [Math.max(1, nodeCount - 1) / 2 + offsetX, 0, 0],
      span: Math.max(1, nodeCount - 1),
    },
    diagnostics: [],
    isEmpty: nodeCount === 0,
  };
};

const fakeRenderer = (): Space3DRendererLike => ({
  setPixelRatio: () => undefined,
  setSize: () => undefined,
  render: () => undefined,
  dispose: () => undefined,
});

const fakeControls = (): Space3DControlsLike => ({
  target: new Vector3(),
  enableDamping: false,
  update: () => undefined,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  dispose: () => undefined,
});


/**
 * `setModel` programa el repintado con rAF, que no existe en el entorno node de
 * esta suite. Se ejecuta de inmediato: aquí se comprueba estado de escena y
 * cámara, no el ritmo de cuadros.
 */
const rafGlobal = globalThis as typeof globalThis & {
  requestAnimationFrame?: (callback: FrameRequestCallback) => number;
  cancelAnimationFrame?: (handle: number) => void;
};
const originalRaf = rafGlobal.requestAnimationFrame;
const originalCancelRaf = rafGlobal.cancelAnimationFrame;

beforeAll(() => {
  rafGlobal.requestAnimationFrame ??= (callback) => { callback(0); return 1; };
  rafGlobal.cancelAnimationFrame ??= () => undefined;
});

afterAll(() => {
  rafGlobal.requestAnimationFrame = originalRaf;
  rafGlobal.cancelAnimationFrame = originalCancelRaf;
});

const makeCanvas = (): HTMLCanvasElement => ({
  clientWidth: 800,
  clientHeight: 600,
  parentElement: null,
  getBoundingClientRect: () => ({
    x: 0, y: 0, top: 0, right: 800, bottom: 600, left: 0,
    width: 800, height: 600, toJSON: () => ({}),
  }),
} as unknown as HTMLCanvasElement);

describe('Space 3D viewport display geometry', () => {
  it('keeps scene-object count constant as nodes and members grow', () => {
    const canvas = {
      clientWidth: 800,
      clientHeight: 600,
      parentElement: null,
      getBoundingClientRect: () => ({
        x: 0, y: 0, top: 0, right: 800, bottom: 600, left: 0,
        width: 800, height: 600, toJSON: () => ({}),
      }),
    } as unknown as HTMLCanvasElement;

    const model = makeModel(250);
    const viewport = createSpace3DViewport({
      canvas,
      model,
      createRenderer: () => fakeRenderer(),
      createControls: () => fakeControls(),
    });

    const memberGroup = viewport.scene.getObjectByName('members');
    const nodeGroup = viewport.scene.getObjectByName('nodes');
    expect(memberGroup).toBeDefined();
    expect(nodeGroup).toBeDefined();

    const memberInstances = memberGroup!.children.filter((child) => child instanceof InstancedMesh);
    const nodeInstances = nodeGroup!.children.filter((child) => child instanceof InstancedMesh);

    expect(memberInstances).toHaveLength(1);
    expect(nodeInstances).toHaveLength(1);
    expect((memberInstances[0] as InstancedMesh).count).toBe(249);
    expect((nodeInstances[0] as InstancedMesh).count).toBe(250);

    // One hidden picking primitive + one visual InstancedMesh per entity family.
    expect(memberGroup!.children).toHaveLength(2);
    expect(nodeGroup!.children).toHaveLength(2);

    viewport.dispose();
  });

  // `instanceMatrix` e `instanceColor` los posee el InstancedMesh: si su
  // `dispose()` no se llama, cada reconstrucción de escena —selección, modo de
  // resultado, tema— deja sus búferes vivos en la GPU durante toda la sesión.
  it('disposes instanced buffers when the scene is rebuilt', () => {
    const viewport = createSpace3DViewport({
      canvas: makeCanvas(),
      model: makeModel(8),
      createRenderer: () => fakeRenderer(),
      createControls: () => fakeControls(),
    });

    const instancedIn = (groupName: string): InstancedMesh => {
      const group = viewport.scene.getObjectByName(groupName);
      const mesh = group!.children.find((child) => child instanceof InstancedMesh);
      expect(mesh, groupName).toBeDefined();
      return mesh as InstancedMesh;
    };

    const staleMembers = instancedIn('members');
    const staleNodes = instancedIn('nodes');
    const disposed = new Set<InstancedMesh>();
    for (const mesh of [staleMembers, staleNodes]) {
      const original = mesh.dispose.bind(mesh);
      mesh.dispose = () => { disposed.add(mesh); original(); };
    }

    viewport.setModel(makeModel(12));

    expect(disposed.has(staleMembers)).toBe(true);
    expect(disposed.has(staleNodes)).toBe(true);
    // Y la escena no conserva las mallas viejas.
    expect(instancedIn('members')).not.toBe(staleMembers);

    viewport.dispose();
  });

  // Reemplazar el proyecto reconstruía la geometría sin tocar la cámara: un
  // modelo lejos del origen quedaba fuera de encuadre.
  it('refits the camera when the model moves, and only then', () => {
    const viewport = createSpace3DViewport({
      canvas: makeCanvas(),
      model: makeModel(8),
      createRenderer: () => fakeRenderer(),
      createControls: () => fakeControls(),
    });

    const targetX = () => viewport.controlsTarget.x;
    const initialTarget = targetX();

    // Un modelo del mismo tamaño pero desplazado debe traer la cámara con él.
    viewport.setModel(makeModel(8, 500));
    const movedTarget = targetX();
    expect(movedTarget).toBeGreaterThan(initialTarget + 400);
    expect(viewport.camera.position.x).toBeGreaterThan(400);

    // Una reconstrucción que no mueve los límites no roba el encuadre.
    const restyled = { ...makeModel(8, 500) };
    viewport.setModel(restyled);
    expect(targetX()).toBeCloseTo(movedTarget, 6);

    viewport.dispose();
  });
});
