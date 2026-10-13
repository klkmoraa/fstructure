import { expect, it } from 'vitest';
import { createDefaultProject } from './defaultProject';
import { compileProjectCommand, applyProjectPatch } from '../commands/projectCommand';
import { normalizeProject } from './migrate';
import { model2dDesignSource } from '../design/elements/model2dSource';
import { setStiffnessDefaults } from './memberStiffness';
const section={name:'Viga 30 × 60',definition:{family:'rectangle' as const,width:.3,depth:.6}};
const material={name:'Concreto 32',category:'CONCRETE' as const,poissonRatio:.2,thermalExpansion:1e-5,compressiveStrength:32000};
it('la geometría se aplica atómicamente, conserva sus medidas al reabrir y se deshace',()=>{
  const p=setStiffnessDefaults(createDefaultProject(),{mode:'EI',factor:2},true);
  const c=compileProjectCommand(p,{kind:'member.section.custom',description:'Sección',memberId:'M1',section});
  const n=applyProjectPatch(p,c.forward);expect(n.members[0].A).toBeCloseTo(.18);expect(n.members[0].I).toBeCloseTo(.0054);
  expect(n.members[0].stiffnessFactor).toBeUndefined();expect(normalizeProject(JSON.parse(JSON.stringify(n))).members[0].customSection).toEqual(section);
  expect(applyProjectPatch(n,c.inverse)).toEqual(p);
});
it('un concreto con f′c propio llega a Diseño, aun con un E elegido por el usuario',()=>{
  const p=createDefaultProject();
  const c=compileProjectCommand(p,{kind:'member.material.custom',description:'Material',memberId:'M2',material,properties:{E:60e6,G:25e6,density:2450}});
  const n=applyProjectPatch(p,c.forward);expect(n.members[1].materialId).toBeUndefined();
  expect(normalizeProject(JSON.parse(JSON.stringify(n))).members[1].customMaterial).toEqual(material);
  expect(model2dDesignSource(n).fcMpa).toBe(32);
  expect(applyProjectPatch(n,c.inverse)).toEqual(p);
});
it('rechaza medidas y materiales inválidos sin mutar el proyecto',()=>{
  const p=createDefaultProject();
  expect(()=>compileProjectCommand(p,{kind:'member.section.custom',description:'Mala',memberId:'M1',section:{...section,definition:{family:'rectangular-box',width:.3,depth:.5,thickness:.2}}})).toThrow();
  expect(()=>normalizeProject({...p,members:[{...p.members[0],customMaterial:{...material,poissonRatio:.6}}]})).toThrow();
  expect(()=>normalizeProject({...p,members:[{...p.members[0],customMaterial:{...material,compressiveStrength:-32}}]})).toThrow();
});
it('las barras nuevas usan Ejercicios sin imponer forma o material',()=>{
  const p=createDefaultProject();const c=compileProjectCommand(p,{kind:'member.createAtPoint',description:'Nueva',startNodeId:'N4',point:{x:9,y:4},template:{type:'frame',E:200e6,A:.01,I:8e-5}});
  const m=applyProjectPatch(p,c.forward).members.at(-1)!;expect(m.propertyProfile).toBe('exercise');expect(m.customSection).toBeUndefined();expect(m.customMaterial).toBeUndefined();
});
it('modificar medidas conserva E constante y editar el material conserva I constante',()=>{
  for (const mode of ['E','I'] as const){const p=setStiffnessDefaults(createDefaultProject(),{mode,value:mode==='E'?30e6:.002,factor:2},true);
    const c=compileProjectCommand(p,mode==='E'?{kind:'member.section.custom',description:'Medidas',memberId:'M1',section}:{kind:'member.material.custom',description:'E propio',memberId:'M1',material,properties:{E:40e6}});
    const m=applyProjectPatch(p,c.forward).members[0];expect(m.stiffnessFactor).toBe(2);expect(m[mode]).toBe(p.members[0][mode]);}
});
it('la geometría real permite evaluar la fluencia con Fy personalizado; las constantes no fabrican W',async()=>{
  const {analyzeProject}=await import('../engine/solver');const {memberElasticIndexView}=await import('../features/results/elasticDemand');
  const p=createDefaultProject();p.members=p.members.map(m=>({...m,customSection:section,sectionOrigin:'custom' as const,customMaterial:{name:'Acero propio',category:'STEEL' as const,poissonRatio:.3,thermalExpansion:1.3e-5,yieldStrength:355000},materialOrigin:'custom' as const,A:.18,I:.0054}));
  const a=analyzeProject(p);expect(a.success).toBe(true);const view=memberElasticIndexView(p.members[1],a.memberResults.find(r=>r.memberId==='M2')!,a);
  expect(view.status).toBe('available');if(view.status==='available'){expect(view.index.material.yieldStrength).toBe(355000);expect(view.index.section?.sectionModulus).toBeCloseTo(.018);}
  const relative=setStiffnessDefaults(p,{mode:'I',value:.02,factor:1},true);const next=analyzeProject(relative);expect(memberElasticIndexView(relative.members[1],next.memberResults.find(r=>r.memberId==='M2')!,next).status).toBe('unavailable');
});
it('α del material actúa en un efecto térmico sin α propio y el valor explícito tiene prioridad',async()=>{
  const {analyzeProject}=await import('../engine/solver');const p=createDefaultProject();p.nodes=[{id:'A',x:0,y:0,support:{type:'pin'}},{id:'B',x:2,y:0,support:{type:'custom',restrainX:true,restrainY:true}}];
  p.members=[{...p.members[0],id:'AB',i:'A',j:'B',type:'truss',I:0,E:200e6,A:.01,customMaterial:{name:'Acero',category:'STEEL',poissonRatio:.3,thermalExpansion:2e-5},materialOrigin:'custom'}];p.memberLoads=[];p.nodalLoads=[];p.memberInitialEffects=[{id:'T',memberId:'AB',caseId:'LC1',type:'temperature',deltaT:20}];
  const a=analyzeProject(p);expect(a.success).toBe(true);expect(Math.abs(a.memberResults[0].maxAxial)).toBeCloseTo(200e6*.01*2e-5*20);
  p.memberInitialEffects[0].alpha=1e-5;expect(Math.abs(analyzeProject(p).memberResults[0].maxAxial)).toBeCloseTo(200e6*.01*1e-5*20);
});
