import { designCode, isDesignCodeId, type DesignCode, type DesignCodeId, type LoadCombination } from './codes';
import {
  barArea,
  capacityCheck,
  ceilTo,
  complementary,
  flexuralCapacity,
  floorTo,
  governingRatio,
  isPositiveFinite,
  overallStatus,
  requiredFlexuralSteelMm2,
  type ElementCheck,
} from './shared';

export interface FootingDesignInput {
  readonly code: DesignCodeId;
  /** Dimensión de la columna paralela a X. */
  readonly columnWidthMm: number;
  /** Dimensión de la columna paralela a Y. */
  readonly columnDepthMm: number;
  readonly deadKn: number;
  readonly liveKn: number;
  /** Combinaciones de resistencia de la norma; rige la mayor carga axial. */
  readonly combinations: readonly LoadCombination[];
  /** Momentos de servicio en la base de la columna, kN·m (Mx gira alrededor de X y excentra la carga en Y). */
  readonly serviceMomentXKnm: number;
  readonly serviceMomentYKnm: number;
  /** Momentos últimos en la base de la columna, kN·m. */
  readonly ultimateMomentXKnm: number;
  readonly ultimateMomentYKnm: number;
  /** Capacidad admisible neta del suelo. */
  readonly allowablePressureKpa: number;
  readonly fcMpa: number;
  readonly fyMpa: number;
  /** `null` busca el peralte mínimo que cumple cortantes. */
  readonly thicknessMm: number | null;
  /** `null` dimensiona la planta con la presión admisible y la excentricidad. */
  readonly sideXMm: number | null;
  readonly sideYMm: number | null;
  readonly coverMm: number;
  readonly barDiameterMm: number;
  /** La combinación incluye sismo: en la NTC FR = 0.65 para cortante en dos direcciones (tabla 3.8.2.1 d). */
  readonly seismicCombination: boolean;
}

export interface FootingDirection {
  /** Dirección de las barras (y del voladizo que resisten). */
  readonly axis: 'x' | 'y';
  /** Capa inferior (mayor peralte) o superior de la parrilla. */
  readonly layer: 'bottom' | 'top';
  readonly effectiveDepthMm: number;
  readonly cantileverMm: number;
  readonly momentKnm: number;
  readonly requiredMm2: number;
  readonly minimumMm2: number;
  /** Mínimo adicional por penetración (NTC 6.7.6.1.2); 0 si no aplica. */
  readonly punchingMinimumMm2: number;
  readonly providedMm2: number;
  readonly strengthKnm: number;
  readonly barCount: number;
  readonly spacingMm: number;
  readonly maximumSpacingMm: number;
  readonly oneWayDemandKn: number;
  /** Cortante como viga sin estribos: NTC 0.66·λs·ρ^(1/3)·√f′c; NSR y E.060 0.17√f′c. */
  readonly oneWayStrengthKn: number;
  readonly sizeFactor: number;
  readonly steelRatio: number;
  readonly resistanceFactor: number;
  /** Longitud recta disponible desde el paño de la columna hasta el extremo de la barra. */
  readonly availableAnchorageMm: number;
  readonly developmentLengthMm: number;
  readonly hookLengthMm: number;
  readonly anchorage: 'straight' | 'hook' | 'insufficient';
  /** Zapata rectangular: parte del acero corto va en una banda central de ancho igual al lado corto. */
  readonly band: { readonly widthMm: number; readonly barsInBand: number; readonly spacingInBandMm: number; readonly spacingOutsideMm: number } | null;
}

export interface FootingDesignResult {
  readonly ok: true;
  readonly input: FootingDesignInput;
  readonly sideXMm: number;
  readonly sideYMm: number;
  readonly thicknessMm: number;
  readonly effectiveDepthMm: number;
  readonly ultimateAxialKn: number;
  readonly service: {
    readonly maximumKpa: number;
    readonly minimumKpa: number;
    readonly eccentricityXMm: number;
    readonly eccentricityYMm: number;
  };
  readonly ultimate: { readonly averageKpa: number; readonly maximumKpa: number; readonly minimumKpa: number };
  readonly punching: {
    readonly perimeterMm: number;
    readonly criticalWidthMm: number;
    readonly criticalDepthMm: number;
    readonly demandKn: number;
    readonly strengthKn: number;
    /** Esfuerzo máximo con la transferencia de momento γv·M·c/Jc. */
    readonly demandStressMpa: number;
    /** Esfuerzo por el cortante directo, vuv = Vu/(bo·d). */
    readonly directStressMpa: number;
    readonly strengthStressMpa: number;
    readonly sizeFactor: number;
    readonly resistanceFactor: number;
  };
  readonly directions: { readonly x: FootingDirection; readonly y: FootingDirection };
  readonly checks: readonly ElementCheck[];
  readonly governingRatio: number;
  readonly status: 'pass' | 'fail' | 'warning';
}

interface FootingDesignError { readonly ok: false; readonly errors: readonly string[] }

/** Factor de efecto de tamaño λs = √(2/(1 + 0.004d)) ≤ 1.0 con d en mm (NTC ec. 5.5.3.2.1.b). */
export const sizeFactor = (effectiveDepthMm: number): number => Math.min(1, Math.sqrt(2 / (1 + 0.004 * effectiveDepthMm)));
const MAXIMUM_SIDE_MM = 12_000;
/** αs para columnas interiores. */
const ALPHA_S = 40;

function validate(input: FootingDesignInput): string[] {
  const errors: string[] = [];
  if (!isDesignCodeId(input.code)) return ['Norma de diseño desconocida.'];
  const positive: [keyof FootingDesignInput, string][] = [
    ['columnWidthMm', 'Columna c1'], ['columnDepthMm', 'Columna c2'], ['allowablePressureKpa', 'Capacidad del suelo'],
    ['fcMpa', "f'c"], ['fyMpa', 'fy'], ['coverMm', 'Recubrimiento'], ['barDiameterMm', 'Diámetro de barra'],
  ];
  for (const [key, label] of positive) if (!isPositiveFinite(input[key] as number)) errors.push(`${label} debe ser mayor que cero.`);
  if (input.combinations.length < 1) errors.push('Se requiere al menos una combinación de carga.');
  for (const combination of input.combinations) {
    if (!isPositiveFinite(combination.dead) || !Number.isFinite(combination.live) || combination.live < 0) errors.push(`Combinación ${combination.label}: factores inválidos.`);
  }
  if (!Number.isFinite(input.deadKn) || input.deadKn < 0 || !Number.isFinite(input.liveKn) || input.liveKn < 0) errors.push('Las cargas deben ser cero o positivas.');
  if (input.deadKn + input.liveKn <= 0) errors.push('La columna debe bajar alguna carga.');
  for (const key of ['serviceMomentXKnm', 'serviceMomentYKnm', 'ultimateMomentXKnm', 'ultimateMomentYKnm'] as const) {
    if (!Number.isFinite(input[key])) errors.push('Los momentos deben ser números.');
  }
  if (input.thicknessMm !== null && (!isPositiveFinite(input.thicknessMm) || input.thicknessMm <= input.coverMm + 2 * input.barDiameterMm)) errors.push('El peralte es insuficiente para el recubrimiento.');
  for (const [value, label] of [[input.sideXMm, 'B'], [input.sideYMm, 'L']] as const) {
    if (value !== null && !isPositiveFinite(value)) errors.push(`El lado ${label} debe ser mayor que cero.`);
  }
  if (input.sideXMm !== null && input.sideXMm <= input.columnWidthMm) errors.push('El lado B debe ser mayor que la columna.');
  if (input.sideYMm !== null && input.sideYMm <= input.columnDepthMm) errors.push('El lado L debe ser mayor que la columna.');
  return errors;
}

const servicePressure = (input: FootingDesignInput, bx: number, by: number) => {
  const p = input.deadKn + input.liveKn;
  const area = bx * by / 1e6;
  const ex = Math.abs(input.serviceMomentYKnm) / p * 1e3;
  const ey = Math.abs(input.serviceMomentXKnm) / p * 1e3;
  const bending = 6 * ex / bx + 6 * ey / by;
  return { maximum: p / area * (1 + bending), minimum: p / area * (1 - bending), ex, ey };
};

/** Planta mínima: presión máxima ≤ admisible y resultante dentro del núcleo, creciendo el lado más excéntrico. */
function sizePlan(input: FootingDesignInput): { bx: number; by: number } {
  const service = input.deadKn + input.liveKn;
  const start = Math.max(
    ceilTo(Math.sqrt(service / input.allowablePressureKpa) * 1e3, 50),
    Math.max(input.columnWidthMm, input.columnDepthMm) + 200,
  );
  let bx = input.sideXMm ?? start;
  let by = input.sideYMm ?? start;
  for (let step = 0; step < 400; step += 1) {
    const pressure = servicePressure(input, bx, by);
    if (pressure.maximum <= input.allowablePressureKpa && pressure.minimum >= 0) break;
    const growX = input.sideXMm === null && (input.sideYMm !== null || 6 * pressure.ex / bx >= 6 * pressure.ey / by);
    const growY = input.sideYMm === null && !growX;
    if (!growX && !growY) break;
    if (growX) bx += 50; else by += 50;
    if (bx > MAXIMUM_SIDE_MM || by > MAXIMUM_SIDE_MM) break;
  }
  return { bx, by };
}

interface Geometry { bx: number; by: number; h: number }

/** Carga axial última: la mayor de las combinaciones de la norma. */
const ultimateAxialKn = (input: FootingDesignInput) =>
  Math.max(...input.combinations.map((combination) => combination.dead * input.deadKn + combination.live * input.liveKn));

/** Resultados de resistencia para una geometría dada. */
function evaluate(code: DesignCode, input: FootingDesignInput, { bx, by, h }: Geometry) {
  const c1 = input.columnWidthMm;
  const c2 = input.columnDepthMm;
  const fc = input.fcMpa;
  const db = input.barDiameterMm;
  const pu = ultimateAxialKn(input);
  const area = bx * by;
  const q0 = pu * 1e3 / area; // MPa
  const mux = Math.abs(input.ultimateMomentXKnm) * 1e6; // N·mm, varía la presión en Y
  const muy = Math.abs(input.ultimateMomentYKnm) * 1e6; // N·mm, varía la presión en X
  const ix = bx * by ** 3 / 12;
  const iy = by * bx ** 3 / 12;
  const kx = muy / iy; // MPa por mm en X
  const ky = mux / ix;
  const qMax = q0 + kx * bx / 2 + ky * by / 2;
  const qMin = q0 - kx * bx / 2 - ky * by / 2;

  // Las barras de la dirección larga van abajo, con el mayor peralte.
  const longAxis: 'x' | 'y' = bx >= by ? 'x' : 'y';
  const depthFor = (axis: 'x' | 'y') => h - input.coverMm - (axis === longAxis ? db / 2 : 1.5 * db);
  const average = h - input.coverMm - db;

  // Cortante como viga a d del paño y momento en el paño con presión trapecial (lado más cargado).
  const cantilever = (axis: 'x' | 'y') => {
    const side = axis === 'x' ? bx : by;
    const column = axis === 'x' ? c1 : c2;
    const width = axis === 'x' ? by : bx;
    const k = axis === 'x' ? kx : ky;
    const a = column / 2;
    const e = side / 2;
    const d = depthFor(axis);
    const momentNmm = width * (q0 * (e - a) ** 2 / 2 + k * ((e ** 3 - a ** 3) / 3 - a * (e ** 2 - a ** 2) / 2));
    const s = a + d;
    const shearN = s < e ? width * (q0 * (e - s) + k * (e ** 2 - s ** 2) / 2) : 0;
    return { axis, d, width, cantileverMm: e - a, momentKnm: momentNmm / 1e6, oneWayDemandKn: shearN / 1e3 };
  };

  // Penetración: esfuerzo directo más la fracción γv del momento transferido, en el perímetro a d/2 del paño.
  const b1 = Math.min(bx, c1 + average);
  const b2 = Math.min(by, c2 + average);
  const perimeter = 2 * (b1 + b2);
  const punchingN = pu * 1e3 - q0 * b1 * b2;
  const polar = (along: number, across: number) => average * along ** 3 / 6 + along * average ** 3 / 6 + average * across * along ** 2 / 2;
  const gammaV = (along: number, across: number) => 1 - 1 / (1 + 2 / 3 * Math.sqrt(along / across));
  const directStress = punchingN / (perimeter * average);
  const demandStress = directStress
    + gammaV(b1, b2) * muy * (b1 / 2) / polar(b1, b2)
    + gammaV(b2, b1) * mux * (b2 / 2) / polar(b2, b1);
  const beta = Math.max(c1, c2) / Math.min(c1, c2);
  const punchingSize = code.footing.punchingSizeFactor ? sizeFactor(average) : 1;
  const punchingFactor = code.twoWayShearFactor(input.seismicCombination);
  const vc = Math.min(0.33, 0.17 * (1 + 2 / beta), 0.083 * (2 + ALPHA_S * average / perimeter)) * punchingSize * Math.sqrt(fc);

  return {
    pu, q0, qMax, qMin, longAxis, average,
    x: cantilever('x'),
    y: cantilever('y'),
    punching: {
      perimeterMm: perimeter,
      criticalWidthMm: b1,
      criticalDepthMm: b2,
      demandKn: punchingN / 1e3,
      strengthKn: punchingFactor * vc * perimeter * average / 1e3,
      demandStressMpa: demandStress,
      directStressMpa: directStress,
      strengthStressMpa: punchingFactor * vc,
      sizeFactor: punchingSize,
      resistanceFactor: punchingFactor,
    },
  };
}

type State = ReturnType<typeof evaluate>;

const passesShear = (code: DesignCode, state: State, x: FootingDirection, y: FootingDirection) =>
  state.average >= code.footing.minimumEffectiveDepthMm
  && state.punching.demandStressMpa <= state.punching.strengthStressMpa
  && x.oneWayDemandKn <= x.oneWayStrengthKn
  && y.oneWayDemandKn <= y.oneWayStrengthKn;

function reinforce(code: DesignCode, input: FootingDesignInput, geometry: Geometry, state: State, strip: State['x']): FootingDirection {
  const { h } = geometry;
  const fc = input.fcMpa;
  const fy = input.fyMpa;
  const area = barArea(input.barDiameterMm);
  const required = requiredFlexuralSteelMm2(strip.momentKnm, strip.width, strip.d, fy, fc, strip.d, code.flexureFactor, code.tensionControlledStrain) ?? Number.POSITIVE_INFINITY;
  const minimum = code.footing.minimumSteelRatio * strip.width * h;
  // NTC 6.7.6.1.2: si vuv > 0.17·FR·λs·√f′c, As,mín = 5·vuv·blosa·bo/(FR·αs·fy) en el ancho blosa;
  // aquí se reparte con la misma densidad en todo el ancho (del lado seguro).
  const { punching } = state;
  const punchingMinimum = code.footing.punchingMinimumSteel && punching.directStressMpa > 0.17 * punching.resistanceFactor * punching.sizeFactor * Math.sqrt(fc)
    ? 5 * punching.directStressMpa * punching.perimeterMm / (punching.resistanceFactor * ALPHA_S * fy) * strip.width
    : 0;
  const target = Math.max(required, minimum, punchingMinimum);
  const maximumSpacing = code.footing.maximumSpacing(h);
  const usable = strip.width - 2 * input.coverMm - input.barDiameterMm;
  let count = Math.max(2, Number.isFinite(target) ? Math.ceil(target / area) : 2);
  if (usable / (count - 1) > maximumSpacing) count = Math.ceil(usable / maximumSpacing) + 1;
  const spacing = usable / (count - 1);
  const provided = count * area;

  // Acero corto en zapata rectangular: la fracción 2/(β + 1) va en la franja central.
  let band: FootingDirection['band'] = null;
  const long = Math.max(geometry.bx, geometry.by);
  const short = Math.min(geometry.bx, geometry.by);
  if (strip.axis !== state.longAxis && long / short > 1.05) {
    const beta = long / short;
    const barsInBand = Math.ceil(count * 2 / (beta + 1));
    const outside = count - barsInBand;
    band = {
      widthMm: short,
      barsInBand,
      spacingInBandMm: floorTo(short / barsInBand, 25) || short / barsInBand,
      spacingOutsideMm: outside > 0 ? floorTo((long - short) / outside, 25) || (long - short) / outside : 0,
    };
  }
  const capacity = flexuralCapacity(provided, strip.width, strip.d, fy, fc, strip.d, code.flexureFactor);
  const steelRatio = provided / (strip.width * strip.d);
  const size = sizeFactor(strip.d);
  const oneWayStrength = code.footing.oneWay === 'ntc'
    ? code.shearFactor * 0.66 * size * Math.cbrt(steelRatio) * Math.sqrt(fc) * strip.width * strip.d / 1e3
    : code.shearFactor * 0.17 * Math.sqrt(fc) * strip.width * strip.d / 1e3;
  const development = code.developmentLength({
    diameterMm: input.barDiameterMm,
    fyMpa: fy,
    fcMpa: fc,
    topBar: false,
    clearSpacingMm: spacing - input.barDiameterMm,
    clearCoverMm: input.coverMm,
    minimumStirrups: false,
  });
  const hook = code.hookedDevelopmentMm(input.barDiameterMm, fy, fc);
  const available = strip.cantileverMm - input.coverMm;
  return {
    axis: strip.axis,
    layer: strip.axis === state.longAxis ? 'bottom' : 'top',
    effectiveDepthMm: strip.d,
    cantileverMm: strip.cantileverMm,
    momentKnm: strip.momentKnm,
    requiredMm2: required,
    minimumMm2: minimum,
    punchingMinimumMm2: punchingMinimum,
    providedMm2: provided,
    strengthKnm: capacity.strengthKnm,
    resistanceFactor: capacity.resistanceFactor,
    barCount: count,
    spacingMm: floorTo(spacing, 25) || floorTo(spacing, 5),
    maximumSpacingMm: maximumSpacing,
    oneWayDemandKn: strip.oneWayDemandKn,
    oneWayStrengthKn: oneWayStrength,
    sizeFactor: code.footing.oneWay === 'ntc' ? size : 1,
    steelRatio,
    availableAnchorageMm: available,
    developmentLengthMm: development.lengthMm,
    hookLengthMm: hook,
    anchorage: development.lengthMm <= available ? 'straight' : hook <= available ? 'hook' : 'insufficient',
    band,
  };
}

export function designFooting(input: FootingDesignInput): FootingDesignResult | FootingDesignError {
  const errors = validate(input);
  if (errors.length) return { ok: false, errors };

  const code = designCode(input.code);
  const { bx, by } = sizePlan(input);
  let h = input.thicknessMm ?? 250;
  if (input.thicknessMm === null) {
    for (; h < 2_000; h += 50) {
      const geometry = { bx, by, h };
      const trial = evaluate(code, input, geometry);
      if (passesShear(code, trial, reinforce(code, input, geometry, trial, trial.x), reinforce(code, input, geometry, trial, trial.y))) break;
    }
  }
  const geometry = { bx, by, h };
  const state = evaluate(code, input, geometry);
  const service = servicePressure(input, bx, by);
  const x = reinforce(code, input, geometry, state, state.x);
  const y = reinforce(code, input, geometry, state, state.y);
  const refs = code.refs;

  const checks: ElementCheck[] = [
    capacityCheck('bearing', 'Presión máxima de servicio', service.maximum, input.allowablePressureKpa, 'kPa', complementary('Capacidad admisible del estudio geotécnico')),
  ];
  if (service.ex > 0 || service.ey > 0) {
    checks.push({
      id: 'kern',
      label: 'Resultante dentro del núcleo',
      status: service.minimum >= -1e-9 ? 'pass' : 'fail',
      demand: 6 * service.ex / bx + 6 * service.ey / by,
      capacity: 1,
      unit: '',
      ratio: 6 * service.ex / bx + 6 * service.ey / by,
      reference: complementary('Estática'),
      note: service.minimum >= -1e-9 ? `Presión mínima ${service.minimum.toFixed(0)} kPa: todo el apoyo en compresión.` : 'Parte de la zapata se levanta: aumenta el lado en la dirección del momento.',
    });
  }
  const withMoment = state.punching.demandStressMpa > state.punching.directStressMpa + 1e-9;
  const polarNote = withMoment
    ? ` · incluye γv·M·c/Jc (Jc de columna interior: ${refs.punchingPolar.standard === 'complementary' ? 'criterio complementario' : refs.punchingPolar.label})`
    : '';
  checks.push(
    capacityCheck('min-depth', 'Peralte efectivo mínimo', code.footing.minimumEffectiveDepthMm, state.average, 'mm', refs.footingDepth),
    capacityCheck('punching', 'Cortante por penetración', state.punching.demandStressMpa, state.punching.strengthStressMpa, 'MPa', refs.punching,
      `${code.footing.punchingSizeFactor ? `λs = ${state.punching.sizeFactor.toFixed(2)} · ` : ''}FR ${state.punching.resistanceFactor}${polarNote}.`),
  );
  for (const [axis, direction] of [['X', x], ['Y', y]] as const) {
    checks.push(
      capacityCheck(`one-way-${axis.toLowerCase()}`, `Cortante como viga (${axis})`, direction.oneWayDemandKn, direction.oneWayStrengthKn, 'kN', refs.oneWay,
        code.footing.oneWay === 'ntc'
          ? `Sin estribos: 0.66·λs·ρ^(1/3)·√f′c con λs = ${direction.sizeFactor.toFixed(2)} y ρ = ${(direction.steelRatio * 100).toFixed(2)} %.`
          : `Sin estribos: 0.17·√f′c·b·d a d del paño · FR ${code.shearFactor}.`),
      capacityCheck(`flexure-${axis.toLowerCase()}`, `Flexión en el paño (${axis})`, direction.momentKnm, direction.strengthKnm, 'kN·m', refs.footingFlexure, `FR ${direction.resistanceFactor.toFixed(2)}.`),
    );
    checks.push({
      id: `anchorage-${axis.toLowerCase()}`,
      label: `Anclaje de las barras (${axis})`,
      status: direction.anchorage === 'insufficient' ? 'fail' : 'pass',
      demand: direction.anchorage === 'straight' ? direction.developmentLengthMm : direction.hookLengthMm,
      capacity: direction.availableAnchorageMm,
      unit: 'mm',
      ratio: (direction.anchorage === 'straight' ? direction.developmentLengthMm : direction.hookLengthMm) / direction.availableAnchorageMm,
      reference: refs.anchorage,
      note: direction.anchorage === 'straight'
        ? 'La barra recta desarrolla ld desde el paño de la columna.'
        : direction.anchorage === 'hook'
          ? `La barra recta necesitaría ${Math.round(direction.developmentLengthMm)} mm: remata con gancho estándar (ldh = ${Math.round(direction.hookLengthMm)} mm).`
          : `Ni la barra recta (${Math.round(direction.developmentLengthMm)} mm) ni el gancho (${Math.round(direction.hookLengthMm)} mm) caben en el voladizo: usa una varilla más delgada o amplía la zapata.`,
    });
  }
  const minimumDirection = x.providedMm2 / Math.max(x.minimumMm2, x.punchingMinimumMm2) <= y.providedMm2 / Math.max(y.minimumMm2, y.punchingMinimumMm2) ? x : y;
  const minimumRequired = Math.max(minimumDirection.minimumMm2, minimumDirection.punchingMinimumMm2);
  checks.push(
    capacityCheck('steel-min', 'Acero mínimo', minimumRequired, minimumDirection.providedMm2, 'mm²', refs.footingMinSteel,
      minimumDirection.punchingMinimumMm2 > minimumDirection.minimumMm2
        ? `vuv = ${state.punching.directStressMpa.toFixed(2)} MPa > 0.17·FR·λs·√f′c: rige As,mín = 5·vuv·bo/(FR·αs·fy) por unidad de ancho.`
        : `${(code.footing.minimumSteelRatio * 100).toFixed(2)} % del área bruta.`),
    capacityCheck('spacing', 'Separación del refuerzo', Math.max(x.spacingMm, y.spacingMm), x.maximumSpacingMm, 'mm', refs.footingSpacing, `Máximo: ${code.footing.maximumSpacingNote}.`),
  );
  if (!Number.isFinite(x.requiredMm2) || !Number.isFinite(y.requiredMm2)) {
    checks.push({ id: 'section', label: 'Peralte insuficiente para flexión', status: 'fail', reference: refs.footingFlexure, note: 'Aumenta el peralte.' });
  }
  if (state.qMin < 0) {
    checks.push({ id: 'ultimate-uplift', label: 'Presión última sin tensión', status: 'warning', reference: complementary('Estática'), note: 'Con cargas factorizadas la resultante sale del núcleo; la distribución lineal es conservadora sólo aproximadamente.' });
  }
  checks.push({ id: 'load-factors', label: 'Combinaciones de carga', status: 'info', reference: refs.loadFactors,
    note: `${input.combinations.map((combination) => combination.label).join(' · ')}: Pu = ${state.pu.toFixed(0)} kN.` });

  return {
    ok: true,
    input,
    sideXMm: bx,
    sideYMm: by,
    thicknessMm: h,
    effectiveDepthMm: state.average,
    ultimateAxialKn: state.pu,
    service: { maximumKpa: service.maximum, minimumKpa: service.minimum, eccentricityXMm: service.ex, eccentricityYMm: service.ey },
    ultimate: { averageKpa: state.q0 * 1e3, maximumKpa: state.qMax * 1e3, minimumKpa: state.qMin * 1e3 },
    punching: state.punching,
    directions: { x, y },
    checks,
    governingRatio: governingRatio(checks.filter((item) => !['spacing', 'kern', 'min-depth', 'steel-min'].includes(item.id) && !item.id.startsWith('anchorage'))),
    status: overallStatus(checks),
  };
}
