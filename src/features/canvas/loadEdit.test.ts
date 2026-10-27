import { describe, expect, it } from 'vitest';
import { createDefaultProject } from '../../data/defaultProject';
import { beginLoadEdit, prepareLoadEdit } from './loadEdit';
import { toDisplay } from '../../foundation/units';
import type { Selection } from '../../types';
const selected: Selection = { kind: 'nodalLoad', id: 'NL1' };
describe('borrador de cargas', () => {
  it('preparar es puro y conserva caso, nudo y momento coexistente', () => {
    const p = createDefaultProject(); p.nodalLoads[0].mz = 7;
    const before = structuredClone(p); const session = beginLoadEdit(p, selected)!;
    const r = prepareLoadEdit(p, session, '25', '0', false);
    expect(r.ok).toBe(true); expect(p).toEqual(before);
    if (!r.ok) throw new Error(r.reason);
    expect(r.project.nodalLoads[0]).toEqual({ ...before.nodalLoads[0], fx: 25, fy: 0 });
  });
  it('un momento llevado a cero no se convierte en fuerza', () => {
    const p = createDefaultProject(); Object.assign(p.nodalLoads[0], {fx:0, fy:0, mz:-8});
    const r = prepareLoadEdit(p, beginLoadEdit(p, selected)!, '0', '', true);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.project.nodalLoads[0]).toMatchObject({fx:0,fy:0,mz:0});
  });
  it('conserva ceros y proporción con signo de una carga distribuida al rotarla', () => {
    const p = createDefaultProject();
    p.memberLoads = [{id:'Q',memberId:'M1',caseId:'LC1',type:'distributed',coordinateSystem:'local',lengthBasis:'real',start:.1,end:.9,qxStart:0,qyStart:-10,qxEnd:0,qyEnd:5}];
    const s = beginLoadEdit(p, {kind:'memberLoad',id:'Q'})!;
    const r = prepareLoadEdit(p,s,'20','0',false); expect(r.ok).toBe(true);
    if(r.ok) expect(r.project.memberLoads[0]).toEqual({...p.memberLoads[0],qxStart:20,qyStart:0,qxEnd:-10,qyEnd:0});
  });
  it('cambiar sólo magnitud no gira ni redondea una dirección oblicua', () => {
    const p=createDefaultProject(); Object.assign(p.nodalLoads[0],{fx:3,fy:7});
    const s=beginLoadEdit(p,selected)!;
    const r=prepareLoadEdit(p,s,String(s.initial.magnitude*2),String(s.initial.direction),false);
    expect(r.ok).toBe(true);
    if(r.ok){expect(r.project.nodalLoads[0].fx).toBeCloseTo(6,12);expect(r.project.nodalLoads[0].fy).toBeCloseTo(14,12);}
  });
  it('aplicar sin editar conserva exactamente el proyecto', () => {
    const p=createDefaultProject(); Object.assign(p.nodalLoads[0],{fx:3.123456789123,fy:-7.222222222222});
    const s=beginLoadEdit(p,selected)!;
    const r=prepareLoadEdit(p,s,String(s.initial.magnitude),String(s.initial.direction),false);
    expect(r.ok).toBe(true);if(r.ok)expect(r.project).toBe(p);
  });
  it('carga nula puede recibir magnitud y dirección en una sola confirmación', () => {
    const p=createDefaultProject(); Object.assign(p.nodalLoads[0],{fx:0,fy:0,mz:0});
    const r=prepareLoadEdit(p,beginLoadEdit(p,selected)!,'12','0',false);
    expect(r.ok).toBe(true);if(r.ok)expect(r.project.nodalLoads[0]).toMatchObject({fx:12,fy:0});
  });
  it.each(['','abc','Infinity','1e400'])('rechaza magnitud inválida %s sin mutar', value => {
    const p=createDefaultProject();const before=structuredClone(p);
    expect(prepareLoadEdit(p,beginLoadEdit(p,selected)!,value,'-90',false)).toEqual({ok:false,reason:'magnitude'});
    expect(p).toEqual(before);
  });
  it('rechaza un proyecto diferente aunque reutilice los mismos ids', () => {
    const p=createDefaultProject();const s=beginLoadEdit(p,selected)!;p.id='otro';
    expect(prepareLoadEdit(p,s,'25','0',false)).toEqual({ok:false,reason:'stale'});
  });
  it('no confirma sobre una carga cambiada o eliminada', () => {
    const p=createDefaultProject();const s=beginLoadEdit(p,selected)!;p.nodalLoads[0].fy=-8;
    expect(prepareLoadEdit(p,s,'25','0',false)).toEqual({ok:false,reason:'stale'});
    p.nodalLoads=[];expect(prepareLoadEdit(p,s,'25','0',false)).toEqual({ok:false,reason:'stale'});
  });
  it('magnitud original pequeña conserva precisión aunque String use exponente', () => {
    const p=createDefaultProject(); Object.assign(p.nodalLoads[0],{fx:0,fy:-1e-9});
    const session=beginLoadEdit(p,selected)!;
    const r=prepareLoadEdit(p,session,String(session.initial.magnitude),String(session.initial.direction),false);
    expect(r.ok).toBe(true);if(r.ok)expect(r.project).toBe(p);
  });
  it.each(['N-mm','kgf-cm','kip-ft'] as const)('convierte %s una vez y conserva un aplicar sin cambios', units => {
    const p=createDefaultProject();p.settings.units=units;const session=beginLoadEdit(p,selected)!;
    const displayed=toDisplay(session.initial.magnitude,units,'force');
    const same=prepareLoadEdit(p,session,String(displayed),'-90',false);
    expect(same.ok).toBe(true);if(same.ok)expect(same.project).toBe(p);
    const r=prepareLoadEdit(p,session,String(displayed*2),'0',false);
    expect(r.ok).toBe(true);if(r.ok)expect(r.project.nodalLoads[0].fx).toBeCloseTo(40,9);
  });
  it('unidades cambiadas invalidan el borrador', () => {
    const p=createDefaultProject();const session=beginLoadEdit(p,selected)!;p.settings.units='N-mm';
    expect(prepareLoadEdit(p,session,'25','0',false)).toEqual({ok:false,reason:'stale'});
  });
  it('un triángulo mantiene el extremo descargado y sus intervalos', () => {
    const p=createDefaultProject();
    p.memberLoads=[{id:'Q',memberId:'M1',caseId:'LC1',type:'distributed',coordinateSystem:'global',lengthBasis:'horizontal',start:.2,end:.8,qyStart:0,qyEnd:-5}];
    const r=prepareLoadEdit(p,beginLoadEdit(p,{kind:'memberLoad',id:'Q'})!,'10','90',false);
    expect(r.ok).toBe(true);if(r.ok)expect(r.project.memberLoads[0]).toMatchObject({qyStart:0,qyEnd:10,start:.2,end:.8,lengthBasis:'horizontal'});
  });
  it('punto y momento de barra conservan su posición y metadatos', () => {
    const p=createDefaultProject();
    p.memberLoads=[{id:'P',memberId:'M1',caseId:'LC1',type:'point',coordinateSystem:'local',lengthBasis:'real',start:0,end:1,position:.25,px:0,py:-5}];
    const r=prepareLoadEdit(p,beginLoadEdit(p,{kind:'memberLoad',id:'P'})!,'10','0',false);
    expect(r.ok).toBe(true);if(r.ok)expect(r.project.memberLoads[0]).toEqual({...p.memberLoads[0],px:10,py:0});
    p.memberLoads=[{...p.memberLoads[0],type:'moment',moment:-8}];
    const m=prepareLoadEdit(p,beginLoadEdit(p,{kind:'memberLoad',id:'P'})!,'16','',true);
    expect(m.ok).toBe(true);if(m.ok)expect(m.project.memberLoads[0]).toEqual({...p.memberLoads[0],moment:16});
  });

});
