import { describe, expect, it } from 'vitest';
import { createDefaultProject } from './defaultProject';
import { applyProjectPatch, compileProjectCommand } from '../commands/projectCommand';
import { normalizeProject } from './migrate';
import { copyModelSelection, pasteModelClipboard } from './modelOperations';
import { analyzeProject } from '../engine/solver';
import { withMemberStiffness, setStiffnessDefaults } from './memberStiffness';

const defaults = { mode: 'EI' as const, value: 16000, factor: 1 };

describe('constantes de rigidez', () => {
  it('2EI conserva EA y divide por dos la flecha de referencia PL³/3EI', () => {
    const project = createDefaultProject();
    project.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
      { id: 'B', x: 4, y: 0, support: { type: 'none' } },
    ];
    const member = { ...project.members[0], id: 'AB', i: 'A', j: 'B' };
    project.members = [withMemberStiffness(member, defaults, 2)];
    project.nodalLoads = [{ id: 'P', nodeId: 'B', caseId: 'LC1', fx: 0, fy: -10, mz: 0 }];
    project.memberLoads = [];
    project.settings.stiffnessDefaults = defaults;
    const result = analyzeProject(project);
    expect(result.success).toBe(true);
    expect(result.nodeResults.find((node) => node.nodeId === 'B')?.uy).toBeCloseTo(-10 * 4 ** 3 / (3 * 32000), 9);
    expect(project.members[0].E * project.members[0].A).toBe(member.E * member.A);
  });

  it.each(['E', 'I'] as const)('%s constante mantiene la propiedad independiente', (mode) => {
    const member = createDefaultProject().members[0];
    const value = mode === 'E' ? 30e6 : 0.002;
    const updated = withMemberStiffness(member, { mode, value, factor: 1 }, 2);
    expect(updated[mode]).toBe(value * 2);
    expect(updated[mode === 'E' ? 'I' : 'E']).toBe(member[mode === 'E' ? 'I' : 'E']);
    expect(member.stiffnessFactor).toBeUndefined();
  });

  it('actualizar la base conserva factores y propiedades propias; aplicar a todas es explícito', () => {
    const project = createDefaultProject();
    project.members[0] = withMemberStiffness(project.members[0], defaults, 2);
    project.settings.stiffnessDefaults = defaults;
    const next = setStiffnessDefaults(project, { ...defaults, value: 20000, factor: 3 });
    expect(next.members[0].E * next.members[0].I).toBeCloseTo(40000);
    expect(next.members[1]).toEqual(project.members[1]);
    expect(project.members[0].E * project.members[0].I).toBeCloseTo(32000);
    const all = setStiffnessDefaults(next, { ...defaults, factor: 2 }, true);
    expect(all.members.every((member) => member.stiffnessFactor === 2)).toBe(true);
  });

  it('creación hereda 2EI y el historial restaura la base y sus miembros', () => {
    const project = createDefaultProject();
    const command = compileProjectCommand(project, {
      kind: 'stiffness.defaults.update', description: 'Base 2EI', defaults: { ...defaults, factor: 2 }, applyToAll: true,
    });
    const next = applyProjectPatch(project, command.forward);
    expect(next.settings.stiffnessDefaults?.factor).toBe(2);
    expect(applyProjectPatch(next, command.inverse)).toEqual(project);
    const create = compileProjectCommand(next, {
      kind: 'member.createAtPoint', description: 'Nueva barra', startNodeId: 'N4', point: { x: 9, y: 4 },
      template: { type: 'frame', E: 200e6, A: 0.005, I: 8.333e-6 },
    });
    const added = applyProjectPatch(next, create.forward).members.at(-1)!;
    expect(added.stiffnessFactor).toBe(2);
    expect(added.E * added.I).toBeCloseTo(32000);
  });

  it('guarda y reabre la base sin valor y el multiplicador sin modificar proyectos antiguos', () => {
    const old = createDefaultProject();
    const previous = normalizeProject({ ...old, schemaVersion: 8 });
    expect(previous.members[0].E).toBe(old.members[0].E);
    expect(previous.settings.stiffnessDefaults).toBeUndefined();
    const project = setStiffnessDefaults(old, { mode: 'EI', factor: 2 }, true);
    const reopened = normalizeProject(JSON.parse(JSON.stringify(project)));
    expect(reopened.settings.stiffnessDefaults).toEqual({ mode: 'EI', factor: 2 });
    expect(reopened.members[0].stiffnessFactor).toBe(2);
    expect(reopened.members[0].E * reopened.members[0].I).toBe(project.members[0].E * project.members[0].I);
  });

  it('E constante admite armaduras con I = 0 y nunca asigna EI a una barra rígida', () => {
    const member = { ...createDefaultProject().members[0], type: 'truss' as const, I: 0 };
    const updated = withMemberStiffness(member, { mode: 'E', value: 30e6, factor: 2 });
    expect(updated.E).toBe(60e6);
    expect(updated.I).toBe(0);
    expect(withMemberStiffness({ ...member, type: 'rigid' }, defaults, 2).stiffnessFactor).toBeUndefined();
  });

  it('rechaza un archivo con factor sin base o con valores E/I incoherentes', () => {
    const project = createDefaultProject();
    project.members[0].stiffnessFactor = 2;
    expect(() => normalizeProject(project)).toThrow(/stiffnessFactor/);
    project.settings.stiffnessDefaults = defaults;
    expect(() => normalizeProject(project)).toThrow(/no coinciden/);
  });

  it('la edición de propiedades y el deshacer conservan la procedencia de la constante', () => {
    const project = setStiffnessDefaults(createDefaultProject(), defaults, true);
    const command = compileProjectCommand(project, { kind: 'member.update', description: 'I propia', memberId: 'M1', changes: { I: 0.001 } });
    const own = applyProjectPatch(project, command.forward);
    expect(own.members[0].stiffnessFactor).toBeUndefined();
    expect(own.members[0].I).toBe(0.001);
    expect(applyProjectPatch(own, command.inverse)).toEqual(project);
    const split = compileProjectCommand(project, { kind: 'member.split', description: 'Dividir', memberId: 'M2', ratio: 0.5 });
    expect(applyProjectPatch(project, split.forward).members.every((member) => member.stiffnessFactor === 1)).toBe(true);
  });

  it('pegar una barra conserva el factor al cambiar la base y se desvincula en un proyecto sin base', () => {
    const source = setStiffnessDefaults(createDefaultProject(), { ...defaults, factor: 2 }, true);
    const clipboard = copyModelSelection(source, { kind: 'member', id: 'M2' })!;
    const next = setStiffnessDefaults(source, { ...defaults, value: 20000 });
    pasteModelClipboard(next, clipboard, { x: 10, y: 0 });
    const member = next.members.at(-1)!;
    expect(member.stiffnessFactor).toBe(2);
    expect(member.E * member.I).toBeCloseTo(40000);
    const own = createDefaultProject();
    pasteModelClipboard(own, clipboard, { x: 10, y: 0 });
    expect(own.members.at(-1)!.stiffnessFactor).toBeUndefined();
    expect(own.members.at(-1)!.E * own.members.at(-1)!.I).toBeCloseTo(32000);
  });

  it.each([0, -1, Infinity])('rechaza factores inválidos (%s)', (factor) => {
    const project = createDefaultProject();
    expect(() => withMemberStiffness(project.members[0], defaults, factor)).toThrow();
    expect(() => normalizeProject({ ...project, settings: { ...project.settings, stiffnessDefaults: { ...defaults, factor } } })).toThrow(/stiffnessDefaults/);
  });
});
