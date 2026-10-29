// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { CanvasGeometryLayer } from './CanvasGeometryLayer';
import { CanvasStructureGeneratorLayer } from './CanvasStructureGeneratorLayer';
import { DEFAULT_EDITOR_LAYERS } from './editorLayers';
import { createBlankProject } from '../../data/defaultProject';
import { generateStructure } from '../../data/generators/structureGenerators';
import { createStructureGenerationGhost } from '../../data/generators/generatorGhost';
import { nearestGeometryCandidate } from './candidatePicker';

afterEach(cleanup);
const params = { kind: 'circular-arch' as const, span: 10, rise: 5, segments: 200,
  properties: { kind: 'explicit' as const, E: 200e6, A: 0.02, I: 0.0001 } };
const screenPoint = (x: number, y: number) => ({ x: x * 40 + 100, y: 320 - y * 40 });
const setup = () => {
  const project = createBlankProject(), shape = generateStructure(params);
  project.nodes = structuredClone([...shape.nodes]); project.members = structuredClone([...shape.members]);
  const onPointer = vi.fn();
  const props = {
    project, nodeMap: new Map(project.nodes.map(n => [n.id, n])), memberMap: new Map(project.members.map(m => [m.id, m])),
    toScreen: screenPoint, camera: { scale: 40 },
    selectionVisualState: { kind: 'none' as const, nodeIds: [], memberIds: [], nodalLoadId: null, memberLoadId: null, count: 0 },
    candidatePreview: null, learningFocus: null, memberStartId: null,
    layers: DEFAULT_EDITOR_LAYERS, loadsLayerVisible: true, heatmapRatios: new Map<string, number>(), demandMapActive: false,
    resultTab: 'moment' as const, units: 'kN-m' as const, forceLabel: 'kN', momentLabel: 'kN·m', distributedLabel: 'kN/m',
    t: ((key: string) => key) as never,
    onObjectPointerDown: onPointer, onObjectKeyDown: vi.fn(), onShowCut: vi.fn(), onCutLeave: vi.fn(),
  };
  return { project, props, onPointer };
};
describe('one curved member on the real editing canvas', () => {
  it('draws one exact arc and only the two physical node objects', () => {
    const { project, props, onPointer } = setup();
    const before = JSON.stringify(project);
    const { container } = render(<svg><CanvasGeometryLayer {...props} slot="members" /><CanvasGeometryLayer {...props} slot="objects" /></svg>);
    expect(container.querySelectorAll('[data-structure-kind="member"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-structure-kind="node"]')).toHaveLength(2);
    const line = container.querySelector('[data-curved-member="true"] .member-line')!;
    expect(line.tagName.toLowerCase()).toBe('path');
    expect(line.getAttribute('d')).toContain(' A ');
    fireEvent.pointerDown(line);
    expect(onPointer.mock.calls[0][1]).toEqual({ kind: 'member', id: 'M1' });
    expect(JSON.stringify(project)).toBe(before);
  });
  it('uses the same one-arc/two-node geometry in the generator ghost', () => {
    const ghost = createStructureGenerationGhost(params);
    const { container } = render(<svg><CanvasStructureGeneratorLayer ghost={ghost} toScreen={screenPoint} label="Curva" /></svg>);
    expect(container.querySelectorAll('.structure-generation-ghost__members path')).toHaveLength(1);
    expect(container.querySelectorAll('.structure-generation-ghost__members line')).toHaveLength(0);
    expect(container.querySelectorAll('.structure-generation-ghost__nodes circle')).toHaveLength(2);
  });
  it('targets the arc at its crown instead of picking a nearby straight chord', () => {
    const { project, props } = setup();
    project.members.push({ ...project.members[0], id: 'M2', curve: undefined });
    const memberMap = new Map(project.members.map(m => [m.id, m]));
    const target = nearestGeometryCandidate({ kind: 'member', id: 'M2' }, [{ kind: 'member', id: 'M2' }, { kind: 'member', id: 'M1' }], { x: 5, y: 5 }, props.nodeMap, memberMap);
    expect(target.id).toBe('M1');
  });
});
