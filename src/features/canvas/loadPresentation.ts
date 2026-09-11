import type { MemberLoad } from '../../types';

export const DISTRIBUTED_LANE_SPACING_PX = 12;
export const DISTRIBUTED_BASE_HEIGHT_PX = 62;
export const POINT_ARROW_HEAD_OFFSET_PX = 7;
export const POINT_ARROW_LENGTH_PX = 45;
export const POINT_STACK_GAP_PX = 10;
export const POINT_DISTRIBUTED_GAP_PX = 10;

const STATION_TOLERANCE = 1e-6;

export type MemberLoadLane = 'inner' | 'point' | 'point-outer' | 'moment-outer';

export interface MemberLoadPresentation {
  load: MemberLoad;
  lane: MemberLoadLane;
  paintOrder: 0 | 1 | 2;
  stackOffsetPx: number;
  pointStackIndex?: number;
  pointStackCount?: number;
  pointHeadOffsetPx?: number;
  pointTailOffsetPx?: number;
  drawsPointGuide?: boolean;
}

export const pointLoadLabelAnchor = (
  base: { x: number; y: number },
  direction: { x: number; y: number },
  presentation?: MemberLoadPresentation,
) => {
  const labelOffset = (presentation?.pointTailOffsetPx ?? 52) + 8;
  return {
    x: base.x - direction.x * labelOffset,
    y: base.y - direction.y * labelOffset - 5,
  };
};

const stationOf = (load: MemberLoad) => load.position ?? 0.5;

const stableLoadCompare = (left: MemberLoad, right: MemberLoad) => (
  left.memberId.localeCompare(right.memberId)
  || stationOf(left) - stationOf(right)
  || left.caseId.localeCompare(right.caseId)
  || left.id.localeCompare(right.id)
);

const typeOrder = (load: MemberLoad): 0 | 1 | 2 => (
  load.type === 'distributed' ? 0 : load.type === 'point' ? 1 : 2
);

const sameStation = (left: MemberLoad, right: MemberLoad) => (
  left.memberId === right.memberId
  && Math.abs(stationOf(left) - stationOf(right)) <= STATION_TOLERANCE
);

const pointMagnitude = (load: MemberLoad) => Math.hypot(load.px ?? 0, load.py ?? 0);

const samePointDirection = (left: MemberLoad, right: MemberLoad) => {
  if (left.coordinateSystem !== right.coordinateSystem) return false;
  const leftMagnitude = pointMagnitude(left);
  const rightMagnitude = pointMagnitude(right);
  if (leftMagnitude <= 1e-9 || rightMagnitude <= 1e-9) return leftMagnitude <= 1e-9 && rightMagnitude <= 1e-9;
  const dot = ((left.px ?? 0) * (right.px ?? 0) + (left.py ?? 0) * (right.py ?? 0))
    / (leftMagnitude * rightMagnitude);
  return dot >= 1 - 1e-6;
};

type VisualSide = -1 | 1;

const dominantComponentValues = (load: MemberLoad) => {
  if (load.type === 'point') {
    const px = load.px ?? 0;
    const py = load.py ?? 0;
    return Math.abs(py) >= Math.abs(px) ? [py, py] as const : [px, px] as const;
  }
  const qxStart = load.qxStart ?? 0;
  const qxEnd = load.qxEnd ?? qxStart;
  const qyStart = load.qyStart ?? 0;
  const qyEnd = load.qyEnd ?? qyStart;
  return Math.max(Math.abs(qyStart), Math.abs(qyEnd)) >= Math.max(Math.abs(qxStart), Math.abs(qxEnd))
    ? [qyStart, qyEnd] as const
    : [qxStart, qxEnd] as const;
};

const visualSides = (load: MemberLoad) => {
  const sides = new Set<VisualSide>();
  for (const value of dominantComponentValues(load)) {
    if (value > 1e-9) sides.add(1);
    if (value < -1e-9) sides.add(-1);
  }
  return sides;
};

const sharesVisualSide = (left: MemberLoad, right: MemberLoad) => {
  if (left.coordinateSystem !== right.coordinateSystem) return true;
  const leftSides = visualSides(left);
  const rightSides = visualSides(right);
  return [...leftSides].some((side) => rightSides.has(side));
};

const overlapsDistributed = (point: MemberLoad, distributedLoads: readonly MemberLoad[]) => {
  const station = stationOf(point);
  return distributedLoads.some((load) => {
    if (load.memberId !== point.memberId || load.type !== 'distributed' || !sharesVisualSide(point, load)) return false;
    const start = Math.min(load.start, load.end);
    const end = Math.max(load.start, load.end);
    return station >= start - STATION_TOLERANCE && station <= end + STATION_TOLERANCE;
  });
};

const distributedInterval = (load: MemberLoad) => ({
  start: Math.min(load.start, load.end),
  end: Math.max(load.start, load.end),
});

const distributedCompare = (left: MemberLoad, right: MemberLoad) => {
  const leftInterval = distributedInterval(left);
  const rightInterval = distributedInterval(right);
  return left.memberId.localeCompare(right.memberId)
    || (rightInterval.end - rightInterval.start) - (leftInterval.end - leftInterval.start)
    || leftInterval.start - rightInterval.start
    || left.caseId.localeCompare(right.caseId)
    || left.id.localeCompare(right.id);
};

const distributedIntervalsOverlap = (left: MemberLoad, right: MemberLoad) => {
  if (left.memberId !== right.memberId || !sharesVisualSide(left, right)) return false;
  const a = distributedInterval(left);
  const b = distributedInterval(right);
  return a.start <= b.end + STATION_TOLERANCE && b.start <= a.end + STATION_TOLERANCE;
};

const distributedHeightAt = (load: MemberLoad, station: number, lane: number) => {
  const intervalLength = load.end - load.start;
  const ratio = Math.abs(intervalLength) <= STATION_TOLERANCE
    ? 0
    : Math.min(1, Math.max(0, (station - load.start) / intervalLength));
  const qxStart = load.qxStart ?? 0;
  const qyStart = load.qyStart ?? 0;
  const qxEnd = load.qxEnd ?? qxStart;
  const qyEnd = load.qyEnd ?? qyStart;
  const localMagnitude = Math.hypot(
    qxStart + (qxEnd - qxStart) * ratio,
    qyStart + (qyEnd - qyStart) * ratio,
  );
  const maximumMagnitude = Math.max(Math.hypot(qxStart, qyStart), Math.hypot(qxEnd, qyEnd), 1e-9);
  return localMagnitude / maximumMagnitude * (DISTRIBUTED_BASE_HEIGHT_PX + lane * DISTRIBUTED_LANE_SPACING_PX);
};

const distributedLaneMap = (loads: readonly MemberLoad[]) => {
  const lanes = new Map<MemberLoad, number>();
  const ordered = loads.filter((load) => load.type === 'distributed').sort(distributedCompare);
  for (const load of ordered) {
    const occupied = new Set<number>();
    for (const previous of ordered) {
      if (previous === load) break;
      if (distributedIntervalsOverlap(previous, load)) occupied.add(lanes.get(previous) ?? 0);
    }
    let lane = 0;
    while (occupied.has(lane)) lane += 1;
    lanes.set(load, lane);
  }
  return lanes;
};

/**
 * Resolves only screen presentation metadata. The returned records retain the
 * original load references and never write to the project or its load arrays.
 */
export const resolveMemberLoadPresentation = (
  loads: readonly MemberLoad[],
): MemberLoadPresentation[] => {
  const distributedLoads = loads.filter((load) => load.type === 'distributed').sort(distributedCompare);
  const distributedLanes = distributedLaneMap(distributedLoads);
  const pointLoads = loads.filter((load) => load.type === 'point').sort(stableLoadCompare);

  return [...loads]
    .sort((left, right) => typeOrder(left) - typeOrder(right)
      || (left.type === 'distributed' && right.type === 'distributed'
        ? distributedCompare(left, right)
        : stableLoadCompare(left, right)))
    .map((load) => {
      const paintOrder = typeOrder(load);
      if (load.type === 'distributed') {
        return {
          load,
          lane: 'inner',
          paintOrder,
          stackOffsetPx: (distributedLanes.get(load) ?? 0) * DISTRIBUTED_LANE_SPACING_PX,
        };
      }
      if (load.type === 'moment') {
        return { load, lane: 'moment-outer', paintOrder, stackOffsetPx: 0 };
      }

      const coincident = pointLoads
        .filter((candidate) => sameStation(candidate, load) && samePointDirection(candidate, load))
        .sort((left, right) => pointMagnitude(right) - pointMagnitude(left) || stableLoadCompare(left, right));
      const index = coincident.findIndex((candidate) => candidate.id === load.id && candidate.caseId === load.caseId);
      const highestDistributedHeight = distributedLoads.reduce((highest, distributed) => {
        if (!overlapsDistributed(load, [distributed])) return highest;
        return Math.max(
          highest,
          distributedHeightAt(distributed, stationOf(load), distributedLanes.get(distributed) ?? 0),
        );
      }, 0);
      const pointHeadBase = highestDistributedHeight > 1e-9
        ? highestDistributedHeight + POINT_DISTRIBUTED_GAP_PX
        : POINT_ARROW_HEAD_OFFSET_PX;
      const pointHeadOffsetPx = pointHeadBase + index * (POINT_ARROW_LENGTH_PX + POINT_STACK_GAP_PX);
      return {
        load,
        lane: highestDistributedHeight > 1e-9 ? 'point-outer' : 'point',
        paintOrder,
        stackOffsetPx: 0,
        pointStackIndex: index,
        pointStackCount: coincident.length,
        pointHeadOffsetPx,
        pointTailOffsetPx: pointHeadOffsetPx + POINT_ARROW_LENGTH_PX,
        drawsPointGuide: index === coincident.length - 1
          && (coincident.length > 1 || pointHeadBase > POINT_ARROW_HEAD_OFFSET_PX),
      };
    });
};
