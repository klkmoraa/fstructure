import { describe, expect, it } from 'vitest';
import { createBlankProject } from '../data/defaultProject';
import { generateStructure } from '../data/generators/structureGenerators';
import { buildStructuralBom } from '../features/bom/structuralBom';
import { diagramSheetLayout } from '../features/canvas/diagramSheetLayout';
import { circularMemberGeometry, curvePointAt } from './memberCurve';
import { selectGeometryByBox } from '../utils/selectionGeometry';
import { buildIntersectionSnapCandidates, buildPerpendicularSnapCandidates } from '../utils/snapping';

const makeArc = () => {
  const project = createBlankProject();
  const generated = generateStructure({
    kind: 'circular-arch', span: 10, rise: 5, segments: 24,
    properties: { kind: 'explicit', E: 200e6, A: 0.02, I: 0.0001 },
  });
  project.nodes = [...generated.nodes];
  project.members = [...generated.members];
  const arc = circularMemberGeometry(project.members[0], project.nodes[0], project.nodes[1])!;
  const segment = { id: project.members[0].id, start: project.nodes[0], end: project.nodes[1], curve: arc };
  return { project, arc, segment };
};

describe('native curve visual integrations', () => {
  it('frames the crown inside the simultaneous-diagram row', () => {
    const { project, arc } = makeArc();
    const layout = diagramSheetLayout(project, { width: 1301, height: 792 });
    const crown = curvePointAt(arc, 0.5);
    const y = layout.camera.y - crown.y * layout.camera.scale - layout.replicaShift;
    expect(y).toBeGreaterThanOrEqual(35);
    expect(y).toBeLessThanOrEqual(layout.rowHeight - 35);
  });

  it('crosses an arc at its crown without selecting the empty chord', () => {
    const { project } = makeArc();
    const crown = selectGeometryByBox({ x: 6, y: 6 }, { x: 4, y: 4 }, project.nodes, project.members);
    expect(crown.memberIds).toContain(project.members[0].id);
    const emptyChord = selectGeometryByBox({ x: 6, y: 1 }, { x: 4, y: -1 }, project.nodes, project.members);
    expect(emptyChord.memberIds).not.toContain(project.members[0].id);
    const insufficientWindow = selectGeometryByBox({ x: -1, y: -1 }, { x: 11, y: 1 }, project.nodes, project.members);
    expect(insufficientWindow.memberIds).not.toContain(project.members[0].id);
  });

  it('snaps the true arc/line intersection and perpendicular foot', () => {
    const { segment } = makeArc();
    const vertical = { id: 'V', start: { x: 5, y: -2 }, end: { x: 5, y: 7 } };
    const intersections = buildIntersectionSnapCandidates([segment, vertical]);
    expect(intersections.some(p => Math.abs(p.x - 5) < 1e-7 && Math.abs(p.y - 5) < 1e-7)).toBe(true);
    const perpendiculars = buildPerpendicularSnapCandidates({ x: 5, y: 7 }, [segment]);
    expect(perpendiculars.some(p => Math.abs(p.x - 5) < 1e-7 && Math.abs(p.y - 5) < 1e-7)).toBe(true);
  });

  it('measures a semicircular member by centreline length in the BOM', () => {
    const { project } = makeArc();
    const bom = buildStructuralBom(project);
    expect(bom.totals.totalLengthM).toBeCloseTo(5 * Math.PI, 5);
  });
});
