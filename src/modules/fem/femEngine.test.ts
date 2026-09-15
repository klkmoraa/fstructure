import { describe, expect, it } from 'vitest';

import {
  analyzeFemDocument,
  createTri3PatchFixture,
  exportFemVtk,
  parseGmsh41,
  serializeFemBundle,
  validateFemDocument,
} from './femEngine';

describe('FEM document and TRI3 engine', () => {
  it('solves a constrained TRI3 patch and publishes fields plus equilibrium', () => {
    const document = createTri3PatchFixture();
    const result = analyzeFemDocument(document);

    expect(result.success).toBe(true);
    expect(result.displacements).toHaveLength(document.nodes.length);
    expect(result.stresses).toHaveLength(document.elements.length);
    expect(result.stresses[0].vonMises).toBeGreaterThan(0);
    expect(result.equilibrium.normalized).toBeLessThanOrEqual(1e-8);
    expect(result.meshQuality.minArea).toBeGreaterThan(0);
  });

  it('imports Gmsh 4.1 nodes and triangle connectivity without a remote service', () => {
    const document = parseGmsh41(`$MeshFormat\n4.1 0 8\n$EndMeshFormat\n$Nodes\n1 3 1 3\n2 1 0 3\n1\n2\n3\n1 2 3 1 2 3 1 2 3\n$EndNodes\n$Elements\n1 1 1 1\n2 1 2 1\n1 1 2 3\n$EndElements\n`);

    expect(document.nodes).toEqual([
      { id: '1', x: 1, y: 2, z: 3 },
      { id: '2', x: 1, y: 2, z: 3 },
      { id: '3', x: 1, y: 2, z: 3 },
    ]);
    expect(document.elements[0]).toMatchObject({ type: 'TRI3', nodeIds: ['1', '2', '3'] });
  });

  it('consumes supported Gmsh boundary records without promoting them to FEM elements', () => {
    const document = parseGmsh41(`$MeshFormat\n4.1 0 8\n$EndMeshFormat\n$Nodes\n1 3 1 3\n2 1 0 3\n1\n2\n3\n0 0 0 1 0 0 0 1 0\n$EndNodes\n$Elements\n2 2 1 2\n1 1 1 1\n101 1 2\n2 1 2 1\n201 1 2 3\n$EndElements\n`);

    expect(document.elements).toHaveLength(1);
    expect(document.elements[0]).toMatchObject({ id: '201', type: 'TRI3', nodeIds: ['1', '2', '3'] });
  });

  it('rejects binary Gmsh payloads instead of interpreting them as ASCII', () => {
    expect(() => parseGmsh41(`$MeshFormat\n4.1 1 8\n$EndMeshFormat\n$Nodes\n0 0 0 0\n$EndNodes\n$Elements\n0 0 0 0\n$EndElements\n`)).toThrow(/ASCII/);
  });

  it('rejects unsupported element physics instead of returning illustrative results', () => {
    const document = createTri3PatchFixture();
    const unsupported = { ...document, elements: [{ id: 'T1', type: 'TET4' as const, nodeIds: ['1', '2', '3', '4'] }] };

    expect(validateFemDocument(unsupported)).toContainEqual(expect.objectContaining({ code: 'unsupported-element' }));
    expect(analyzeFemDocument(unsupported).success).toBe(false);
  });

  it('solves a QUAD4 plane-strain patch with the same local contract', () => {
    const document = {
      ...createTri3PatchFixture(),
      id: 'fem-quad4-patch',
      analysis: 'plane-strain' as const,
      nodes: [{ id: '1', x: 0, y: 0 }, { id: '2', x: 1, y: 0 }, { id: '3', x: 1, y: 1 }, { id: '4', x: 0, y: 1 }],
      elements: [{ id: 'Q1', type: 'QUAD4' as const, nodeIds: ['1', '2', '3', '4'] }],
      loads: [{ id: 'L1', nodeId: '2', fx: 10, fy: 0 }],
      restraints: [{ nodeId: '1', ux: true, uy: true }, { nodeId: '4', ux: true }],
    };
    const result = analyzeFemDocument(document);

    expect(result.success).toBe(true);
    expect(result.stresses[0].type).toBe('QUAD4');
    expect(result.equilibrium.normalized).toBeLessThanOrEqual(1e-8);
  });

  it('rejects crossed QUAD4 geometry and publishes its element id', () => {
    const document = {
      ...createTri3PatchFixture(),
      id: 'fem-quad4-crossed',
      nodes: [{ id: '1', x: 0, y: 0 }, { id: '2', x: 1, y: 1 }, { id: '3', x: 0, y: 1 }, { id: '4', x: 1, y: 0 }],
      elements: [{ id: 'Q-crossed', type: 'QUAD4' as const, nodeIds: ['1', '2', '3', '4'] }],
    };
    const result = analyzeFemDocument(document);

    expect(result.success).toBe(false);
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'degenerate-element', id: 'Q-crossed' }));
    expect(result.meshQuality.degenerateElementIds).toEqual(['Q-crossed']);
  });

  it('rejects non-positive thickness before assembling stiffness', () => {
    const document = createTri3PatchFixture();
    const result = analyzeFemDocument({ ...document, material: { ...document.material, thickness: -1 } });

    expect(result.success).toBe(false);
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'invalid-value', field: 'material.thickness' }));
    expect(result.relativeResidual).toBeNull();
  });

  it('admits a fully restrained model and returns reactions at zero displacement', () => {
    const document = createTri3PatchFixture();
    const result = analyzeFemDocument({
      ...document,
      restraints: document.nodes.flatMap((node) => [{ nodeId: node.id, ux: true, uy: true }]),
    });

    expect(result.success).toBe(true);
    expect(result.displacements.every((item) => item.ux === 0 && item.uy === 0)).toBe(true);
    expect(result.reactions.find((item) => item.nodeId === '2')?.ux).toBeCloseTo(-10);
  });

  it('rejects before matrix allocation when the caller budget is exhausted', () => {
    const result = analyzeFemDocument(createTri3PatchFixture(), { budget: { maxEstimatedBytes: 1, softDeadlineMs: 30_000 } });

    expect(result.success).toBe(false);
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'memory-budget' }));
  });

  it('downgrades non-finite numerical output instead of publishing a false success', () => {
    const document = createTri3PatchFixture();
    const result = analyzeFemDocument({ ...document, material: { ...document.material, E: 1e-320 } });

    expect(result.success).toBe(false);
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'invalid-value', field: 'stiffness' }));
  });

  it('keeps the relative Jacobian tolerance scale-aware for tiny valid QUAD4 meshes', () => {
    const document = {
      ...createTri3PatchFixture(),
      id: 'fem-quad4-tiny',
      nodes: [{ id: '1', x: 0, y: 0 }, { id: '2', x: 1e-7, y: 0 }, { id: '3', x: 1e-7, y: 1e-7 }, { id: '4', x: 0, y: 1e-7 }],
      elements: [{ id: 'Q-tiny', type: 'QUAD4' as const, nodeIds: ['1', '2', '3', '4'] }],
      loads: [{ id: 'L1', nodeId: '2', fx: 1e-7, fy: 0 }],
      restraints: [{ nodeId: '1', ux: true, uy: true }, { nodeId: '4', ux: true }],
    };
    const result = analyzeFemDocument(document);

    expect(result.success).toBe(true);
  });

  it('exports an open JSON bundle and VTK fields from a completed study', () => {
    const document = createTri3PatchFixture();
    const result = analyzeFemDocument(document);
    const bundle = serializeFemBundle(document, result);
    const vtk = exportFemVtk(document, result);

    expect(JSON.parse(bundle)).toMatchObject({ format: 'fstructure-fem-bundle', formatVersion: 1, document: { id: document.id } });
    expect(vtk).toContain('DATASET UNSTRUCTURED_GRID');
    expect(vtk).toContain('VECTORS displacement float');
    expect(vtk).toContain('SCALARS vonMises float 1');
  });

  it('serializes failed diagnostics with JSON-safe null metrics', () => {
    const document = createTri3PatchFixture();
    const failed = analyzeFemDocument({ ...document, material: { ...document.material, thickness: 0 } });
    const parsed = JSON.parse(serializeFemBundle(document, failed)) as { analysis?: { relativeResidual?: unknown; equilibrium?: { normalized?: unknown } } };

    expect(parsed.analysis?.relativeResidual).toBeNull();
    expect(parsed.analysis?.equilibrium?.normalized).toBeNull();
  });

  it('rejects VTK export when an element references a missing node', () => {
    const document = createTri3PatchFixture();
    expect(() => exportFemVtk({ ...document, elements: [{ ...document.elements[0], nodeIds: ['1', '2', 'missing'] }] })).toThrow(/conectividad incompleta/);
  });
});
