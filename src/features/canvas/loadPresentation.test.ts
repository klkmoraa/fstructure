import { describe, expect, it } from 'vitest';
import type { MemberLoad } from '../../types';
import {
  pointLoadLabelAnchor,
  resolveMemberLoadPresentation,
} from './loadPresentation';

const distributed = (id: string, start: number, end: number): MemberLoad => ({
  id, memberId: 'M1', caseId: 'LC1', type: 'distributed',
  coordinateSystem: 'global', lengthBasis: 'real', start, end,
  qxStart: 0, qxEnd: 0, qyStart: -10, qyEnd: -10,
});

const point = (id: string, magnitude: number, position = 0.25): MemberLoad => ({
  id, memberId: 'M1', caseId: 'LC1', type: 'point',
  coordinateSystem: 'global', lengthBasis: 'real', position,
  px: 0, py: -magnitude, start: 0, end: 1,
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
    expect(distributedPresentations.map(({ distributedBaseOffsetPx }) => distributedBaseOffsetPx))
      .toEqual([0, 63, 126]);
  });

  it('staggers distributed label stations across the span when loads share an interval', () => {
    const presentations = resolveMemberLoadPresentation([
      distributed('d1', 0, 1),
      distributed('d2', 0, 1),
      distributed('d3', 0, 1),
    ]);
    const distributedPresentations = presentations.filter(({ load }) => load.type === 'distributed');
    expect(distributedPresentations.map(({ distributedBaseOffsetPx }) => distributedBaseOffsetPx))
      .toEqual([0, 63, 126]);
    expect(distributedPresentations.map(({ distributedStackTopOffsetPx }) => distributedStackTopOffsetPx))
      .toEqual([188, 188, 188]);
    expect(distributedPresentations.map(({ distributedLabelStation }) => distributedLabelStation))
      .toEqual([0.25, 0.5, 0.75]);
  });

  it('reuses the inner distributed lane for loads on opposite sides of the member', () => {
    const upward = { ...distributed('upward', 0, 1), qyStart: 10, qyEnd: 10 };
    const downward = distributed('downward', 0, 1);
    const presentations = resolveMemberLoadPresentation([upward, downward]);

    expect(presentations.map(({ distributedBaseOffsetPx }) => distributedBaseOffsetPx)).toEqual([0, 0]);
  });

  it('stacks coincident point loads upward from greatest to smallest magnitude', () => {
    const presentations = resolveMemberLoadPresentation([
      point('small', 10),
      point('large', 30),
      point('medium', 20),
    ]);
    const byId = new Map(presentations.map((presentation) => [presentation.load.id, presentation]));

    expect(byId.get('large')).toMatchObject({
      pointStackIndex: 0,
      pointStackCount: 3,
      pointHeadOffsetPx: 7,
      pointTailOffsetPx: 52,
    });
    expect(byId.get('medium')).toMatchObject({
      pointStackIndex: 1,
      pointStackCount: 3,
      pointHeadOffsetPx: 53,
      pointTailOffsetPx: 98,
    });
    expect(byId.get('small')).toMatchObject({
      pointStackIndex: 2,
      pointStackCount: 3,
      pointHeadOffsetPx: 99,
      pointTailOffsetPx: 144,
      drawsPointGuide: true,
    });
  });

  it('keeps opposite point-load directions in independent stacks', () => {
    const presentations = resolveMemberLoadPresentation([
      point('down', 30),
      { ...point('up', 10), py: 10 },
    ]);

    expect(presentations.filter(({ load }) => load.type === 'point')).toEqual(expect.arrayContaining([
      expect.objectContaining({ pointStackIndex: 0, pointStackCount: 1, pointHeadOffsetPx: 7 }),
      expect.objectContaining({ pointStackIndex: 0, pointStackCount: 1, pointHeadOffsetPx: 7 }),
    ]));
  });

  it('starts a point stack above the local height of every overlapping distributed lane', () => {
    const presentations = resolveMemberLoadPresentation([
      distributed('wide', 0, 1),
      distributed('medium', 0, 0.5),
      distributed('short', 0.2, 0.3),
      point('large', 30),
      point('small', 10),
    ]);
    const byId = new Map(presentations.map((presentation) => [presentation.load.id, presentation]));

    expect(byId.get('large')).toMatchObject({ pointHeadOffsetPx: 189, pointTailOffsetPx: 234 });
    expect(byId.get('small')).toMatchObject({ pointHeadOffsetPx: 235, pointTailOffsetPx: 280, drawsPointGuide: true });
  });

  it('does not reserve distributed height where a triangular envelope is zero', () => {
    const triangular = {
      ...distributed('triangle', 0, 1),
      qyStart: 0,
      qyEnd: -10,
    };
    const presentation = resolveMemberLoadPresentation([
      triangular,
      point('point-at-zero', 10, 0),
    ]).find(({ load }) => load.id === 'point-at-zero');

    expect(presentation).toMatchObject({ pointHeadOffsetPx: 7, pointTailOffsetPx: 52 });
  });

  it('does not raise a point load for a distributed envelope on the opposite side', () => {
    const upward = { ...distributed('upward', 0, 1), qyStart: 10, qyEnd: 10 };
    const presentation = resolveMemberLoadPresentation([
      upward,
      point('downward-point', 10),
    ]).find(({ load }) => load.id === 'downward-point');

    expect(presentation).toMatchObject({
      lane: 'point',
      pointHeadOffsetPx: 7,
      pointTailOffsetPx: 52,
      drawsPointGuide: false,
    });
  });

  it('anchors each point label beyond the tail of its assigned stack level', () => {
    const presentations = resolveMemberLoadPresentation([
      point('small', 10),
      point('large', 30),
      point('medium', 20),
    ]);
    const small = presentations.find(({ load }) => load.id === 'small');
    const large = presentations.find(({ load }) => load.id === 'large');

    expect(pointLoadLabelAnchor(
      { x: 140, y: 220 },
      { x: 0, y: 1 },
      small,
    )).toEqual({ x: 140, y: 63 });

    const largeAnchor = pointLoadLabelAnchor(
      { x: 140, y: 220 },
      { x: 0, y: 1 },
      large,
    );
    expect(largeAnchor.x).not.toBe(140);
  });
});
