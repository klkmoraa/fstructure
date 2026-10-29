import { describe, expect, it } from 'vitest';
import { generateStructure } from './structureGenerators';
const properties = { kind: 'explicit' as const, E: 200_000_000, A: 0.02, I: 0.0001 };

describe('physical curved structural generators', () => {
  it('builds one supported circular member between its two physical endpoints', () => {
    const result = generateStructure({ kind: 'circular-arch', span: 10, rise: 3, segments: 12, properties, baseSupport: { type: 'pin' } });
    expect(result.nodes).toHaveLength(2); expect(result.members).toHaveLength(1);
    expect(result.supportedNodeIds).toHaveLength(2);
    expect(result.members[0]).toMatchObject({ type: 'frame', i: result.nodes[0].id, j: result.nodes[1].id, curve: { kind: 'circular-arc', bulge: 0.6 } });
  });
  it('closes a ring with two opposite arcs sharing two nodes', () => {
    const result = generateStructure({ kind: 'circular-ring', radius: 5, segments: 16, properties });
    expect(result.nodes).toHaveLength(2); expect(result.members).toHaveLength(2);
    expect(result.members.map(m => m.curve?.bulge)).toEqual([1, -1]);
    expect(result.members[0].i).toBe(result.members[1].i);
    expect(result.members[0].j).toBe(result.members[1].j);
    expect(result.supportedNodeIds).toHaveLength(0);
  });
  it('creates a pitched frame with two base supports', () => {
    const result = generateStructure({ kind: 'pitched-portal', span: 8, leftHeight: 3, rightHeight: 4, ridge: { x: 3, y: 6 }, properties, baseSupport: { type: 'pin' } });
    expect(result.nodes).toHaveLength(5); expect(result.members).toHaveLength(4); expect(result.supportedNodeIds).toHaveLength(2);
  });
  it('generates deterministic coordinates and preserves the requested origin', () => {
    const params = { kind: 'circular-arch' as const, span: 10, rise: 3, segments: 12, origin: { x: 20, y: -2 }, properties };
    const first = generateStructure(params);
    expect(first).toEqual(generateStructure(params));
    expect(first.nodes[0]).toMatchObject({ x: 20, y: -2 }); expect(first.nodes.at(-1)).toMatchObject({ x: 30, y: -2 });
  });
  it('rejects unsupported geometry but obsolete divisions never create physical nodes', () => {
    expect(() => generateStructure({ kind: 'circular-arch', span: 10, rise: 6, segments: 12, properties })).toThrow(/flecha/);
    const ring = generateStructure({ kind: 'circular-ring', radius: 5, segments: 201, properties });
    expect(ring.nodes).toHaveLength(2); expect(ring.members).toHaveLength(2);
  });
  it('does not add supports to a ring even when a base support is requested', () => {
    const result = generateStructure({ kind: 'circular-ring', radius: 5, segments: 12, properties, baseSupport: { type: 'pin' } });
    expect(result.supportedNodeIds).toEqual([]); expect(result.warnings.some(w => w.code === 'no-supports')).toBe(true);
  });
});
