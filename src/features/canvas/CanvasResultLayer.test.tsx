// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { expect, it } from 'vitest';
import { createBlankProject } from '../../data/defaultProject';
import { analyzeProject } from '../../engine/solver';
import { CanvasResultLayer } from './CanvasResultLayer';

it('muestra la deformada de una viga con rótula y cargas en N sin alterar sus resultados', () => {
  const project = createBlankProject();
  project.nodes = [
    { id: 'N1', x: 0, y: 0, support: { type: 'none' } },
    { id: 'N2', x: 2, y: 0, support: { type: 'roller' } },
    { id: 'N3', x: 5, y: 0, support: { type: 'none' }, internalHinge: true },
    { id: 'N4', x: 8, y: 0, support: { type: 'fixed' } },
  ];
  project.members = [ ['N1', 'N2'], ['N2', 'N3'], ['N3', 'N4'] ].map(([i, j], index) => ({
    id: `M${index + 1}`, i, j, type: 'frame', E: 200e6, A: 0.005, I: 8.333e-6,
  }));
  project.nodalLoads = [{ id: 'moment', nodeId: 'N1', caseId: 'LC1', fx: 0, fy: 0, mz: -0.008 }];
  project.memberLoads = [{ id: 'point', memberId: 'M3', caseId: 'LC1', type: 'point', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, position: 2 / 3, px: 0, py: -0.01 }];
  const analysis = analyzeProject(project);
  expect(analysis.success).toBe(true);
  expect(analysis.nodeResults.find((node) => node.nodeId === 'N2')!.ry).toBeCloseTo(-0.008 / 3, 9);
  expect(analysis.nodeResults.find((node) => node.nodeId === 'N4')!.rm).toBeCloseTo(-0.018, 9);
  const original = JSON.stringify(analysis);
  const { container } = render(<svg><CanvasResultLayer
    slot="diagrams" project={project} analysis={analysis} resultTab="deformed" resultsAllowed
    resultCursor={null} influenceCanvasState={null} modeShapeState={null}
    camera={{ scale: 40, x: 0, y: 0 }} toScreen={(x, y) => ({ x: x * 40, y: -y * 40 })}
    nodeMap={new Map(project.nodes.map((node) => [node.id, node]))}
    memberMap={new Map(project.members.map((member) => [member.id, member]))}
    resultMap={new Map(analysis.memberResults.map((member) => [member.memberId, member]))}
    nodeResultMap={new Map(analysis.nodeResults.map((node) => [node.nodeId, node]))}
    mechanismMap={new Map()} mechanismPixelScale={1} globalDiagramMax={1}
    units="kN-m" lengthLabel="m" forceLabel="kN" momentLabel="kN·m"
    showResults showDiagnostics={false} size={{ width: 400, height: 400 }} t={((key: string) => key) as never}
  /></svg>);
  const ys = [...container.querySelectorAll('.deformed-layer path')].flatMap((path) =>
    [...path.getAttribute('d')!.matchAll(/[ML] [\d.e+-]+ ([\d.e+-]+)/g)].map((match) => Math.abs(Number(match[1]))));
  expect(Math.max(...ys)).toBeGreaterThan(20);
  expect(JSON.stringify(analysis)).toBe(original);
});
