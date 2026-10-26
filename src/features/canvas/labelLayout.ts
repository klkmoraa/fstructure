import type { CanvasSafeRect } from './canvasChromeGeometry';

export type SmartLabelPriority = 0 | 1 | 2 | 3;
/**
 * Los tres primeros tonos de carga nombran la FAMILIA de lo que se aplica, no
 * la señal del resultado que comparte su tono. `force` y `moment` seguían
 * pintando la etiqueta de una distribuida con el azul de la puntual y la de un
 * momento aplicado con el rojo del momento flector, de modo que el número no
 * decía de qué carga era y contradecía al símbolo que anotaba.
 */
export type SmartLabelTone =
  | 'load-point' | 'load-distributed' | 'load-moment'
  | 'neutral' | 'selection' | 'force' | 'shear' | 'moment' | 'dimension' | 'axial' | 'axial-tension' | 'axial-compression' | 'reaction';

export interface SmartLabelCandidate {
  id: string;
  text: string;
  anchor: { x: number; y: number };
  priority: SmartLabelPriority;
  tone?: SmartLabelTone;
  preferredOffset?: { x: number; y: number };
  minScale?: number;
  forceVisible?: boolean;
}

interface SmartLabelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SmartLabelPoint {
  x: number;
  y: number;
}

/**
 * Trazo que ninguna etiqueta puede tapar: una barra, la curva de un diagrama,
 * la flecha de una reacción. Es una polilínea en píxeles de pantalla con un
 * margen: medio grosor del trazo más el aire que debe quedar entre el trazo y
 * la caja de la etiqueta.
 */
export interface SmartLabelObstacle {
  points: readonly SmartLabelPoint[];
  clearance: number;
}

interface PlacedSmartLabel extends SmartLabelCandidate {
  rect: SmartLabelRect;
  leader: boolean;
}

type SmartLabelDetail = 'essential' | 'standard' | 'detailed';

const LABEL_HEIGHT = 22;
const LABEL_GAP = 8;
/** Separación entre el ancla y la caja a partir de la cual la etiqueta lleva guía. */
const LEADER_GAP = 16;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const smartLabelDetailForScale = (scale: number): SmartLabelDetail => {
  if (scale < 52) return 'essential';
  if (scale < 90) return 'standard';
  return 'detailed';
};

const defaultMinimumScale = (priority: SmartLabelPriority): number => {
  if (priority <= 1) return 0;
  if (priority === 2) return 52;
  return 90;
};

/** Huella estimada de la caja de una etiqueta, en píxeles. */
const smartLabelSize = (text: string) => ({ width: Math.max(34, text.length * 6.5 + 18), height: LABEL_HEIGHT });

const estimatedWidth = (text: string, availableWidth: number): number =>
  Math.min(availableWidth, smartLabelSize(text).width);

/**
 * Desplazamiento del centro de una caja de `size` para que quede del lado
 * `direction` de su ancla con su borde a `gap` píxeles de ella: una caja de
 * cien píxeles de ancho tiene que apartarse más hacia un lado que hacia arriba.
 */
const offsetToward = (size: { width: number; height: number }, direction: SmartLabelPoint, gap: number): SmartLabelPoint => {
  const length = Math.hypot(direction.x, direction.y);
  if (length < 1e-9) return { x: 0, y: -(gap + size.height / 2) };
  const ux = direction.x / length;
  const uy = direction.y / length;
  const reach = gap + Math.min(
    Math.abs(ux) > 1e-9 ? size.width / 2 / Math.abs(ux) : Infinity,
    Math.abs(uy) > 1e-9 ? size.height / 2 / Math.abs(uy) : Infinity,
  );
  return { x: ux * reach, y: uy * reach };
};

/**
 * Desplazamiento preferido para que la etiqueta con `text` quede del lado
 * `direction` de su ancla y a `gap` píxeles de ella: la cifra de un extremo se
 * pone fuera del diagrama, junto a la curva y sin tocarla.
 */
export const smartLabelOffsetToward = (text: string, direction: SmartLabelPoint, gap: number): SmartLabelPoint =>
  offsetToward(smartLabelSize(text), direction, gap);

const rectAt = (
  candidate: SmartLabelCandidate,
  offset: { x: number; y: number },
  bounds: CanvasSafeRect,
): SmartLabelRect => {
  const width = estimatedWidth(candidate.text, bounds.width);
  const height = Math.min(LABEL_HEIGHT, bounds.height);
  const desiredX = candidate.anchor.x + offset.x - width / 2;
  const desiredY = candidate.anchor.y + offset.y - height / 2;
  return {
    x: clamp(desiredX, bounds.x, bounds.x + bounds.width - width),
    y: clamp(desiredY, bounds.y, bounds.y + bounds.height - height),
    width,
    height,
  };
};

export const smartLabelRectsOverlap = (
  first: SmartLabelRect,
  second: SmartLabelRect,
  gap = LABEL_GAP,
): boolean => !(
  first.x + first.width + gap <= second.x
  || second.x + second.width + gap <= first.x
  || first.y + first.height + gap <= second.y
  || second.y + second.height + gap <= first.y
);

/** Separaciones, en px, de los anillos de posiciones alrededor del ancla. */
const RING_GAPS = [4, 14, 28, 46, 70, 100, 140, 190] as const;
const RING_DIRECTIONS = 16;
/** Giros dentro de un anillo, del más cercano a la dirección preferida al más lejano: 0, +1, −1, +2, −2… */
const RING_TURNS = Array.from({ length: RING_DIRECTIONS }, (_, index) => (index % 2 === 0 ? -1 : 1) * Math.ceil(index / 2));

/**
 * Posiciones que se prueban, de la más cercana a la más lejana: la preferida y
 * sus tres reflejos, y después anillos alrededor del ancla en los que es el
 * BORDE de la caja, no su centro, el que queda a la misma distancia del ancla.
 * Dentro de cada anillo se empieza por la dirección preferida.
 */
const candidateOffsets = (preferred: SmartLabelPoint, size: { width: number; height: number }): SmartLabelPoint[] => {
  const offsets = [
    preferred,
    { x: -preferred.x, y: preferred.y },
    { x: preferred.x, y: -preferred.y },
    { x: -preferred.x, y: -preferred.y },
  ];
  const start = Math.hypot(preferred.x, preferred.y) > 1e-6 ? Math.atan2(preferred.y, preferred.x) : -Math.PI / 2;
  for (const gap of RING_GAPS) {
    for (const turn of RING_TURNS) {
      const angle = start + (turn * 2 * Math.PI) / RING_DIRECTIONS;
      offsets.push(offsetToward(size, { x: Math.cos(angle), y: Math.sin(angle) }, gap));
    }
  }
  return offsets;
};

const rectCenter = (rect: SmartLabelRect) => ({
  x: rect.x + rect.width / 2,
  y: rect.y + rect.height / 2,
});

/** Radio dentro del cual dos etiquetas idénticas describen el mismo punto. */
const DUPLICATE_RADIUS = 16;

/** Distancia de un punto a una caja; cero si cae dentro. */
const pointRectDistance = (point: SmartLabelPoint, rect: SmartLabelRect): number => Math.hypot(
  Math.max(rect.x - point.x, 0, point.x - rect.x - rect.width),
  Math.max(rect.y - point.y, 0, point.y - rect.y - rect.height),
);

const pointSegmentDistance = (point: SmartLabelPoint, a: SmartLabelPoint, b: SmartLabelPoint): number => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared > 0 ? clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared, 0, 1) : 0;
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
};

/** Recorte de Liang–Barsky: ¿algún tramo del segmento cae dentro de la caja? */
const segmentCrossesRect = (a: SmartLabelPoint, b: SmartLabelPoint, rect: SmartLabelRect): boolean => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let enter = 0;
  let exit = 1;
  for (const [p, q] of [[-dx, a.x - rect.x], [dx, rect.x + rect.width - a.x], [-dy, a.y - rect.y], [dy, rect.y + rect.height - a.y]]) {
    if (Math.abs(p) < 1e-12) {
      if (q < 0) return false;
      continue;
    }
    const t = q / p;
    if (p < 0) enter = Math.max(enter, t);
    else exit = Math.min(exit, t);
    if (enter > exit) return false;
  }
  return true;
};

/**
 * Distancia mínima, en píxeles, entre la caja de una etiqueta y un segmento;
 * cero cuando se cruzan. Entre dos convexos que no se tocan, la distancia
 * mínima la da un vértice de uno de los dos.
 */
export const smartLabelRectSegmentDistance = (rect: SmartLabelRect, a: SmartLabelPoint, b: SmartLabelPoint): number => {
  if (segmentCrossesRect(a, b, rect)) return 0;
  const corners = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x, y: rect.y + rect.height },
    { x: rect.x + rect.width, y: rect.y + rect.height },
  ];
  return Math.min(
    pointRectDistance(a, rect),
    pointRectDistance(b, rect),
    ...corners.map((corner) => pointSegmentDistance(corner, a, b)),
  );
};

/** ¿La caja invade el margen de la polilínea? */
export const smartLabelRectHitsObstacle = (rect: SmartLabelRect, obstacle: SmartLabelObstacle): boolean => {
  for (let index = 1; index < obstacle.points.length; index += 1) {
    if (smartLabelRectSegmentDistance(rect, obstacle.points[index - 1], obstacle.points[index]) < obstacle.clearance) return true;
  }
  return false;
};

interface IndexedSegment {
  a: SmartLabelPoint;
  b: SmartLabelPoint;
  clearance: number;
  /** Caja del segmento ya ensanchada por su margen. */
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const OBSTACLE_CELL = 64;

/**
 * Rejilla de los tramos de obstáculo que caen en el área segura. La
 * disposición se rehace en cada paneo y en cada zoom, y un modelo grande con
 * su diagrama suma miles de tramos: cada caja candidata sólo se compara con
 * los tramos de sus celdas.
 */
const obstacleIndex = (obstacles: readonly SmartLabelObstacle[], bounds: CanvasSafeRect) => {
  const cells = new Map<string, IndexedSegment[]>();
  const cellRange = (min: number, max: number, origin: number, extent: number) => [
    Math.floor((clamp(min, origin, origin + extent) - origin) / OBSTACLE_CELL),
    Math.floor((clamp(max, origin, origin + extent) - origin) / OBSTACLE_CELL),
  ] as const;
  for (const obstacle of obstacles) {
    for (let index = 1; index < obstacle.points.length; index += 1) {
      const a = obstacle.points[index - 1];
      const b = obstacle.points[index];
      if (![a.x, a.y, b.x, b.y].every(Number.isFinite)) continue;
      const segment: IndexedSegment = {
        a,
        b,
        clearance: obstacle.clearance,
        minX: Math.min(a.x, b.x) - obstacle.clearance,
        maxX: Math.max(a.x, b.x) + obstacle.clearance,
        minY: Math.min(a.y, b.y) - obstacle.clearance,
        maxY: Math.max(a.y, b.y) + obstacle.clearance,
      };
      if (segment.maxX < bounds.x || segment.minX > bounds.x + bounds.width
        || segment.maxY < bounds.y || segment.minY > bounds.y + bounds.height) continue;
      const [fromX, toX] = cellRange(segment.minX, segment.maxX, bounds.x, bounds.width);
      const [fromY, toY] = cellRange(segment.minY, segment.maxY, bounds.y, bounds.height);
      for (let cellX = fromX; cellX <= toX; cellX += 1) {
        for (let cellY = fromY; cellY <= toY; cellY += 1) {
          const key = `${cellX}:${cellY}`;
          const bucket = cells.get(key);
          if (bucket) bucket.push(segment);
          else cells.set(key, [segment]);
        }
      }
    }
  }
  return (rect: SmartLabelRect): boolean => {
    if (!cells.size) return false;
    const [fromX, toX] = cellRange(rect.x, rect.x + rect.width, bounds.x, bounds.width);
    const [fromY, toY] = cellRange(rect.y, rect.y + rect.height, bounds.y, bounds.height);
    const seen = new Set<IndexedSegment>();
    for (let cellX = fromX; cellX <= toX; cellX += 1) {
      for (let cellY = fromY; cellY <= toY; cellY += 1) {
        for (const segment of cells.get(`${cellX}:${cellY}`) ?? []) {
          if (seen.has(segment)) continue;
          seen.add(segment);
          if (segment.maxX < rect.x || segment.minX > rect.x + rect.width
            || segment.maxY < rect.y || segment.minY > rect.y + rect.height) continue;
          if (smartLabelRectSegmentDistance(rect, segment.a, segment.b) < segment.clearance) return true;
        }
      }
    }
    return false;
  };
};

/** Área compartida por dos rectángulos, en píxeles cuadrados. */
const overlapArea = (first: SmartLabelRect, second: SmartLabelRect): number => {
  const width = Math.min(first.x + first.width, second.x + second.width) - Math.max(first.x, second.x);
  const height = Math.min(first.y + first.height, second.y + second.height) - Math.max(first.y, second.y);
  return width > 0 && height > 0 ? width * height : 0;
};

/**
 * Deterministic, presentation-only label placement. P0/P1 labels are mandatory;
 * P2/P3 labels yield when the safe canvas area is already occupied.
 *
 * Tres reglas sostienen la legibilidad cuando el modelo se llena:
 *
 * 1. **Un valor, una etiqueta.** El nudo de un pórtico pertenece a dos barras,
 *    así que el mismo momento se pedía dos veces desde el mismo punto y se
 *    dibujaba dos veces encima. Un candidato con el mismo texto y el mismo
 *    ancla que uno ya colocado no aporta información: se descarta.
 *
 * 2. **Lo obligatorio se aparta, no se apila.** Una etiqueta que no puede
 *    ceder —un máximo, una reacción— caía en su posición preferida aunque
 *    estuviera ocupada. Ahora, cuando ninguna posición está libre, se queda en
 *    la que menos superficie comparte: sigue siendo determinista y deja de
 *    tapar exactamente la cifra que compite con ella.
 *
 * 3. **Ninguna cifra encima de un trazo.** El repartidor sólo veía otras
 *    etiquetas: la reacción caía sobre la curva del momento y el «N máx» de
 *    una armadura cruzaba las barras vecinas. Las barras, las curvas de los
 *    diagramas y las flechas de reacción entran como `obstacles`, y una
 *    posición que invade su margen se descarta. Si no queda ninguna libre,
 *    una etiqueta obligatoria busca también fuera de los anillos locales. Si
 *    el área segura está agotada, prefiere compartir sitio con otra etiqueta antes
 *    que tapar un trazo, y la que se aleja de su ancla lleva guía.
 */
export const layoutSmartLabels = (
  candidates: SmartLabelCandidate[],
  bounds: CanvasSafeRect,
  scale: number,
  /**
   * Cajas que ya ocupan el lienzo y que esta capa no dibuja —los sellos de
   * extremo del diagrama—. Sin ellas, la etiqueta y el sello se colocaban cada
   * uno por su cuenta y se tapaban sobre el pico.
   */
  reserved: readonly SmartLabelRect[] = [],
  /** Trazos del dibujo que ninguna etiqueta puede tapar (regla 3). */
  obstacles: readonly SmartLabelObstacle[] = [],
): PlacedSmartLabel[] => {
  const ordered = [...candidates]
    .filter((candidate) => candidate.text.trim().length > 0)
    .filter((candidate) => candidate.forceVisible || scale >= (candidate.minScale ?? defaultMinimumScale(candidate.priority)))
    .sort((first, second) => first.priority - second.priority || first.id.localeCompare(second.id));
  const placed: PlacedSmartLabel[] = [];
  const blocked = obstacleIndex(obstacles, bounds);
  const exhaustedFallbackSizes = new Set<string>();
  let reservedEdgeBudget = 64;
  const occupied = (rect: SmartLabelRect): SmartLabelRect[] => [
    ...reserved.filter((other) => smartLabelRectsOverlap(rect, other)),
    ...placed.filter((label) => smartLabelRectsOverlap(rect, label.rect)).map((label) => label.rect),
  ];

  for (const candidate of ordered) {
    const duplicate = placed.some((label) => label.text === candidate.text
      && Math.hypot(label.anchor.x - candidate.anchor.x, label.anchor.y - candidate.anchor.y) <= DUPLICATE_RADIUS);
    if (duplicate) continue;

    const preferred = candidate.preferredOffset ?? { x: 18, y: -18 };
    const preferredCenter = {
      x: candidate.anchor.x + preferred.x,
      y: candidate.anchor.y + preferred.y,
    };
    const size = { width: estimatedWidth(candidate.text, bounds.width), height: Math.min(LABEL_HEIGHT, bounds.height) };
    let selectedRect: SmartLabelRect | null = null;
    let leastCrowded: { rect: SmartLabelRect; area: number } | null = null;
    let nearestBlocked: SmartLabelRect | null = null;
    for (const offset of candidateOffsets(preferred, size)) {
      const rect = rectAt(candidate, offset, bounds);
      if (blocked(rect)) {
        nearestBlocked ??= rect;
        continue;
      }
      const collisions = occupied(rect);
      if (collisions.length === 0) {
        selectedRect = rect;
        break;
      }
      const area = collisions.reduce((total, other) => total + overlapArea(rect, other), 0);
      if (!leastCrowded || area < leastCrowded.area) leastCrowded = { rect, area };
    }

    if (!selectedRect) {
      if (candidate.priority >= 2 && !candidate.forceVisible) continue;
      // En horizontal puede quedar sitio al otro lado del lienzo, fuera de los
      // anillos locales. Antes de apilar una cifra obligatoria, busca un hueco
      // en el área segura; las mismas exclusiones siguen protegiendo el dibujo.
      const occupiedRects = [...reserved, ...placed.map((label) => label.rect)];
      const maxX = bounds.x + bounds.width - size.width;
      const maxY = bounds.y + bounds.height - size.height;
      // Un hueco junto a los ejes o al radar puede ser más estrecho que un
      // paso de rejilla. Como máximo 64 intentos entre TODAS las etiquetas.
      reservedEdges: for (const reservation of reserved) {
        for (const x of [reservation.x + reservation.width + LABEL_GAP, reservation.x - size.width - LABEL_GAP]) {
          for (const other of occupiedRects) {
            for (const y of [other.y + other.height + LABEL_GAP, other.y - size.height - LABEL_GAP]) {
              if (reservedEdgeBudget === 0) break reservedEdges;
              reservedEdgeBudget -= 1;
              if (x < bounds.x || x > maxX || y < bounds.y || y > maxY) continue;
              const rect = { x, y, ...size };
              if (occupiedRects.some((otherRect) => smartLabelRectsOverlap(rect, otherRect)) || blocked(rect)) continue;
              selectedRect = rect;
              break reservedEdges;
            }
          }
        }
      }
      const sizeKey = `${size.width}:${size.height}`;
      // Lo ya colocado sólo aumenta: si esta rejilla no tenía hueco para una
      // caja del mismo tamaño, repetirla para la siguiente no puede liberarlo.
      if (!selectedRect && !exhaustedFallbackSizes.has(sizeKey)) {
        // A lo sumo 25 × 17 posiciones, sólo si fallaron los anillos locales.
        const stepX = Math.max((size.width + LABEL_GAP) / 2, bounds.width / 24);
        const stepY = Math.max(size.height + LABEL_GAP, bounds.height / 16);
        let nearestFreeDistance = Infinity;
        for (let y = bounds.y; y <= maxY; y += stepY) {
          for (let x = bounds.x; x <= maxX; x += stepX) {
            const rect = { x, y, ...size };
            if (occupiedRects.some((other) => smartLabelRectsOverlap(rect, other)) || blocked(rect)) continue;
            const center = rectCenter(rect);
            const distance = Math.hypot(center.x - preferredCenter.x, center.y - preferredCenter.y);
            if (distance < nearestFreeDistance) {
              selectedRect = rect;
              nearestFreeDistance = distance;
            }
          }
        }
        if (!selectedRect) exhaustedFallbackSizes.add(sizeKey);
      }
      selectedRect ??= leastCrowded?.rect ?? nearestBlocked ?? rectAt(candidate, preferred, bounds);
    }

    const center = rectCenter(selectedRect);
    // La que se aparta pero sigue junto a su ancla no necesita guía; la guía
    // es para la que tuvo que alejarse.
    const leader = Math.hypot(center.x - preferredCenter.x, center.y - preferredCenter.y) > 12
      && pointRectDistance(candidate.anchor, selectedRect) > LEADER_GAP;
    placed.push({ ...candidate, rect: selectedRect, leader });
  }

  return placed;
};
