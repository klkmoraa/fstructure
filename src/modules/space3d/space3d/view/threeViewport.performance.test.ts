import { describe, expect, it } from 'vitest';
import { InstancedMesh, Vector3 } from 'three';
import type { Space3DSceneModel } from './sceneModel';
import {
  createSpace3DViewport,
  type Space3DControlsLike,
  type Space3DRendererLike,
} from './threeViewport';

const makeModel = (nodeCount: number): Space3DSceneModel => {
  const nodes = Array.from({ length: nodeCount }, (_, index) => ({
    id: `N${index + 1}`,
    position: [index, 0, 0] as const,
    restrained: false,
    selected: false,
  }));
  const members = Array.from({ length: Math.max(0, nodeCount - 1) }, (_, index) => ({
    id: `M${index + 1}`,
    nodeI: nodes[index].id,
    nodeJ: nodes[index + 1].id,
    start: nodes[index].position,
    end: nodes[index + 1].position,
    midpoint: [index + 0.5, 0, 0] as const,
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
      min: [0, 0, 0],
      max: [Math.max(1, nodeCount - 1), 0, 0],
      center: [Math.max(1, nodeCount - 1) / 2, 0, 0],
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
});
