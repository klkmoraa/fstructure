import { designCode, isDesignCodeId, type DesignCode, type DesignCodeId, type LoadCombination } from './codes';
import { sizeFactor } from './footing';
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

/**
 * Zapata combinada rectangular para dos columnas alineadas en X. Se supone
 * rígida: la presión del suelo varía linealmente a lo largo y es uniforme a lo
 * ancho. La longitud centra la resultante de servicio bajo la zapata cuando la
 * geometría lo permite (voladizo izquierdo dado, típico de lindero). La
 * dirección larga se diseña como viga con las columnas como cargas
 * concentradas; la corta, como voladizos en una banda bajo cada columna.
 */
export interface CombinedFootingColumn {
  /** Dimensión paralela a la zapata (X). */
  readonly widthMm: number;
  /** Dimensión transversal (Y). */
  readonly depthMm: number;
  readonly deadKn: number;
  readonly liveKn: number;
}

export interface CombinedFootingInput {
  readonly code: DesignCodeId;
  readonly columns: readonly [CombinedFootingColumn, CombinedFootingColumn];
  /** Distancia entre ejes de columnas. */
  readonly spacingMm: number;
  /** Del eje de la columna 1 al borde izquierdo; `null` = al paño exterior (lindero). */
  readonly leftOverhangMm: number | null;
  readonly combinations: readonly LoadCombination[];
  readonly allowablePressureKpa: number;
  readonly fcMpa: number;
  readonly fyMpa: number;
  /** `null` dimensiona el ancho con la presión admisible. */
  readonly widthMm: number | null;
  /** `null` busca el peralte mínimo que cumple penetración y cortante. */
  readonly thicknessMm: number | null;
  readonly coverMm: number;
  readonly longitudinalBarMm: number;
  readonly transverseBarMm: number;
}

export interface CombinedLayer {
  /** Diámetro usado: el pedido o uno mayor si con él las barras quedarían a menos de 10 cm. */
  readonly diameterMm: number;
  readonly requiredMm2: number;
  readonly minimumMm2: number;
  readonly providedMm2: number;
  readonly barCount: number;
  readonly spacingMm: number;
  readonly maximumSpacingMm: number;
  readonly strengthKnm: number;
  readonly resistanceFactor: number;
  readonly effectiveDepthMm: number;
  readonly momentKnm: number;
}

export interface CombinedPunching {
  readonly column: 1 | 2;
  readonly sides: number;
  readonly perimeterMm: number;
  readonly demandKn: number;
  readonly demandStressMpa: number;
  readonly strengthStressMpa: number;
  readonly alphaS: number;
  /** Rectángulo crítico [x0, x1] × [y0, y1] recortado a la zapata, mm. */
  readonly rectangle: { readonly x0: number; readonly x1: number; readonly y0: number; readonly y1: number };
}

export interface CombinedBand extends CombinedLayer {
  readonly column: 1 | 2;
  readonly widthMm: number;
  readonly cantileverMm: number;
  readonly developmentLengthMm: number;
  readonly hookLengthMm: number;
  readonly availableAnchorageMm: number;
  readonly anchorage: 'straight' | 'hook' | 'insufficient';
}

export interface CombinedFootingResult {
  readonly ok: true;
  readonly input: CombinedFootingInput;
  readonly lengthMm: number;
  readonly widthMm: number;
  readonly thicknessMm: number;
  /** Ejes de las columnas desde el borde izquierdo. */
  readonly columnAtMm: readonly [number, number];
  readonly service: { readonly resultantAtMm: number; readonly eccentricityMm: number; readonly maximumKpa: number; readonly minimumKpa: number };
  readonly ultimate: { readonly minimumKpa: number; readonly maximumKpa: number };
  /** Envolventes últimas a lo largo (todo el ancho): M > 0 tensiona abajo. */
  readonly diagram: { readonly xMm: readonly number[]; readonly shearMaxKn: readonly number[]; readonly shearMinKn: readonly number[]; readonly momentMaxKnm: readonly number[]; readonly momentMinKnm: readonly number[] };
  readonly bottom: CombinedLayer;
  /** `null` si no hay momento negativo. */
  readonly top: CombinedLayer | null;
  readonly transverseMinimumSpacingMm: number;
  readonly bands: readonly [CombinedBand, CombinedBand];
  readonly punching: readonly [CombinedPunching, CombinedPunching];
  readonly oneWay: { readonly demandKn: number; readonly strengthKn: number; readonly atMm: number };
  readonly checks: readonly ElementCheck[];
  readonly governingRatio: number;
  readonly status: 'pass' | 'fail' | 'warning';
}

const ALPHA_BY_SIDES: Record<number, number> = { 4: 40, 3: 30, 2: 20 };
/** Cuantía máxima del lecho longitudinal que se admite subir por cortante antes de engrosar. */
const SHEAR_RATIO_CAP = 0.005;
/** Separación práctica mínima entre barras de la parrilla (criterio complementario); si no cabe, sube el diámetro. */
const MINIMUM_SPACING_MM = 100;
const UPSIZE_DIAMETERS = [12.7, 15.9, 19.1, 22.2, 25.4, 28.6, 31.8, 34.9];
const STATIONS = 240;

function validate(input: CombinedFootingInput): string[] {
  const errors: string[] = [];
  if (!isDesignCodeId(input.code)) return ['Norma de diseño desconocida.'];
  const positive: [number, string][] = [
    [input.spacingMm, 'Distancia entre ejes'], [input.allowablePressureKpa, 'Capacidad del suelo'], [input.fcMpa, "f'c"], [input.fyMpa, 'fy'],
    [input.coverMm, 'Recubrimiento'], [input.longitudinalBarMm, 'Varilla longitudinal'], [input.transverseBarMm, 'Varilla transversal'],
  ];
  input.columns.forEach((column, index) => {
    positive.push([column.widthMm, `Columna ${index + 1}: c1`], [column.depthMm, `Columna ${index + 1}: c2`]);
    if (!Number.isFinite(column.deadKn) || column.deadKn < 0 || !Number.isFinite(column.liveKn) || column.liveKn < 0) errors.push(`Columna ${index + 1}: las cargas deben ser cero o positivas.`);
  });
  for (const [value, label] of positive) if (!isPositiveFinite(value)) errors.push(`${label} debe ser mayor que cero.`);
  if (errors.length) return errors;
  const [first, second] = input.columns;
  if (first.deadKn + first.liveKn + second.deadKn + second.liveKn <= 0) errors.push('Las columnas deben bajar alguna carga.');
  if (input.spacingMm <= (first.widthMm + second.widthMm) / 2) errors.push('Las columnas se traslapan: aumenta la distancia entre ejes.');
  if (input.leftOverhangMm !== null && input.leftOverhangMm < first.widthMm / 2) errors.push('El voladizo izquierdo no alcanza a cubrir la columna 1.');
  if (input.widthMm !== null && input.widthMm <= Math.max(first.depthMm, second.depthMm)) errors.push('El ancho de la zapata debe ser mayor que las columnas.');
  if (input.thicknessMm !== null && input.thicknessMm <= input.coverMm + 2 * (input.longitudinalBarMm + input.transverseBarMm)) errors.push('El peralte es insuficiente para el recubrimiento.');
  return errors;
}

interface Plan { length: number; width: number; x1: number; x2: number }

function sizePlan(input: CombinedFootingInput): Plan & { resultant: number; eccentricity: number; maximum: number; minimum: number } {
  const [first, second] = input.columns;
  const p1 = first.deadKn + first.liveKn;
  const p2 = second.deadKn + second.liveKn;
  const x1 = input.leftOverhangMm ?? first.widthMm / 2;
  const x2 = x1 + input.spacingMm;
  const resultant = (p1 * x1 + p2 * x2) / (p1 + p2);
  // Centra la resultante si la columna 2 queda dentro; si no, el borde derecho va al paño de la columna 2.
  const length = ceilTo(Math.max(2 * resultant, x2 + second.widthMm / 2), 50);
  const eccentricity = resultant - length / 2;
  const bending = 6 * Math.abs(eccentricity) / length;
  const minimumWidth = Math.max(first.depthMm, second.depthMm) + 200;
  const width = input.widthMm ?? Math.max(ceilTo((p1 + p2) * (1 + bending) / (input.allowablePressureKpa * length / 1e3) * 1e3, 50), minimumWidth);
  const area = length * width / 1e6;
  return { length, width, x1, x2, resultant, eccentricity, maximum: (p1 + p2) / area * (1 + bending), minimum: (p1 + p2) / area * (1 - bending) };
}

/** Carga de línea del suelo w(x) = A + B(x − L/2) (kN/mm) y sus integrales para una combinación. */
function lineLoad(loads: readonly [number, number], at: readonly [number, number], length: number) {
  const total = loads[0] + loads[1];
  const center = (loads[0] * at[0] + loads[1] * at[1]) / total;
  const a = total / length;
  const b = 12 * a * (center - length / 2) / length ** 2;
  const shear = (x: number) => a * x + b * (x ** 2 / 2 - length * x / 2) - (x > at[0] ? loads[0] : 0) - (x > at[1] ? loads[1] : 0);
  const moment = (x: number) => a * x ** 2 / 2 + b * (x ** 3 / 6 - length * x ** 2 / 4) - loads[0] * Math.max(0, x - at[0]) - loads[1] * Math.max(0, x - at[1]);
  const load = (x: number) => a + b * (x - length / 2);
  return { shear, moment, load, total };
}

function layer(code: DesignCode, input: CombinedFootingInput, momentKnm: number, widthMm: number, depthMm: number, thicknessMm: number, diameterMm: number, applyMinimum: boolean, shearSteelMm2 = 0): CombinedLayer {
  const minimum = Math.max(applyMinimum ? code.footing.minimumSteelRatio * widthMm * thicknessMm : 0, shearSteelMm2);
  const maximumSpacing = code.footing.maximumSpacing(thicknessMm);
  const arrangement = (db: number) => {
    // Una barra más gruesa sube su centro: el peralte efectivo baja la mitad de la diferencia.
    const depth = depthMm - (db - diameterMm) / 2;
    const required = requiredFlexuralSteelMm2(momentKnm, widthMm, depth, input.fyMpa, input.fcMpa, depth, code.flexureFactor, code.tensionControlledStrain) ?? Number.POSITIVE_INFINITY;
    const target = Math.max(required, minimum);
    const usable = widthMm - 2 * input.coverMm - db;
    let count = Math.max(2, Number.isFinite(target) ? Math.ceil(target / barArea(db)) : 2);
    if (usable / (count - 1) > maximumSpacing) count = Math.ceil(usable / maximumSpacing) + 1;
    return { db, depth, required, usable, count };
  };
  const candidates = [diameterMm, ...UPSIZE_DIAMETERS.filter((db) => db > diameterMm)].map(arrangement);
  const chosen = candidates.find((item) => item.usable / (item.count - 1) >= MINIMUM_SPACING_MM) ?? candidates[candidates.length - 1]!;
  const { usable, count, depth } = chosen;
  const provided = count * barArea(chosen.db);
  const capacity = flexuralCapacity(provided, widthMm, depth, input.fyMpa, input.fcMpa, depth, code.flexureFactor);
  return {
    diameterMm: chosen.db, requiredMm2: chosen.required, minimumMm2: minimum, providedMm2: provided, barCount: count,
    spacingMm: floorTo(usable / (count - 1), 25) || floorTo(usable / (count - 1), 5), maximumSpacingMm: maximumSpacing,
    strengthKnm: capacity.strengthKnm, resistanceFactor: capacity.resistanceFactor, effectiveDepthMm: depth, momentKnm,
  };
}

function evaluate(code: DesignCode, input: CombinedFootingInput, plan: Plan, thicknessMm: number) {
  const { length, width, x1, x2 } = plan;
  const [first, second] = input.columns;
  const fc = input.fcMpa;
  const dLong = thicknessMm - input.coverMm - input.longitudinalBarMm / 2;
  const dTrans = thicknessMm - input.coverMm - input.longitudinalBarMm - input.transverseBarMm / 2;
  const average = (dLong + dTrans) / 2;
  const at = [x1, x2] as const;
  const combos = input.combinations.map((combination) => {
    const loads = [
      combination.dead * first.deadKn + combination.live * first.liveKn,
      combination.dead * second.deadKn + combination.live * second.liveKn,
    ] as const;
    return { combination, loads, line: lineLoad(loads, at, length) };
  });

  // Estaciones: malla regular más paños y secciones críticas.
  const faces = [x1 - first.widthMm / 2, x1 + first.widthMm / 2, x2 - second.widthMm / 2, x2 + second.widthMm / 2];
  const critical = [faces[0]! - dLong, faces[1]! + dLong, faces[2]! - dLong, faces[3]! + dLong].filter((x) => x > 0 && x < length);
  const xs = [...new Set([...Array.from({ length: STATIONS + 1 }, (_, index) => length * index / STATIONS), ...faces.filter((x) => x >= 0 && x <= length), ...critical])].sort((a, b) => a - b);
  const envelope = (pick: (line: ReturnType<typeof lineLoad>, x: number) => number) => ({
    max: xs.map((x) => Math.max(...combos.map((item) => pick(item.line, x)))),
    min: xs.map((x) => Math.min(...combos.map((item) => pick(item.line, x)))),
  });
  const shear = envelope((line, x) => line.shear(x));
  const moment = envelope((line, x) => line.moment(x) / 1e3); // kN·m

  // Momento positivo (tensión abajo) fuera de las columnas y en sus paños; negativo (tensión arriba) entre paños interiores.
  const insideColumn = (x: number) => (x > faces[0]! + 1e-6 && x < faces[1]! - 1e-6) || (x > faces[2]! + 1e-6 && x < faces[3]! - 1e-6);
  const positive = Math.max(0, ...xs.map((x, index) => insideColumn(x) ? 0 : moment.max[index]!));
  const negative = Math.max(0, ...xs.map((x, index) => x >= faces[1]! && x <= faces[2]! ? -moment.min[index]! : 0));
  const oneWayAt = critical.reduce((worst, x) => {
    const value = Math.max(...combos.map((item) => Math.abs(item.line.shear(x))));
    return value > worst.value ? { x, value } : worst;
  }, { x: critical[0] ?? 0, value: 0 });

  // Penetración en cada columna con la combinación de mayor carga; lados en el borde no cuentan.
  const phiTwoWay = code.twoWayShearFactor(false);
  const size = code.footing.punchingSizeFactor ? sizeFactor(average) : 1;
  const punching = input.columns.map((column, index): CombinedPunching => {
    const x = at[index]!;
    const governing = combos.reduce((worst, item) => item.loads[index]! > worst.loads[index]! ? item : worst);
    const pu = governing.loads[index]!;
    const x0 = Math.max(0, x - column.widthMm / 2 - average / 2);
    const x1r = Math.min(length, x + column.widthMm / 2 + average / 2);
    const y0 = Math.max(-width / 2, -column.depthMm / 2 - average / 2);
    const y1 = Math.min(width / 2, column.depthMm / 2 + average / 2);
    const sidesX = [x0 > 0, x1r < length].filter(Boolean).length;
    const sidesY = [y0 > -width / 2, y1 < width / 2].filter(Boolean).length;
    const perimeter = sidesX * (y1 - y0) + sidesY * (x1r - x0);
    const sides = sidesX + sidesY;
    const inside = governing.line.load(x) / width * (x1r - x0) * (y1 - y0) / 1e3; // kN
    const demandKn = Math.max(0, pu - inside);
    const alphaS = ALPHA_BY_SIDES[sides] ?? 20;
    const beta = Math.max(column.widthMm, column.depthMm) / Math.min(column.widthMm, column.depthMm);
    const vc = Math.min(0.33, 0.17 * (1 + 2 / beta), 0.083 * (2 + alphaS * average / Math.max(perimeter, 1))) * size * Math.sqrt(fc);
    return {
      column: (index + 1) as 1 | 2, sides, perimeterMm: perimeter, demandKn,
      demandStressMpa: perimeter > 0 ? demandKn * 1e3 / (perimeter * average) : Number.POSITIVE_INFINITY,
      strengthStressMpa: phiTwoWay * vc, alphaS, rectangle: { x0, x1: x1r, y0, y1 },
    };
  }) as unknown as readonly [CombinedPunching, CombinedPunching];

  const oneWayStrength = (depth: number, rho: number) => code.footing.oneWay === 'ntc'
    ? code.shearFactor * 0.66 * sizeFactor(depth) * Math.cbrt(rho) * Math.sqrt(fc) * width * depth / 1e3
    : code.shearFactor * 0.17 * Math.sqrt(fc) * width * depth / 1e3;
  return { combos, xs, shear, moment, positive, negative, oneWayAt, punching, dLong, dTrans, average, oneWayStrength, faces };
}

export function designCombinedFooting(input: CombinedFootingInput): CombinedFootingResult | { ok: false; errors: readonly string[] } {
  const errors = validate(input);
  if (errors.length) return { ok: false, errors };
  const code = designCode(input.code);
  const plan = sizePlan(input);
  // La sección crítica de cortante tensiona el lecho superior entre columnas y el inferior en los voladizos.
  const shearInTop = (state: ReturnType<typeof evaluate>) => state.oneWayAt.x > state.faces[1]! && state.oneWayAt.x < state.faces[2]! && state.negative > 1e-6;
  /**
   * NTC: el cortante sin estribos crece con ρ^(1/3). Si el acero de flexión no
   * alcanza, se aumenta el lecho en tensión de esa sección hasta ρ = 1 % antes
   * de engrosar la zapata. Devuelve el área adicional (0 si no hace falta).
   */
  const shearSteel = (state: ReturnType<typeof evaluate>) => {
    if (code.footing.oneWay !== 'ntc') return 0;
    const perRatio = state.oneWayStrength(state.dLong, 1);
    const needed = (state.oneWayAt.value / perRatio) ** 3;
    return Math.min(needed, SHEAR_RATIO_CAP) * plan.width * state.dLong;
  };
  const tensionRatio = (state: ReturnType<typeof evaluate>, h: number) => {
    const governing = layer(code, input, shearInTop(state) ? state.negative : state.positive, plan.width, state.dLong, h, input.longitudinalBarMm, true, shearSteel(state));
    return governing.providedMm2 / (plan.width * state.dLong);
  };
  const passes = (h: number) => {
    const state = evaluate(code, input, plan, h);
    return state.dLong >= code.footing.minimumEffectiveDepthMm
      && state.punching.every((item) => item.demandStressMpa <= item.strengthStressMpa)
      && state.oneWayAt.value <= state.oneWayStrength(state.dLong, tensionRatio(state, h));
  };
  let h = input.thicknessMm ?? 300;
  if (input.thicknessMm === null) for (; h < 2_500 && !passes(h); h += 50);
  const state = evaluate(code, input, plan, h);
  const { length, width, x1, x2 } = plan;
  const refs = code.refs;
  const extraForShear = shearSteel(state);
  const topGoverns = shearInTop(state);
  const bottom = layer(code, input, state.positive, width, state.dLong, h, input.longitudinalBarMm, true, topGoverns ? 0 : extraForShear);
  const top = state.negative > 1e-6 ? layer(code, input, state.negative, width, state.dLong, h, input.longitudinalBarMm, true, topGoverns ? extraForShear : 0) : null;
  const shearLayer = topGoverns && top ? top : bottom;
  const rho = shearLayer.providedMm2 / (width * state.dLong);
  const raisedForShear = extraForShear > Math.max(shearLayer.requiredMm2, code.footing.minimumSteelRatio * width * h) + 1;
  const oneWayStrength = state.oneWayStrength(state.dLong, rho);

  // Bandas transversales bajo cada columna: ancho c1 + d (criterio complementario), voladizo desde el paño en Y.
  const bands = input.columns.map((column, index) => {
    const x = [x1, x2][index]!;
    const bandWidth = Math.min(column.widthMm + state.dTrans, 2 * Math.min(x, length - x) + column.widthMm);
    const pu = Math.max(...state.combos.map((item) => item.loads[index]!));
    const cantilever = (width - column.depthMm) / 2;
    const momentKnm = pu / width * cantilever ** 2 / 2 / 1e3;
    const base = layer(code, input, momentKnm, bandWidth, state.dTrans, h, input.transverseBarMm, true);
    const development = code.developmentLength({
      diameterMm: base.diameterMm, fyMpa: input.fyMpa, fcMpa: input.fcMpa, topBar: false,
      clearSpacingMm: base.spacingMm - base.diameterMm, clearCoverMm: input.coverMm, minimumStirrups: false,
    });
    const hook = code.hookedDevelopmentMm(base.diameterMm, input.fyMpa, input.fcMpa);
    const available = cantilever - input.coverMm;
    return {
      ...base, column: (index + 1) as 1 | 2, widthMm: bandWidth, cantileverMm: cantilever,
      developmentLengthMm: development.lengthMm, hookLengthMm: hook, availableAnchorageMm: available,
      anchorage: (development.lengthMm <= available ? 'straight' : hook <= available ? 'hook' : 'insufficient') as CombinedBand['anchorage'],
    };
  }) as unknown as readonly [CombinedBand, CombinedBand];
  const transverseMinimum = code.footing.minimumSteelRatio * 1_000 * h;
  const transverseMinimumSpacing = Math.min(code.footing.maximumSpacing(h), floorTo(barArea(input.transverseBarMm) * 1_000 / transverseMinimum, 25) || 50);

  // w en kN/mm entre el ancho en mm: kN/mm², por 10⁶ en kPa.
  const ultimatePressures = state.combos.flatMap((item) => [item.line.load(0), item.line.load(length)].map((w) => w / width * 1e6));
  const combinations = input.combinations.map((combination) => combination.label).join(' · ');
  const service = { resultant: plan.resultant, eccentricity: plan.eccentricity, maximum: plan.maximum, minimum: plan.minimum };
  const at = (x: number) => `x = ${(x / 1e3).toFixed(2)} m`;

  const checks: ElementCheck[] = [
    tracedAt(capacityCheck('bearing', 'Presión máxima de servicio', service.maximum, input.allowablePressureKpa, 'kPa', complementary('Capacidad admisible del estudio geotécnico')),
      service.eccentricity > 1 ? 'Extremo derecho' : service.eccentricity < -1 ? 'Extremo izquierdo' : 'Presión uniforme', 'Servicio: cargas sin factorizar'),
    {
      id: 'kern', label: 'Resultante dentro del núcleo',
      status: service.minimum >= -1e-9 ? 'pass' : 'fail',
      demand: 6 * Math.abs(service.eccentricity) / length, capacity: 1, unit: '', ratio: 6 * Math.abs(service.eccentricity) / length,
      reference: refs.stability,
      note: Math.abs(service.eccentricity) < 1 ? 'La resultante de servicio queda al centro de la zapata.'
        : `Resultante a ${Math.abs(service.eccentricity).toFixed(0)} mm del centro${service.minimum < 0 ? ': parte de la zapata se levanta; acerca la columna 2 o usa contratrabe.' : '.'}`,
    },
    capacityCheck('min-depth', 'Peralte efectivo mínimo', code.footing.minimumEffectiveDepthMm, state.dLong, 'mm', refs.footingDepth),
    ...state.punching.map((item) => tracedAt(capacityCheck(`punching-${item.column}`, `Penetración en la columna ${item.column}`, item.demandStressMpa, item.strengthStressMpa, 'MPa', refs.punching,
      `${item.sides === 4 ? 'Columna interior' : item.sides === 3 ? 'Columna de borde (3 lados)' : 'Columna de esquina (2 lados)'}: bo = ${item.perimeterMm.toFixed(0)} mm, αs = ${item.alphaS}. Sin transferencia de momento de la columna.`),
    `Perímetro a d/2 de la columna ${item.column}`, 'Combinación con la mayor carga de esa columna')),
    tracedAt(capacityCheck('one-way', 'Cortante como viga (a lo largo)', state.oneWayAt.value, oneWayStrength, 'kN', refs.oneWay,
      code.footing.oneWay === 'ntc'
        ? `Sin estribos: 0.66·λs·ρ^(1/3)·√f′c con ρ = ${(rho * 100).toFixed(2)} % del lecho ${topGoverns ? 'superior' : 'inferior'}${raisedForShear ? ', aumentado por cortante para no engrosar la zapata' : ''}.`
        : `Sin estribos: 0.17·√f′c·B·d · FR ${code.shearFactor}.`),
    `${at(state.oneWayAt.x)} (a d del paño)`, combinations),
    tracedAt(capacityCheck('flexure-bottom', 'Flexión positiva (lecho inferior)', bottom.momentKnm, bottom.strengthKnm, 'kN·m', refs.footingFlexure, `FR ${bottom.resistanceFactor.toFixed(2)}.`),
      'Paños de columna y voladizos', combinations),
    ...(top ? [tracedAt(capacityCheck('flexure-top', 'Flexión negativa (lecho superior)', top.momentKnm, top.strengthKnm, 'kN·m', refs.footingFlexure, `FR ${top.resistanceFactor.toFixed(2)}.`),
      'Entre columnas', combinations)] : []),
    ...bands.map((band) => tracedAt(capacityCheck(`transverse-${band.column}`, `Flexión transversal bajo la columna ${band.column}`, band.momentKnm, band.strengthKnm, 'kN·m', refs.footingFlexure,
      `Banda de ${band.widthMm.toFixed(0)} mm = columna + d (criterio complementario); FR ${band.resistanceFactor.toFixed(2)}.`),
    `Paño de la columna ${band.column} en Y`, 'Combinación con la mayor carga de esa columna')),
    capacityCheck('steel-min', 'Acero mínimo longitudinal', bottom.minimumMm2, bottom.providedMm2, 'mm²', refs.footingMinSteel, `${(code.footing.minimumSteelRatio * 100).toFixed(2)} % de B·h.`),
    capacityCheck('spacing', 'Separación del refuerzo', Math.max(bottom.spacingMm, top?.spacingMm ?? 0, ...bands.map((band) => band.spacingMm)), bottom.maximumSpacingMm, 'mm', refs.footingSpacing,
      `Máximo: ${code.footing.maximumSpacingNote}.`),
    capacityCheck('min-spacing', 'Separación práctica mínima', MINIMUM_SPACING_MM, Math.min(bottom.spacingMm, top?.spacingMm ?? Number.POSITIVE_INFINITY, ...bands.map((band) => band.spacingMm)), 'mm',
      complementary('Práctica constructiva'), 'Si no cabe con 10 cm entre barras, el taller sube el diámetro; si ni con la #11 cabe, aumenta el ancho o el peralte.'),
    ...bands.map((band): ElementCheck => ({
      id: `anchorage-${band.column}`, label: `Anclaje transversal (columna ${band.column})`,
      status: band.anchorage === 'insufficient' ? 'fail' : 'pass',
      demand: band.anchorage === 'straight' ? band.developmentLengthMm : band.hookLengthMm, capacity: band.availableAnchorageMm, unit: 'mm',
      ratio: (band.anchorage === 'straight' ? band.developmentLengthMm : band.hookLengthMm) / band.availableAnchorageMm,
      reference: refs.anchorage,
      note: band.anchorage === 'straight' ? 'La barra recta desarrolla ld desde el paño.' : band.anchorage === 'hook' ? `Gancho estándar (ldh = ${Math.round(band.hookLengthMm)} mm).` : 'No cabe: usa varilla más delgada o ensancha la zapata.',
    })),
    { id: 'load-factors', label: 'Combinaciones de carga', status: 'info', reference: refs.loadFactors, note: `${combinations}; zapata rígida con presión lineal.` },
  ];
  if (!Number.isFinite(bottom.requiredMm2) || (top && !Number.isFinite(top.requiredMm2))) {
    checks.push({ id: 'section', label: 'Peralte insuficiente para flexión', status: 'fail', reference: refs.footingFlexure, note: 'Aumenta el peralte.' });
  }
  if (Math.min(...ultimatePressures) < 0) {
    checks.push({ id: 'ultimate-uplift', label: 'Presión última sin tensión', status: 'warning', reference: complementary('Estática'), note: 'Con cargas factorizadas la presión sale negativa en un extremo; la distribución lineal es sólo aproximada.' });
  }

  return {
    ok: true,
    input,
    lengthMm: length,
    widthMm: width,
    thicknessMm: h,
    columnAtMm: [x1, x2],
    service: { resultantAtMm: service.resultant, eccentricityMm: service.eccentricity, maximumKpa: service.maximum, minimumKpa: service.minimum },
    ultimate: { minimumKpa: Math.min(...ultimatePressures), maximumKpa: Math.max(...ultimatePressures) },
    diagram: { xMm: state.xs, shearMaxKn: state.shear.max, shearMinKn: state.shear.min, momentMaxKnm: state.moment.max, momentMinKnm: state.moment.min },
    bottom,
    top,
    transverseMinimumSpacingMm: transverseMinimumSpacing,
    bands,
    punching: state.punching,
    oneWay: { demandKn: state.oneWayAt.value, strengthKn: oneWayStrength, atMm: state.oneWayAt.x },
    checks,
    governingRatio: governingRatio(checks.filter((item) => ['bearing', 'one-way', 'flexure-bottom', 'flexure-top'].includes(item.id) || item.id.startsWith('punching') || item.id.startsWith('transverse'))),
    status: overallStatus(checks),
  };
}
