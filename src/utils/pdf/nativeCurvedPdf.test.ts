import { describe, expect, it, vi } from 'vitest';
import { createBlankProject } from '../../data/defaultProject';
import { generateStructure } from '../../data/generators/structureGenerators';
import type { PdfColor } from './reportContext';
import type { PdfLayout } from './pdfBuilder';
import { createProjection, drawProjectedMember } from './pdfScene';
import { circularMemberGeometry, curvePointAt } from '../../graphics/memberCurve';

const projectWithArc = () => {
  const project = createBlankProject();
  const generated = generateStructure({ kind: 'circular-arch', span: 10, rise: 5, segments: 24,
    properties: { kind: 'explicit', E: 200e6, A: 0.02, I: 0.0001 } });
  project.nodes = [...generated.nodes];
  project.members = [...generated.members];
  return project;
};

describe('PDF native curved member geometry', () => {
  it('fits the true crown within the report projection', () => {
    const project = projectWithArc(), member = project.members[0];
    const arc = circularMemberGeometry(member, project.nodes[0], project.nodes[1])!;
    const projection = createProjection(project.nodes, { left: 10, right: 310, bottom: 20, top: 220 }, project.members);
    const crown = curvePointAt(arc, 0.5), pos = projection.at(crown.x, crown.y);
    expect(pos.y).toBeGreaterThan(20);
    expect(pos.y).toBeLessThanOrEqual(220);
    expect(projection.at(project.nodes[0].x, project.nodes[0].y).y).toBeGreaterThanOrEqual(20);
  });

  it('draws a curved polyline in the free-body scene without adding physical nodes', () => {
    const project = projectWithArc();
    const drawLine = vi.fn();
    const layout = { page: { drawLine } } as unknown as PdfLayout;
    const projection = createProjection(project.nodes, { left: 10, right: 310, bottom: 20, top: 220 }, project.members);
    const previous = JSON.stringify(project);
    drawProjectedMember(layout, projection, project.members[0], project.nodes[0], project.nodes[1],
      { thickness: 2, color: {} as PdfColor });
    expect(drawLine.mock.calls.length).toBeGreaterThan(32);
    const ys = drawLine.mock.calls.flatMap(([line]) => [line.start.y, line.end.y]);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(100);
    expect(JSON.stringify(project)).toEqual(previous);
  });
});
