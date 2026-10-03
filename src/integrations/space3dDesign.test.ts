import { describe, expect, it } from 'vitest';
import { createConcreteFrameProject } from '../data/defaultProject';
import { designCode } from '../design/elements/codes';
import { model2dDesignSource } from '../design/elements/model2dSource';
import { designStructure, type StructureDesignOptions, type StructureSource } from '../design/elements/structure';
import { parseSpace3DProject } from '../modules/space3d/space3d/data/codec';
import { generateSpace3DBuilding } from '../modules/space3d/space3d/engine/buildingTemplate';
import type { Space3DProjectV1, Space3DRestraints } from '../modules/space3d/space3d/model/types';
import { space3dFromModel2d } from './model2dSpace3d';
import { space3dDesignSource, space3dFramePlanes } from './space3dDesign';

const code = 'nsr-10' as const;
const options: StructureDesignOptions = {
  code, coverMm: 40, fcMpa: 25, fyMpa: 420, fyStirrupMpa: 420, maxAggregateMm: 19, includeSelfWeight: true,
  combinations: designCode(code).loadCombinations('B'),
  lateralCombinations: designCode(code).lateralCombinations('B').combinations,
  lateralReference: designCode(code).lateralCombinations('B').reference!,
  sustainedLiveRatio: 0.4, longTermXi: 2, damagesNonstructural: false, beamBarDiameterMm: null, stirrupDiameterMm: null,
  columnReinforcement: { barDiameterMm: 19.1, barsAlongWidth: 3, barsAlongDepth: 3, tieDiameterMm: 9.5 }, group: 'B2', effectiveLengthFactor: null,
};

const portal = () => createConcreteFrameProject();
const extruded = (frames = 1, spacingM = 0) => {
  const outcome = space3dFromModel2d(portal(), { frames, spacingM });
  if (!outcome.model) throw new Error(outcome.errors.join('\n'));
  return outcome.model;
};

/**
 * El mismo pórtico en el plano x = 0: x ↔ z. Es una reflexión, así que los
 * giros en el plano cambian de signo (rz → −rx). Las columnas conservan la
 * referencia X, ahora normal al plano: su flexión en el plano pasa al eje
 * local z (Iy), el camino de `My` del puente.
 */
const mirrored = (model: Space3DProjectV1): Space3DProjectV1 => {
  const swap = (r: Space3DRestraints): Space3DRestraints => ({ ux: r.uz, uy: r.uy, uz: r.ux, rx: r.rz, ry: r.ry, rz: r.rx });
  const vertical = new Set(model.members.filter((member) => member.orientation.localYReferenceGlobal[0] === 1).map((member) => member.id));
  return {
    ...model,
    grid: undefined,
    nodes: model.nodes.map((node) => ({ ...node, x: node.z, z: node.x, restraints: swap(node.restraints) })),
    members: model.members.map((member) => vertical.has(member.id) ? { ...member, Iy: member.Iz, Iz: member.Iy } : member),
    nodalLoads: model.nodalLoads.map((load) => ({ ...load, fx: load.fz, fz: load.fx, mx: -load.mz, mz: -load.mx })),
    memberLoads: model.memberLoads.map((load) => ({
      ...load,
      ...(load.qxStart !== undefined || load.qzStart !== undefined ? { qxStart: load.qzStart ?? 0, qzStart: load.qxStart ?? 0, qxEnd: load.qzEnd ?? 0, qzEnd: load.qxEnd ?? 0 } : {}),
      ...(load.px !== undefined || load.pz !== undefined ? { px: load.pz ?? 0, pz: load.px ?? 0 } : {}),
      ...(load.type === 'moment' ? { mx: -(load.mz ?? 0), mz: -(load.mx ?? 0) } : {}),
    })),
  };
};

const compareSources = (reference: StructureSource, candidate: StructureSource) => {
  expect(candidate.nodes).toEqual(reference.nodes.map((node) => expect.objectContaining({ x: expect.closeTo(node.x, 9), y: expect.closeTo(node.y, 9), support: node.support })));
  expect(candidate.members.map((member) => [member.id, member.kind, member.i, member.j])).toEqual(reference.members.map((member) => [member.id, member.kind, member.i, member.j]));
  candidate.members.forEach((member, index) => {
    expect(member.section.widthMm).toBeCloseTo(reference.members[index]!.section.widthMm, 6);
    expect(member.section.heightMm).toBeCloseTo(reference.members[index]!.section.heightMm, 6);
  });
  expect(candidate.cases.map((item) => item.kind)).toEqual(reference.cases.map((item) => item.kind));
  const a = reference.analyze();
  const b = candidate.analyze();
  if (!a.ok || !b.ok) throw new Error(`${a.ok ? '' : a.error} ${b.ok ? '' : b.error}`);
  a.cases.forEach((expected, caseIndex) => {
    const actual = b.cases[caseIndex]!;
    expected.nodeDisplacements.forEach((value, node) => value.forEach((component, dof) => {
      expect(actual.nodeDisplacements[node]![dof]).toBeCloseTo(component, 8);
    }));
    reference.members.forEach((member, memberIndex) => {
      const length = Math.hypot(reference.nodes[member.j]!.x - reference.nodes[member.i]!.x, reference.nodes[member.j]!.y - reference.nodes[member.i]!.y);
      for (const x of [0, 0.13, 0.5, 0.71, 1].map((t) => t * length)) {
        const p = expected.at(memberIndex, x);
        const q = actual.at(memberIndex, x);
        expect(q.axial).toBeCloseTo(p.axial, 5);
        expect(q.shear).toBeCloseTo(p.shear, 5);
        expect(q.moment).toBeCloseTo(p.moment, 5);
        // El motor 3D da el acortamiento lineal entre extremos: con peso propio en
        // las columnas difiere del 2D menos de 0,001 mm.
        expect(q.u).toBeCloseTo(p.u, 5);
        expect(q.v).toBeCloseTo(p.v, 7);
      }
    });
  });
};

describe('un eje del Modelo 3D como fuente de Estructura', () => {
  it('encuentra los ejes con vigas y los nombra con la rejilla', () => {
    const model = extruded(3, 5);
    const planes = space3dFramePlanes(model);
    expect(planes.map((plane) => plane.id)).toEqual(['z:0', 'z:5', 'z:10', 'x:0', 'x:6', 'x:11']);
    expect(planes[0]!.label).toBe('Eje 1 · z = 0 m');
    expect(planes[3]!.label).toBe('Eje A · x = 0 m');
    // Seis columnas y cuatro vigas por pórtico; en el eje A, dos columnas por pórtico y las transversales.
    expect(planes[0]!.members).toBe(10);
    expect(planes[3]!.members).toBe(2 * 3 + 2 * 2);
  });

  it('resuelve un pórtico extruido igual que el Modelo 2D (plano z = 0)', () => {
    const reference = model2dDesignSource(portal());
    const external = space3dDesignSource(extruded(), 'z:0');
    expect(external.errors).toEqual([]);
    expect(external.summary).toMatchObject({ beams: reference.summary.beams, columns: reference.summary.columns, deadCases: 1, lateralCases: 1, liveCases: reference.summary.liveCases });
    expect(external.includesSelfWeight).toBe(reference.includesSelfWeight);
    compareSources(reference.create({ braced: false })!, external.create({ braced: false })!);
  });

  it('lee la flexión en el plano por el eje local z (My) en un eje x = cte', () => {
    const reference = model2dDesignSource(portal());
    const model = mirrored(extruded());
    const external = space3dDesignSource(model, space3dFramePlanes(model).find((plane) => plane.axis === 'x')!.id);
    expect(external.errors).toEqual([]);
    compareSources(reference.create({ braced: false })!, external.create({ braced: false })!);
  });

  it('diseña el pórtico del eje igual que el Modelo 2D', () => {
    const from2d = designStructure(model2dDesignSource(portal()).create({ braced: false })!, options);
    const from3d = designStructure(space3dDesignSource(extruded(), 'z:0').create({ braced: false })!, options);
    if (!from2d.ok || !from3d.ok) throw new Error('el diseño falló');
    expect(from3d.source.kind).toBe('model3d');
    expect(from3d.beams.map((beam) => beam.label)).toEqual(from2d.beams.map((beam) => beam.label));
    from3d.beams.forEach((beam, index) => expect(beam.result.governingRatio).toBeCloseTo(from2d.beams[index]!.result.governingRatio, 4));
    from3d.columns.forEach((column, index) => expect(column.result.governingRatio).toBeCloseTo(from2d.columns[index]!.result.governingRatio, 4));
    from3d.stories.forEach((story, index) => expect(story.stabilityIndex).toBeCloseTo(from2d.stories[index]!.stabilityIndex, 6));
    expect(from3d.governingRatio).toBeCloseTo(from2d.governingRatio, 4);
  });

  it('en un edificio, las vigas transversales llevan carga a las columnas del eje', () => {
    const base = extruded(3, 5);
    // 10 kN/m de muerta en cada transversal del primer nivel.
    const transverse = base.members.filter((member) => member.id.startsWith('T'));
    const model = parseSpace3DProject(JSON.stringify({
      ...base,
      memberLoads: [...base.memberLoads, ...transverse.map((member) => ({
        id: `X-${member.id}`, memberId: member.id, caseId: base.loadCases.find((item) => item.category === 'permanent')!.id,
        type: 'distributed', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, qxStart: 0, qxEnd: 0, qyStart: -10, qyEnd: -10, qzStart: 0, qzEnd: 0,
      }))],
    }));
    const plain = space3dDesignSource(base, 'z:5').create({ braced: false })!.analyze();
    const loaded = space3dDesignSource(model, 'z:5').create({ braced: false })!.analyze();
    if (!plain.ok || !loaded.ok) throw new Error('el análisis falló');
    const source = space3dDesignSource(model, 'z:5').create({ braced: false })!;
    const column = source.members.findIndex((member) => member.kind === 'column');
    // Más compresión en la columna baja del eje central (axial negativo).
    expect(loaded.cases[0]!.at(column, 0).axial).toBeLessThan(plain.cases[0]!.at(column, 0).axial - 10);
    expect(source.cases.at(-1)!.kind).toBe('probe');
  });

  it('las columnas del eje reciben la flexión perpendicular del 3D y se revisan en flexión biaxial', () => {
    const base = extruded(3, 5);
    // Un sismo en z (perpendicular a los ejes 1, 2, 3): 20 kN por nudo libre.
    const free = base.nodes.filter((node) => !node.restraints.uy);
    const model = parseSpace3DProject(JSON.stringify({
      ...base,
      loadCases: [...base.loadCases, { id: 'SZ', name: 'Sismo Z', category: 'accidental', active: true }],
      nodalLoads: [...base.nodalLoads, ...free.map((node) => ({ id: `SZ-${node.id}`, caseId: 'SZ', nodeId: node.id, fx: 0, fy: 0, fz: 20, mx: 0, my: 0, mz: 0 }))],
    }));
    const plain = designStructure(space3dDesignSource(base, 'z:0').create({ braced: false })!, options);
    const withZ = designStructure(space3dDesignSource(model, 'z:0').create({ braced: false })!, options);
    if (!plain.ok || !withZ.ok) throw new Error('el diseño falló');
    const column = withZ.columns.find((item) => item.story === 0)!;
    const before = plain.columns.find((item) => item.id === column.id)!;
    const governing = column.states[column.governingState]!;
    // Sin acción perpendicular, M⊥ sólo viene del peso de las vigas transversales
    // que llegan al eje de borde; con el sismo Z, la columna baja la toma.
    const outBefore = Math.max(...before.states.map((state) => Math.abs(state.outOfPlaneKnm ?? 0)));
    const outAfter = Math.max(...column.states.map((state) => Math.abs(state.outOfPlaneKnm ?? 0)));
    expect(outBefore).toBeLessThan(10);
    expect(outAfter).toBeGreaterThan(Math.max(10, 3 * outBefore));
    expect(column.states.some((state) => state.label.startsWith('M⊥'))).toBe(true);
    expect(governing.outOfPlaneDesignKnm).toBeGreaterThan(0);
    expect(column.result.governingRatio).toBeGreaterThan(before.result.governingRatio);
  });

  it('diseña un edificio generado en el 3D (con diafragmas, masas y espectros) en todos sus ejes', () => {
    const model = generateSpace3DBuilding({
      xSpacings: [6, 5], zSpacings: [5], storyHeights: [3.5, 3], columnSection: 'Concreto 40x40 cm', beamSection: 'Concreto 30x50 cm',
      superDeadLoad: 4, liveLoad: 2, lateralCoefficient: 0.1,
    });
    expect(model.massSource).toBeDefined();
    expect(model.responseSpectrumCases?.length).toBeGreaterThan(0);
    const planes = space3dFramePlanes(model);
    expect(planes.map((plane) => plane.short)).toEqual(['1', '2', 'A', 'B', 'C']);
    for (const plane of planes) {
      const external = space3dDesignSource(model, plane.id);
      expect(external.errors).toEqual([]);
      const result = designStructure(external.create({ braced: false })!, options);
      if (!result.ok) throw new Error(`${plane.label}: ${result.errors.join(' | ')}`);
      expect(result.columns.length).toBeGreaterThan(0);
    }
    // Las columnas del eje 1 se rotulan con la rejilla (A, B, C), no con su orden.
    const axis1 = designStructure(space3dDesignSource(model, 'z:0').create({ braced: false })!, options);
    if (!axis1.ok) throw new Error('eje 1');
    expect(new Set(axis1.columns.map((column) => column.axisLabel))).toEqual(new Set(['A', 'B', 'C']));
  });

  it('dice por qué no puede diseñar', () => {
    expect(space3dDesignSource(extruded(), 'z:7').errors[0]).toMatch(/ya no está/);
    const steel = extruded();
    const external = space3dDesignSource({ ...steel, members: steel.members.map((member) => ({ ...member, E: 2e8 })) }, 'z:0');
    expect(external.errors[0]).toMatch(/no tiene barras de concreto/);
  });
});
