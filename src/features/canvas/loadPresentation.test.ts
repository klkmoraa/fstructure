import { describe, expect, it } from 'vitest';
import type { MemberLoad } from '../../types';
import {
  resolveMemberLoadPresentation,
} from './loadPresentation';

const distributed = (id: string, start: number, end: number): MemberLoad => ({
  id, memberId: 'M1', caseId: 'LC1', type: 'distributed',
  coordinateSystem: 'global', lengthBasis: 'real', start, end,
  qxStart: 0, qxEnd: 0, qyStart: -10, qyEnd: -10,
});

describe('member-load presentation', () => {
  it('places nested distributed spans from longest to shortest in outward lanes', () => {
    const presentations = resolveMemberLoadPresentation([
      distributed('short', 0.2, 0.3),
      distributed('wide', 0, 1),
      distributed('medium', 0, 0.5),
    ]);

    const distributedPresentations = presentations.filter(({ load }) => load.type === 'distributed');
    expect(distributedPresentations.map(({ load }) => load.id)).toEqual(['wide', 'medium', 'short']);
    expect(distributedPresentations.map((presentation) => (
      presentation as typeof presentation & { stackOffsetPx?: number }
    ).stackOffsetPx)).toEqual([0, 12, 24]);
  });

  it('raises a coincident point load above the highest distributed lane', () => {
    const point: MemberLoad = {
      id: 'point', memberId: 'M1', caseId: 'LC1', type: 'point',
      coordinateSystem: 'global', lengthBasis: 'real', position: 0.25, px: 0, py: -10,
      start: 0, end: 1,
    };
    const presentation = resolveMemberLoadPresentation([
      distributed('wide', 0, 1),
      distributed('medium', 0, 0.5),
      distributed('short', 0.2, 0.3),
      point,
    ]).find(({ load }) => load.id === point.id);

    expect(presentation?.tailExtensionPx).toBe(42);
  });
});
