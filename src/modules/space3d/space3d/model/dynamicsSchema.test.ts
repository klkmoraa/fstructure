import { describe, expect, it } from 'vitest';
import { axialCantilever } from '../engine/fixtures';
import { parseSpace3DProject, serializeSpace3DProject, Space3DCodecError } from '../data/codec';
import { applySpace3DCommand, Space3DCommandError } from '../data/commands';
import { SPACE3D_SCHEMA_VERSION, type Space3DProjectV1 } from './types';

const withDynamics = (): Space3DProjectV1 => {
  const base = axialCantilever();
  return {
    ...base,
    nodes: [...base.nodes, { id: 'K', x: 2, y: 0, z: 2, restraints: base.nodes[1].restraints }],
    diaphragms: [{ id: 'D1', name: 'Techo', nodeIds: ['J', 'K'] }],
    massSource: { selfMass: true, loads: [{ caseId: 'LC1', factor: 0.25 }] },
    spectrumFunctions: [{ id: 'SP', name: 'Diseño', points: [[0, 0.4], [0.5, 1], [2, 0.25]] }],
    responseSpectrumCases: [{ id: 'EX', name: 'Sismo X', functionId: 'SP', direction: 'x', scale: 0.25, dampingRatio: 0.05, modes: 6, combination: 'cqc' }],
  };
};

describe('Space3D schema v4: diaphragms, mass source and spectra', () => {
  it('saves and reopens every dynamic entity unchanged', () => {
    const project = withDynamics();
    const reopened = parseSpace3DProject(serializeSpace3DProject(project), { requireAdmissibleModel: false });
    expect(reopened.schemaVersion).toBe(SPACE3D_SCHEMA_VERSION);
    expect(reopened.diaphragms).toEqual(project.diaphragms);
    expect(reopened.massSource).toEqual(project.massSource);
    expect(reopened.spectrumFunctions).toEqual(project.spectrumFunctions);
    expect(reopened.responseSpectrumCases).toEqual(project.responseSpectrumCases);
  });

  it('opens a v3 file as v4 without inventing diaphragms or spectra', () => {
    const v3 = { ...JSON.parse(serializeSpace3DProject(axialCantilever())), schemaVersion: 3 };
    const migrated = parseSpace3DProject(JSON.stringify(v3));
    expect(migrated.schemaVersion).toBe(SPACE3D_SCHEMA_VERSION);
    expect(migrated.diaphragms).toBeUndefined();
    expect(migrated.responseSpectrumCases).toBeUndefined();
  });

  it('rejects v4 fields inside an older file and broken spectra', () => {
    const v3WithDiaphragm = { ...JSON.parse(serializeSpace3DProject(withDynamics())), schemaVersion: 3 };
    expect(() => parseSpace3DProject(JSON.stringify(v3WithDiaphragm), { requireAdmissibleModel: false })).toThrow(Space3DCodecError);
    const decreasing = { ...withDynamics(), spectrumFunctions: [{ id: 'SP', name: 'Mal', points: [[1, 0.5], [0.5, 0.4]] }] };
    expect(() => parseSpace3DProject(JSON.stringify(decreasing), { requireAdmissibleModel: false })).toThrow(/crecer/);
    const shared = { ...withDynamics(), diaphragms: [{ id: 'D1', name: 'A', nodeIds: ['J', 'K'] }, { id: 'D2', name: 'B', nodeIds: ['K', 'I'] }] };
    expect(() => parseSpace3DProject(JSON.stringify(shared), { requireAdmissibleModel: false })).toThrow(/ya pertenece/);
  });

  it('keeps references consistent through commands', () => {
    const project = withDynamics();
    expect(() => applySpace3DCommand(project, { kind: 'delete-spectrum-function', functionId: 'SP' })).toThrow(Space3DCommandError);
    expect(() => applySpace3DCommand(project, { kind: 'delete-load-case', caseId: 'LC1' })).toThrow(/masa/);
    const withoutNode = applySpace3DCommand({ ...project, nodalLoads: project.nodalLoads.filter((load) => load.nodeId !== 'K') }, { kind: 'delete-node', nodeId: 'K' });
    // Un diafragma que se queda con un nudo ya no restringe nada: se retira.
    expect(withoutNode.diaphragms).toEqual([]);
  });
});
