import {describe,expect,it} from 'vitest';
import {createBlankProject,createDefaultProject} from '../../data/defaultProject';
import {setStiffnessDefaults} from '../../data/memberStiffness';
import {analyzeProject} from '../../engine/solver';
import {analysisFeedback} from './analysisFeedback';

function screenshotBeam() {
 let p=createBlankProject();
 p.nodes=[{id:'N1',x:0,y:0,support:{type:'roller',angleDeg:90}},{id:'N2',x:7,y:0,support:{type:'custom',restrainX:true,restrainY:false,restrainR:true}}];
 p.members=[{id:'M1',i:'N1',j:'N2',type:'frame',E:200e6,A:.01,I:8.333e-6}];
 p.nodalLoads=[];p.memberLoads=[{id:'P1',memberId:'M1',caseId:'LC1',type:'point',coordinateSystem:'global',lengthBasis:'real',start:0,end:1,position:2.891/7,px:0,py:-10}];
 return setStiffnessDefaults(p,{mode:'EI',factor:1},true);
}
describe('diagnóstico de ejercicios sin desvío a Doctor',()=>{
 it.each(['es','en'] as const)('explica la referencia sin tratarla como fallo físico (%s)',language=>{
  const r=analyzeProject(screenshotBeam());const before=structuredClone(r);
  expect(r.success).toBe(true);expect(r.nodeResults[1].rm).toBeCloseTo(28.91,8);
  expect(r.issues.map(i=>i.id)).toEqual(expect.arrayContaining(['relative-stiffness','small-displacement-assumption']));
  expect(analysisFeedback(r,language,'Doctor')).toMatchObject({tone:'info',compact:true,action:{command:'open-results'}});
  expect(analysisFeedback(r,language,'Doctor').durationMs).toBeGreaterThan(0);
  expect(r).toEqual(before);
 });
 it('una referencia sin otro aviso nunca enlaza a Doctor',()=>{
  const r=analyzeProject(setStiffnessDefaults(createDefaultProject(),{mode:'EI',factor:1},true));
  r.issues=r.issues.filter(i=>i.id==='relative-stiffness');
  expect(analysisFeedback(r,'es','Doctor').action?.command).toBe('open-results');
 });
 it('deformaciones grandes con rigidez física mantienen advertencia y causa explícita',()=>{
  const p=screenshotBeam();p.settings.stiffnessDefaults!.value=1666.6;
  const r=analyzeProject(p);expect(r.issues.some(i=>i.id==='relative-stiffness')).toBe(false);
  const issue=r.issues.find(i=>i.id==='small-displacement-assumption')!;
  const notice=analysisFeedback(r,'es','Doctor');expect(notice.tone).toBe('warning');expect(notice.durationMs).toBe(0);
  expect(notice.description).toContain(issue.title);
 });
 it('la referencia no oculta otro problema del modelo',()=>{
  const r=analyzeProject(screenshotBeam());
  r.issues.push({id:'dup-M2',severity:'warning',title:'Miembro superpuesto',message:'Revisar la duplicación de rigidez.'});
  const notice=analysisFeedback(r,'es','Doctor');expect(notice.tone).toBe('warning');expect(notice.description).toContain('Miembro superpuesto');
 });
 it.each(['limited','unreliable'] as const)('la calidad %s no se convierte en información de referencia',level=>{
  const r=analyzeProject(screenshotBeam());r.reliability={...r.reliability!,level};
  const notice=analysisFeedback(r,'es','Doctor');expect(notice.tone).toBe(level==='limited'?'warning':'error');expect(notice.durationMs).toBe(0);
 });
 it('un modelo sin apoyos sigue fallando y mantiene el error visible',()=>{
  const p=screenshotBeam();p.nodes.forEach(n=>{n.support={type:'none'};});
  const r=analyzeProject(p);expect(r.success).toBe(false);
  expect(analysisFeedback(r,'es','Doctor')).toMatchObject({tone:'error',durationMs:0,action:{command:'open-results'}});
 });
});
