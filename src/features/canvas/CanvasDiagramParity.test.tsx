// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createDefaultProject } from '../../data/defaultProject';
import { analyzeProject } from '../../engine/solver';
import type { DiagramQuantity } from '../../types';
import { CanvasDiagramStack } from './CanvasDiagramStack';
import { CanvasResultLayer } from './CanvasResultLayer';
import { diagramSheetLayout } from './diagramSheetLayout';

const quantities: DiagramQuantity[] = ['axial', 'shear', 'moment'];
const size = { width: 800, height: 700 };
const t = ((key: string) => key) as never;
const points = (path: Element) => {
  const result: {x:number;y:number}[] = [];
  for (const match of path.getAttribute('d')!.matchAll(/([MLC])([^MLC]*)/g)) {
    const values = match[2].match(/[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi)!.map(Number);
    for (let i=0;i<values.length;i+=2) {
      const point = {x:values[i],y:values[i+1]}; const previous = result.at(-1);
      // A redundant L to the current endpoint does not change the drawn curve.
      if(match[1]==='L' && previous && Math.hypot(point.x-previous.x,point.y-previous.y)<1e-8)continue;
      result.push(point);
    }
  }
  return result;
};

describe.each(['positive', 'negative'] as const)('misma convención %s en vista individual y Diagramas', side => {
  it.each([0, 30, 90, 180])('conserva cada punto de N, V y M en una barra a %s°', angle => {
    const project = createDefaultProject(); const radians = angle * Math.PI / 180;
    project.nodes = [{id:'A',x:0,y:0,support:{type:'fixed'}},{id:'B',x:4*Math.cos(radians),y:4*Math.sin(radians),support:{type:'none'}}];
    project.members = [{...project.members[0],id:'AB',i:'A',j:'B',rigidOffsetI:.2,rigidOffsetJ:.3}];
    project.nodalLoads = [];
    project.memberLoads = [
      {id:'q',memberId:'AB',caseId:'LC1',type:'distributed',coordinateSystem:'local',lengthBasis:'real',start:0,end:1,qyStart:-10,qyEnd:-10},
      {id:'P',memberId:'AB',caseId:'LC1',type:'point',coordinateSystem:'local',lengthBasis:'real',start:0,end:1,position:.6,px:8,py:-5},
    ];
    project.settings.diagramSide = side;
    // Match pixel amplitude so equality checks every Bézier control and load jump,
    // rather than merely checking whether one peak appears above or below the bar.
    project.settings.diagramScale = 52 / 68;
    const analysis = analyzeProject(project); expect(analysis.success).toBe(true);
    const before = JSON.stringify(analysis);
    const layout = diagramSheetLayout(project, size);
    const camera = { x:100, y:400, scale:40 };
    const rowCamera = { ...camera, y:camera.y-layout.replicaShift };
    const nodeMap = new Map(project.nodes.map(n=>[n.id,n]));
    const result = analysis.memberResults[0];
    const stack = render(<CanvasDiagramStack project={project} results={analysis.memberResults} quantities={quantities} nodeMap={nodeMap} size={size} camera={camera} t={t}/>);
    for (const quantity of quantities) {
      const maximum = quantity==='axial'?Math.max(Math.abs(result.maxAxial),Math.abs(result.minAxial)):quantity==='shear'?Math.max(Math.abs(result.maxShear),Math.abs(result.minShear)):Math.max(Math.abs(result.maxMoment),Math.abs(result.minMoment));
      const single = render(<svg><CanvasResultLayer slot="diagrams" project={project} analysis={analysis} resultTab={quantity} resultsAllowed resultCursor={null} influenceCanvasState={null} modeShapeState={null}
        camera={rowCamera} toScreen={(x,y)=>({x:rowCamera.x+x*rowCamera.scale,y:rowCamera.y-y*rowCamera.scale})}
        nodeMap={nodeMap} memberMap={new Map(project.members.map(m=>[m.id,m]))} resultMap={new Map([[result.memberId,result]])} nodeResultMap={new Map(analysis.nodeResults.map(n=>[n.nodeId,n]))}
        mechanismMap={new Map()} mechanismPixelScale={1} globalDiagramMax={Math.max(1e-9,maximum)} units="kN-m" lengthLabel="m" forceLabel="kN" momentLabel="kN·m" showResults showDiagnostics={false} size={size} t={t}/></svg>);
      const expected = points(single.container.querySelector('.diagram-line-exact')!);
      const actual = points(stack.container.querySelector(`[data-stack-panel="${quantity}"] .diagram-stack-member-line`)!);
      expect(actual).toHaveLength(expected.length);
      actual.forEach((p,i)=>{expect(p.x, `${quantity}, punto ${i}, x`).toBeCloseTo(expected[i].x,8);expect(p.y, `${quantity}, punto ${i}, y`).toBeCloseTo(expected[i].y,8);});
      single.unmount();
    }
    expect(JSON.stringify(analysis)).toBe(before); stack.unmount();
  });
});

it('el caso de la captura conserva M positivo y negativo, así como las reacciones de referencia',()=>{
  const p=createDefaultProject();p.nodes=[{id:'A',x:0,y:0,support:{type:'pin'}},{id:'B',x:9,y:0,support:{type:'none'}},{id:'C',x:18,y:0,support:{type:'fixed'}}];
  p.members=[{...p.members[0],id:'AB',i:'A',j:'B'},{...p.members[1],id:'BC',i:'B',j:'C'}];p.nodalLoads=[];
  p.memberLoads=[{id:'q',memberId:'AB',caseId:'LC1',type:'distributed',coordinateSystem:'global',lengthBasis:'real',start:0,end:1,qyStart:-10,qyEnd:-10}];
  const a=analyzeProject(p);expect(a.success).toBe(true);expect(a.nodeResults.find(n=>n.nodeId==='A')!.ry).toBeCloseTo(57.65625,5);expect(a.nodeResults.find(n=>n.nodeId==='C')!.ry).toBeCloseTo(32.34375,5);
  expect(a.memberResults[0].maxMoment).toBeCloseTo(166.212158203125,5);expect(a.memberResults[1].minMoment).toBeCloseTo(-177.1875,5);
});

it('los valores grandes de momento mantienen la precisión de centésimas de la vista individual',()=>{
  const p=createDefaultProject();p.nodes=[{id:'A',x:0,y:0,support:{type:'pin'}},{id:'B',x:9,y:0,support:{type:'none'}},{id:'C',x:18,y:0,support:{type:'fixed'}}];
  p.members=[{...p.members[0],id:'AB',i:'A',j:'B'},{...p.members[1],id:'BC',i:'B',j:'C'}];p.nodalLoads=[];
  p.memberLoads=[{id:'q',memberId:'AB',caseId:'LC1',type:'distributed',coordinateSystem:'global',lengthBasis:'real',start:0,end:1,qyStart:-10,qyEnd:-10}];
  const a=analyzeProject(p);
  const {container}=render(<CanvasDiagramStack project={p} results={a.memberResults} quantities={['moment']} nodeMap={new Map(p.nodes.map(n=>[n.id,n]))} size={size} t={t}/>);
  for(const r of a.memberResults){
    const values=[...container.querySelectorAll(`[data-stack-member="${r.memberId}"] .diagram-stack-value`)].map(el=>Number(el.textContent));
    for(const peak of [r.maxMoment,r.minMoment].filter(value=>Math.abs(value)>100)) expect(values.some(value=>Math.abs(value-peak)<=.005)).toBe(true);
  }
});
