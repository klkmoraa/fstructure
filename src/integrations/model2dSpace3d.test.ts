import { describe, expect, it } from 'vitest';
import { createConcreteFrameProject } from '../data/defaultProject';
import { analyzeProject } from '../engine/solver';
import { parseSpace3DProject, serializeSpace3DProject } from '../modules/space3d/space3d/data/codec';
import { analyzeSpace3DProject } from '../modules/space3d/space3d/engine/solver';
import { MAX_EXTRUDED_FRAMES, space3dFromModel2d } from './model2dSpace3d';

const portal = () => createConcreteFrameProject();

describe('Traer del 2D: el pórtico del Modelo 2D extruido al Modelo 3D', () => {
  it('repite el pórtico, lo une con vigas transversales y pasa el validador del 3D', () => {
    const project = portal();
    const { model, errors, notes } = space3dFromModel2d(project, { frames: 3, spacingM: 5 });
    expect(errors).toEqual([]);
    if (!model) throw new Error('sin modelo');
    // Serializar y volver a leer con el códec del 3D: el documento es válido.
    const parsed = parseSpace3DProject(serializeSpace3DProject(model));
    const free = project.nodes.filter((node) => node.support.type === 'none').length;
    expect(parsed.nodes).toHaveLength(project.nodes.length * 3);
    expect(parsed.members).toHaveLength(project.members.length * 3 + free * 2);
    expect(new Set(parsed.nodes.map((node) => node.z))).toEqual(new Set([0, 5, 10]));
    expect(parsed.grid?.zLines.map((line) => line.coordinate)).toEqual([0, 5, 10]);
    expect(parsed.memberLoads).toHaveLength(project.memberLoads.length * 3);
    expect(notes.some((note) => note.includes('vigas transversales'))).toBe(true);
    // Las columnas usan la referencia X y las vigas la Y: el eje local y queda en el plano del pórtico.
    const column = parsed.members.find((member) => member.id === `${project.members.find((item) => item.label?.startsWith('C'))?.id ?? 'C11'}-1`);
    expect(column?.orientation.localYReferenceGlobal).toEqual([1, 0, 0]);
  });

  it('con diafragmas, cada nivel une sus nudos libres de todos los pórticos y el edificio se resuelve', () => {
    const project = portal();
    const { model, notes } = space3dFromModel2d(project, { frames: 3, spacingM: 5, diaphragms: true });
    const parsed = parseSpace3DProject(serializeSpace3DProject(model!));
    const free = project.nodes.filter((node) => node.support.type === 'none');
    const levels = [...new Set(free.map((node) => node.y))].sort((a, b) => a - b);
    expect(parsed.diaphragms).toHaveLength(levels.length);
    // Primer nivel: sus nudos libres, en cada uno de los tres pórticos.
    expect(parsed.diaphragms![0]!.nodeIds).toHaveLength(free.filter((node) => node.y === levels[0]).length * 3);
    expect(notes.some((note) => note.includes('diafragma rígido'))).toBe(true);
    const permanent = parsed.loadCases.find((item) => item.category === 'permanent')!;
    expect(analyzeSpace3DProject(parsed, permanent.id).success).toBe(true);
    // Un pórtico solo no lleva diafragma (ya es plano).
    expect(space3dFromModel2d(project, { frames: 1, spacingM: 0, diaphragms: true }).model!.diaphragms).toBeUndefined();
  });

  it('el edificio extruido se resuelve en el 3D', () => {
    const { model } = space3dFromModel2d(portal(), { frames: 3, spacingM: 5 });
    const permanent = model!.loadCases.find((item) => item.category === 'permanent')!;
    const run = analyzeSpace3DProject(model!, permanent.id);
    expect(run.success).toBe(true);
  });

  it('un pórtico solo con apoyos articulados queda plano y da las mismas reacciones que el 2D', () => {
    const base = portal();
    const project = { ...base, nodes: base.nodes.map((node) => node.support.type === 'fixed' ? { ...node, support: { type: 'pin' as const } } : node) };
    const { model, notes } = space3dFromModel2d(project, { frames: 1, spacingM: 0 });
    expect(notes.some((note) => note.includes('plano'))).toBe(true);
    const caseId = project.loadCases.find((item) => item.category === 'permanent')!.id;
    const run3d = analyzeSpace3DProject(model!, caseId);
    const run2d = analyzeProject(project, { id: 'c', name: 'c', factors: { [caseId]: 1 } }, { includeEducationTrace: false });
    expect(run3d.success).toBe(true);
    expect(run2d.success).toBe(true);
    for (const node of project.nodes.filter((item) => item.support.type !== 'none')) {
      const reaction2d = run2d.nodeResults.find((item) => item.nodeId === node.id)!;
      const reaction3d = run3d.nodeResults.find((item) => item.nodeId === node.id)!.reaction;
      expect(reaction3d.uy).toBeCloseTo(reaction2d.ry, 6);
      expect(reaction3d.ux).toBeCloseTo(reaction2d.rx, 6);
    }
  });

  it('dice por qué no puede traerlo', () => {
    expect(space3dFromModel2d({ ...portal(), members: [] }, { frames: 1, spacingM: 0 }).errors[0]).toMatch(/vacío/);
    expect(space3dFromModel2d(portal(), { frames: MAX_EXTRUDED_FRAMES + 1, spacingM: 5 }).model).toBeNull();
    expect(space3dFromModel2d(portal(), { frames: 2, spacingM: 0 }).errors[0]).toMatch(/separación/);
  });
});
