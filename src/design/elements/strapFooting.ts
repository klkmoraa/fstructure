import { designCode, isDesignCodeId, type DesignCode, type DesignCodeId, type LoadCombination } from './codes';
import { designFooting, type FootingDesignResult } from './footing';
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
  tracedAt,
  type ElementCheck,
} from './shared';
import { designStripFooting, type StripFootingResult } from './stripFooting';

/**
 * Zapata de lindero con contratrabe (strap). La columna 1 queda en el lindero y
 * su zapata no puede centrarse bajo ella; una contratrabe la liga a la zapata
 * de la columna interior 2 y equilibra la excentricidad e entre el eje de la
 * columna 1 y el centro de su zapata:
 *
 *   R1 = P1·L/(L − e)      R2 = P2 − P1·e/(L − e)
 *
 * La zapata 1 trabaja en una dirección, transversal a la contratrabe (NTC
 * 9.3.1.3), y se resuelve como zapata corrida bajo ella. La 2 se diseña como
 * aislada con P2 completa: la contratrabe sólo la descarga, así que es del lado
 * seguro. La contratrabe se diseña como viga con la reacción del suelo bajo la
 * zapata 1 (NTC 9.5.1.1-9.5.1.2 y 9.2.5.8).
 */
export interface StrapColumn {
  /** Paralela a la contratrabe (X). */
  readonly widthMm: number;
  /** Transversal (Y). */
  readonly depthMm: number;
  readonly deadKn: number;
  readonly liveKn: number;
}

export interface StrapFootingInput {
  readonly code: DesignCodeId;
  /** Columna 1, con su cara exterior en el lindero. */
  readonly exterior: StrapColumn;
  readonly interior: StrapColumn;
  /** Distancia entre ejes de columnas L. */
  readonly spacingMm: number;
  readonly combinations: readonly LoadCombination[];
  readonly allowablePressureKpa: number;
  readonly fcMpa: number;
  readonly fyMpa: number;
  readonly coverMm: number;
  /** Largo de la zapata 1 a lo largo de la contratrabe; `null` la hace de ancho ≈ 2 veces su largo. */
  readonly exteriorLengthMm: number | null;
  /** Peralte de ambas zapatas; `null` busca el mínimo que cumple. */
  readonly thicknessMm: number | null;
  readonly barDiameterMm: number;
  readonly strap: {
    /** `null`: ancho y peralte mínimos que cumplen. */
    readonly widthMm: number | null;
    readonly heightMm: number | null;
    readonly barDiameterMm: number;
    readonly stirrupDiameterMm: number;
  };
}

export interface StrapLayer {
  readonly momentKnm: number;
  readonly requiredMm2: number;
  readonly minimumMm2: number;
  readonly maximumMm2: number;
  readonly barCount: number;
  readonly providedMm2: number;
  readonly strengthKnm: number;
  readonly resistanceFactor: number;
  readonly clearSpacingMm: number;
}

export interface StrapBeamDesign {
  readonly widthMm: number;
  readonly heightMm: number;
  readonly effectiveDepthMm: number;
  /** Claro libre entre paños de columnas. */
  readonly clearSpanMm: number;
  readonly top: StrapLayer;
  readonly bottom: StrapLayer;
  /** Donde rige el momento negativo, desde el lindero. */
  readonly negativeAtMm: number;
  readonly shear: {
    readonly demandKn: number;
    readonly concreteKn: number;
    readonly strengthKn: number;
    readonly sectionStrengthKn: number;
    readonly spacingMm: number;
    readonly maximumSpacingMm: number;
  };
  /** Gancho de las barras superiores dentro de la columna 1 (9.2.5.8). */
  readonly hookMm: number;
  readonly availableHookMm: number;
}

export interface StrapFootingResult {
  readonly ok: true;
  readonly input: StrapFootingInput;
  /** Largo B1 de la zapata 1 (a lo largo de la contratrabe) y su ancho W1. */
  readonly exteriorLengthMm: number;
  readonly exteriorWidthMm: number;
  readonly eccentricityMm: number;
  readonly reactions: {
    readonly service: { readonly exteriorKn: number; readonly interiorKn: number };
    readonly ultimate: { readonly exteriorKn: number; readonly interiorKn: number; readonly exteriorColumnKn: number };
    /** R2 con la columna 1 a carga total y la 2 sólo con muerta. */
    readonly minimumInteriorKn: number;
  };
  readonly exterior: StripFootingResult;
  readonly interior: FootingDesignResult;
  readonly strap: StrapBeamDesign;
  /** Cortante y momento últimos de la contratrabe, del lindero al eje de la columna 2. */
  readonly diagram: { readonly xMm: readonly number[]; readonly shearKn: readonly number[]; readonly momentKnm: readonly number[] };
  readonly checks: readonly ElementCheck[];
  readonly governingRatio: number;
  readonly status: 'pass' | 'fail' | 'warning';
}

type StrapError = { readonly ok: false; readonly errors: readonly string[] };

const AGGREGATE_MM = 19;

function validate(input: StrapFootingInput): string[] {
  const errors: string[] = [];
  if (!isDesignCodeId(input.code)) return ['Norma de diseño desconocida.'];
  for (const [column, label] of [[input.exterior, 'Columna 1'], [input.interior, 'Columna 2']] as const) {
    if (!isPositiveFinite(column.widthMm) || !isPositiveFinite(column.depthMm)) errors.push(`${label}: dimensiones inválidas.`);
    if (!Number.isFinite(column.deadKn) || column.deadKn < 0 || !Number.isFinite(column.liveKn) || column.liveKn < 0) errors.push(`${label}: cargas inválidas.`);
    if (column.deadKn + column.liveKn <= 0) errors.push(`${label}: debe bajar alguna carga.`);
  }
  const positive: [number, string][] = [
    [input.spacingMm, 'Distancia entre ejes'], [input.allowablePressureKpa, 'Capacidad del suelo'], [input.fcMpa, "f'c"], [input.fyMpa, 'fy'],
    [input.coverMm, 'Recubrimiento'], [input.barDiameterMm, 'Varilla de las zapatas'], [input.strap.barDiameterMm, 'Varilla de la contratrabe'],
    [input.strap.stirrupDiameterMm, 'Estribo de la contratrabe'],
  ];
  for (const [value, label] of positive) if (!isPositiveFinite(value)) errors.push(`${label} debe ser mayor que cero.`);
  if (input.exteriorLengthMm !== null && (!isPositiveFinite(input.exteriorLengthMm) || input.exteriorLengthMm <= input.exterior.widthMm)) {
    errors.push('El largo de la zapata 1 debe ser mayor que la columna 1.');
  }
  for (const [value, label] of [[input.strap.widthMm, 'ancho'], [input.strap.heightMm, 'peralte']] as const) {
    if (value !== null && !isPositiveFinite(value)) errors.push(`El ${label} de la contratrabe debe ser mayor que cero.`);
  }
  if (errors.length) return errors;
  if (input.spacingMm <= (input.exterior.widthMm + input.interior.widthMm) / 2) errors.push('Las columnas se traslapan: aumenta la distancia entre ejes.');
  return errors;
}

/** Combinación que rige: la de mayor carga factorizada en la columna 1. */
function governingCombination(input: StrapFootingInput): LoadCombination {
  const factored = (combination: LoadCombination) => combination.dead * input.exterior.deadKn + combination.live * input.exterior.liveKn;
  return input.combinations.reduce((best, combination) => factored(combination) > factored(best) ? combination : best);
}

/** Estática de la contratrabe con la zapata 1 de largo B1. */
function statics(input: StrapFootingInput, lengthMm: number) {
  const e = lengthMm / 2 - input.exterior.widthMm / 2;
  const k = input.spacingMm / (input.spacingMm - e);
  return { e, k };
}

/** B1 con W1 ≈ 2B1 (la zapata se alarga sobre el lindero), iterando porque R1 depende de B1. */
function exteriorLength(input: StrapFootingInput): number {
  if (input.exteriorLengthMm !== null) return input.exteriorLengthMm;
  const service = input.exterior.deadKn + input.exterior.liveKn;
  let length = Math.max(ceilTo(Math.sqrt(service / (2 * input.allowablePressureKpa)) * 1e3, 50), input.exterior.widthMm + 200);
  for (let step = 0; step < 30; step += 1) {
    const { k } = statics(input, length);
    const next = Math.max(ceilTo(Math.sqrt(service * k / (2 * input.allowablePressureKpa)) * 1e3, 50), input.exterior.widthMm + 200);
    if (next === length) break;
    length = next;
  }
  return length;
}

/** Cortante y momento de la contratrabe como cuerpo libre del lindero a la columna 2 (hacia arriba positivo). */
function strapActions(input: StrapFootingInput, lengthMm: number, exteriorUltimateKn: number, columnUltimateKn: number) {
  const x1 = input.exterior.widthMm / 2;
  const x2 = x1 + input.spacingMm;
  const w = exteriorUltimateKn / lengthMm; // kN/mm hacia arriba bajo la zapata 1
  const shearAt = (x: number) => w * Math.min(x, lengthMm) - (x >= x1 ? columnUltimateKn : 0);
  const momentAt = (x: number) => {
    const soil = x <= lengthMm ? w * x ** 2 / 2 : exteriorUltimateKn * (x - lengthMm / 2);
    return (soil - (x > x1 ? columnUltimateKn * (x - x1) : 0)) / 1e3; // kN·m
  };
  const stations = 200;
  const xMm = Array.from({ length: stations + 1 }, (_, index) => x2 * index / stations);
  // Estaciones exactas en los puntos de quiebre.
  for (const x of [x1, Math.min(lengthMm, x2), columnUltimateKn / w]) if (x > 0 && x < x2) xMm.push(x);
  xMm.sort((left, right) => left - right);
  return { x1, x2, w, shearAt, momentAt, xMm, shearKn: xMm.map(shearAt), momentKnm: xMm.map(momentAt) };
}

function layer(code: DesignCode, momentKnm: number, widthMm: number, depthMm: number, heightMm: number, input: StrapFootingInput): StrapLayer {
  const { fcMpa: fc, fyMpa: fy } = input;
  const db = input.strap.barDiameterMm;
  const required = momentKnm > 0
    ? requiredFlexuralSteelMm2(momentKnm, widthMm, depthMm, fy, fc, depthMm, code.flexureFactor, code.tensionControlledStrain) ?? Number.POSITIVE_INFINITY
    : 0;
  const minimum = code.beam.minimumSteel(widthMm, depthMm, heightMm, fc, fy, depthMm);
  const maximum = code.beam.maximumSteel(widthMm, depthMm, depthMm, fc, fy);
  const target = Math.max(required, minimum);
  const count = Math.max(2, Number.isFinite(target) ? Math.ceil(target / barArea(db) - 1e-9) : 2);
  const provided = count * barArea(db);
  const capacity = flexuralCapacity(Math.min(provided, maximum), widthMm, depthMm, fy, fc, depthMm, code.flexureFactor);
  const clear = (widthMm - 2 * (input.coverMm + input.strap.stirrupDiameterMm) - count * db) / (count - 1);
  return {
    momentKnm, requiredMm2: required, minimumMm2: minimum, maximumMm2: maximum, barCount: count, providedMm2: provided,
    strengthKnm: capacity.strengthKnm, resistanceFactor: capacity.resistanceFactor, clearSpacingMm: clear,
  };
}

function strapBeam(code: DesignCode, input: StrapFootingInput, actions: ReturnType<typeof strapActions>, widthMm: number, heightMm: number): StrapBeamDesign {
  const { fcMpa: fc, fyMpa: fy } = input;
  const ds = input.strap.stirrupDiameterMm;
  const d = heightMm - input.coverMm - ds - input.strap.barDiameterMm / 2;
  const negativeIndex = actions.momentKnm.reduce((best, value, index) => value < actions.momentKnm[best]! ? index : best, 0);
  const negative = Math.max(0, -actions.momentKnm[negativeIndex]!);
  const positive = Math.max(0, ...actions.momentKnm);
  const top = layer(code, negative, widthMm, d, heightMm, input);
  const bottom = layer(code, positive, widthMm, d, heightMm, input);

  // Cortante a d del paño interior de la columna 1 y en el tramo libre (constante R1u − P1u).
  const face = input.exterior.widthMm + d;
  const demand = Math.max(Math.abs(actions.shearAt(Math.min(face, actions.x2))), Math.abs(actions.shearAt(actions.x2 - 1)));
  const phi = code.shearFactor;
  const concreteN = 0.17 * Math.sqrt(fc) * widthMm * d;
  const steelN = Math.max(0, demand * 1e3 / phi - concreteN);
  const legs = 2 * barArea(ds);
  const minimumRatio = Math.max(0.062 * Math.sqrt(fc), 0.35) * widthMm / fy;
  const high = steelN > 0.33 * Math.sqrt(fc) * widthMm * d;
  // NTC 9.5.1.2: estribos cerrados a no más de la mitad de la menor dimensión ni de 300 mm.
  const strapRule = code.refs.strapBeam.standard !== 'complementary' ? Math.min(Math.min(widthMm, heightMm) / 2, 300) : Number.POSITIVE_INFINITY;
  const maximumSpacing = Math.min(high ? Math.min(d / 4, 300) : Math.min(d / 2, 600), strapRule);
  const required = legs / Math.max(steelN / (fy * d), minimumRatio);
  const spacing = Math.max(50, floorTo(Math.min(required, maximumSpacing), 25) || floorTo(Math.min(required, maximumSpacing), 5));
  const hook = code.hookedDevelopmentMm(input.strap.barDiameterMm, fy, fc);
  return {
    widthMm, heightMm, effectiveDepthMm: d,
    clearSpanMm: input.spacingMm - input.exterior.widthMm / 2 - input.interior.widthMm / 2,
    top, bottom,
    negativeAtMm: actions.xMm[negativeIndex]!,
    shear: {
      demandKn: demand,
      concreteKn: phi * concreteN / 1e3,
      strengthKn: phi * (concreteN + legs * fy * d / spacing) / 1e3,
      sectionStrengthKn: phi * (concreteN + 0.66 * Math.sqrt(fc) * widthMm * d) / 1e3,
      spacingMm: spacing,
      maximumSpacingMm: maximumSpacing,
    },
    hookMm: hook,
    availableHookMm: input.exterior.widthMm - input.coverMm,
  };
}

const strapPasses = (code: DesignCode, input: StrapFootingInput, beam: StrapBeamDesign) =>
  Number.isFinite(beam.top.requiredMm2) && beam.top.requiredMm2 <= 0.75 * beam.top.maximumMm2 && beam.shear.demandKn <= beam.shear.sectionStrengthKn
  && Math.min(beam.top.clearSpacingMm, beam.bottom.clearSpacingMm) >= code.beam.minimumClearSpacing(input.strap.barDiameterMm, AGGREGATE_MM);

/** Prefija las revisiones de una zapata para listarlas junto a las de la contratrabe. */
const prefixed = (checks: readonly ElementCheck[], prefix: string, label: string): ElementCheck[] =>
  checks.filter((check) => check.id !== 'load-factors').map((check) => ({ ...check, id: `${prefix}-${check.id}`, label: `${label}: ${check.label.charAt(0).toLowerCase()}${check.label.slice(1)}` }));

export function designStrapFooting(input: StrapFootingInput): StrapFootingResult | StrapError {
  const errors = validate(input);
  if (errors.length) return { ok: false, errors };
  const code = designCode(input.code);
  const refs = code.refs;
  const length = exteriorLength(input);
  const { e, k } = statics(input, length);
  if (e >= input.spacingMm) return { ok: false, errors: ['La zapata 1 es tan larga que su centro pasa de la columna 2: acorta la zapata o separa las columnas.'] };

  const combination = governingCombination(input);
  const p1 = input.exterior.deadKn + input.exterior.liveKn;
  const p2 = input.interior.deadKn + input.interior.liveKn;
  const serviceExterior = p1 * k;
  const serviceInterior = p2 - p1 * (k - 1);
  const minimumInterior = input.interior.deadKn - p1 * (k - 1);
  const p1u = combination.dead * input.exterior.deadKn + combination.live * input.exterior.liveKn;
  const p2u = combination.dead * input.interior.deadKn + combination.live * input.interior.liveKn;
  const r1u = p1u * k;

  // Zapata 1: corrida bajo la contratrabe con la reacción repartida en su largo B1.
  const initialWidth = input.strap.widthMm ?? Math.max(code.refs.strapBeam.standard !== 'complementary' ? 450 : 300, input.exterior.depthMm);
  const exteriorFor = (strapWidth: number) => designStripFooting({
    code: input.code, wallWidthMm: strapWidth, wallMaterial: 'concrete', supportName: 'contratrabe',
    deadKnPerM: input.exterior.deadKn * k / (length / 1e3), liveKnPerM: input.exterior.liveKn * k / (length / 1e3),
    combinations: [combination], allowablePressureKpa: input.allowablePressureKpa, fcMpa: input.fcMpa, fyMpa: input.fyMpa,
    widthMm: null, thicknessMm: input.thicknessMm, coverMm: input.coverMm, barDiameterMm: input.barDiameterMm, distributionBarDiameterMm: input.barDiameterMm,
  });

  const actions = strapActions(input, length, r1u, p1u);
  const clearSpan = input.spacingMm - input.exterior.widthMm / 2 - input.interior.widthMm / 2;
  // NTC 9.5.1.1: menor dimensión ≥ claro libre/20 y ≥ 450 mm.
  const minimumDimension = code.refs.strapBeam.standard !== 'complementary' ? Math.max(450, clearSpan / 20) : 0;
  // Sección automática: el menor peralte (y luego el menor ancho, hasta 30 cm más) en que el armado cabe en una capa.
  const baseWidth = input.strap.widthMm ?? Math.max(initialWidth, ceilTo(minimumDimension, 50));
  const widths = input.strap.widthMm === null ? Array.from({ length: 7 }, (_, step) => baseWidth + 50 * step) : [baseWidth];
  const heights = input.strap.heightMm === null
    ? Array.from({ length: 60 }, (_, step) => Math.max(ceilTo(Math.max(minimumDimension, clearSpan / 10), 50), 400) + 50 * step)
    : [input.strap.heightMm];
  let section = { width: baseWidth, height: heights[heights.length - 1]! };
  search: for (const height of heights) {
    for (const width of widths) {
      if (strapPasses(code, input, strapBeam(code, input, actions, width, height))) { section = { width, height }; break search; }
    }
  }
  if (input.strap.heightMm !== null) section = { ...section, height: input.strap.heightMm };
  const { width, height } = section;
  const beam = strapBeam(code, input, actions, width, height);

  const exterior = exteriorFor(width);
  if (!exterior.ok) return { ok: false, errors: exterior.errors.map((error) => `Zapata 1: ${error}`) };
  const interior = designFooting({
    code: input.code, columnWidthMm: input.interior.widthMm, columnDepthMm: input.interior.depthMm,
    deadKn: input.interior.deadKn, liveKn: input.interior.liveKn, combinations: input.combinations,
    serviceMomentXKnm: 0, serviceMomentYKnm: 0, ultimateMomentXKnm: 0, ultimateMomentYKnm: 0,
    allowablePressureKpa: input.allowablePressureKpa, fcMpa: input.fcMpa, fyMpa: input.fyMpa,
    thicknessMm: input.thicknessMm, sideXMm: null, sideYMm: null, coverMm: input.coverMm, barDiameterMm: input.barDiameterMm, seismicCombination: false,
  });
  if (!interior.ok) return { ok: false, errors: interior.errors.map((error) => `Zapata 2: ${error}`) };

  const gap = input.exterior.widthMm / 2 + input.spacingMm - interior.sideXMm / 2 - length;
  const strapRef = refs.strapBeam;
  const verified = strapRef.standard !== 'complementary';
  const combinationText = `${combination.label} · P1u = ${p1u.toFixed(0)} kN, R1u = ${r1u.toFixed(0)} kN`;
  const checks: ElementCheck[] = [
    {
      id: 'strap-balance', label: 'Equilibrio de la columna interior', status: minimumInterior > 0 ? 'pass' : 'fail',
      demand: p1 * (k - 1), capacity: input.interior.deadKn, unit: 'kN', ratio: p1 * (k - 1) / Math.max(input.interior.deadKn, 1e-9),
      reference: complementary('Estática'),
      note: minimumInterior > 0
        ? `R2 mínima = CM2 − P1·e/(L − e) = ${minimumInterior.toFixed(0)} kN > 0: la columna 2 retiene la contratrabe.`
        : 'La carga muerta de la columna 2 no alcanza a equilibrar la excentricidad: alarga la contratrabe, reduce B1 o ancla la columna 2.',
    },
    {
      id: 'strap-gap', label: 'Separación entre zapatas', status: gap >= 0 ? 'pass' : 'fail', demand: 0, capacity: gap, unit: 'mm',
      reference: complementary('Geometría'),
      note: gap >= 0 ? `Quedan ${Math.round(gap)} mm libres entre las zapatas.` : 'Las zapatas se traslapan: usa una zapata combinada.',
    },
    tracedAt(capacityCheck('strap-flexure-top', 'Contratrabe: flexión negativa', beam.top.momentKnm, beam.top.strengthKnm, 'kN·m', refs.flexure,
      `${beam.top.barCount} barras superiores · FR ${beam.top.resistanceFactor.toFixed(2)}.`),
    `x = ${(beam.negativeAtMm / 1e3).toFixed(2)} m del lindero · lecho superior`, combinationText),
    capacityCheck('strap-flexure-bottom', 'Contratrabe: flexión positiva', beam.bottom.momentKnm, beam.bottom.strengthKnm, 'kN·m', refs.flexure),
    capacityCheck('strap-steel-min', 'Contratrabe: acero mínimo', beam.top.minimumMm2, Math.min(beam.top.providedMm2, beam.bottom.providedMm2), 'mm²', refs.steelMin),
    capacityCheck('strap-steel-max', 'Contratrabe: acero máximo', beam.top.providedMm2, beam.top.maximumMm2, 'mm²', refs.steelMax, code.beam.maximumSteelNote),
    capacityCheck('strap-bar-spacing', 'Contratrabe: separación libre de barras', code.beam.minimumClearSpacing(input.strap.barDiameterMm, AGGREGATE_MM),
      Math.min(beam.top.clearSpacingMm, beam.bottom.clearSpacingMm), 'mm', refs.barSpacing, 'Si no caben en una capa, aumenta el ancho o usa varilla más gruesa.'),
    tracedAt(capacityCheck('strap-shear', 'Contratrabe: cortante', beam.shear.demandKn, beam.shear.strengthKn, 'kN', refs.shear,
      `Estribos de 2 ramas @ ${beam.shear.spacingMm} mm · φVc = ${beam.shear.concreteKn.toFixed(0)} kN.`), 'A d del paño de la columna 1 y tramo libre', combinationText),
    capacityCheck('strap-shear-section', 'Contratrabe: cortante máximo por sección', beam.shear.demandKn, beam.shear.sectionStrengthKn, 'kN', refs.shearSection),
    capacityCheck('strap-stirrups', 'Contratrabe: separación de estribos', beam.shear.spacingMm, beam.shear.maximumSpacingMm, 'mm', verified ? strapRef : refs.stirrupSpacing,
      verified ? 'Estribos cerrados a no más de la mitad de la menor dimensión ni de 300 mm.' : 'd/2 ≤ 600 mm (d/4 ≤ 300 mm con cortante alto).'),
    {
      id: 'strap-anchorage', label: 'Contratrabe: anclaje en la columna de lindero', status: beam.hookMm <= beam.availableHookMm ? 'pass' : 'fail',
      demand: beam.hookMm, capacity: beam.availableHookMm, unit: 'mm', ratio: beam.hookMm / beam.availableHookMm,
      reference: verified ? strapRef : refs.hook,
      note: `Las barras superiores rematan con gancho estándar dentro de la columna 1 (ldh = ${Math.round(beam.hookMm)} mm) y siguen corridas a través de la columna 2.`,
    },
  ];
  if (verified) {
    checks.splice(2, 0, capacityCheck('strap-dimension', 'Contratrabe: dimensión mínima', minimumDimension, Math.min(width, height), 'mm', strapRef,
      `Menor dimensión ≥ claro libre/20 = ${Math.round(clearSpan / 20)} mm y ≥ 450 mm.`));
  }
  checks.push(
    ...prefixed(exterior.checks, 'f1', 'Zapata 1'),
    ...prefixed(interior.checks, 'f2', 'Zapata 2'),
    { id: 'interior-load', label: 'Zapata 2 con P2 completa', status: 'info', reference: complementary('Del lado seguro'),
      note: `La contratrabe descarga la zapata 2 en ${(p1 * (k - 1)).toFixed(0)} kN (R2 = ${serviceInterior.toFixed(0)} kN de servicio); se diseña con P2 = ${p2.toFixed(0)} kN.` },
    { id: 'load-factors', label: 'Combinaciones de carga', status: 'info', reference: refs.loadFactors, note: `${combinationText}; P2u = ${p2u.toFixed(0)} kN.` },
  );

  return {
    ok: true,
    input,
    exteriorLengthMm: length,
    exteriorWidthMm: exterior.widthMm,
    eccentricityMm: e,
    reactions: {
      service: { exteriorKn: serviceExterior, interiorKn: serviceInterior },
      ultimate: { exteriorKn: r1u, interiorKn: p2u - (r1u - p1u), exteriorColumnKn: p1u },
      minimumInteriorKn: minimumInterior,
    },
    exterior,
    interior,
    strap: beam,
    diagram: { xMm: actions.xMm, shearKn: actions.shearKn, momentKnm: actions.momentKnm },
    checks,
    governingRatio: governingRatio(checks.filter((check) => ['strap-flexure-top', 'strap-flexure-bottom', 'strap-shear', 'strap-shear-section'].includes(check.id)
      || check.id === 'f1-flexure' || check.id === 'f1-one-way' || check.id === 'f1-bearing' || check.id === 'f2-bearing' || check.id === 'f2-punching'
      || check.id.startsWith('f2-flexure') || check.id.startsWith('f2-one-way'))),
    status: overallStatus(checks),
  };
}
