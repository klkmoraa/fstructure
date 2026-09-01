// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { MemberModel, NodeModel, ProjectModel } from '../../types';
import type { AnalysisResult } from '../../types';
import { CanvasDiagramStack, externalStackBottomReserve } from './CanvasDiagramStack';

type MemberResult = AnalysisResult['memberResults'][number];

const nodes = [
  { id: 'A', x: 0, y: 0 }, { id: 'B', x: 0, y: 3 },
  { id: 'C', x: 5, y: 3 }, { id: 'D', x: 5, y: 0 },
].map((node) => ({ ...node, support: { type: 'none' } } as NodeModel));

const members = [
  ['AB', 'A', 'B'], ['BC', 'B', 'C'], ['CD', 'C', 'D'],
].map(([id, i, j]) => ({ id, i, j, type: 'frame', E: 2e8, A: 0.02, I: 8e-5 } as MemberModel));

const result = (memberId: string): MemberResult => ({
  memberId,
  length: memberId === 'BC' ? 5 : 3,
  startOffset: 0,
  localDisplacements: [],
  localEndForces: [],
  diagramJumps: [],
  criticalPoints: [],
  diagramSegments: [{
    x0: 0,
    x1: memberId === 'BC' ? 5 : 3,
    axial: [4, 0, 0],
    shear: [8, -2, 0],
    moment: [0, 8, -2, 0],
    distributedAxial: [0, 0],
    distributedTransverse: [0, 0],
  }],
  diagram: [],
  deformation: [],
  deformationSegments: [],
  deformationCriticalPoints: [],
  maxAxial: 4,
  minAxial: -4,
  maxShear: 8,
  minShear: -3,
  maxMoment: 10,
  minMoment: -6,
} as unknown as MemberResult);

const project = { id: 'portal', name: 'Pórtico', nodes, members, settings: { units: 'kN-m' } } as unknown as ProjectModel;
const props = {
  project,
  results: members.map((member) => result(member.id)),
  quantities: ['axial', 'shear', 'moment'] as const,
  nodeMap: new Map(nodes.map((node) => [node.id, node])),
  t: ((key: string) => key) as never,
};

describe('CanvasDiagramStack', () => {
  it('uses an in-canvas scene on compact viewports without reserving a second shelf', () => {
    const { container } = render(<svg><CanvasDiagramStack {...props} size={{ width: 390, height: 520 }} /></svg>);
    const layer = container.querySelector('[data-canvas-layer="diagram-stack"]');

    expect(layer?.classList.contains('diagram-stack-layer--canvas')).toBe(true);
    expect(layer?.querySelector('.diagram-stack-canvas-mask')).toBeTruthy();
    expect(layer?.querySelectorAll('[data-stack-panel]')).toHaveLength(3);
    expect(layer?.querySelectorAll('.diagram-stack-member-label')).toHaveLength(0);
    expect(externalStackBottomReserve(project, { width: 390, height: 520 }, 3)).toBe(0);

    for (const surface of Array.from(layer?.querySelectorAll<SVGRectElement>('.diagram-stack-panel-surface') ?? [])) {
      const x = Number(surface.getAttribute('x'));
      const y = Number(surface.getAttribute('y'));
      const width = Number(surface.getAttribute('width'));
      const height = Number(surface.getAttribute('height'));
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x + width).toBeLessThanOrEqual(390);
      expect(y + height).toBeLessThanOrEqual(520);
    }

    const { container: shortDesktop } = render(<svg><CanvasDiagramStack {...props} size={{ width: 1280, height: 599 }} /></svg>);
    expect(shortDesktop.querySelector('[data-canvas-layer="diagram-stack"]')?.classList.contains('diagram-stack-layer--canvas')).toBe(true);
    expect(externalStackBottomReserve(project, { width: 1280, height: 599 }, 3)).toBe(0);
  });

  it('keeps the wide exterior replica for desktop reading space', () => {
    const { container } = render(<svg><CanvasDiagramStack {...props} size={{ width: 1280, height: 900 }} /></svg>);
    const layer = container.querySelector('[data-canvas-layer="diagram-stack"]');

    expect(layer?.classList.contains('diagram-stack-layer--external')).toBe(true);
    expect(layer?.querySelector('.diagram-stack-canvas-mask')).toBeNull();
    expect(layer?.querySelectorAll('.diagram-stack-member-label')).toHaveLength(9);
    expect(externalStackBottomReserve(project, { width: 1280, height: 900 }, 3)).toBeGreaterThan(0);
  });
});
