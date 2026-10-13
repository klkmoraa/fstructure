import { expect, it } from 'vitest';
import { createDefaultProject } from '../../data/defaultProject';
import { diagramSheetLayout } from './diagramSheetLayout';
it('encuadra una viga trasladada y conserva márgenes de cargas y diagramas compactos', () => {
  const p = createDefaultProject(); p.nodes = p.nodes.slice(0,3).map((n,i)=>({...n,x:100+i*3,y:20}));
  const l = diagramSheetLayout(p,{width:390,height:720});
  expect(l.rowHeight).toBeLessThan(170);
  for(const n of p.nodes){const x=l.camera.x+n.x*l.camera.scale;const y=l.camera.y-n.y*l.camera.scale;
    expect(x).toBeGreaterThanOrEqual(40);expect(x).toBeLessThanOrEqual(350);
    expect(y).toBeGreaterThan(120);expect(y).toBeLessThan(l.dclHeight-40);
    const replicaY=y-l.replicaShift;expect(replicaY).toBeGreaterThan(40);expect(replicaY).toBeLessThan(l.rowHeight-40);
  }
});
it('muestra completo un marco alto y nunca impone una escala mínima que recorte el modelo',()=>{
  const p=createDefaultProject();p.nodes=p.nodes.map(n=>({...n,x:n.x*100,y:n.y*100}));
  const l=diagramSheetLayout(p,{width:390,height:450});
  for(const n of p.nodes){const x=l.camera.x+n.x*l.camera.scale;const y=l.camera.y-n.y*l.camera.scale;
    expect(x).toBeGreaterThan(35);expect(x).toBeLessThan(355);expect(y).toBeGreaterThan(110);expect(y).toBeLessThan(l.dclHeight-30);
  }
});
