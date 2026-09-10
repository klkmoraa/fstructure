import type { MemberLoad } from '../../types';

export const OVERLAP_TAIL_EXTENSION_PX = 18;
export const POINT_LANE_SPACING_PX = 8;
export const DISTRIBUTED_LANE_SPACING_PX = 12;

const STATION_TOLERANCE = 1e-6;

export type MemberLoadLane = 'inner' | 'point' | 'point-outer' | 'moment-outer';

export interface MemberLoadPresentation {
  load: MemberLoad;
  lane: MemberLoadLane;
  paintOrder: 0 | 1 | 2;
  tailExtensionPx: number;
  lateralOffsetPx: number;
  stackOffsetPx: number;
}

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

const overlapsDistributed = (point: MemberLoad, distributedLoads: readonly MemberLoad[]) => {
  const station = stationOf(point);
  return distributedLoads.some((load) => {
    if (load.memberId !== point.memberId || load.type !== 'distributed') return false;
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
  if (left.memberId !== right.memberId) return false;
  const a = distributedInterval(left);
  const b = distributedInterval(right);
  return a.start <= b.end + STATION_TOLERANCE && b.start <= a.end + STATION_TOLERANCE;
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
          tailExtensionPx: 0,
          lateralOffsetPx: 0,
          stackOffsetPx: (distributedLanes.get(load) ?? 0) * DISTRIBUTED_LANE_SPACING_PX,
        };
      }
      if (load.type === 'moment') {
        return { load, lane: 'moment-outer', paintOrder, tailExtensionPx: 0, lateralOffsetPx: 0, stackOffsetPx: 0 };
      }

      const coincident = pointLoads.filter((candidate) => sameStation(candidate, load));
      const index = coincident.findIndex((candidate) => candidate.id === load.id && candidate.caseId === load.caseId);
      const lateralOffsetPx = (index - (coincident.length - 1) / 2) * POINT_LANE_SPACING_PX;
      const overlapping = overlapsDistributed(load, distributedLoads);
      const highestDistributedOffset = distributedLoads.reduce((highest, distributed) => (
        overlapsDistributed(load, [distributed])
          ? Math.max(highest, (distributedLanes.get(distributed) ?? 0) * DISTRIBUTED_LANE_SPACING_PX)
          : highest
      ), 0);
      return {
        load,
        lane: overlapping ? 'point-outer' : 'point',
        paintOrder,
        tailExtensionPx: overlapping ? OVERLAP_TAIL_EXTENSION_PX + highestDistributedOffset : 0,
        lateralOffsetPx,
        stackOffsetPx: 0,
      };
    });
};
