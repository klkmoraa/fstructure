export interface SnapTarget {
  x: number;
  y: number;
}

export type SnapKind = 'node' | 'midpoint' | 'intersection' | 'perpendicular' | 'target' | 'grid';

export interface SnapCandidate extends SnapTarget {
  kind: Exclude<SnapKind, 'grid'>;
  /** Stable source identifiers are useful for drawing a snap glyph and tooltip. */
  sourceIds?: string[];
}

/**
 * Arco circular de una barra curva: centro, radio, ángulo de inicio y barrido
 * con signo (|barrido| ≤ π). Una barra curva no tiene «cuerda» física: sus
 * snaps de punto medio, perpendicular e intersección se toman sobre el arco.
 */
export interface SnapArc {
  center: SnapTarget;
  radius: number;
  startAngle: number;
  sweep: number;
}

export interface SnapSegment {
  id: string;
  start: SnapTarget;
  end: SnapTarget;
  /** Presente sólo en barras curvas. */
  arc?: SnapArc;
}

type SnapModeToggles = Partial<Record<SnapKind, boolean>>;

interface SnapOptions {
  enabled: boolean;
  gridSize: number;
  pixelsPerUnit: number;
  /** Legacy untyped targets. Prefer candidates for new call sites. */
  targets?: SnapTarget[];
  candidates?: SnapCandidate[];
  modes?: SnapModeToggles;
  pixelTolerance?: number;
  priority?: SnapKind[];
}

interface SnapResult {
  point: SnapTarget;
  kind: SnapKind | 'none';
  distancePixels: number;
  candidate?: SnapCandidate;
}

interface IntersectionCandidateOptions {
  epsilon?: number;
  /** End intersections normally duplicate node snaps, so they are excluded by default. */
  includeEndpoints?: boolean;
}

interface PerpendicularCandidateOptions {
  epsilon?: number;
  /** Includes a projection on the segment extension rather than only on the finite member. */
  includeExtensions?: boolean;
}

const DEFAULT_SNAP_PRIORITY: SnapKind[] = [
  'node',
  'intersection',
  'midpoint',
  'perpendicular',
  'target',
  'grid',
];

const squaredDistance = (a: SnapTarget, b: SnapTarget): number => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
};

const cross = (ax: number, ay: number, bx: number, by: number): number => ax * by - ay * bx;

const isModeEnabled = (kind: SnapKind, modes?: SnapModeToggles): boolean => modes?.[kind] !== false;

const normalizedPriority = (priority?: SnapKind[]): Map<SnapKind, number> => {
  const ordered = priority?.length ? priority : DEFAULT_SNAP_PRIORITY;
  const ranks = new Map<SnapKind, number>();
  for (const kind of ordered) if (!ranks.has(kind)) ranks.set(kind, ranks.size);
  for (const kind of DEFAULT_SNAP_PRIORITY) if (!ranks.has(kind)) ranks.set(kind, ranks.size);
  return ranks;
};

/**
 * Broad phase shared by the geometric builders: a uniform bucket grid keyed by a
 * numeric spatial hash. Hash collisions are harmless because every lookup is
 * confirmed by the exact geometric test, so the grid can only ever save work —
 * it never decides a result on its own.
 */
const hashCell = (cellX: number, cellY: number): number =>
  (Math.imul(cellX, 73856093) ^ Math.imul(cellY, 19349663)) | 0;

/** Keeps the derived cell indices comfortably inside the exact-integer range. */
const isUsableCell = (cell: number): boolean => Number.isSafeInteger(cell) && Math.abs(cell) <= 2 ** 40;

/**
 * Index of already emitted candidates used to collapse coincident points. Cells
 * are `2 * epsilon` wide, so every point within `epsilon` of a query necessarily
 * lands in the queried cell or one of its eight neighbours.
 */
const createCandidateIndex = (epsilon: number) => {
  const cellSize = Math.max(epsilon * 2, Number.MIN_VALUE);
  const epsilonSquared = epsilon * epsilon;
  const buckets = new Map<number, number[]>();
  let degraded = false;

  const cellOf = (value: number): number => Math.floor(value / cellSize);

  return {
    /**
     * Mirrors `candidates.find(...)`: returns the earliest emitted candidate
     * within `epsilon` of the point, or `undefined`.
     */
    findDuplicate(candidates: SnapCandidate[], point: SnapTarget): SnapCandidate | undefined {
      const cellX = cellOf(point.x);
      const cellY = cellOf(point.y);
      if (degraded || !isUsableCell(cellX) || !isUsableCell(cellY)) {
        degraded = true;
        return candidates.find((candidate) => squaredDistance(candidate, point) <= epsilonSquared);
      }
      let earliest = -1;
      for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
        for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
          const bucket = buckets.get(hashCell(cellX + offsetX, cellY + offsetY));
          if (!bucket) continue;
          for (const position of bucket) {
            if (earliest >= 0 && position > earliest) continue;
            if (squaredDistance(candidates[position], point) <= epsilonSquared) earliest = position;
          }
        }
      }
      return earliest >= 0 ? candidates[earliest] : undefined;
    },
    /** Registers the candidate stored at `position` in the owning array. */
    add(point: SnapTarget, position: number): void {
      if (degraded) return;
      const cellX = cellOf(point.x);
      const cellY = cellOf(point.y);
      if (!isUsableCell(cellX) || !isUsableCell(cellY)) {
        degraded = true;
        return;
      }
      const key = hashCell(cellX, cellY);
      const bucket = buckets.get(key);
      if (bucket) bucket.push(position);
      else buckets.set(key, [position]);
    },
  };
};

interface BoundedSegment {
  segment: SnapSegment;
  dx: number;
  dy: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const arcPointAt = (arc: SnapArc, ratio: number): SnapTarget => {
  const angle = arc.startAngle + arc.sweep * ratio;
  return { x: arc.center.x + arc.radius * Math.cos(angle), y: arc.center.y + arc.radius * Math.sin(angle) };
};

/**
 * Fracción del arco (0 en el inicio, 1 en el final) del punto de la
 * circunferencia `point`, o `null` si cae fuera del barrido. `point` ya debe
 * estar sobre la circunferencia: sólo se mira su ángulo.
 */
const arcRatioOf = (arc: SnapArc, point: SnapTarget, epsilon: number): number | null => {
  if (!(Math.abs(arc.sweep) > 0)) return null;
  const delta = Math.atan2(point.y - arc.center.y, point.x - arc.center.x) - arc.startAngle;
  for (const turn of [0, 1, -1, 2, -2]) {
    const ratio = (delta + turn * 2 * Math.PI) / arc.sweep;
    if (ratio >= -epsilon && ratio <= 1 + epsilon) return Math.min(1, Math.max(0, ratio));
  }
  return null;
};

/** Caja del arco: sus extremos y los puntos cardinales que caen dentro del barrido. */
const arcBounds = (arc: SnapArc, start: SnapTarget, end: SnapTarget) => {
  const points = [start, end];
  for (const angle of [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2]) {
    const point = { x: arc.center.x + arc.radius * Math.cos(angle), y: arc.center.y + arc.radius * Math.sin(angle) };
    if (arcRatioOf(arc, point, 0) !== null) points.push(point);
  }
  return {
    minX: Math.min(...points.map((point) => point.x)), maxX: Math.max(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)), maxY: Math.max(...points.map((point) => point.y)),
  };
};

/** Un cruce con la fracción de cada miembro en él (recta: t; arco: fracción del barrido). */
interface CurvedCrossing { point: SnapTarget; first: number; second: number }

/** Cortes de la recta finita `segment` con el arco `arc` (0, 1 o 2). */
const lineArcCrossings = (segment: SnapSegment, arc: SnapArc, epsilon: number): CurvedCrossing[] => {
  const dx = segment.end.x - segment.start.x;
  const dy = segment.end.y - segment.start.y;
  const fx = segment.start.x - arc.center.x;
  const fy = segment.start.y - arc.center.y;
  const a = dx * dx + dy * dy;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - arc.radius * arc.radius;
  const discriminant = b * b - 4 * a * c;
  const scale = Math.max(b * b, Math.abs(4 * a * c), Number.MIN_VALUE);
  if (!(a > 0) || discriminant < -epsilon * scale) return [];
  const root = Math.sqrt(Math.max(0, discriminant));
  const ts = root <= epsilon * Math.sqrt(scale) ? [-b / (2 * a)] : [(-b - root) / (2 * a), (-b + root) / (2 * a)];
  return ts.flatMap((t) => {
    if (t < -epsilon || t > 1 + epsilon) return [];
    const point = { x: segment.start.x + t * dx, y: segment.start.y + t * dy };
    const ratio = arcRatioOf(arc, point, epsilon);
    return ratio === null ? [] : [{ point: arcPointAt(arc, ratio), first: t, second: ratio }];
  });
};

/** Cortes de dos arcos: las intersecciones de sus circunferencias que caen en ambos barridos. */
const arcArcCrossings = (first: SnapArc, second: SnapArc, epsilon: number): CurvedCrossing[] => {
  const dx = second.center.x - first.center.x;
  const dy = second.center.y - first.center.y;
  const distance = Math.hypot(dx, dy);
  const scale = Math.max(first.radius, second.radius, 1);
  // Circunferencias concéntricas (o la misma): no definen un punto único.
  if (distance <= epsilon * scale) return [];
  if (distance > first.radius + second.radius + epsilon * scale) return [];
  if (distance < Math.abs(first.radius - second.radius) - epsilon * scale) return [];
  const along = (first.radius ** 2 - second.radius ** 2 + distance ** 2) / (2 * distance);
  const half = Math.sqrt(Math.max(0, first.radius ** 2 - along ** 2));
  const base = { x: first.center.x + along * dx / distance, y: first.center.y + along * dy / distance };
  const offsets = half <= epsilon * scale ? [0] : [half, -half];
  return offsets.flatMap((offset) => {
    const point = { x: base.x - offset * dy / distance, y: base.y + offset * dx / distance };
    const a = arcRatioOf(first, point, epsilon);
    const b = arcRatioOf(second, point, epsilon);
    return a === null || b === null ? [] : [{ point: arcPointAt(first, a), first: a, second: b }];
  });
};

/** Punto medio de cada barra: la clave del arco en una curva, no el centro de su cuerda. */
export const buildMidpointSnapCandidates = (segments: SnapSegment[]): SnapCandidate[] => segments.map((segment) => {
  const point = segment.arc
    ? arcPointAt(segment.arc, 0.5)
    : { x: (segment.start.x + segment.end.x) / 2, y: (segment.start.y + segment.end.y) / 2 };
  return { ...point, kind: 'midpoint', sourceIds: [segment.id] };
});

/** Caps the bucket count so a single oversized member cannot blow up memory. */
const MAX_GRID_AXIS_CELLS = 64;

/**
 * Buckets segment bounding boxes so the intersection builder only tests pairs
 * that share a cell. Two segments that truly cross have overlapping boxes and
 * therefore always share at least one cell, so no candidate is lost.
 */
const buildSegmentGrid = (items: BoundedSegment[]) => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const item of items) {
    if (item.minX < minX) minX = item.minX;
    if (item.minY < minY) minY = item.minY;
    if (item.maxX > maxX) maxX = item.maxX;
    if (item.maxY > maxY) maxY = item.maxY;
  }

  const axisCells = Math.max(1, Math.min(MAX_GRID_AXIS_CELLS, Math.round(Math.sqrt(items.length))));
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const usable = Number.isFinite(spanX) && Number.isFinite(spanY);
  const cellWidth = usable && spanX > 0 ? spanX / axisCells : Infinity;
  const cellHeight = usable && spanY > 0 ? spanY / axisCells : Infinity;

  const columnOf = (value: number): number =>
    cellWidth === Infinity ? 0 : Math.max(0, Math.min(axisCells - 1, Math.floor((value - minX) / cellWidth)));
  const rowOf = (value: number): number =>
    cellHeight === Infinity ? 0 : Math.max(0, Math.min(axisCells - 1, Math.floor((value - minY) / cellHeight)));

  const buckets = new Map<number, number[]>();
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const lastColumn = columnOf(item.maxX);
    const lastRow = rowOf(item.maxY);
    for (let column = columnOf(item.minX); column <= lastColumn; column += 1) {
      for (let row = rowOf(item.minY); row <= lastRow; row += 1) {
        const key = column * MAX_GRID_AXIS_CELLS + row;
        const bucket = buckets.get(key);
        if (bucket) bucket.push(index);
        else buckets.set(key, [index]);
      }
    }
  }

  /**
   * Collects the indices greater than `index` whose owner shares a cell with it,
   * in ascending order so the emission order matches an exhaustive pair scan.
   */
  return (index: number, into: number[]): number[] => {
    into.length = 0;
    const item = items[index];
    const lastColumn = columnOf(item.maxX);
    const lastRow = rowOf(item.maxY);
    for (let column = columnOf(item.minX); column <= lastColumn; column += 1) {
      for (let row = rowOf(item.minY); row <= lastRow; row += 1) {
        const bucket = buckets.get(column * MAX_GRID_AXIS_CELLS + row);
        if (!bucket) continue;
        // Only later partners: every pair is visited from its lower index, as an
        // exhaustive `for j > i` scan would.
        for (const other of bucket) if (other > index) into.push(other);
      }
    }
    if (into.length > 1) {
      into.sort((a, b) => a - b);
      let unique = 1;
      for (let position = 1; position < into.length; position += 1) {
        if (into[position] !== into[unique - 1]) into[unique++] = into[position];
      }
      into.length = unique;
    }
    return into;
  };
};

/**
 * Computes strict segment intersections once per geometry revision. Collinear
 * overlaps are intentionally ignored because they do not define a unique snap.
 * A uniform grid provides the broad phase: only members whose bounding boxes
 * share a cell reach the exact cross-product test.
 */
export const buildIntersectionSnapCandidates = (
  segments: SnapSegment[],
  options: IntersectionCandidateOptions = {},
): SnapCandidate[] => {
  const epsilon = Math.max(options.epsilon ?? 1e-9, Number.EPSILON);
  const candidates: SnapCandidate[] = [];

  const bounded: BoundedSegment[] = [];
  for (const segment of segments) {
    const dx = segment.end.x - segment.start.x;
    const dy = segment.end.y - segment.start.y;
    if (dx * dx + dy * dy <= epsilon * epsilon) continue;
    bounded.push({
      segment,
      dx,
      dy,
      ...(segment.arc ? arcBounds(segment.arc, segment.start, segment.end) : {
        minX: Math.min(segment.start.x, segment.end.x),
        minY: Math.min(segment.start.y, segment.end.y),
        maxX: Math.max(segment.start.x, segment.end.x),
        maxY: Math.max(segment.start.y, segment.end.y),
      }),
    });
  }
  if (bounded.length < 2) return candidates;

  const neighboursOf = buildSegmentGrid(bounded);
  const index = createCandidateIndex(epsilon);
  const neighbours: number[] = [];

  for (let firstIndex = 0; firstIndex < bounded.length; firstIndex += 1) {
    const first = bounded[firstIndex];
    const { dx: rx, dy: ry } = first;

    for (const secondIndex of neighboursOf(firstIndex, neighbours)) {
      const second = bounded[secondIndex];
      // Narrow the broad phase: touching cells does not imply touching boxes.
      if (first.maxX < second.minX || second.maxX < first.minX) continue;
      if (first.maxY < second.minY || second.maxY < first.minY) continue;
      if (first.segment.arc || second.segment.arc) {
        // Una curva se corta sobre su arco; su cuerda no es una barra.
        const firstArc = first.segment.arc;
        const secondArc = second.segment.arc;
        const crossings = firstArc && secondArc
          ? arcArcCrossings(firstArc, secondArc, epsilon)
          : firstArc
            ? lineArcCrossings(second.segment, firstArc, epsilon).map((item) => ({ ...item, first: item.second, second: item.first }))
            : lineArcCrossings(first.segment, secondArc!, epsilon);
        const atEnd = (ratio: number) => ratio <= epsilon || ratio >= 1 - epsilon;
        for (const crossing of crossings) {
          if (!options.includeEndpoints && (atEnd(crossing.first) || atEnd(crossing.second))) continue;
          const duplicate = index.findDuplicate(candidates, crossing.point);
          if (duplicate) {
            duplicate.sourceIds = [...new Set([...(duplicate.sourceIds ?? []), first.segment.id, second.segment.id])];
          } else {
            index.add(crossing.point, candidates.length);
            candidates.push({ ...crossing.point, kind: 'intersection', sourceIds: [first.segment.id, second.segment.id] });
          }
        }
        continue;
      }
      const { dx: sx, dy: sy } = second;

      const denominator = cross(rx, ry, sx, sy);
      const scale = Math.max(Math.hypot(rx, ry) * Math.hypot(sx, sy), 1);
      if (Math.abs(denominator) <= epsilon * scale) continue;

      const qpx = second.segment.start.x - first.segment.start.x;
      const qpy = second.segment.start.y - first.segment.start.y;
      const t = cross(qpx, qpy, sx, sy) / denominator;
      const u = cross(qpx, qpy, rx, ry) / denominator;
      const onSegments = t >= -epsilon && t <= 1 + epsilon && u >= -epsilon && u <= 1 + epsilon;
      if (!onSegments) continue;
      if (!options.includeEndpoints && (t <= epsilon || t >= 1 - epsilon || u <= epsilon || u >= 1 - epsilon)) continue;

      const point = { x: first.segment.start.x + t * rx, y: first.segment.start.y + t * ry };
      const duplicate = index.findDuplicate(candidates, point);
      if (duplicate) {
        duplicate.sourceIds = [...new Set([...(duplicate.sourceIds ?? []), first.segment.id, second.segment.id])];
      } else {
        index.add(point, candidates.length);
        candidates.push({ ...point, kind: 'intersection', sourceIds: [first.segment.id, second.segment.id] });
      }
    }
  }

  return candidates;
};

/** Builds perpendicular feet from a drawing origin to finite model members. */
export const buildPerpendicularSnapCandidates = (
  origin: SnapTarget,
  segments: SnapSegment[],
  options: PerpendicularCandidateOptions = {},
): SnapCandidate[] => {
  const epsilon = Math.max(options.epsilon ?? 1e-9, Number.EPSILON);
  const candidates: SnapCandidate[] = [];
  const index = createCandidateIndex(epsilon);

  const add = (point: SnapTarget, segment: SnapSegment) => {
    if (squaredDistance(point, origin) <= epsilon * epsilon) return;
    const duplicate = index.findDuplicate(candidates, point);
    if (duplicate) duplicate.sourceIds = [...new Set([...(duplicate.sourceIds ?? []), segment.id])];
    else {
      index.add(point, candidates.length);
      candidates.push({ ...point, kind: 'perpendicular', sourceIds: [segment.id] });
    }
  };

  for (const segment of segments) {
    if (segment.arc) {
      // Sobre un arco, la perpendicular desde el origen sigue el radio: el pie
      // más cercano y el opuesto de la circunferencia, si caen en el barrido.
      const { center, radius } = segment.arc;
      const distance = Math.hypot(origin.x - center.x, origin.y - center.y);
      if (distance <= epsilon * Math.max(1, radius)) continue;
      for (const sign of [1, -1]) {
        const foot = {
          x: center.x + sign * radius * (origin.x - center.x) / distance,
          y: center.y + sign * radius * (origin.y - center.y) / distance,
        };
        const ratio = arcRatioOf(segment.arc, foot, epsilon);
        if (ratio !== null) add(arcPointAt(segment.arc, ratio), segment);
      }
      continue;
    }
    const dx = segment.end.x - segment.start.x;
    const dy = segment.end.y - segment.start.y;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared <= epsilon * epsilon) continue;
    const ratio = ((origin.x - segment.start.x) * dx + (origin.y - segment.start.y) * dy) / lengthSquared;
    if (!options.includeExtensions && (ratio < -epsilon || ratio > 1 + epsilon)) continue;
    add({ x: segment.start.x + ratio * dx, y: segment.start.y + ratio * dy }, segment);
  }

  return candidates;
};

/**
 * Resolves typed geometric snaps in screen-space tolerance, then optionally uses
 * the grid. The candidate sweep runs allocation-free: each entry is rejected on
 * the X axis before the full distance is computed, and only the running best is
 * kept, so a pointer move never materialises a ranking array.
 */
export const resolveSnap = (point: SnapTarget, options: SnapOptions): SnapResult => {
  if (!options.enabled) return { point: { ...point }, kind: 'none', distancePixels: 0 };

  const pixelsPerUnit = Math.max(Math.abs(options.pixelsPerUnit), 1e-12);
  const tolerancePixels = Math.max(options.pixelTolerance ?? 12, 0);
  const toleranceModelSquared = (tolerancePixels / pixelsPerUnit) ** 2;
  const ranks = normalizedPriority(options.priority);

  // Typed candidates first, then the legacy untyped targets, exactly as the
  // previous concatenation ordered them.
  const candidates = options.candidates;
  const targets = options.targets;
  const typedCount = candidates?.length ?? 0;
  const total = typedCount + (targets?.length ?? 0);

  let bestCandidate: SnapCandidate | null = null;
  let bestRank = Number.MAX_SAFE_INTEGER;
  let bestDistanceSquared = Infinity;

  for (let index = 0; index < total; index += 1) {
    const legacy = index >= typedCount;
    const source = legacy ? targets![index - typedCount] : candidates![index];
    const kind = legacy ? ('target' as const) : (source as SnapCandidate).kind;
    if (!isModeEnabled(kind, options.modes)) continue;
    const dx = point.x - source.x;
    if (dx * dx > toleranceModelSquared) continue;
    const dy = point.y - source.y;
    const distanceSquared = dx * dx + dy * dy;
    if (distanceSquared > toleranceModelSquared) continue;
    const rank = ranks.get(kind) ?? Number.MAX_SAFE_INTEGER;
    // Ties keep the earliest candidate, matching the previous stable ordering.
    if (bestCandidate && !(rank < bestRank || (rank === bestRank && distanceSquared < bestDistanceSquared))) continue;
    bestCandidate = legacy ? { ...source, kind } : (source as SnapCandidate);
    bestRank = rank;
    bestDistanceSquared = distanceSquared;
  }

  if (bestCandidate) {
    return {
      point: { x: bestCandidate.x, y: bestCandidate.y },
      kind: bestCandidate.kind,
      distancePixels: Math.sqrt(bestDistanceSquared) * pixelsPerUnit,
      candidate: bestCandidate,
    };
  }

  if (!isModeEnabled('grid', options.modes)) {
    return { point: { ...point }, kind: 'none', distancePixels: 0 };
  }
  const grid = Number.isFinite(options.gridSize) && options.gridSize > 0 ? options.gridSize : 1;
  const gridPoint = { x: Math.round(point.x / grid) * grid, y: Math.round(point.y / grid) * grid };
  return {
    point: gridPoint,
    kind: 'grid',
    distancePixels: Math.sqrt(squaredDistance(point, gridPoint)) * pixelsPerUnit,
  };
};
