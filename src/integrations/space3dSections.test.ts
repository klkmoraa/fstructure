import { expect, it } from 'vitest';
import { createConcreteFrameProject } from '../data/defaultProject';
import { space3dFromModel2d } from './model2dSpace3d';
import { space3dSectionGroups, withSpace3dSections, designSpace3dSectionCandidate } from './space3dSections';
import { proposeModelSections, type SectionProposal } from '../features/design/workbench/frameProposal';
import { FRAME_DEFAULTS, structureOptions } from '../features/design/workbench/frameModel';
import { space3dDesignAxes } from './space3dDesign';
import { parseSpace3DDraft } from '../modules/space3d/space3d/data/codec';
import type { DesignCodeId } from '../design/elements/codes';
const model = (frames = 1) => space3dFromModel2d(createConcreteFrameProject(), { frames, spacingM: frames > 1 ? 5 : 0 }).model!;
const sizes = { beam: { widthMm: 300, heightMm: 500 }, column: { widthMm: 400, heightMm: 400 } };
it('cambia propiedades rectangulares por grupo y conserva datos y orientación; se puede guardar y reabrir', () => {
  const original = model();
  const groups = space3dSectionGroups(original);
  expect(groups.flatMap((g) => g.memberIds).sort()).toEqual(original.members.map((m) => m.id).sort());
  const changed = withSpace3dSections(original, sizes);
  expect(changed.nodes).toBe(original.nodes);
  expect(changed.memberLoads).toBe(original.memberLoads);
  expect(changed.nodalLoads).toBe(original.nodalLoads);
  changed.members.forEach((m, i) => { expect(m.orientation).toEqual(original.members[i]!.orientation); expect(m.E).toBe(original.members[i]!.E); });
  const beam = changed.members.find((m) => groups.some((g) => g.kind === 'beam' && g.memberIds.includes(m.id)))!;
  expect(beam.A).toBeCloseTo(.15, 12); expect(beam.Iz).toBeCloseTo(.3*.5**3/12, 12); expect(beam.Iy).toBeCloseTo(.5*.3**3/12, 12);
  expect(beam.J).toBeGreaterThan(0); expect(beam.sectionId).toBeUndefined();
  expect(parseSpace3DDraft(JSON.stringify(structuredClone(changed)))).toEqual(changed);
  expect(() => withSpace3dSections(original, { ...sizes, beam: { widthMm: NaN, heightMm: 500 } })).toThrow(/finitas/);
  const steel = { ...original, members: original.members.map((m) => ({ ...m, E: 200e6, materialId: 'A992', materialOrigin: 'catalog' as const })) };
  expect(withSpace3dSections(steel, sizes).members).toEqual(steel.members);
});
it('agrupa todos los ejes sin contar dos veces las columnas compartidas', () => {
  const building = space3dFromModel2d(createConcreteFrameProject(), { frames: 2, spacingM: 5 }).model!;
  const ids = space3dSectionGroups(building).flatMap((g) => g.memberIds);
  expect(new Set(ids).size).toBe(ids.length);
  expect(ids.sort()).toEqual(building.members.map((m) => m.id).sort());
});
for (const code of ['ntc-2023', 'nsr-10', 'e060'] as DesignCodeId[]) it(`propone por grupos en el 3D y verifica todos los ejes con ${code}`, () => {
  const original = model(code === 'ntc-2023' ? 2 : 1), groups = space3dSectionGroups(original), draft = { ...FRAME_DEFAULTS, source: 'model3d', proposalBars: 'yes' };
  const variant = (beam: {width:number;height:number}, column: {width:number;height:number}, assigned: readonly (typeof groups)[number][] = groups) => withSpace3dSections(original,
    { beam: {widthMm:beam.width*10,heightMm:beam.height*10}, column: {widthMm:column.width*10,heightMm:column.height*10} }, assigned.filter((g) => g.width > 0));
  const evaluate = (c: DesignCodeId, d: typeof draft, beam: {width:number;height:number}, column: {width:number;height:number}, assigned?: readonly (typeof groups)[number][]) => {
    const result = designSpace3dSectionCandidate(variant(beam,column,assigned), structureOptions(c,d), false);
    return result.ok ? {ok:true as const, result, frame:null} : result;
  };
  let proposal: SectionProposal | null = null;
  for (const step of proposeModelSections(code,draft,{groups,beamLengthM:groups.filter((g)=>g.kind==='beam').reduce((s,g)=>s+g.lengthM,0),columnLengthM:groups.filter((g)=>g.kind==='column').reduce((s,g)=>s+g.lengthM,0),
    variant:(b,c,g)=> { const axes=space3dDesignAxes(variant(b,c,g)); return axes.source(axes.axes[0]!.id)!; },evaluate})) {
    if (step.kind==='failed') throw new Error(step.reason); if(step.kind==='done') proposal=step.proposal;
  }
  expect(proposal).not.toBeNull();
  expect(proposal!.volumeM3).toBeLessThanOrEqual(proposal!.uniformVolumeM3!+1e-9);
  const final=evaluate(code,draft,proposal!.beam,proposal!.column,proposal!.groups as typeof groups);
  expect(final.ok).toBe(true); if(final.ok) {expect(final.result.governingRatio).toBeLessThanOrEqual(1);expect(final.result.status).not.toBe('fail');}
  for (const group of proposal!.groups!) {
    const smaller = { ...group, width: group.kind === 'column' ? group.width-5 : group.width, height: group.height-5 };
    if (smaller.width < (group.kind === 'column' ? 30 : 25) || smaller.height < (group.kind === 'column' ? 30 : Math.max(35,smaller.width))) continue;
    const reduced=evaluate(code,draft,proposal!.beam,proposal!.column,proposal!.groups!.map((g)=>g.id===group.id?smaller:g));
    expect(!reduced.ok || reduced.result.status === 'fail' || reduced.result.governingRatio>1).toBe(true);
  }
}, 60000);
