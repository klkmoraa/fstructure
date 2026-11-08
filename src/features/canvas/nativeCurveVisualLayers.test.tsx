// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { createBlankProject } from '../../data/defaultProject';
import { generateStructure } from '../../data/generators/structureGenerators';
import { CanvasGeometryLayer } from './CanvasGeometryLayer';
import { CanvasMiniMap } from './CanvasMiniMap';
import { DEFAULT_EDITOR_LAYERS } from './editorLayers';

afterEach(cleanup);
const setup = () => {
  const project = createBlankProject();
  const geometry = generateStructure({ kind: 'circular-arch', span: 10, rise: 5, segments: 24,
    properties: { kind: 'explicit', E: 200e6, A: 0.02, I: 0.0001 } });
  project.nodes = [...geometry.nodes];
  project.members = [...geometry.members];
  project.settings.showLoads = true;
  const nodeMap = new Map(project.nodes.map(node => [node.id, node]));
  const memberMap = new Map(project.members.map(member => [member.id, member]));
  const props = {
    project, nodeMap, memberMap,
    toScreen: (x: number, y: number) => ({ x: 100 + x * 40, y: 350 - y * 40 }),
    camera: { scale: 40 },
    selectionVisualState: { kind: 'none' as const, nodeIds: [], memberIds: [], nodalLoadId: null, memberLoadId: null, count: 0 },
    candidatePreview: null, learningFocus: null, memberStartId: null,
    layers: DEFAULT_EDITOR_LAYERS, loadsLayerVisible: true, heatmapRatios: new Map<string, number>(),
    demandMapActive: false, resultTab: 'moment' as const, units: 'kN-m' as const,
    forceLabel: 'kN', momentLabel: 'kN·m', distributedLabel: 'kN/m',
    t: ((key: string) => key) as never,
    onObjectPointerDown: vi.fn(), onObjectKeyDown: vi.fn(), onShowCut: vi.fn(), onCutLeave: vi.fn(),
  };
  return { project, props };
};

describe('native-curve visual components', () => {
  it('varies distributed arrows with q and separates two overlapping lanes', () => {
    const { project, props } = setup();
    const caseId = project.loadCases[0]?.id ?? 'LC1';
    project.memberLoads = [
      { id: 'ML1', memberId: 'M1', caseId, type: 'distributed', coordinateSystem: 'global', lengthBasis: 'real',
        start: 0, end: 1, qxStart: 0, qxEnd: 0, qyStart: -1, qyEnd: -9 },
      { id: 'ML2', memberId: 'M1', caseId, type: 'distributed', coordinateSystem: 'global', lengthBasis: 'real',
        start: 0, end: 1, qxStart: 0, qxEnd: 0, qyStart: -9, qyEnd: -9 },
    ];
    const before = JSON.stringify(project);
    const { container } = render(<svg><CanvasGeometryLayer {...props} slot="objects" /></svg>);
    const arrows = [...container.querySelectorAll('[data-structure-id="ML1"] line[marker-end]')];
    expect(arrows).toHaveLength(9);
    const length = (line: Element) => {
      const x1 = Number(line.getAttribute('x1')), x2 = Number(line.getAttribute('x2'));
      const y1 = Number(line.getAttribute('y1')), y2 = Number(line.getAttribute('y2'));
      return Math.hypot(x2 - x1, y2 - y1);
    };
    expect(length(arrows[0])).toBeLessThan(length(arrows[8]));
    expect(container.querySelectorAll('[data-structure-id="ML2"] .native-curve-load-guide').length).toBeGreaterThan(0);
    expect(JSON.stringify(project)).toBe(before);
  });

  it('renders the real arc instead of a chord in the minimap', () => {
    const { project } = setup();
    const { container } = render(<CanvasMiniMap nodes={project.nodes} members={project.members}
      viewport={null} label="Mapa" onFit={vi.fn()} onNavigate={vi.fn()} />);
    expect(container.querySelectorAll('.canvas-minimap-members path')).toHaveLength(1);
    expect(container.querySelector('.canvas-minimap-members path')?.getAttribute('d')).toContain(' A ');
    expect(container.querySelectorAll('.canvas-minimap-members line')).toHaveLength(0);
  });
});
