import { describe, expect, it } from 'vitest';
import { supportForCanvasPlacement } from './supportPlacementModel';

describe('supportForCanvasPlacement', () => {
  it('replaces a roller with the standalone elastic support symbol', () => {
    const support = supportForCanvasPlacement(
      { type: 'roller', angleDeg: 90, prescribed: { normal: 0.01 }, spring: { kx: 250 } },
      'none',
      90,
      'spring',
    );

    expect(support).toEqual({
      type: 'none',
      spring: { kx: 250, ky: 1000 },
    });
  });

  it('removes legacy settlements that do not belong to the newly selected support', () => {
    const support = supportForCanvasPlacement(
      { type: 'roller', angleDeg: 90, prescribed: { normal: 0.01 } },
      'pin',
      90,
    );

    expect(support.type).toBe('pin');
    expect(support.prescribed).toBeUndefined();
  });
});
