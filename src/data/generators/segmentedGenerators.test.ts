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
});
