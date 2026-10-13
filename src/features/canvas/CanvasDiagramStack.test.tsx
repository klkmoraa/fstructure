// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { expect, it } from 'vitest';
import { createDefaultProject } from '../../data/defaultProject';
import { analyzeProject } from '../../engine/solver';
import { diagramSheetLayout } from './diagramSheetLayout';
import { CanvasDiagramStack, diagramRowHeight } from './CanvasDiagramStack';

const project = createDefaultProject();
const camera = { x: 80, y: 320, scale: 40 };
const props = { project, results: analyzeProject(project).memberResults, quantities: ['axial', 'shear', 'moment'] as const,
  nodeMap: new Map(project.nodes.map((node) => [node.id, node])), t: ((key: string) => key) as never, camera };

it('cada diagrama conserva el marco COMPLETO y las mismas coordenadas que el DCL', () => {
  const { container } = render(<CanvasDiagramStack {...props} size={{ width: 800, height: 700 }} />);
  const panels = container.querySelectorAll('[data-stack-panel]');
  expect(panels).toHaveLength(3);
  for (const panel of panels) {
    const members = panel.querySelectorAll('.diagram-stack-replica-member');
    expect(members).toHaveLength(3);
    for (const member of project.members) {
      const line = panel.querySelector(`[data-replica-member="${member.id}"]`)!;
      const i = props.nodeMap.get(member.i)!; const j = props.nodeMap.get(member.j)!;
      expect(Number(line.getAttribute('x1'))).toBe(camera.x + i.x * camera.scale);
      expect(Number(line.getAttribute('y1'))).toBe(camera.y - i.y * camera.scale - diagramSheetLayout(project, {width:800,height:700}).replicaShift);
      expect(Number(line.getAttribute('x2'))).toBe(camera.x + j.x * camera.scale);
      expect(Number(line.getAttribute('y2'))).toBe(camera.y - j.y * camera.scale - diagramSheetLayout(project, {width:800,height:700}).replicaShift);
    }
  }
});
it('una viga incluye todos sus tramos y el voladizo; cada cantidad tiene su eje alineado', () => {
  const beam = createDefaultProject();
  beam.nodes = [
    { id:'A',x:0,y:0,support:{type:'pin'} }, { id:'B',x:3,y:0,support:{type:'roller',angleDeg:90} },
    { id:'C',x:4.5,y:0,support:{type:'none'} },
  ];
  beam.members = [ { ...beam.members[0],id:'AB',i:'A',j:'B' }, { ...beam.members[0],id:'BC',i:'B',j:'C' } ];
  beam.nodalLoads = [{id:'P',nodeId:'C',caseId:'LC1',fx:0,fy:-1,mz:0}];beam.memberLoads=[];
  const { container } = render(<CanvasDiagramStack {...props} project={beam} results={analyzeProject(beam).memberResults}
    nodeMap={new Map(beam.nodes.map(n=>[n.id,n]))} size={{width:390,height:650}} />);
  expect(container.querySelectorAll('[data-replica-member="AB"]')).toHaveLength(3);
  expect(container.querySelectorAll('[data-replica-member="BC"]')).toHaveLength(3);
  for (const line of container.querySelectorAll('[data-replica-member="BC"]')) {
    expect(Number(line.getAttribute('x1'))).toBe(200);
    expect(Number(line.getAttribute('x2'))).toBe(260);
    expect(Number(line.getAttribute('y1'))).toBe(Number(line.getAttribute('y2')));
  }
});
it('los marcos conservan espacio legible sin comprimir tres copias dentro del alto de pantalla', () => {
  expect(diagramRowHeight(project,{width:390,height:650})).toBeGreaterThan(240);
  expect(diagramRowHeight(project,{width:844,height:280})).toBeGreaterThanOrEqual(220);
});
