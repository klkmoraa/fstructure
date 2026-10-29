import { describe, expect, it } from 'vitest';
import { generateStructure } from './structureGenerators';

const properties = { kind: 'explicit' as const, E: 200_000_000, A: 0.02, I: 0.0001 };

describe('segmented structural generators', () => {
  it('builds a supported circular arch as connected frame members', () => {
    const result = generateStructure({ kind: 'circular-arch', span: 10, rise: 3, segments: 12, properties, baseSupport: { type: 'pin' } });
    expect(result.nodes).toHaveLength(13);
    expect(result.members).toHaveLength(12);
    expect(result.supportedNodeIds).toHaveLength(2);
    expect(result.members[0].type).toBe('frame');
    expect(result.members[0].j).toBe(result.members[1].i);
  });
  it('closes a ring without duplicating nodes or inventing supports', () => {
    const result = generateStructure({ kind: 'circular-ring', radius: 5, segments: 16, properties });
    expect(result.nodes).toHaveLength(16);
    expect(result.members).toHaveLength(16);
    expect(result.members.at(-1)?.j).toBe(result.nodes[0].id);
    expect(result.supportedNodeIds).toHaveLength(0);
  });
  it('creates a pitched frame with two base supports', () => {
    const result = generateStructure({ kind: 'pitched-portal', span: 8, leftHeight: 3, rightHeight: 4, ridge: { x: 3, y: 6 }, properties, baseSupport: { type: 'pin' } });
    expect(result.nodes).toHaveLength(5);
    expect(result.members).toHaveLength(4);
    expect(result.supportedNodeIds).toHaveLength(2);
  });
  it('generates deterministic coordinates and preserves the requested origin', () => {
    const params = { kind: 'circular-arch' as const, span: 10, rise: 3, segments: 12, origin: { x: 20, y: -2 }, properties };
    const first = generateStructure(params);
    const second = generateStructure(params);
    expect(first).toEqual(second);
    expect(first.nodes[0]).toMatchObject({ x: 20, y: -2 });
    expect(first.nodes.at(-1)).toMatchObject({ x: 30, y: -2 });
  });
  it('rejects unsupported arc geometry and excessive divisions', () => {
    expect(() => generateStructure({ kind: 'circular-arch', span: 10, rise: 6, segments: 12, properties })).toThrow(/flecha/);
    expect(() => generateStructure({ kind: 'circular-ring', radius: 5, segments: 201, properties })).toThrow(/divisiones/);
  });
  it('does not add supports to a ring even when a base support is requested', () => {
    const result = generateStructure({ kind: 'circular-ring', radius: 5, segments: 12, properties, baseSupport: { type: 'pin' } });
    expect(result.supportedNodeIds).toEqual([]);
    expect(result.warnings.some(warning => warning.code === 'no-supports')).toBe(true);
  });
});
