import { describe, expect, it } from 'vitest';
import { circularArch, circularRing, pitchedPortal } from './curvedGeometry';

describe('parametric segmented geometries', () => {
  it('creates an arch with exact supports and a crown at the specified rise', () => {
    const arch = circularArch(10, 3, 20);
    expect(arch.points).toHaveLength(21);
    expect(arch.points[0]).toEqual({ x: 0, y: 0 });
    expect(arch.points[10]).toEqual({ x: 5, y: 3 });
    expect(arch.points[20]).toEqual({ x: 10, y: 0 });
    expect(arch.closed).toBe(false);
  });
  it('creates a closed ring without duplicating the first node', () => {
    const ring = circularRing(5, 12);
    expect(ring.points).toHaveLength(12);
    expect(ring.closed).toBe(true);
    expect(ring.points[0]).toEqual({ x: 5, y: 0 });
    expect(new Set(ring.points.map(p => `${p.x},${p.y}`)).size).toBe(12);
  });
  it('creates one-slope and asymmetric two-slope portals', () => {
    expect(pitchedPortal(8, 3, 4).points).toHaveLength(4);
    expect(pitchedPortal(8, 3, 4, { x: 3, y: 6 }).points[2]).toEqual({ x: 3, y: 6 });
  });
  it('rejects invalid inputs before generating geometry', () => {
    expect(() => circularArch(0, 2, 12)).toThrow();
    expect(() => circularArch(10, 6, 12)).toThrow(/flecha/);
    expect(() => circularRing(4, 2)).toThrow();
    expect(() => pitchedPortal(8, 3, 4, { x: 9, y: 6 })).toThrow();
  });
});
