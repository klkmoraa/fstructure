// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { NodeModel, ProjectModel } from '../../types';
import { CanvasGeometryLayer } from './CanvasGeometryLayer';
import { DEFAULT_EDITOR_LAYERS } from './editorLayers';

const nodes: NodeModel[] = [
  {
    id: 'N1', x: 0, y: 0,
    support: {
      type: 'fixed',
      spring: { kx: 10, ky: 20, kr: 30, kNormal: 40, angleDeg: 35 },
      prescribed: { ux: 0.005 },
    },
  },
  { id: 'N2', x: 4, y: 0, support: { type: 'none' } },
  { id: 'N3', x: 8, y: 0, support: { type: 'none', spring: { ky: 1000 } } },
];

const project = {
  id: 'support-presentation',
  name: 'Soportes visibles',
  nodes,
  members: [],
  nodalLoads: [],
  memberLoads: [],
  loadCases: [{ id: 'LC1', name: 'Carga 1' }],
  prescribedDisplacements: [
    { id: 'PD1', nodeId: 'N1', caseId: 'LC1', component: 'uy', value: -0.01 },
    { id: 'PD2', nodeId: 'N2', caseId: 'LC1', component: 'ux', value: 0.01 },
    { id: 'PD3', nodeId: 'N1', caseId: 'LC1', component: 'rz', value: -0.001 },
  ],
  nodeLinks: [
    { id: 'LINK1', nodeI: 'N1', behavior: 'compression-only', stiffness: 1000, angleDeg: 0 },
    { id: 'LINK2', nodeI: 'N1', nodeJ: 'N2', behavior: 'friction', stiffness: 1000, angleDeg: 0, slipForce: 10 },
  ],
  settings: { units: 'kN-m' },
} as unknown as ProjectModel;

const props = {
  slot: 'objects' as const,
  project,
  nodeMap: new Map(nodes.map((node) => [node.id, node])),
  memberMap: new Map(),
  toScreen: (x: number, y: number) => ({ x: x * 40 + 100, y: 220 - y * 40 }),
  camera: { scale: 1 },
  selectionVisualState: { kind: 'none' as const, nodeIds: [], memberIds: [], nodalLoadId: null, memberLoadId: null, count: 0 },
  candidatePreview: null,
  learningFocus: null,
  memberStartId: null,
  layers: DEFAULT_EDITOR_LAYERS,
  loadsLayerVisible: true,
  heatmapRatios: new Map(),
  demandMapActive: false,
  resultTab: 'moment' as const,
  units: 'kN-m' as const,
  forceLabel: 'kN',
  momentLabel: 'kN·m',
  distributedLabel: 'kN/m',
  t: ((key: string) => key) as never,
  onObjectPointerDown: () => undefined,
  onObjectKeyDown: () => undefined,
  onShowCut: () => undefined,
  onCutLeave: () => undefined,
};

describe('CanvasGeometryLayer support presentation', () => {
  it('draws every configured spring plus the imposed movement and advanced links', () => {
    const { container } = render(<svg><CanvasGeometryLayer {...props} /></svg>);

    expect(container.querySelector('.support-spring--x')).not.toBeNull();
    expect(container.querySelector('.support-spring--y')).not.toBeNull();
    expect(container.querySelector('.support-spring--normal')).not.toBeNull();
    expect(container.querySelector('.support-spring--arc')).not.toBeNull();
    const standaloneSpring = container.querySelector('[data-support-id="N3"]');
    expect(standaloneSpring?.classList.contains('support-spring')).toBe(true);
    expect(standaloneSpring?.classList.contains('support-roller')).toBe(false);
    expect(container.querySelector('[data-settlement-id="PD1"]')?.getAttribute('data-settlement-direction')).toBe('negative');
    expect(container.querySelector('[data-settlement-id="support:N1:ux"]')?.getAttribute('data-settlement-direction')).toBe('positive');
    expect(container.querySelector('[data-settlement-id="PD2"]')?.getAttribute('data-settlement-lane')).toBe('0');
    expect(container.querySelector('[data-settlement-id="PD3"]')?.getAttribute('data-settlement-lane')).toBe('1');
    expect(container.querySelector('[data-node-link-id="LINK1"]')).not.toBeNull();
    expect(container.querySelector('[data-node-link-id="LINK2"]')).not.toBeNull();
  });
});
