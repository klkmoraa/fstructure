import { describe, expect, it } from 'vitest';
import { createDefaultProject } from './defaultProject';
import { mergeCoincidentNodes, repairProjectTopology, splitMemberAt } from './modelOperations';

/**
 * Pruebas mínimas de las tres operaciones que reescriben la topología del
 * modelo directamente sobre `project`: fusionar nudos coincidentes, dividir un
 * miembro y la reparación automática que encadena ambas. Lo que importa
 * comprobar no es la geometría en sí, sino que ninguna referencia (`i`/`j`,
 * cargas, apoyos) queda apuntando a un nudo que dejó de existir.
 */
describe('mergeCoincidentNodes', () => {
  it('fusiona dos nudos coincidentes y remapea las cargas del que desaparece', () => {
    const project = createDefaultProject();
    // N5 coincide con N3 y no está unido a él por ningún miembro.
    project.nodes.push({ id: 'N5', x: 0, y: 4, support: { type: 'none' } });
    project.nodalLoads.push({ id: 'NLX', nodeId: 'N5', caseId: 'LC1', fx: 1, fy: 0, mz: 0 });

    const result = mergeCoincidentNodes(project, 'N3', 'N5');

    expect(project.nodes.some((node) => node.id === result.removedNodeId)).toBe(false);
    expect(project.nodalLoads.every((load) => load.nodeId !== result.removedNodeId)).toBe(true);
  });

  it('rechaza fusionar dos nudos unidos por un miembro (quedaría de longitud cero)', () => {
    const project = createDefaultProject();
    expect(() => mergeCoincidentNodes(project, 'N1', 'N3')).toThrow();
  });
});

describe('splitMemberAt', () => {
  it('divide un miembro en dos e inserta un nudo intermedio conectado', () => {
    const project = createDefaultProject();
    const nodesBefore = project.nodes.length;
    const membersBefore = project.members.length;

    const result = splitMemberAt(project, 'M2', 0.5);

    expect(project.nodes).toHaveLength(nodesBefore + 1);
    expect(project.members).toHaveLength(membersBefore + 1);
    const newNode = project.nodes.find((node) => node.id === result.nodeId);
    expect(newNode).toBeDefined();
    const touching = project.members.filter((member) => member.i === result.nodeId || member.j === result.nodeId);
    expect(touching).toHaveLength(2);
  });
});

describe('repairProjectTopology', () => {
  it('fusiona nudos duplicados y reporta el resultado', () => {
    const project = createDefaultProject();
    project.nodes.push({ id: 'N6', x: 6, y: 4, support: { type: 'none' } }); // duplica N4

    const report = repairProjectTopology(project);

    expect(report.mergedNodes).toHaveLength(1);
    expect(project.nodes.some((node) => node.id === 'N6')).toBe(false);
  });

  it('un proyecto ya consistente no reporta ningún cambio', () => {
    const project = createDefaultProject();
    const report = repairProjectTopology(project);
    expect(report).toEqual({ mergedNodes: [], splitMembers: [], skippedCoincidentPairs: [] });
  });
});
