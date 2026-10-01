/**
 * Experimental one-direction reinforced-concrete section laboratory.
 * Units: mm, N/mm², kN, kN·m. Compression and moment compressing +q are positive.
 * The material models are intentionally explicit, not a claim of compliance:
 * FHWA strain compatibility / rectangular block: https://www.fhwa.dot.gov/bridge/pubs/nhi15047.pdf
 * JRC partial-factor introduction: https://eurocodes.jrc.ec.europa.eu/sites/default/files/2021-12/handbook2.pdf
 */
import { betaOne } from './ntcConcrete2023';

export interface PointMm { x: number; y: number }
export type SectionStudioShape = 'square' | 'rectangle' | 'circle' | 'octagon' | 'hexagon' | 'triangle';
export type SectionStudioPhilosophy = 'allowable' | 'ultimate' | 'limit-state';
export interface SectionStudioInput {
  shape: SectionStudioShape;
  widthMm: number;
  heightMm: number;
  coverMm: number;
  fcMpa: number;
  fyMpa: number;
  barDiameterMm: number;
  barCount: number;
  barLayout?: 'perimeter' | 'layers';
  topBarCount?: number;
  bottomBarCount?: number;
  tieDiameterMm: number;
  tieSpacingMm: number;
  tieType: 'closed' | 'cross-tie' | 'spiral';
  lengthM: number;
  axialKn: number;
  momentKnm: number;
  shearKn: number;
  angleDeg: number;
  philosophy: SectionStudioPhilosophy;
  phi: number;
  gammaConcrete: number;
  gammaSteel: number;
  allowableConcreteRatio: number;
  allowableSteelRatio: number;
}
export interface SectionStudioInteractionPoint {
  axialKn: number;
  momentKnm: number;
  orthogonalMomentKnm: number;
  neutralAxisDepthMm: number | null;
  extremeCompressionStrain: number;
  steelMaxTensionStrain: number;
  strainAtCentroid: number;
  curvaturePerMm: number;
  compressionSide: -1 | 0 | 1;
}
export interface SectionStudioDetailCheck {
  id: string;
  label: string;
  status: 'ok' | 'warning';
  value: number | null;
  limit: number | null;
  description: string;
}
export interface SectionStudioSuccess {
  status: 'ok';
  directionalOnly: boolean;
  input: SectionStudioInput;
  geometry: {
    vertices: PointMm[];
    bars: PointMm[];
    tieVertices: PointMm[];
    tieCrossLines: PointMm[][];
    areaMm2: number;
    inertiaXmm4: number;
    inertiaYmm4: number;
    inertiaXYmm4: number;
    widthMm: number;
    heightMm: number;
    circleRadiusMm: number | null;
  };
  interaction: SectionStudioInteractionPoint[];
  demand: { axialKn: number; momentKnm: number; shearKn: number };
  capacity: {
    axialCompressionKn: number;
    axialTensionKn: number;
    positiveMomentKnm: number;
    negativeMomentKnm: number;
    loadFactor: number | null;
    point: SectionStudioInteractionPoint | null;
  };
  utilization: number;
  analysis: {
    compressionPolygon: PointMm[];
    neutralAxis: PointMm[];
    strainProfile: { depthMm: number; strain: number }[];
    maxConcreteStressMpa: number;
    minConcreteStressMpa: number;
    maxSteelStressMpa: number;
    neutralAxisDepthMm: number | null;
    equilibriumAxialKn: number;
    equilibriumMomentKnm: number;
    orthogonalMomentKnm: number;
    strainAtCentroid: number;
    curvaturePerMm: number;
    model: string;
  };
  reinforcement: {
    barCount: number;
    steelAreaMm2: number;
    ratioPercent: number;
    minClearSpacingMm: number;
    requiredClearSpacingMm: number;
  };
  quantities: {
    concreteM3: number;
    netConcreteM3: number;
    longitudinalSteelKg: number;
    tieSteelKg: number;
    totalSteelKg: number;
    tieCount: number;
    tieLengthM: number;
    totalTieLengthM: number;
  };
  detailing: {
    checks: SectionStudioDetailCheck[];
    proposedTieSpacingMm: number;
    providedTieSpacingMm: number;
  };
  effective: { fcMpa: number; fyMpa: number; resistanceFactor: number };
  limitations: string[];
  assumptions: string[];
  sources: { title: string; url: string }[];
}
export type SectionStudioResult = SectionStudioSuccess | { status: 'invalid'; errors: string[] };
export type SectionStudioProposal =
  | { status: 'proposed'; input: SectionStudioInput; result: SectionStudioSuccess; checkedCandidates: number }
  | { status: 'no-solution'; reason: string; checkedCandidates: number };

const ES = 200_000;
const EPS_CU = 0.003;
const DENSITY_STEEL_KG_M3 = 7850;
const PI = Math.PI;
const SHAPES: SectionStudioShape[] = ['square', 'rectangle', 'circle', 'octagon', 'hexagon', 'triangle'];
const PHILOSOPHIES: SectionStudioPhilosophy[] = ['allowable', 'ultimate', 'limit-state'];
interface Moments { area: number; sx: number; sy: number; ix: number; iy: number; ixy: number }
interface ProjectedMoments { area: number; first: number; second: number; firstOrthogonal: number; mixed: number }
interface Section {
  vertices: PointMm[];
  bars: PointMm[];
  tieVertices: PointMm[];
  crossLines: PointMm[][];
  moments: Moments;
  radius: number | null;
  barRadius: number;
  barArea: number;
  sin: number;
  cos: number;
  qMin: number;
  qMax: number;
  width: number;
  height: number;
}
interface ElasticState { axialN: number; momentNmm: number; orthogonalMomentNmm: number; k00: number; k01: number; k11: number }

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const cross = (a: PointMm, b: PointMm) => a.x * b.y - a.y * b.x;
const projection = (point: PointMm, section: Section) => point.x * section.sin + point.y * section.cos;
const orthogonalProjection = (point: PointMm, section: Section) => point.x * section.cos - point.y * section.sin;

function polygonMoments(vertices: PointMm[]): Moments {
  let twiceArea = 0; let sx = 0; let sy = 0; let ix = 0; let iy = 0; let ixy = 0;
  for (let i = 0; i < vertices.length; i += 1) {
    const a = vertices[i]; const b = vertices[(i + 1) % vertices.length];
    const z = cross(a, b);
    twiceArea += z;
    sx += (a.x + b.x) * z; sy += (a.y + b.y) * z;
    ix += (a.y ** 2 + a.y * b.y + b.y ** 2) * z;
    iy += (a.x ** 2 + a.x * b.x + b.x ** 2) * z;
    ixy += (2 * a.x * a.y + a.x * b.y + b.x * a.y + 2 * b.x * b.y) * z;
  }
  return { area: twiceArea / 2, sx: sx / 6, sy: sy / 6, ix: ix / 12, iy: iy / 12, ixy: ixy / 24 };
}

/** Convex half-plane clipping; projection >= threshold. */
function clip(vertices: PointMm[], nx: number, ny: number, threshold: number): PointMm[] {
  if (vertices.length === 0) return [];
  const result: PointMm[] = [];
  for (let i = 0; i < vertices.length; i += 1) {
    const a = vertices[i]; const b = vertices[(i + 1) % vertices.length];
    const da = a.x * nx + a.y * ny - threshold;
    const db = b.x * nx + b.y * ny - threshold;
    if (da >= -1e-9) result.push(a);
    if ((da < -1e-9 && db >= -1e-9) || (da >= -1e-9 && db < -1e-9)) {
      const t = da / (da - db);
      result.push({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
    }
  }
  return result;
}

function inset(vertices: PointMm[], distance: number): PointMm[] {
  let result = vertices;
  for (let i = 0; i < vertices.length; i += 1) {
    const a = vertices[i]; const b = vertices[(i + 1) % vertices.length];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const nx = -(b.y - a.y) / length; const ny = (b.x - a.x) / length;
    result = clip(result, nx, ny, a.x * nx + a.y * ny + distance);
  }
  return result;
}

function circleVertices(radius: number, count = 96): PointMm[] {
  return Array.from({ length: count }, (_, i) => ({ x: radius * Math.cos(2 * PI * i / count), y: radius * Math.sin(2 * PI * i / count) }));
}

function perimeter(vertices: PointMm[]): number {
  return vertices.reduce((sum, a, i) => {
    const b = vertices[(i + 1) % vertices.length];
    return sum + Math.hypot(b.x - a.x, b.y - a.y);
  }, 0);
}

function distribute(vertices: PointMm[], count: number): PointMm[] {
  // At vertex-count multiples, retain every corner and subdivide each face equally.
  // This preserves the principal-axis symmetry of triangle/rectangle/regular polygon cages.
  if (count % vertices.length === 0) {
    const perFace = count / vertices.length;
    return vertices.flatMap((a, edge) => {
      const b = vertices[(edge + 1) % vertices.length];
      return Array.from({ length: perFace }, (_, i) => ({ x: a.x + (b.x - a.x) * i / perFace, y: a.y + (b.y - a.y) * i / perFace }));
    });
  }
  const lengths = vertices.map((a, i) => {
    const b = vertices[(i + 1) % vertices.length];
    return Math.hypot(b.x - a.x, b.y - a.y);
  });
  const total = lengths.reduce((sum, length) => sum + length, 0);
  return Array.from({ length: count }, (_, index) => {
    let remaining = index * total / count;
    let edge = 0;
    while (edge < lengths.length - 1 && remaining > lengths[edge]) {
      remaining -= lengths[edge]; edge += 1;
    }
    const a = vertices[edge]; const b = vertices[(edge + 1) % vertices.length];
    const fraction = remaining / lengths[edge];
    return { x: a.x + (b.x - a.x) * fraction, y: a.y + (b.y - a.y) * fraction };
  });
}

function lineAcross(vertices: PointMm[], nx: number, ny: number, value: number): PointMm[] {
  const points: PointMm[] = [];
  for (let i = 0; i < vertices.length; i += 1) {
    const a = vertices[i]; const b = vertices[(i + 1) % vertices.length];
    const da = a.x * nx + a.y * ny - value; const db = b.x * nx + b.y * ny - value;
    if (Math.abs(da) < 1e-7) points.push(a);
    if (da * db < 0) {
      const t = da / (da - db);
      points.push({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
    }
  }
  const unique = points.filter((point, index) => !points.slice(0, index).some((other) => Math.hypot(point.x - other.x, point.y - other.y) < 1e-6));
  if (unique.length < 2) return [];
  let pair = [unique[0], unique[1]]; let longest = 0;
  for (const a of unique) for (const b of unique) {
    const distance = Math.hypot(a.x - b.x, a.y - b.y);
    if (distance > longest) { longest = distance; pair = [a, b]; }
  }
  return pair;
}

function validate(input: SectionStudioInput): string[] {
  const errors: string[] = [];
  if (!SHAPES.includes(input.shape)) errors.push('Forma de sección desconocida.');
  if (!PHILOSOPHIES.includes(input.philosophy)) errors.push('Filosofía de diseño desconocida.');
  if (!['closed', 'cross-tie', 'spiral'].includes(input.tieType)) errors.push('Tipo de estribo desconocido.');
  if (input.barLayout !== undefined && !['perimeter', 'layers'].includes(input.barLayout)) errors.push('Distribución de barras desconocida.');
  const positiveKeys = ['widthMm', 'heightMm', 'fcMpa', 'fyMpa', 'barDiameterMm', 'tieDiameterMm', 'tieSpacingMm', 'lengthM', 'phi', 'gammaConcrete', 'gammaSteel', 'allowableConcreteRatio', 'allowableSteelRatio'] as const;
  for (const key of positiveKeys) if (!Number.isFinite(input[key]) || input[key] <= 0) errors.push(`${key}: debe ser un número finito mayor que cero.`);
  for (const key of ['coverMm', 'axialKn', 'momentKnm', 'shearKn', 'angleDeg'] as const) if (!Number.isFinite(input[key])) errors.push(`${key}: debe ser un número finito.`);
  if (input.coverMm < 0) errors.push('El recubrimiento no puede ser negativo.');
  if (input.phi > 1) errors.push('φ debe estar entre cero y uno.');
  if (input.gammaConcrete < 1 || input.gammaSteel < 1) errors.push('Los factores parciales γc y γs deben ser mayores o iguales a uno.');
  if (input.allowableConcreteRatio > 1 || input.allowableSteelRatio > 1) errors.push('Las fracciones admisibles deben estar entre cero y uno.');
  if (!Number.isInteger(input.barCount) || input.barCount < 2 || input.barCount > 120) errors.push('El número de barras debe ser entero entre 2 y 120.');
  if (input.widthMm > 100_000 || input.heightMm > 100_000 || input.lengthM > 1000 || input.fcMpa > 500 || input.fyMpa > 2000 || input.barDiameterMm > 200 || input.tieDiameterMm > 100) errors.push('Las dimensiones o materiales exceden el dominio acotado del laboratorio.');
  if (input.tieSpacingMm < input.tieDiameterMm) errors.push('El paso de estribos no puede ser menor que su diámetro: se solaparían.');
  if (input.tieType === 'spiral' && input.shape !== 'circle') errors.push('La espiral se ofrece sólo para secciones circulares.');
  if (input.barLayout === 'layers') {
    if (input.shape !== 'square' && input.shape !== 'rectangle') errors.push('Los lechos rectos se ofrecen sólo para secciones cuadradas o rectangulares.');
    const top = input.topBarCount ?? Math.floor(input.barCount / 2);
    const bottom = input.bottomBarCount ?? input.barCount - top;
    if (!Number.isInteger(top) || !Number.isInteger(bottom) || top < 0 || bottom < 0 || top + bottom < 2 || top + bottom > 120) errors.push('Los lechos requieren conteos enteros no negativos y un total de 2 a 120 barras.');
  }
  return errors;
}

function buildSection(input: SectionStudioInput): Section | string {
  const width = input.widthMm;
  const height = input.shape === 'square' || input.shape === 'circle' ? width : input.heightMm;
  const radius = input.shape === 'circle' ? width / 2 : null;
  let vertices: PointMm[];
  if (radius !== null) vertices = circleVertices(radius);
  else if (input.shape === 'triangle') vertices = [{ x: -width / 2, y: -height / 3 }, { x: width / 2, y: -height / 3 }, { x: 0, y: 2 * height / 3 }];
  else if (input.shape === 'square' || input.shape === 'rectangle') vertices = [{ x: -width / 2, y: -height / 2 }, { x: width / 2, y: -height / 2 }, { x: width / 2, y: height / 2 }, { x: -width / 2, y: height / 2 }];
  else {
    const count = input.shape === 'octagon' ? 8 : 6;
    const rotation = input.shape === 'octagon' ? PI / 8 : 0;
    const unit = Array.from({ length: count }, (_, i) => ({ x: Math.cos(rotation + 2 * PI * i / count), y: Math.sin(rotation + 2 * PI * i / count) }));
    const maxX = Math.max(...unit.map((p) => Math.abs(p.x))); const maxY = Math.max(...unit.map((p) => Math.abs(p.y)));
    vertices = unit.map((p) => ({ x: width * p.x / (2 * maxX), y: height * p.y / (2 * maxY) }));
  }
  const barOffset = input.coverMm + input.tieDiameterMm + input.barDiameterMm / 2;
  const tieOffset = input.coverMm + input.tieDiameterMm / 2;
  let bars: PointMm[]; let tieVertices: PointMm[];
  if (radius !== null) {
    const barRadius = radius - barOffset;
    if (barRadius <= 0) return 'Recubrimiento, estribo y barra no caben dentro del círculo.';
    bars = circleVertices(barRadius, input.barCount);
    tieVertices = circleVertices(radius - tieOffset);
  } else {
    const steelContour = inset(vertices, barOffset);
    tieVertices = inset(vertices, tieOffset);
    if (steelContour.length < 3 || polygonMoments(steelContour).area < 1 || tieVertices.length < 3) return 'Recubrimiento, estribo y barras no caben dentro de la sección.';
    if (input.barLayout === 'layers') {
      const top = input.topBarCount ?? Math.floor(input.barCount / 2);
      const bottom = input.bottomBarCount ?? input.barCount - top;
      const x = width / 2 - barOffset; const y = height / 2 - barOffset;
      const layer = (count: number, layerY: number) => Array.from({ length: count }, (_, i) => ({ x: count === 1 ? 0 : -x + 2 * x * i / (count - 1), y: layerY }));
      bars = [...layer(top, y), ...layer(bottom, -y)];
    } else bars = distribute(steelContour, input.barCount);
  }
  let minDistance = Infinity;
  for (let i = 0; i < bars.length; i += 1) for (let j = i + 1; j < bars.length; j += 1) minDistance = Math.min(minDistance, Math.hypot(bars[i].x - bars[j].x, bars[i].y - bars[j].y));
  if (minDistance < input.barDiameterMm - 1e-7) return 'Las barras se solapan: reduce su número/diámetro o aumenta la sección.';
  const moments = radius === null ? polygonMoments(vertices) : { area: PI * radius ** 2, sx: 0, sy: 0, ix: PI * radius ** 4 / 4, iy: PI * radius ** 4 / 4, ixy: 0 };
  const radians = input.angleDeg * PI / 180; const sin = Math.sin(radians); const cos = Math.cos(radians);
  const q = vertices.map((p) => p.x * sin + p.y * cos);
  const crossLines = input.tieType === 'cross-tie' ? [lineAcross(tieVertices, 1, 0, 0), lineAcross(tieVertices, 0, 1, 0)].filter((line) => line.length === 2) : [];
  return { vertices, bars, tieVertices, crossLines, moments, radius, barRadius: input.barDiameterMm / 2, barArea: PI * input.barDiameterMm ** 2 / 4, sin, cos, qMin: radius === null ? Math.min(...q) : -radius, qMax: radius === null ? Math.max(...q) : radius, width, height };
}

function projectMoments(moments: Moments, section: Section): ProjectedMoments {
  return {
    area: moments.area,
    first: moments.sx * section.sin + moments.sy * section.cos,
    second: moments.iy * section.sin ** 2 + moments.ix * section.cos ** 2 + 2 * moments.ixy * section.sin * section.cos,
    firstOrthogonal: moments.sx * section.cos - moments.sy * section.sin,
    mixed: (moments.iy - moments.ix) * section.sin * section.cos + moments.ixy * (section.cos ** 2 - section.sin ** 2),
  };
}

/** Exact A, ∫q dA, ∫q² dA of a circle above q=threshold (including partial bar disks). */
function circularSegment(radius: number, centerQ: number, threshold: number): ProjectedMoments {
  const u = threshold - centerQ;
  if (u >= radius) return { area: 0, first: 0, second: 0, firstOrthogonal: 0, mixed: 0 };
  if (u <= -radius) {
    const area = PI * radius ** 2;
    return { area, first: area * centerQ, second: area * centerQ ** 2 + PI * radius ** 4 / 4, firstOrthogonal: 0, mixed: 0 };
  }
  const root = Math.sqrt(Math.max(0, radius ** 2 - u ** 2));
  const angle = Math.acos(u / radius);
  const area = radius ** 2 * angle - u * root;
  const firstLocal = 2 * root ** 3 / 3;
  const secondLocal = (radius ** 4 * angle + u * root * (radius ** 2 - 2 * u ** 2)) / 4;
  return { area, first: centerQ * area + firstLocal, second: centerQ ** 2 * area + 2 * centerQ * firstLocal + secondLocal, firstOrthogonal: 0, mixed: 0 };
}

function compressionRegion(section: Section, threshold: number, side: 1 | -1): ProjectedMoments {
  if (section.radius !== null) {
    const value = circularSegment(section.radius, 0, threshold);
    return { area: value.area, first: side * value.first, second: value.second, firstOrthogonal: 0, mixed: 0 };
  }
  return projectMoments(polygonMoments(clip(section.vertices, side * section.sin, side * section.cos, threshold)), section);
}

function displacedRegion(section: Section, threshold: number, side: 1 | -1): ProjectedMoments {
  const total = { area: 0, first: 0, second: 0, firstOrthogonal: 0, mixed: 0 };
  for (const bar of section.bars) {
    const value = circularSegment(section.barRadius, side * projection(bar, section), threshold);
    total.area += value.area; total.first += side * value.first; total.second += value.second;
    const orthogonal = orthogonalProjection(bar, section);
    total.firstOrthogonal += orthogonal * value.area; total.mixed += orthogonal * side * value.first;
  }
  return total;
}

function elasticState(section: Section, ec: number, a: number, b: number): ElasticState {
  let concrete: ProjectedMoments;
  if (Math.abs(b) < 1e-20) concrete = a > 0 ? projectMoments(section.moments, section) : { area: 0, first: 0, second: 0, firstOrthogonal: 0, mixed: 0 };
  else concrete = compressionRegion(section, (b > 0 ? 1 : -1) * (-a / b), b > 0 ? 1 : -1);
  const displaced = Math.abs(b) < 1e-20
    ? a > 0 ? displacedRegion(section, -Infinity, 1) : { area: 0, first: 0, second: 0, firstOrthogonal: 0, mixed: 0 }
    : displacedRegion(section, (b > 0 ? 1 : -1) * (-a / b), b > 0 ? 1 : -1);
  const area = concrete.area - displaced.area;
  const first = concrete.first - displaced.first;
  const second = concrete.second - displaced.second;
  let k00 = ec * area; let k01 = ec * first; let k11 = ec * second;
  let orthogonalMomentNmm = ec * (a * (concrete.firstOrthogonal - displaced.firstOrthogonal) + b * (concrete.mixed - displaced.mixed));
  for (const bar of section.bars) {
    const q = projection(bar, section);
    k00 += ES * section.barArea;
    k01 += ES * section.barArea * q;
    k11 += ES * (section.barArea * q ** 2 + PI * section.barRadius ** 4 / 4);
    orthogonalMomentNmm += ES * section.barArea * orthogonalProjection(bar, section) * (a + b * q);
  }
  return { axialN: k00 * a + k01 * b, momentNmm: k01 * a + k11 * b, orthogonalMomentNmm, k00, k01, k11 };
}

function elasticStresses(section: Section, ec: number, a: number, b: number) {
  const concreteStrain = Math.max(0, a + b * section.qMax, a + b * section.qMin);
  let maxSteelStrain = 0; let maxTensionStrain = 0;
  for (const bar of section.bars) {
    const q = projection(bar, section);
    maxSteelStrain = Math.max(maxSteelStrain, Math.abs(a + b * (q - section.barRadius)), Math.abs(a + b * (q + section.barRadius)));
    maxTensionStrain = Math.max(maxTensionStrain, -(a + b * (q - section.barRadius)), -(a + b * (q + section.barRadius)));
  }
  return { concreteStrain, concreteStress: ec * concreteStrain, steelStress: ES * maxSteelStrain, maxTensionStrain };
}

function solveElastic(section: Section, ec: number, axialN: number, momentNmm: number): { a: number; b: number; state: ElasticState } | null {
  let a = 0; let b = 0;
  const initial = elasticState(section, ec, 1, 0);
  const determinant = initial.k00 * initial.k11 - initial.k01 ** 2;
  if (!(determinant > 0)) return null;
  a = (axialN * initial.k11 - momentNmm * initial.k01) / determinant;
  b = (momentNmm * initial.k00 - axialN * initial.k01) / determinant;
  const depth = section.qMax - section.qMin;
  const norm = (state: ElasticState) => Math.hypot(state.axialN - axialN, (state.momentNmm - momentNmm) / depth);
  const tolerance = 1e-9 * Math.max(1, Math.abs(axialN), Math.abs(momentNmm) / depth);
  for (let iteration = 0; iteration < 60; iteration += 1) {
    const state = elasticState(section, ec, a, b);
    const error = norm(state);
    if (error <= tolerance) return { a, b, state };
    const det = state.k00 * state.k11 - state.k01 ** 2;
    if (!(det > 0)) return null;
    const n = axialN - state.axialN; const m = momentNmm - state.momentNmm;
    const da = (n * state.k11 - m * state.k01) / det;
    const db = (m * state.k00 - n * state.k01) / det;
    let step = 1;
    while (step > 1 / 1024 && norm(elasticState(section, ec, a + step * da, b + step * db)) > error) step /= 2;
    a += step * da; b += step * db;
  }
  return null;
}

function makeInteractionPoint(section: Section, axialN: number, momentNmm: number, a: number, b: number, factor: number, orthogonalMomentNmm = 0): SectionStudioInteractionPoint {
  const side = b > 1e-20 ? 1 : b < -1e-20 ? -1 : 0;
  const compressionExtreme = side === -1 ? -section.qMin : section.qMax;
  return {
    axialKn: factor * axialN / 1000, momentKnm: factor * momentNmm / 1e6, orthogonalMomentKnm: factor * orthogonalMomentNmm / 1e6,
    neutralAxisDepthMm: side === 0 ? null : compressionExtreme + a / Math.abs(b),
    extremeCompressionStrain: Math.max(0, a + b * section.qMin, a + b * section.qMax),
    steelMaxTensionStrain: Math.max(0, ...section.bars.map((bar) => -(a + b * projection(bar, section)))),
    strainAtCentroid: a, curvaturePerMm: b, compressionSide: side,
  };
}

function strengthPoint(section: Section, fc: number, fy: number, factor: number, beta: number, c: number, side: 1 | -1): SectionStudioInteractionPoint {
  const extreme = side === 1 ? section.qMax : -section.qMin;
  const threshold = extreme - beta * c;
  const concrete = compressionRegion(section, threshold, side);
  const displaced = displacedRegion(section, threshold, side);
  const a = EPS_CU * (1 - extreme / c); const b = side * EPS_CU / c;
  let n = 0.85 * fc * (concrete.area - displaced.area);
  let m = 0.85 * fc * (concrete.first - displaced.first);
  let orthogonal = 0.85 * fc * (concrete.firstOrthogonal - displaced.firstOrthogonal);
  for (const bar of section.bars) {
    const q = projection(bar, section);
    const force = section.barArea * clamp(ES * (a + b * q), -fy, fy);
    n += force; m += force * q; orthogonal += force * orthogonalProjection(bar, section);
  }
  return makeInteractionPoint(section, n, m, a, b, factor, orthogonal);
}

function uniformPoint(section: Section, concreteStress: number, steelStress: number, strain: number, factor: number): SectionStudioInteractionPoint {
  const steelArea = section.barArea * section.bars.length;
  const steelFirst = section.bars.reduce((sum, bar) => sum + section.barArea * projection(bar, section), 0);
  const steelFirstOrthogonal = section.bars.reduce((sum, bar) => sum + section.barArea * orthogonalProjection(bar, section), 0);
  return makeInteractionPoint(section, concreteStress * (section.moments.area - steelArea) + steelStress * steelArea, (steelStress - concreteStress) * steelFirst, strain, 0, factor, (steelStress - concreteStress) * steelFirstOrthogonal);
}

function interaction(section: Section, input: SectionStudioInput, fc: number, fy: number, factor: number, ec: number): SectionStudioInteractionPoint[] {
  const depth = section.qMax - section.qMin;
  const samples = 140;
  // Dense coverage near the balanced state, with both signed compression faces.
  const depths = Array.from({ length: samples }, (_, i) => depth * 10 ** (-3 + 6 * i / (samples - 1)));
  const branch = (side: 1 | -1) => depths.map((c) => {
    if (input.philosophy !== 'allowable') return strengthPoint(section, fc, fy, factor, betaOne(input.fcMpa), c, side);
    const extreme = side === 1 ? section.qMax : -section.qMin;
    const rawA = 1 - extreme / c; const rawB = side / c;
    const stresses = elasticStresses(section, ec, rawA, rawB);
    const scale = Math.min(stresses.concreteStress > 0 ? fc / stresses.concreteStress : Infinity, stresses.steelStress > 0 ? fy / stresses.steelStress : Infinity);
    const a = rawA * scale; const b = rawB * scale;
    const state = elasticState(section, ec, a, b);
    return makeInteractionPoint(section, state.axialN, state.momentNmm, a, b, 1, state.orthogonalMomentNmm);
  });
  const compressionStrain = input.philosophy === 'allowable' ? Math.min(fc / ec, fy / ES) : EPS_CU;
  const concreteStress = input.philosophy === 'allowable' ? ec * compressionStrain : 0.85 * fc;
  const steelCompression = Math.min(fy, ES * compressionStrain);
  const compression = uniformPoint(section, concreteStress, steelCompression, compressionStrain, factor);
  const tension = uniformPoint(section, 0, -fy, -fy / ES, factor);
  return [tension, ...branch(1), compression, ...branch(-1).reverse(), tension];
}

function interpolatePoint(a: SectionStudioInteractionPoint, b: SectionStudioInteractionPoint, t: number): SectionStudioInteractionPoint {
  const lerp = (x: number, y: number) => x + (y - x) * t;
  return {
    axialKn: lerp(a.axialKn, b.axialKn), momentKnm: lerp(a.momentKnm, b.momentKnm),
    orthogonalMomentKnm: lerp(a.orthogonalMomentKnm, b.orthogonalMomentKnm),
    neutralAxisDepthMm: a.neutralAxisDepthMm !== null && b.neutralAxisDepthMm !== null ? lerp(a.neutralAxisDepthMm, b.neutralAxisDepthMm) : null,
    extremeCompressionStrain: lerp(a.extremeCompressionStrain, b.extremeCompressionStrain),
    steelMaxTensionStrain: lerp(a.steelMaxTensionStrain, b.steelMaxTensionStrain),
    strainAtCentroid: lerp(a.strainAtCentroid, b.strainAtCentroid), curvaturePerMm: lerp(a.curvaturePerMm, b.curvaturePerMm),
    compressionSide: a.compressionSide === b.compressionSide ? a.compressionSide : (t < 0.5 ? a.compressionSide : b.compressionSide),
  };
}

interface RayIntersection { factor: number; point: SectionStudioInteractionPoint; start: SectionStudioInteractionPoint; end: SectionStudioInteractionPoint }

function rayIntersection(points: SectionStudioInteractionPoint[], axial: number, moment: number): RayIntersection | null {
  if (axial === 0 && moment === 0) return null;
  let match: RayIntersection | null = null;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p = points[i]; const end = points[i + 1];
    const dx = end.axialKn - p.axialKn; const dy = end.momentKnm - p.momentKnm;
    const det = axial * dy - moment * dx;
    if (Math.abs(det) < 1e-14) continue;
    const factor = (p.axialKn * dy - p.momentKnm * dx) / det;
    const t = (p.axialKn * moment - p.momentKnm * axial) / det;
    if (factor > 1e-10 && t >= -1e-9 && t <= 1 + 1e-9 && (match === null || factor < match.factor)) match = { factor, point: interpolatePoint(p, end, clamp(t, 0, 1)), start: p, end };
  }
  return match;
}


/** Resolve the governing ray on the actual constitutive model, rather than interpolating strains and forces independently. */
function refinedStrengthIntersection(points: SectionStudioInteractionPoint[], section: Section, input: SectionStudioInput, fc: number, fy: number, resistanceFactor: number, axial: number, moment: number): RayIntersection | null {
  const intersection = rayIntersection(points, axial, moment);
  if (intersection === null) return null;
  const { start, end } = intersection;
  if (start.neutralAxisDepthMm === null || end.neutralAxisDepthMm === null || start.compressionSide === 0 || start.compressionSide !== end.compressionSide) return intersection;
  const side = start.compressionSide;
  let low = Math.min(start.neutralAxisDepthMm, end.neutralAxisDepthMm);
  let high = Math.max(start.neutralAxisDepthMm, end.neutralAxisDepthMm);
  const evaluate = (c: number) => strengthPoint(section, fc, fy, resistanceFactor, betaOne(input.fcMpa), c, side);
  const residual = (point: SectionStudioInteractionPoint) => point.axialKn * moment - point.momentKnm * axial;
  const lowPoint = evaluate(low); let lowResidual = residual(lowPoint);
  const highPoint = evaluate(high);
  if (lowResidual * residual(highPoint) > 0) return intersection;
  let point = lowPoint;
  for (let iteration = 0; iteration < 45; iteration += 1) {
    const c = (low + high) / 2;
    point = evaluate(c);
    const value = residual(point);
    if (Math.abs(value) < 1e-11 * Math.max(1, Math.abs(point.axialKn * moment), Math.abs(point.momentKnm * axial))) break;
    if (value * lowResidual <= 0) high = c;
    else { low = c; lowResidual = value; }
  }
  const factor = Math.abs(axial) > 1e-10 ? point.axialKn / axial : point.momentKnm / moment;
  return factor > 0 ? { factor, point, start, end } : intersection;
}

function exactElasticIntersection(section: Section, ec: number, fc: number, fy: number, axial: number, moment: number): SectionStudioInteractionPoint | null {
  const solution = solveElastic(section, ec, axial * 1000, moment * 1e6);
  if (solution === null) return null;
  const stress = elasticStresses(section, ec, solution.a, solution.b);
  const utilization = Math.max(stress.concreteStress / fc, stress.steelStress / fy);
  if (!(utilization > 0)) return null;
  const scale = 1 / utilization;
  return makeInteractionPoint(section, axial * 1000 * scale, moment * 1e6 * scale, solution.a * scale, solution.b * scale, 1, solution.state.orthogonalMomentNmm * scale);
}

function analysis(section: Section, input: SectionStudioInput, fc: number, fy: number, ec: number, capacityPoint: SectionStudioInteractionPoint | null): SectionStudioSuccess['analysis'] | null {
  let a = 0; let b = 0; let equilibriumAxialKn = 0; let equilibriumMomentKnm = 0; let orthogonalMomentKnm = 0;
  if (input.philosophy === 'allowable') {
    const solution = solveElastic(section, ec, input.axialKn * 1000, input.momentKnm * 1e6);
    if (solution === null) return null;
    a = solution.a; b = solution.b;
    equilibriumAxialKn = solution.state.axialN / 1000; equilibriumMomentKnm = solution.state.momentNmm / 1e6; orthogonalMomentKnm = solution.state.orthogonalMomentNmm / 1e6;
  } else if (capacityPoint !== null) {
    a = capacityPoint.strainAtCentroid; b = capacityPoint.curvaturePerMm;
    equilibriumAxialKn = capacityPoint.axialKn; equilibriumMomentKnm = capacityPoint.momentKnm; orthogonalMomentKnm = capacityPoint.orthogonalMomentKnm;
  }
  const side = b >= 0 ? 1 : -1;
  const neutralQ = Math.abs(b) > 1e-20 ? -a / b : null;
  const extreme = side === 1 ? section.qMax : -section.qMin;
  const neutralDepth = neutralQ === null ? null : extreme - side * neutralQ;
  const threshold = input.philosophy === 'allowable'
    ? neutralQ === null ? a > 0 ? -Infinity : Infinity : side * neutralQ
    : neutralDepth === null ? a > 0 ? -Infinity : Infinity : extreme - betaOne(input.fcMpa) * neutralDepth;
  const compressionPolygon = clip(section.vertices, side * section.sin, side * section.cos, threshold);
  const stresses = elasticStresses(section, ec, a, b);
  return {
    compressionPolygon,
    neutralAxis: neutralQ === null ? [] : lineAcross(section.vertices, section.sin, section.cos, neutralQ),
    strainProfile: Array.from({ length: 3 }, (_, i) => {
      const q = section.qMax - (section.qMax - section.qMin) * i / 2;
      return { depthMm: section.qMax - q, strain: a + b * q };
    }),
    maxConcreteStressMpa: input.philosophy === 'allowable' ? stresses.concreteStress : compressionPolygon.length > 0 ? 0.85 * fc : 0,
    minConcreteStressMpa: 0,
    maxSteelStressMpa: input.philosophy === 'allowable' ? stresses.steelStress : Math.min(fy, Math.max(0, ...section.bars.map((bar) => Math.abs(ES * (a + b * projection(bar, section)))))),
    neutralAxisDepthMm: neutralDepth,
    equilibriumAxialKn, equilibriumMomentKnm, orthogonalMomentKnm,
    strainAtCentroid: a, curvaturePerMm: b,
    model: input.philosophy === 'allowable'
      ? 'Sección elástica fisurada: concreto sólo a compresión; acero elástico, Ec = 4700√f’c, Es = 200000 MPa. Estado de la demanda.'
      : 'Compatibilidad de deformaciones, εcu = 0.003 y bloque 0.85 f’c / β1. Estado límite de la envolvente en la dirección N–M de la demanda.',
  };
}

function quantityAndDetails(section: Section, input: SectionStudioInput): Pick<SectionStudioSuccess, 'reinforcement' | 'quantities' | 'detailing'> {
  const steelArea = section.bars.length * section.barArea;
  let minClear = Infinity;
  for (let i = 0; i < section.bars.length; i += 1) for (let j = i + 1; j < section.bars.length; j += 1) minClear = Math.min(minClear, Math.hypot(section.bars[i].x - section.bars[j].x, section.bars[i].y - section.bars[j].y) - input.barDiameterMm);
  const requiredClear = input.barLayout === 'layers' ? Math.max(25, input.barDiameterMm) : Math.max(40, 1.5 * input.barDiameterMm);
  const spacingLimit = Math.min(16 * input.barDiameterMm, 48 * input.tieDiameterMm, Math.min(section.width, section.height));
  const proposedSpacing = Math.max(input.tieDiameterMm, Math.floor(spacingLimit / 25) * 25);
  const contourLength = section.radius === null ? perimeter(section.tieVertices) : 2 * PI * (section.radius - input.coverMm - input.tieDiameterMm / 2);
  const lengthMm = input.lengthM * 1000;
  let tieCount: number; let tieLengthMm: number; let totalTieLengthMm: number;
  if (input.tieType === 'spiral') {
    const turns = lengthMm / input.tieSpacingMm;
    tieCount = Math.ceil(turns);
    tieLengthMm = Math.hypot(contourLength, input.tieSpacingMm);
    totalTieLengthMm = turns * tieLengthMm;
  } else {
    tieCount = Math.ceil(lengthMm / input.tieSpacingMm) + 1;
    tieLengthMm = contourLength + 20 * input.tieDiameterMm;
    for (const line of section.crossLines) tieLengthMm += Math.hypot(line[1].x - line[0].x, line[1].y - line[0].y) + 20 * input.tieDiameterMm;
    totalTieLengthMm = tieLengthMm * tieCount;
  }
  const longitudinalSteelKg = steelArea * input.lengthM * 0.00785;
  const tieSteelKg = PI * input.tieDiameterMm ** 2 / 4 * totalTieLengthMm / 1e9 * DENSITY_STEEL_KG_M3;
  const totalSteelKg = longitudinalSteelKg + tieSteelKg;
  const concreteM3 = section.moments.area * input.lengthM / 1e6;
  const ratio = steelArea / section.moments.area * 100;
  const checks: SectionStudioDetailCheck[] = [
    { id: 'cover', label: 'Recubrimiento exterior al estribo', status: input.coverMm >= 20 ? 'ok' : 'warning', value: input.coverMm, limit: 20, description: '20 mm es una alerta geométrica orientativa; exposición, fuego y reglamento pueden exigir más.' },
    { id: 'clear-spacing', label: 'Separación libre de barras', status: minClear + 1e-7 >= requiredClear ? 'ok' : 'warning', value: minClear, limit: requiredClear, description: 'Criterio preliminar: lechos ≥ máx(25 mm, db); perímetro ≥ máx(40 mm, 1.5 db). Falta considerar tamaño del agregado.' },
    { id: 'tie-spacing', label: 'Paso de estribos', status: input.tieType === 'spiral' || input.tieSpacingMm <= spacingLimit ? 'ok' : 'warning', value: input.tieSpacingMm, limit: input.tieType === 'spiral' ? null : spacingLimit, description: input.tieType === 'spiral' ? 'Se contabiliza una hélice; no se verifica cuantía volumétrica ni confinamiento de espiral.' : 'Propuesta geométrica de columna: límite preliminar = mín(16 db, 48 de, lado menor). No incluye exigencias sísmicas o de cortante.' },
    { id: 'steel-ratio', label: 'Cuantía longitudinal', status: input.barLayout === 'layers' || (ratio >= 1 && ratio <= 8) ? 'ok' : 'warning', value: ratio, limit: null, description: input.barLayout === 'layers' ? 'La cuantía se informa; mínimo, máximo y ductilidad de viga/losa dependen del reglamento y del detalle.' : 'Intervalo 1–8 % como alerta preliminar de columnas. No sustituye mínimo, máximo o confinamiento reglamentarios.' },
    { id: 'shear', label: 'Cortante y confinamiento', status: Math.abs(input.shearKn) > 0 ? 'warning' : 'ok', value: Math.abs(input.shearKn), limit: null, description: 'Este motor calcula flexocompresión de sección; no calcula resistencia a cortante, torsión ni confinamiento.' },
  ];
  return {
    reinforcement: { barCount: section.bars.length, steelAreaMm2: steelArea, ratioPercent: ratio, minClearSpacingMm: minClear, requiredClearSpacingMm: requiredClear },
    quantities: { concreteM3, netConcreteM3: Math.max(0, concreteM3 - totalSteelKg / DENSITY_STEEL_KG_M3), longitudinalSteelKg, tieSteelKg, totalSteelKg, tieCount, tieLengthM: tieLengthMm / 1000, totalTieLengthM: totalTieLengthMm / 1000 },
    detailing: { checks, proposedTieSpacingMm: proposedSpacing, providedTieSpacingMm: input.tieSpacingMm },
  };
}

/** Returns only section-level results; no load combinations, member stability or regulatory certification. */
export function designSectionStudio(input: SectionStudioInput): SectionStudioResult {
  const errors = validate(input);
  if (errors.length > 0) return { status: 'invalid', errors };
  const section = buildSection(input);
  if (typeof section === 'string') return { status: 'invalid', errors: [section] };
  const fc = input.philosophy === 'allowable' ? input.fcMpa * input.allowableConcreteRatio : input.philosophy === 'limit-state' ? input.fcMpa / input.gammaConcrete : input.fcMpa;
  const fy = input.philosophy === 'allowable' ? input.fyMpa * input.allowableSteelRatio : input.philosophy === 'limit-state' ? input.fyMpa / input.gammaSteel : input.fyMpa;
  const factor = input.philosophy === 'ultimate' ? input.phi : 1;
  const ec = 4700 * Math.sqrt(input.fcMpa);
  const envelope = interaction(section, input, fc, fy, factor, ec);
  const zeroDemand = input.axialKn === 0 && input.momentKnm === 0;
  const intersection = zeroDemand ? null : input.philosophy === 'allowable' ? rayIntersection(envelope, input.axialKn, input.momentKnm) : refinedStrengthIntersection(envelope, section, input, fc, fy, factor, input.axialKn, input.momentKnm);
  const sectionAnalysis = analysis(section, input, fc, fy, ec, intersection?.point ?? null);
  if (sectionAnalysis === null) return { status: 'invalid', errors: ['No se alcanzó el equilibrio elástico de la sección dentro de la tolerancia numérica.'] };
  const quantities = quantityAndDetails(section, input);
  const allowableUtilization = Math.max(sectionAnalysis.maxConcreteStressMpa / fc, sectionAnalysis.maxSteelStressMpa / fy);
  const utilization = zeroDemand ? 0 : input.philosophy === 'allowable' ? allowableUtilization : intersection === null ? Infinity : 1 / intersection.factor;
  const loadFactor = zeroDemand ? null : input.philosophy === 'allowable' ? utilization > 0 ? 1 / utilization : null : intersection?.factor ?? 0;
  // Elastic homogeneity permits an exact radial point from the solved demand, independent of envelope discretisation.
  let capacityPoint = intersection?.point ?? null;
  if (input.philosophy === 'allowable' && !zeroDemand && loadFactor !== null) {
    capacityPoint = makeInteractionPoint(section, input.axialKn * 1000 * loadFactor, input.momentKnm * 1e6 * loadFactor, sectionAnalysis.strainAtCentroid * loadFactor, sectionAnalysis.curvaturePerMm * loadFactor, 1, sectionAnalysis.orthogonalMomentKnm * 1e6 * loadFactor);
  }
  const intercept = (axial: number, moment: number) => input.philosophy === 'allowable' ? exactElasticIntersection(section, ec, fc, fy, axial, moment) : refinedStrengthIntersection(envelope, section, input, fc, fy, factor, axial, moment)?.point;
  return {
    status: 'ok', directionalOnly: Math.abs(sectionAnalysis.orthogonalMomentKnm) > 1e-5 * Math.max(1, Math.abs(sectionAnalysis.equilibriumMomentKnm)), input: { ...input },
    geometry: { vertices: section.vertices, bars: section.bars, tieVertices: section.tieVertices, tieCrossLines: section.crossLines, areaMm2: section.moments.area, inertiaXmm4: section.moments.ix, inertiaYmm4: section.moments.iy, inertiaXYmm4: section.moments.ixy, widthMm: section.width, heightMm: section.height, circleRadiusMm: section.radius },
    interaction: envelope,
    demand: { axialKn: input.axialKn, momentKnm: input.momentKnm, shearKn: input.shearKn },
    capacity: { axialCompressionKn: intercept(1, 0)?.axialKn ?? 0, axialTensionKn: intercept(-1, 0)?.axialKn ?? 0, positiveMomentKnm: intercept(0, 1)?.momentKnm ?? 0, negativeMomentKnm: intercept(0, -1)?.momentKnm ?? 0, loadFactor, point: capacityPoint },
    utilization, analysis: sectionAnalysis, ...quantities,
    effective: { fcMpa: fc, fyMpa: fy, resistanceFactor: factor },
    assumptions: [
      'Sección corta con adherencia perfecta; secciones planas y flexión en una dirección definida por q = x sen(θ) + y cos(θ). N positivo comprime; M positivo comprime el lado +q.',
      input.philosophy === 'allowable' ? 'Esfuerzos admisibles: equilibrio elástico fisurado con concreto sin tracción, acero elástico y fracciones admisibles explícitas del usuario. No emplea φ ni γ.' : input.philosophy === 'limit-state' ? 'Estados límite: resistencias de material f’c/γc y fy/γs, con φ = 1. Usa el mismo bloque experimental de compatibilidad; no implementa Eurocódigo ni NTC completas.' : 'Resistencia última: bloque equivalente, acero elastoplástico, deformación última 0.003 y φ constante explícito del usuario. No deriva φ de ductilidad ni agrega tope axial reglamentario.',
      'Círculos integrados analíticamente; polígonos convexos recortados e integrados exactamente. Se descuenta el concreto desplazado por cada disco de acero dentro de la zona comprimida.',
      'Barras perimetrales: si el conteo es múltiplo de los vértices, todas las esquinas más subdivisiones iguales de cada cara; otros conteos a intervalos de arco iguales. Círculos a igual ángulo; lechos rectos a igual espaciamiento entre extremos. Recubrimiento medido a la superficie exterior del estribo.',
      'Concreto informado como volumen bruto de encofrado; el neto resta el volumen estimado del acero. Acero a 7850 kg/m³, longitud sin traslapes/anclajes ni desperdicio.',
      'Estribos cerrados y grapas: estimación de ganchos de 10 de por extremo. Espiral: hélice a paso indicado sin vueltas de anclaje; los conteos son cuantificación, no despiece constructivo.',
    ],
    limitations: [
      'Experimental: verificación resistente de sección N–M en una dirección. No incluye flexión biaxial, esbeltez, segundo orden, pandeo, combinaciones/factores de acciones, fuego, sismo, desarrollo o empalmes.',
      'El gráfico conecta 283 estados; la capacidad sobre la dirección de demanda se refina por equilibrio en la curva constitutiva. Los diagramas circulares usan 96 segmentos sólo para dibujar; las integrales resistentes del círculo son analíticas.',
      'Cortante, torsión, punzonamiento, fisuración/deflexión de miembro y confinamiento no están verificados. La demanda de cortante se muestra sin capacidad calculada.',
      'Separación, recubrimiento y paso propuesto son alertas geométricas orientativas. Agregado, exposición, detalle de apoyo lateral y requisitos normativos deben definirse antes de uso constructivo.',
      ...(Math.abs(sectionAnalysis.orthogonalMomentKnm) > 1e-5 * Math.max(1, Math.abs(sectionAnalysis.equilibriumMomentKnm)) ? ['El eje de deformación elegido produce un momento perpendicular distinto de cero. La envolvente es una exploración direccional con eje de deformación impuesto; no verifica una solicitación uniaxial sin ese momento perpendicular.'] : []),
      ...(section.bars.length < 4 && input.barLayout !== 'layers' ? ['Menos de cuatro barras perimetrales: disposición exploratoria, sin verificación de mínimos reglamentarios de columna.'] : []),
    ],
    sources: [
      { title: 'FHWA · LRFD Reference Manual: compatibilidad y bloque equivalente', url: 'https://www.fhwa.dot.gov/bridge/pubs/nhi15047.pdf' },
      { title: 'JRC · Handbook 2: esfuerzos permisibles y factores parciales', url: 'https://eurocodes.jrc.ec.europa.eu/sites/default/files/2021-12/handbook2.pdf' },
    ],
  };
}

/** Bounded search at fixed diameter and section. A proposal remains experimental and verifies N–M only. */
export function proposeSectionReinforcement(input: SectionStudioInput): SectionStudioProposal {
  const validation = validate(input);
  if (validation.length > 0) return { status: 'no-solution', reason: validation.join(' '), checkedCandidates: 0 };
  let best: { input: SectionStudioInput; result: SectionStudioSuccess } | null = null;
  let checkedCandidates = 0;
  let directionalCandidates = 0;
  const isLayers = input.barLayout === 'layers';
  const top = input.topBarCount ?? Math.floor(input.barCount / 2);
  const bottom = input.bottomBarCount ?? input.barCount - top;
  const negativeBending = input.momentKnm < 0;
  for (let count = isLayers ? 2 : 3; count <= 24; count += 1) {
    const proposedSpacing = Math.max(input.tieDiameterMm, Math.floor(Math.min(16 * input.barDiameterMm, 48 * input.tieDiameterMm, input.widthMm, input.shape === 'square' || input.shape === 'circle' ? input.widthMm : input.heightMm) / 25) * 25);
    const candidate: SectionStudioInput = { ...input, barCount: isLayers ? count + (negativeBending ? bottom : top) : count, ...(isLayers ? { topBarCount: negativeBending ? count : top, bottomBarCount: negativeBending ? bottom : count } : {}), tieSpacingMm: Math.min(input.tieSpacingMm, proposedSpacing) };
    checkedCandidates += 1;
    const result = designSectionStudio(candidate);
    if (result.status === 'ok' && result.directionalOnly) { directionalCandidates += 1; continue; }
    if (result.status !== 'ok' || result.utilization > 1 || result.reinforcement.minClearSpacingMm + 1e-7 < result.reinforcement.requiredClearSpacingMm) continue;
    if (best === null || result.reinforcement.steelAreaMm2 < best.result.reinforcement.steelAreaMm2) best = { input: candidate, result };
  }
  return best === null
    ? { status: 'no-solution', reason: directionalCandidates > 0 ? 'Las distribuciones generan momento perpendicular con el eje impuesto. Se requiere un modelo acoplado biaxial o una orientación/disposición simétrica antes de proponer acero para N–M sin ese momento.' : 'No se encontró una propuesta con 2–24 barras del diámetro actual que cubra N–M y separación libre. Aumenta la sección o el diámetro. Cortante y requisitos reglamentarios siguen sin verificarse.', checkedCandidates }
    : { status: 'proposed', ...best, checkedCandidates };
}
