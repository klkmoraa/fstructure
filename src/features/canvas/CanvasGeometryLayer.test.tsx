// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { MemberLoad, MemberModel, NodeModel, ProjectModel } from '../../types';
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
  settings: { units: 'kN-m', showLoads: true },
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

const member = {
  id: 'M1', i: 'N1', j: 'N2', type: 'frame',
  material: { elasticModulus: 200_000_000, density: 7850 },
  section: { area: 0.01, inertia: 8e-6 },
} as unknown as MemberModel;

const renderMemberLoads = (memberLoads: MemberLoad[]) => render(<svg><CanvasGeometryLayer
  {...props}
  project={{ ...project, members: [member], memberLoads } as ProjectModel}
  memberMap={new Map([[member.id, member]])}
/></svg>);

const distributedLoad = (qyStart: number, qyEnd: number): MemberLoad => ({
  id: 'ML1', memberId: member.id, caseId: 'LC1', type: 'distributed',
  coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1,
  qxStart: 0, qxEnd: 0, qyStart, qyEnd,
});

const distributedSpan = (id: string, start: number, end: number): MemberLoad => ({
  ...distributedLoad(-10, -10),
  id,
  start,
  end,
});

const pointLoad = (id: string, magnitude: number): MemberLoad => ({
  id, memberId: member.id, caseId: 'LC1', type: 'point',
  coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1,
  position: 0.25, px: 0, py: -magnitude,
});

const arrowTailYs = (container: HTMLElement) => [...container.querySelectorAll<SVGLineElement>('.load-symbol--distributed line[marker-end]')]
  .map((line) => Number(line.getAttribute('y1')));

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

describe('CanvasGeometryLayer distributed-load presentation', () => {
  it('draws overlapping distributed loads in complete non-overlapping bands', () => {
    const { container } = renderMemberLoads([
      distributedSpan('short', 0.2, 0.3),
      distributedSpan('wide', 0, 1),
      distributedSpan('medium', 0, 0.5),
    ]);
    const arrow = (id: string) => container.querySelector<SVGLineElement>(
      `[data-structure-id="${id}"] line[marker-end]`,
    );

    expect([arrow('wide')?.getAttribute('y1'), arrow('wide')?.getAttribute('y2')]).toEqual(['158', '220']);
    expect([arrow('medium')?.getAttribute('y1'), arrow('medium')?.getAttribute('y2')]).toEqual(['95', '157']);
    expect([arrow('short')?.getAttribute('y1'), arrow('short')?.getAttribute('y2')]).toEqual(['32', '94']);
  });

  it('keeps the intermediate arrows on a downward triangular envelope that ends at zero', () => {
    const { container } = renderMemberLoads([distributedLoad(-2000, 0)]);

    expect(arrowTailYs(container)).toEqual([158, 189]);
  });

  it('keeps the intermediate arrows on an upward triangular envelope that starts at zero', () => {
    const { container } = renderMemberLoads([distributedLoad(0, 2000)]);

    expect(arrowTailYs(container)).toEqual([251, 282]);
  });

  it('splits an opposed distributed load into two signed triangular lobes', () => {
    const { container } = renderMemberLoads([distributedLoad(2000, -2000)]);

    expect(arrowTailYs(container)).toEqual([282, 158]);
    expect(container.querySelectorAll('.distributed-envelope')).toHaveLength(2);
  });
});

describe('CanvasGeometryLayer point-load collision presentation', () => {
  it('draws coincident point loads as separate vertical levels without a lateral fan', () => {
    const { container } = renderMemberLoads([
      pointLoad('small', 10),
      pointLoad('large', 30),
      pointLoad('medium', 20),
    ]);
    const arrow = (id: string) => container.querySelector<SVGLineElement>(
      `[data-structure-id="${id}"] line[marker-end]`,
    );

    expect([arrow('large')?.getAttribute('y1'), arrow('large')?.getAttribute('y2')]).toEqual(['168', '213']);
    expect([arrow('medium')?.getAttribute('y1'), arrow('medium')?.getAttribute('y2')]).toEqual(['122', '167']);
    expect([arrow('small')?.getAttribute('y1'), arrow('small')?.getAttribute('y2')]).toEqual(['76', '121']);
    expect([arrow('large')?.getAttribute('x1'), arrow('medium')?.getAttribute('x1'), arrow('small')?.getAttribute('x1')])
      .toEqual(['140', '140', '140']);

    const guide = container.querySelector<SVGLineElement>('[data-point-stack-guide-for="small"]');
    expect([guide?.getAttribute('y1'), guide?.getAttribute('y2')]).toEqual(['213', '121']);
  });

  it('places the complete point arrow beyond an overlapping distributed envelope', () => {
    const { container } = renderMemberLoads([
      distributedLoad(-10, -10),
      pointLoad('point', 30),
    ]);
    const arrow = container.querySelector<SVGLineElement>('[data-structure-id="point"] line[marker-end]');
    const guide = container.querySelector<SVGLineElement>('[data-point-stack-guide-for="point"]');

    expect([arrow?.getAttribute('y1'), arrow?.getAttribute('y2')]).toEqual(['112', '157']);
    expect([guide?.getAttribute('y1'), guide?.getAttribute('y2')]).toEqual(['213', '157']);
  });
});
