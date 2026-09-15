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
});
