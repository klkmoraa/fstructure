import { analyzeBeam, type BeamAnalysis, type BeamEnd, type BeamSpanLoads, type CaseResponse } from './beamAnalysis';
import { designCode, isDesignCodeId, type DesignCode, type DesignCodeId, type DevelopmentLength, type LoadCombination } from './codes';
import {
  CONCRETE_UNIT_WEIGHT_KN_M3,
  STEEL_ELASTIC_MODULUS_MPA,
  barArea,
  capacityCheck,
  complementary,
  flexuralCapacity,
  floorTo,
  governingRatio,
  isPositiveFinite,
  overallStatus,
  rebarLabel,
  requiredFlexuralSteelMm2,
  type ElementCheck,
} from './shared';

export type { BeamEnd, BeamSpanLoads };

export interface BeamDesignInput {
  readonly code: DesignCodeId;
  readonly widthMm: number;
  readonly heightMm: number;
  /** Recubrimiento libre hasta el estribo. */
  readonly coverMm: number;
  readonly fcMpa: number;
  readonly fyMpa: number;
  readonly fyStirrupMpa: number;
  readonly spans: readonly BeamSpanLoads[];
  readonly leftEnd: BeamEnd;
  readonly rightEnd: BeamEnd;
  readonly includeSelfWeight: boolean;
  /** Combinaciones de resistencia de la norma (`designCode(code).loadCombinations`). */
  readonly combinations: readonly LoadCombination[];
  /** Fracción de la carga viva que actúa en forma permanente (W/Wm en la NTC). */
  readonly sustainedLiveRatio: number;
  /** ξ de la deflexión diferida según la duración de la carga sostenida. */
  readonly longTermXi: number;
  /** `null` elige el diámetro automáticamente. */
  readonly barDiameterMm: number | null;
  readonly stirrupDiameterMm: number | null;
  readonly maxAggregateMm: number;
  readonly damagesNonstructural: boolean;
  /** Ancho de las columnas o muros de apoyo en los extremos: longitud para anclar las barras. */
  readonly supportWidthMm: number;
}

export interface BarGroup { readonly count: number; readonly diameterMm: number }

/** Sección de un lecho: dos corridas más, opcionalmente, bastones. */
export interface BedSection {
  readonly bed: 'top' | 'bottom';
  readonly continuous: BarGroup;
  readonly extra: BarGroup | null;
  readonly perLayer: number;
  readonly layers: 1 | 2;
  readonly areaMm2: number;
  readonly requiredMm2: number;
  readonly minimumMm2: number;
  readonly maximumMm2: number;
  readonly effectiveDepthMm: number;
  /** dt: peralte al acero extremo en tensión, con el que se evalúa εt. */
  readonly extremeDepthMm: number;
  readonly strengthKnm: number;
  /** FR de flexión de la norma para esta sección. */
  readonly resistanceFactor: number;
  readonly clearSpacingMm: number;
  readonly minimumClearSpacingMm: number;
  /** El arreglo no alcanza la demanda o excede el acero máximo: se reporta para que falle a la vista. */
  readonly inadmissible: boolean;
}

export interface BeamBastion {
  readonly bed: 'top' | 'bottom';
  readonly bars: BarGroup;
  readonly startM: number;
  readonly endM: number;
  readonly peakAtM: number;
  readonly demandKnm: number;
  readonly developmentLengthMm: number;
  /** Separación y recubrimiento del renglón favorable de la tabla de desarrollo. */
  readonly developmentFavorable: boolean;
  /** El bastón llegó al extremo de la viga antes de desarrollar ld: requiere gancho en el apoyo. */
  readonly needsHook: boolean;
  readonly section: BedSection;
}

export interface SpanStirrups {
  readonly denseSpacingMm: number;
  readonly centerSpacingMm: number;
  readonly maximumSpacingMm: number;
  /** Tramos, en m desde el extremo izquierdo de la viga, donde rige `denseSpacingMm`. */
  readonly denseZones: readonly { readonly startM: number; readonly endM: number }[];
  readonly demandKn: number;
  readonly concreteStrengthKn: number;
  readonly strengthKn: number;
  readonly maximumSectionStrengthKn: number;
  readonly impractical: boolean;
}

export interface BeamSpanDesign {
  readonly startM: number;
  readonly lengthM: number;
  readonly cantilever: boolean;
  readonly positiveMomentKnm: number;
  readonly negativeLeftKnm: number;
  readonly negativeRightKnm: number;
  readonly shearKn: number;
  readonly stirrups: SpanStirrups;
  readonly effectiveInertiaRatio: number;
  readonly immediateMm: number;
  /** Flecha total (inmediata + diferida). */
  readonly deflectionMm: number;
  /** Flecha que se compara con el límite: total (NTC) o la posterior a los elementos no estructurales (ACI). */
  readonly checkedDeflectionMm: number;
  readonly deflectionLimitMm: number;
  /** Flecha inmediata por carga viva y su límite ℓ/360 (normas tipo ACI). */
  readonly liveDeflectionMm: number | null;
  readonly liveDeflectionLimitMm: number | null;
}

export interface BeamDiagram {
  readonly xM: readonly number[];
  /** Envolvente factorizada con alternancia de carga viva por claro. */
  readonly momentMaxKnm: readonly number[];
  readonly momentMinKnm: readonly number[];
  readonly shearMaxKn: readonly number[];
  readonly shearMinKn: readonly number[];
  /** Resistencia de diseño provista en cada estación (φMn⁺ y −φMn⁻). */
  readonly capacityPositiveKnm: readonly number[];
  readonly capacityNegativeKnm: readonly number[];
  /** Flecha total de servicio con inercias agrietadas por claro, mm (negativa hacia abajo). */
  readonly deflectionMm: readonly number[];
}

export interface BeamSectionCut {
  readonly label: string;
  readonly xM: number;
  readonly top: BedSection;
  readonly bottom: BedSection;
}

/** Anclaje de las barras en tensión dentro de un apoyo extremo. */
export interface BeamAnchorage {
  readonly end: 'left' | 'right';
  readonly bed: 'top' | 'bottom';
  readonly diameterMm: number;
  readonly straightMm: number;
  readonly hookMm: number;
  readonly availableMm: number;
  readonly kind: 'straight' | 'hook' | 'insufficient';
}

export interface BeamDesignResult {
  readonly ok: true;
  readonly input: BeamDesignInput;
  readonly totalLengthM: number;
  readonly nodesAtM: readonly number[];
  readonly selfWeightKnPerM: number;
  readonly solverRuns: number;
  readonly diagram: BeamDiagram;
  readonly spans: readonly BeamSpanDesign[];
  readonly stirrupDiameterMm: number;
  readonly continuousTop: BedSection;
  readonly continuousBottom: BedSection;
  readonly bastions: readonly BeamBastion[];
  readonly cuts: readonly BeamSectionCut[];
  readonly anchorages: readonly BeamAnchorage[];
  /** Traslape Clase B de las corridas, mm. */
  readonly splices: { readonly top: number; readonly bottom: number };
  readonly extremes: {
    readonly positiveMomentKnm: number;
    readonly negativeMomentKnm: number;
    readonly shearKn: number;
  };
  readonly deflection: {
    readonly governingSpan: number;
    readonly immediateMm: number;
    readonly totalMm: number;
    readonly checkedMm: number;
    readonly limitMm: number;
    readonly crackingMomentKnm: number;
  };
  readonly checks: readonly ElementCheck[];
  readonly governingRatio: number;
  readonly status: 'pass' | 'fail' | 'warning';
}

export interface BeamDesignError {
  readonly ok: false;
  readonly errors: readonly string[];
}

/** Las separaciones son límites geométricos, no una utilización de resistencia. */
const STRENGTH_CHECKS = new Set(['flexure-positive', 'flexure-negative', 'shear', 'shear-section', 'deflection', 'deflection-live']);
const AUTO_BAR_DIAMETERS = [12.7, 15.9, 19.1, 25.4, 31.8];
const AUTO_STIRRUP_DIAMETERS = [9.5, 12.7];
export const MAX_SPANS = 6;
const TOLERANCE = 1e-9;
/** E.060 9.9.3: Z ≤ 26 kN/mm. */
const Z_LIMIT_KN_PER_MM = 26;

const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);

interface SectionContext {
  readonly input: BeamDesignInput;
  readonly code: DesignCode;
  readonly stirrupDiameterMm: number;
}

/** Evalúa corridas + bastones en un lecho: acomodo en una o dos capas, peralte efectivo y resistencia. */
function evaluateSection(context: SectionContext, bed: 'top' | 'bottom', continuous: BarGroup, extra: BarGroup | null, demandKnm: number): BedSection | undefined {
  const { input, code, stirrupDiameterMm: ds } = context;
  const b = input.widthMm;
  const fc = input.fcMpa;
  const fy = input.fyMpa;
  const maxDiameter = Math.max(continuous.diameterMm, extra?.diameterMm ?? 0);
  const minimumClear = code.beam.minimumClearSpacing(maxDiameter, input.maxAggregateMm);
  const inside = b - 2 * (input.coverMm + ds);
  const perLayer = Math.floor((inside + minimumClear) / (maxDiameter + minimumClear));
  const total = continuous.count + (extra?.count ?? 0);
  if (perLayer < 2 || total > 2 * perLayer) return undefined;
  const firstCount = Math.min(total, perLayer);
  const secondCount = total - firstCount;
  const firstCentroid = input.coverMm + ds + maxDiameter / 2;
  const secondCentroid = firstCentroid + maxDiameter + Math.max(25, maxDiameter);
  const continuousArea = continuous.count * barArea(continuous.diameterMm);
  const extraArea = extra ? extra.count * barArea(extra.diameterMm) : 0;
  const area = continuousArea + extraArea;
  // Los bastones que no caben en la primera capa van a la segunda.
  const extraInSecond = extra ? secondCount * barArea(extra.diameterMm) : 0;
  const centroid = ((area - extraInSecond) * firstCentroid + extraInSecond * secondCentroid) / area;
  const depth = input.heightMm - centroid;
  const extremeDepth = input.heightMm - firstCentroid;
  if (depth <= 0) return undefined;
  const maximum = code.beam.maximumSteel(b, depth, extremeDepth, fc, fy);
  const required = requiredFlexuralSteelMm2(demandKnm, b, depth, fy, fc, extremeDepth, code.flexureFactor, code.tensionControlledStrain) ?? Number.POSITIVE_INFINITY;
  const capacity = flexuralCapacity(Math.min(area, maximum), b, depth, fy, fc, extremeDepth, code.flexureFactor);
  const minimum = demandKnm > TOLERANCE ? code.beam.minimumSteel(b, depth, input.heightMm, fc, fy, extremeDepth) : 0;
  return {
    bed,
    continuous,
    extra,
    perLayer,
    layers: secondCount > 0 ? 2 : 1,
    areaMm2: area,
    requiredMm2: required,
    minimumMm2: minimum,
    maximumMm2: maximum,
    effectiveDepthMm: depth,
    extremeDepthMm: extremeDepth,
    strengthKnm: capacity.strengthKnm,
    resistanceFactor: capacity.resistanceFactor,
    clearSpacingMm: (inside - firstCount * maxDiameter) / (firstCount - 1),
    minimumClearSpacingMm: minimumClear,
    inadmissible: area < required - TOLERANCE || area > maximum + TOLERANCE,
  };
}

/** Diámetro de las dos corridas: el menor que por sí solo da el acero mínimo del lecho. */
function chooseContinuous(context: SectionContext, bed: 'top' | 'bottom', diameters: readonly number[], hasDemand: boolean): BedSection | undefined {
  let fallback: BedSection | undefined;
  for (const diameter of diameters) {
    const section = evaluateSection(context, bed, { count: 2, diameterMm: diameter }, null, 0);
    if (!section) continue;
    fallback = section;
    const { input, code } = context;
    const minimum = code.beam.minimumSteel(input.widthMm, section.effectiveDepthMm, input.heightMm, input.fcMpa, input.fyMpa, section.extremeDepthMm);
    if (!hasDemand || section.areaMm2 >= minimum) return section;
  }
  return fallback;
}

/** Bastones mínimos para que la sección resista `demandKnm`; si no hay arreglo admisible devuelve el mayor que cabe. */
function chooseExtra(context: SectionContext, bed: 'top' | 'bottom', continuous: BarGroup, diameters: readonly number[], demandKnm: number): BedSection | undefined {
  let best: BedSection | undefined;
  let largest: BedSection | undefined;
  for (const diameter of diameters) {
    for (let count = 1; count <= 24; count += 1) {
      const section = evaluateSection(context, bed, continuous, { count, diameterMm: diameter }, demandKnm);
      if (!section) break;
      if (!largest || section.strengthKnm > largest.strengthKnm) largest = section;
      if (section.areaMm2 > section.maximumMm2 + TOLERANCE) break;
      if (section.inadmissible) continue;
      // Una capa antes que dos; luego la menor área y, a igual área, menos barras.
      const better = !best
        || section.layers < best.layers
        || (section.layers === best.layers && (section.areaMm2 < best.areaMm2 - 1
          || (Math.abs(section.areaMm2 - best.areaMm2) <= 1 && (section.extra?.count ?? 0) < (best.extra?.count ?? 0))));
      if (better) best = section;
      break;
    }
  }
  return best ?? largest;
}

interface Interval { start: number; end: number; peak: number }

/** Índices contiguos de estaciones donde la demanda supera la capacidad de las corridas. */
function exceedances(demand: readonly number[], capacity: number): Interval[] {
  const intervals: Interval[] = [];
  let current: Interval | undefined;
  demand.forEach((value, index) => {
    if (value > capacity * (1 + 1e-9) + TOLERANCE) {
      if (!current) current = { start: index, end: index, peak: index };
      current.end = index;
      if (value > demand[current.peak]!) current.peak = index;
    } else if (current) {
      intervals.push(current);
      current = undefined;
    }
  });
  if (current) intervals.push(current);
  return intervals;
}

/** ψt/ψp = 1.3 si quedan más de 300 mm de concreto fresco bajo la barra superior. */
const isTopCast = (context: SectionContext, bed: 'top' | 'bottom', db: number) =>
  bed === 'top' && context.input.heightMm - context.input.coverMm - context.stirrupDiameterMm - db > 300;

const developmentOf = (context: SectionContext, section: BedSection, db: number): DevelopmentLength => context.code.developmentLength({
  diameterMm: db,
  fyMpa: context.input.fyMpa,
  fcMpa: context.input.fcMpa,
  topBar: isTopCast(context, section.bed, db),
  clearSpacingMm: section.clearSpacingMm,
  clearCoverMm: context.input.coverMm + context.stirrupDiameterMm,
  minimumStirrups: true,
});

/**
 * Bastones donde la envolvente supera a las corridas. Cada bastón se prolonga
 * max(d, 12db) más allá del corte teórico y al menos ld a cada lado del pico.
 */
function designBastions(
  context: SectionContext,
  stations: readonly number[],
  totalLength: number,
  bed: 'top' | 'bottom',
  demand: readonly number[],
  continuousSection: BedSection,
  diameters: readonly number[],
): { bastions: BeamBastion[]; failed: boolean } {
  const bastions: BeamBastion[] = [];
  let failed = false;
  for (const interval of exceedances(demand, continuousSection.strengthKnm)) {
    const peakDemand = demand[interval.peak]!;
    const section = chooseExtra(context, bed, continuousSection.continuous, diameters, peakDemand);
    if (!section || !section.extra) { failed = true; continue; }
    if (section.inadmissible) failed = true;
    const db = section.extra.diameterMm;
    const development = developmentOf(context, section, db);
    const ld = development.lengthMm;
    const extension = Math.max(section.effectiveDepthMm, 12 * db) / 1e3;
    const theoreticalStart = stations[Math.max(0, interval.start - 1)]!;
    const theoreticalEnd = stations[Math.min(stations.length - 1, interval.end + 1)]!;
    const peakAt = stations[interval.peak]!;
    const wantedStart = Math.min(theoreticalStart - extension, peakAt - ld / 1e3);
    const wantedEnd = Math.max(theoreticalEnd + extension, peakAt + ld / 1e3);
    bastions.push({
      bed,
      bars: section.extra,
      startM: Math.max(0, wantedStart),
      endM: Math.min(totalLength, wantedEnd),
      peakAtM: peakAt,
      demandKnm: peakDemand,
      developmentLengthMm: ld,
      developmentFavorable: development.favorable,
      needsHook: wantedStart < -TOLERANCE || wantedEnd > totalLength + TOLERANCE,
      section,
    });
  }
  // Dos bastones que se traslapan se unen en uno con el arreglo más fuerte.
  bastions.sort((left, right) => left.startM - right.startM);
  const merged: BeamBastion[] = [];
  for (const bastion of bastions) {
    const last = merged[merged.length - 1];
    if (last && bastion.startM <= last.endM + TOLERANCE) {
      const stronger = bastion.section.areaMm2 > last.section.areaMm2 ? bastion : last;
      merged[merged.length - 1] = {
        ...stronger,
        startM: last.startM,
        endM: Math.max(last.endM, bastion.endM),
        needsHook: last.needsHook || bastion.needsHook,
        demandKnm: Math.max(last.demandKnm, bastion.demandKnm),
      };
    } else merged.push(bastion);
  }
  return { bastions: merged, failed };
}

export const sectionAt = (x: number, bed: 'top' | 'bottom', continuous: BedSection, bastions: readonly BeamBastion[]): BedSection =>
  bastions.find((bastion) => bastion.bed === bed && x >= bastion.startM - TOLERANCE && x <= bastion.endM + TOLERANCE)?.section ?? continuous;

/** Inercia de la sección transformada agrietada, mm⁴. */
function crackedInertia(section: BedSection, widthMm: number, modularRatio: number) {
  const transformed = modularRatio * section.areaMm2;
  const neutral = (-transformed + Math.sqrt(transformed ** 2 + 2 * widthMm * transformed * section.effectiveDepthMm)) / widthMm;
  return widthMm * neutral ** 3 / 3 + transformed * (section.effectiveDepthMm - neutral) ** 2;
}

/**
 * Inercia efectiva de una sección según la norma:
 * NTC tabla 13.4.3.2: Ie = Icr/(1 − ((2/3)Mcr/Ma)²(1 − Icr/Ig)) si Ma > (2/3)Mcr;
 * NSR C.9-8 (Branson): Ie = (Mcr/Ma)³Ig + (1 − (Mcr/Ma)³)Icr;
 * E.060 9.6.2.3: Icr si Ma > Mcr.
 */
function effectiveInertia(code: DesignCode, section: BedSection, widthMm: number, grossInertia: number, modularRatio: number, crackingMomentKnm: number, serviceMomentKnm: number) {
  const cracked = () => crackedInertia(section, widthMm, modularRatio);
  switch (code.beam.inertia) {
    case 'ntc': {
      if (serviceMomentKnm <= 2 * crackingMomentKnm / 3) return grossInertia;
      const icr = cracked();
      const ratio = (2 * crackingMomentKnm / 3 / serviceMomentKnm) ** 2;
      return Math.min(grossInertia, Math.max(icr, icr / (1 - ratio * (1 - icr / grossInertia))));
    }
    case 'branson': {
      if (serviceMomentKnm <= crackingMomentKnm) return grossInertia;
      const ratio = (crackingMomentKnm / serviceMomentKnm) ** 3;
      return Math.min(grossInertia, ratio * grossInertia + (1 - ratio) * cracked());
    }
    case 'cracked':
      return serviceMomentKnm <= crackingMomentKnm ? grossInertia : Math.min(grossInertia, cracked());
  }
}

function validate(input: BeamDesignInput): string[] {
  const errors: string[] = [];
  if (!isDesignCodeId(input.code)) return ['Norma de diseño desconocida.'];
  const positive: [keyof BeamDesignInput, string][] = [
    ['widthMm', 'Base'], ['heightMm', 'Peralte'], ['coverMm', 'Recubrimiento'],
    ['fcMpa', "f'c"], ['fyMpa', 'fy'], ['fyStirrupMpa', 'fy de estribos'], ['maxAggregateMm', 'Agregado máximo'],
    ['supportWidthMm', 'Ancho de apoyo'],
  ];
  for (const [key, label] of positive) {
    if (!isPositiveFinite(input[key] as number)) errors.push(`${label} debe ser un número mayor que cero.`);
  }
  if (input.combinations.length < 1) errors.push('Se requiere al menos una combinación de carga.');
  for (const combination of input.combinations) {
    if (!isPositiveFinite(combination.dead) || !Number.isFinite(combination.live) || combination.live < 0) errors.push(`Combinación ${combination.label}: factores inválidos.`);
    if (!Number.isFinite(combination.favorableDead) || combination.favorableDead <= 0 || combination.favorableDead > combination.dead) errors.push(`Combinación ${combination.label}: el factor favorable de la carga muerta debe estar entre 0 y el factor de carga muerta.`);
  }
  if (!Number.isFinite(input.sustainedLiveRatio) || input.sustainedLiveRatio < 0 || input.sustainedLiveRatio > 1) errors.push('La fracción sostenida de la carga viva debe estar entre 0 y 1.');
  if (!isPositiveFinite(input.longTermXi)) errors.push('El factor ξ de deflexión diferida debe ser mayor que cero.');
  if (input.spans.length < 1 || input.spans.length > MAX_SPANS) errors.push(`La viga debe tener entre 1 y ${MAX_SPANS} claros.`);
  input.spans.forEach((span, index) => {
    if (!isPositiveFinite(span.lengthM)) errors.push(`Claro ${index + 1}: la longitud debe ser mayor que cero.`);
    for (const [key, label] of [['deadKnPerM', 'carga muerta'], ['liveKnPerM', 'carga viva'], ['pointDeadKn', 'puntual muerta'], ['pointLiveKn', 'puntual viva']] as const) {
      if (!Number.isFinite(span[key]) || span[key] < 0) errors.push(`Claro ${index + 1}: la ${label} debe ser cero o positiva.`);
    }
    if ((span.pointDeadKn > 0 || span.pointLiveKn > 0) && (!Number.isFinite(span.pointAtM) || span.pointAtM < 0 || span.pointAtM > span.lengthM)) {
      errors.push(`Claro ${index + 1}: la carga puntual debe quedar entre 0 y ${Number.isFinite(span.lengthM) ? span.lengthM : 'L'} m.`);
    }
  });
  if (errors.length) return errors;
  if (input.heightMm < 2 * input.coverMm + 60) errors.push('El peralte no deja espacio para el refuerzo.');
  if (input.widthMm < 2 * input.coverMm + 60) errors.push('La base no deja espacio para el refuerzo.');
  if (input.fcMpa < 20 || input.fcMpa > 70) errors.push("f'c fuera del intervalo admitido (20–70 MPa).");
  if (input.fyMpa > 550) errors.push('fy mayor que 550 MPa no está contemplado.');
  return errors;
}

type Envelope = { max: number[]; min: number[] };

/**
 * Envolvente por superposición y sobre todas las combinaciones: en cada una, la
 * carga viva de cada claro se suma sólo donde empeora el efecto (nula donde
 * favorece) y la carga muerta de cada claro usa `dead` donde desfavorece y
 * `favorableDead` donde favorece (NTC-CyA 3.4.1 c; en NSR y E.060 ambos iguales).
 */
function envelopeOf(analysis: BeamAnalysis, pick: (response: CaseResponse) => readonly number[], combinations: readonly LoadCombination[]): Envelope {
  const max: number[] = [];
  const min: number[] = [];
  for (let index = 0; index < analysis.stations.length; index += 1) {
    let high = Number.NEGATIVE_INFINITY;
    let low = Number.POSITIVE_INFINITY;
    for (const factors of combinations) {
      let comboHigh = 0;
      let comboLow = 0;
      for (const response of analysis.deadPerSpan) {
        const value = pick(response)[index]!;
        comboHigh += Math.max(factors.dead * value, factors.favorableDead * value);
        comboLow += Math.min(factors.dead * value, factors.favorableDead * value);
      }
      for (const response of analysis.livePerSpan) {
        const value = pick(response)[index]!;
        if (value > 0) comboHigh += factors.live * value; else comboLow += factors.live * value;
      }
      high = Math.max(high, comboHigh);
      low = Math.min(low, comboLow);
    }
    max.push(high);
    min.push(low);
  }
  return { max, min };
}

const SERVICE: readonly LoadCombination[] = [{ label: 'Servicio', dead: 1, favorableDead: 1, live: 1 }];
const LIVE_ONLY: readonly LoadCombination[] = [{ label: 'Viva', dead: 0, favorableDead: 0, live: 1 }];

const sumCases = (responses: readonly CaseResponse[], pick: (response: CaseResponse) => readonly number[], index: number) =>
  responses.reduce((total, response) => total + pick(response)[index]!, 0);

/**
 * Afina los máximos locales con la parábola que pasa por la estación y sus dos
 * vecinas. Con carga uniforme el momento es cuadrático entre estaciones y el
 * vértice es exacto; sin esto el pico se tomaría en la estación más cercana.
 * No se afina a través de discontinuidades (estaciones repetidas).
 */
function refinePeaks(xs: readonly number[], values: readonly number[]): number[] {
  return values.map((value, index) => {
    if (index === 0 || index === values.length - 1) return value;
    const x0 = xs[index - 1]!;
    const x1 = xs[index]!;
    const x2 = xs[index + 1]!;
    const y0 = values[index - 1]!;
    const y2 = values[index + 1]!;
    if (!(x0 < x1 && x1 < x2) || value < y0 || value < y2) return value;
    const denominator = (x0 - x1) * (x0 - x2) * (x1 - x2);
    const a = (x2 * (value - y0) + x1 * (y0 - y2) + x0 * (y2 - value)) / denominator;
    const b = (x2 ** 2 * (y0 - value) + x1 ** 2 * (y2 - y0) + x0 ** 2 * (value - y2)) / denominator;
    if (a >= 0) return value;
    const vertex = -b / (2 * a);
    if (vertex <= x0 || vertex >= x2) return value;
    const c = value - a * x1 ** 2 - b * x1;
    return Math.max(value, a * vertex ** 2 + b * vertex + c);
  });
}

const stationsOfSpan = (analysis: BeamAnalysis, spanIndex: number) =>
  analysis.stationSpan.flatMap((owner, index) => owner === spanIndex ? [index] : []);

function designSpanStirrups(
  context: SectionContext,
  analysis: BeamAnalysis,
  shear: Envelope,
  spanIndex: number,
  span: { startM: number; lengthM: number },
  depthMm: number,
): SpanStirrups {
  const { input, code, stirrupDiameterMm } = context;
  const fc = input.fcMpa;
  const fyv = input.fyStirrupMpa;
  const b = input.widthMm;
  const indexes = stationsOfSpan(analysis, spanIndex);
  const shearAt = (index: number) => Math.max(Math.abs(shear.max[index]!), Math.abs(shear.min[index]!));
  const demand = Math.max(...indexes.map(shearAt));
  const phi = code.shearFactor;
  const concreteN = 0.17 * Math.sqrt(fc) * b * depthMm;
  const requiredSteelN = Math.max(0, demand * 1e3 / phi - concreteN);
  const minimumRatio = Math.max(0.062 * Math.sqrt(fc) * b / fyv, 0.35 * b / fyv);
  const highShear = requiredSteelN > 0.33 * Math.sqrt(fc) * b * depthMm;
  const maximumSpacing = floorTo(highShear ? Math.min(depthMm / 4, 300) : Math.min(depthMm / 2, 600), 5);
  const legArea = 2 * barArea(stirrupDiameterMm);
  const requiredRatio = Math.max(requiredSteelN / (fyv * depthMm), minimumRatio);
  const needed = Math.min(maximumSpacing, floorTo(legArea / requiredRatio, 25));
  const dense = Math.max(needed, 50);
  const center = maximumSpacing >= 25 ? floorTo(maximumSpacing, 25) : maximumSpacing;
  const strengthAt = (s: number) => phi * (concreteN + legArea / s * fyv * depthMm) / 1e3;
  const centerStrength = strengthAt(center);
  const zones: { startM: number; endM: number }[] = [];
  const extend = depthMm / 1e3;
  const spanEnd = span.startM + span.lengthM;
  for (const index of indexes) {
    if (shearAt(index) <= centerStrength) continue;
    const x = analysis.stations[index]!;
    const startM = Math.max(span.startM, x - extend);
    const endM = Math.min(spanEnd, x + extend);
    const last = zones[zones.length - 1];
    if (last && startM <= last.endM) last.endM = Math.max(last.endM, endM);
    else zones.push({ startM, endM });
  }
  const uniform = zones.length === 0 || dense >= center;
  return {
    denseSpacingMm: dense,
    centerSpacingMm: uniform ? dense : center,
    maximumSpacingMm: maximumSpacing,
    denseZones: uniform ? [] : zones,
    demandKn: demand,
    concreteStrengthKn: phi * concreteN / 1e3,
    strengthKn: strengthAt(dense),
    maximumSectionStrengthKn: phi * (concreteN + 0.66 * Math.sqrt(fc) * b * depthMm) / 1e3,
    impractical: needed < 50,
  };
}

interface Reinforcement {
  readonly context: SectionContext;
  readonly continuousTop: BedSection;
  readonly continuousBottom: BedSection;
  readonly bastions: BeamBastion[];
  readonly failed: boolean;
  readonly stirrups: SpanStirrups[];
}

function designReinforcement(
  input: BeamDesignInput,
  code: DesignCode,
  analysis: BeamAnalysis,
  moment: Envelope,
  shear: Envelope,
  spans: readonly { startM: number; lengthM: number }[],
): Reinforcement | undefined {
  const barDiameters = input.barDiameterMm === null ? AUTO_BAR_DIAMETERS : [input.barDiameterMm];
  const stirrupDiameters = input.stirrupDiameterMm === null ? AUTO_STIRRUP_DIAMETERS : [input.stirrupDiameterMm];
  const positiveDemand = moment.max.map((value) => Math.max(0, value));
  const negativeDemand = moment.min.map((value) => Math.max(0, -value));
  let chosen: Reinforcement | undefined;
  for (const stirrupDiameterMm of stirrupDiameters) {
    const context: SectionContext = { input, code, stirrupDiameterMm };
    const continuousBottom = chooseContinuous(context, 'bottom', barDiameters, positiveDemand.some((value) => value > TOLERANCE));
    const continuousTop = chooseContinuous(context, 'top', barDiameters, negativeDemand.some((value) => value > TOLERANCE));
    if (!continuousBottom || !continuousTop) continue;
    const bottom = designBastions(context, analysis.stations, analysis.totalLengthM, 'bottom', positiveDemand, continuousBottom, barDiameters);
    const top = designBastions(context, analysis.stations, analysis.totalLengthM, 'top', negativeDemand, continuousTop, barDiameters);
    const bastions = [...bottom.bastions, ...top.bastions];
    const depth = Math.min(continuousBottom.effectiveDepthMm, continuousTop.effectiveDepthMm, ...bastions.map((bastion) => bastion.section.effectiveDepthMm));
    const stirrups = spans.map((span, index) => designSpanStirrups(context, analysis, shear, index, span, depth));
    chosen = { context, continuousTop, continuousBottom, bastions, failed: bottom.failed || top.failed, stirrups };
    if (!chosen.failed && stirrups.every((item) => !item.impractical)) break;
  }
  return chosen;
}

const largestBar = (section: BedSection) => Math.max(section.continuous.diameterMm, section.extra?.diameterMm ?? 0);

export function designBeam(input: BeamDesignInput): BeamDesignResult | BeamDesignError {
  const errors = validate(input);
  if (errors.length) return { ok: false, errors };

  const code = designCode(input.code);
  const fc = input.fcMpa;
  const b = input.widthMm;
  const h = input.heightMm;
  const ec = code.elasticModulusMpa(fc);
  const fr = code.ruptureModulusMpa(fc);
  const grossInertia = b * h ** 3 / 12;
  const selfWeight = input.includeSelfWeight ? CONCRETE_UNIT_WEIGHT_KN_M3 * b * h / 1e6 : 0;
  const baseAnalysisInput = {
    spans: input.spans,
    leftEnd: input.leftEnd,
    rightEnd: input.rightEnd,
    selfWeightKnPerM: selfWeight,
    elasticModulusKpa: ec * 1e3,
    areaM2: b * h / 1e6,
    inertiaM4: grossInertia / 1e12,
  };

  // 1 · Resistencia: análisis con sección bruta y envolvente factorizada.
  const outcome = analyzeBeam(baseAnalysisInput);
  if (!outcome.ok) return { ok: false, errors: [outcome.error] };
  const { analysis } = outcome;
  const stations = analysis.stations;
  const rawMoment = envelopeOf(analysis, (response) => response.moment, input.combinations);
  const moment: Envelope = {
    max: refinePeaks(analysis.stations, rawMoment.max),
    min: refinePeaks(analysis.stations, rawMoment.min.map((value) => -value)).map((value) => -value),
  };
  const shear = envelopeOf(analysis, (response) => response.shear, input.combinations);
  const serviceMoment = envelopeOf(analysis, (response) => response.moment, SERVICE);

  const spanGeometry = input.spans.map((span, index) => ({ startM: analysis.nodesAtM[index]!, lengthM: span.lengthM }));
  const reinforcement = designReinforcement(input, code, analysis, moment, shear, spanGeometry);
  if (!reinforcement) return { ok: false, errors: ['No caben dos varillas corridas en la base: aumenta la sección o usa otro diámetro.'] };
  const { continuousTop, continuousBottom, bastions, stirrups, context } = reinforcement;
  const capacityPositive = stations.map((x) => sectionAt(x, 'bottom', continuousBottom, bastions).strengthKnm);
  const capacityNegative = stations.map((x) => -sectionAt(x, 'top', continuousTop, bastions).strengthKnm);

  // 2 · Servicio: inercia efectiva por claro y un segundo análisis del solver con esas inercias.
  const modularRatio = STEEL_ELASTIC_MODULUS_MPA / ec;
  const crackingMoment = fr * grossInertia / (h / 2) / 1e6;
  const spanCount = input.spans.length;
  const isCantilever = (index: number) => (index === 0 && input.leftEnd === 'free') || (index === spanCount - 1 && input.rightEnd === 'free');
  const topAt = (station: number) => sectionAt(stations[station]!, 'top', continuousTop, bastions);
  const bottomAt = (station: number) => sectionAt(stations[station]!, 'bottom', continuousBottom, bastions);
  const inertias: number[] = [];
  const longTermFactors: number[] = [];
  input.spans.forEach((_, index) => {
    const indexes = stationsOfSpan(analysis, index);
    const first = indexes[0]!;
    const last = indexes[indexes.length - 1]!;
    const middle = indexes.reduce((best, station) => serviceMoment.max[station]! > serviceMoment.max[best]! ? station : best, first);
    const endInertia = (station: number) => effectiveInertia(code, topAt(station), b, grossInertia, modularRatio, crackingMoment, Math.max(0, -serviceMoment.min[station]!));
    let inertia: number;
    let rhoPrime: number;
    if (isCantilever(index)) {
      // Voladizo: la sección del apoyo (NSR C.9.5.2.4, E.060 9.6.2.4 d).
      const support = index === 0 ? last : first;
      inertia = endInertia(support);
      rhoPrime = bottomAt(support).areaMm2 / (b * topAt(support).effectiveDepthMm);
    } else {
      const midInertia = effectiveInertia(code, bottomAt(middle), b, grossInertia, modularRatio, crackingMoment, Math.max(0, serviceMoment.max[middle]!));
      const leftContinuous = index > 0 || input.leftEnd === 'fixed';
      const rightContinuous = index < spanCount - 1 || input.rightEnd === 'fixed';
      const ends = [...(leftContinuous ? [endInertia(first)] : []), ...(rightContinuous ? [endInertia(last)] : [])];
      // Ambos extremos: (I1 + I2 + 2I3)/4. Un extremo: (I1 + 2I3)/3 (NTC 13.4.3.5, E.060 9.6.2.4 b)
      // o el promedio de las secciones positiva y negativa (NSR C.9.5.2.4). Ninguno: la sección central.
      inertia = ends.length === 1 && code.beam.oneEndAverage === 'halves'
        ? (ends[0]! + midInertia) / 2
        : (sum(ends) + 2 * midInertia) / (ends.length + 2);
      rhoPrime = topAt(middle).areaMm2 / (b * bottomAt(middle).effectiveDepthMm);
    }
    inertias.push(inertia);
    longTermFactors.push(input.longTermXi / (1 + 50 * rhoPrime));
  });
  const cracked = analyzeBeam({ ...baseAnalysisInput, inertiaM4PerSpan: inertias.map((value) => value / 1e12) });
  if (!cracked.ok) return { ok: false, errors: [cracked.error] };
  const serviceDeflection = envelopeOf(cracked.analysis, (response) => response.deflection, SERVICE);
  const liveDeflection = envelopeOf(cracked.analysis, (response) => response.deflection, LIVE_ONLY);
  const immediateMm = serviceDeflection.min.map((value) => value * 1e3);
  const liveMm = liveDeflection.min.map((value) => value * 1e3);
  // Diferida: λΔ = ξ/(1 + 50ρ′) sobre la flecha inmediata de la carga muerta más la viva sostenida.
  const sustainedMm = (index: number) => 1e3 * (
    sumCases(cracked.analysis.deadPerSpan, (response) => response.deflection, index)
    + input.sustainedLiveRatio * sumCases(cracked.analysis.livePerSpan, (response) => response.deflection, index));
  const longTermMm = immediateMm.map((_, index) => longTermFactors[cracked.analysis.stationSpan[index]!]! * sustainedMm(index));
  const deflectionMm = immediateMm.map((value, index) => value + longTermMm[index]!);
  // ACI: parte posterior a los elementos no estructurales = diferida + inmediata por viva.
  const afterAttachmentMm = liveMm.map((value, index) => value + longTermMm[index]!);

  const spans: BeamSpanDesign[] = input.spans.map((span, index) => {
    const indexes = stationsOfSpan(analysis, index);
    const cantilever = isCantilever(index);
    const limitSpan = span.lengthM * 1e3;
    const peak = (values: readonly number[]) => Math.max(...indexes.map((station) => Math.abs(values[station]!)));
    const total = peak(deflectionMm);
    const aci = code.beam.deflection === 'aci';
    return {
      startM: spanGeometry[index]!.startM,
      lengthM: span.lengthM,
      cantilever,
      positiveMomentKnm: Math.max(0, ...indexes.map((station) => moment.max[station]!)),
      negativeLeftKnm: Math.max(0, -moment.min[indexes[0]!]!),
      negativeRightKnm: Math.max(0, -moment.min[indexes[indexes.length - 1]!]!),
      shearKn: stirrups[index]!.demandKn,
      stirrups: stirrups[index]!,
      effectiveInertiaRatio: inertias[index]! / grossInertia,
      immediateMm: peak(immediateMm),
      deflectionMm: total,
      checkedDeflectionMm: aci ? peak(afterAttachmentMm) : total,
      deflectionLimitMm: aci
        ? limitSpan / (input.damagesNonstructural ? 480 : 240)
        : input.damagesNonstructural ? 3 + limitSpan / 480 : 5 + limitSpan / 240,
      liveDeflectionMm: aci ? peak(liveMm) : null,
      liveDeflectionLimitMm: aci ? limitSpan / 360 : null,
    };
  });

  // 3 · Anclaje en los apoyos extremos: recta si cabe ld, gancho estándar si cabe ldh.
  const anchorages: BeamAnchorage[] = [];
  const available = input.supportWidthMm - input.coverMm;
  for (const [end, station, beamEnd] of [['left', 0, input.leftEnd], ['right', stations.length - 1, input.rightEnd]] as const) {
    if (beamEnd === 'free') continue;
    const needs: ('top' | 'bottom')[] = [];
    if (-moment.min[station]! > TOLERANCE) needs.push('top');
    if (moment.max[station]! > TOLERANCE) needs.push('bottom');
    for (const bed of needs) {
      const section = bed === 'top' ? topAt(station) : bottomAt(station);
      const db = largestBar(section);
      const straightMm = developmentOf(context, section, db).lengthMm;
      const hookMm = code.hookedDevelopmentMm(db, input.fyMpa, fc);
      anchorages.push({
        end, bed, diameterMm: db, straightMm, hookMm, availableMm: available,
        kind: straightMm <= available ? 'straight' : hookMm <= available ? 'hook' : 'insufficient',
      });
    }
  }
  const splices = {
    top: code.spliceLengthMm(developmentOf(context, continuousTop, continuousTop.continuous.diameterMm)),
    bottom: code.spliceLengthMm(developmentOf(context, continuousBottom, continuousBottom.continuous.diameterMm)),
  };

  // 4 · Comprobaciones.
  const refs = code.refs;
  const positiveMoment = Math.max(0, ...moment.max);
  const negativeMoment = Math.max(0, ...moment.min.map((value) => -value));
  const worstRatio = (demand: readonly number[], capacity: readonly number[]) => demand.reduce((worst, value, index) => {
    const ratio = value / Math.abs(capacity[index]!);
    return value > TOLERANCE && ratio > worst.ratio ? { ratio, index } : worst;
  }, { ratio: 0, index: 0 });
  const positiveWorst = worstRatio(moment.max.map((value) => Math.max(0, value)), capacityPositive);
  const negativeWorst = worstRatio(moment.min.map((value) => Math.max(0, -value)), capacityNegative);
  const allSections = [continuousBottom, continuousTop, ...bastions.map((bastion) => bastion.section)];
  const pickWorst = <T,>(items: readonly T[], score: (item: T) => number) => items.reduce((worst, item) => score(item) > score(worst) ? item : worst);
  const steelWorst = pickWorst(allSections, (section) => section.areaMm2 / section.maximumMm2);
  const loadedSections = allSections.filter((section) => section.bed === 'bottom' ? positiveMoment > TOLERANCE : negativeMoment > TOLERANCE);
  const minimumOf = (section: BedSection) => code.beam.minimumSteel(b, section.effectiveDepthMm, h, fc, input.fyMpa, section.extremeDepthMm);
  const minimumWorst = loadedSections.length ? pickWorst(loadedSections, (section) => minimumOf(section) / section.areaMm2) : undefined;
  const spacingWorst = pickWorst(allSections, (section) => section.minimumClearSpacingMm / section.clearSpacingMm);
  const shearWorst = pickWorst(stirrups, (item) => item.demandKn / item.strengthKn);
  const sectionWorst = pickWorst(stirrups, (item) => item.demandKn / item.maximumSectionStrengthKn);
  const stirrupSpacingWorst = pickWorst(stirrups, (item) => item.denseSpacingMm / item.maximumSpacingMm);
  const governingSpan = pickWorst(spans, (span) => span.checkedDeflectionMm / span.deflectionLimitMm);
  const governingSpanIndex = spans.indexOf(governingSpan);
  const combinationsText = input.combinations.map((combination) => combination.label).join(' · ');

  const checks: ElementCheck[] = [
    capacityCheck('flexure-positive', 'Flexión positiva', Math.max(0, moment.max[positiveWorst.index]!), capacityPositive[positiveWorst.index]!, 'kN·m', refs.flexure,
      `Rige en x = ${stations[positiveWorst.index]!.toFixed(2)} m · FR ${sectionAt(stations[positiveWorst.index]!, 'bottom', continuousBottom, bastions).resistanceFactor.toFixed(2)}.`),
  ];
  if (negativeMoment > TOLERANCE) {
    checks.push(capacityCheck('flexure-negative', 'Flexión negativa', Math.max(0, -moment.min[negativeWorst.index]!), -capacityNegative[negativeWorst.index]!, 'kN·m', refs.flexure,
      `Rige en x = ${stations[negativeWorst.index]!.toFixed(2)} m · FR ${sectionAt(stations[negativeWorst.index]!, 'top', continuousTop, bastions).resistanceFactor.toFixed(2)}.`));
  }
  checks.push(capacityCheck('steel-max', 'Acero máximo', steelWorst.areaMm2, steelWorst.maximumMm2, 'mm²', refs.steelMax, code.beam.maximumSteelNote));
  if (minimumWorst) {
    checks.push(capacityCheck('steel-min', 'Acero mínimo', minimumOf(minimumWorst), minimumWorst.areaMm2, 'mm²', refs.steelMin,
      `Lecho ${minimumWorst.bed === 'top' ? 'superior' : 'inferior'}.`));
  }
  checks.push(
    capacityCheck('shear', 'Cortante', shearWorst.demandKn, shearWorst.strengthKn, 'kN', refs.shear, `Claro ${stirrups.indexOf(shearWorst) + 1} · FR ${code.shearFactor}.`),
    capacityCheck('shear-section', 'Cortante máximo por sección', sectionWorst.demandKn, sectionWorst.maximumSectionStrengthKn, 'kN', refs.shearSection,
      'Si no cumple, hay que aumentar la sección: más estribos no ayudan.'),
    capacityCheck('stirrup-spacing', 'Separación de estribos', stirrupSpacingWorst.denseSpacingMm, stirrupSpacingWorst.maximumSpacingMm, 'mm', refs.stirrupSpacing),
    capacityCheck('bar-spacing', 'Separación libre entre barras', spacingWorst.minimumClearSpacingMm, spacingWorst.clearSpacingMm, 'mm', refs.barSpacing),
  );

  if (code.beam.crack === 'spacing') {
    // NTC tabla 13.6.2 y NSR C.10.6.4: s ≤ min(380(280/fs) − 2.5cc, 300(280/fs)) con fs = (2/3)fy.
    const fs = 2 * input.fyMpa / 3;
    const clearCoverToBar = input.coverMm + context.stirrupDiameterMm;
    const crackLimit = Math.min(380 * (280 / fs) - 2.5 * clearCoverToBar, 300 * (280 / fs));
    const crackWorst = Math.max(...allSections.map((section) => section.clearSpacingMm + largestBar(section)));
    checks.push(capacityCheck('crack-spacing', 'Separación por agrietamiento', crackWorst, crackLimit, 'mm', refs.crack,
      'fs = (2/3)fy; separación a centros de las barras en tensión.'));
  } else {
    // E.060 9.9.3: Z = fs·∛(dc·Act) ≤ 26 kN/mm con fs = Ms/(0.9·d·As).
    const zFor = (section: BedSection, serviceKnm: number) => {
      const fs = serviceKnm * 1e6 / (0.9 * section.effectiveDepthMm * section.areaMm2);
      const dc = h - section.extremeDepthMm;
      const bars = section.areaMm2 / barArea(largestBar(section));
      const act = 2 * (h - section.effectiveDepthMm) * b / bars;
      return fs * Math.cbrt(dc * act) / 1e3;
    };
    const candidates: { z: number; bed: string }[] = [];
    const positiveService = serviceMoment.max.reduce((best, value, index) => value > serviceMoment.max[best]! ? index : best, 0);
    const negativeService = serviceMoment.min.reduce((best, value, index) => value < serviceMoment.min[best]! ? index : best, 0);
    if (serviceMoment.max[positiveService]! > TOLERANCE) candidates.push({ z: zFor(bottomAt(positiveService), serviceMoment.max[positiveService]!), bed: 'inferior' });
    if (-serviceMoment.min[negativeService]! > TOLERANCE) candidates.push({ z: zFor(topAt(negativeService), -serviceMoment.min[negativeService]!), bed: 'superior' });
    const worst = candidates.reduce((best, item) => item.z > best.z ? item : best, { z: 0, bed: 'inferior' });
    checks.push(capacityCheck('crack-z', 'Control de agrietamiento (Z)', worst.z, Z_LIMIT_KN_PER_MM, 'kN/mm', refs.crack,
      `Lecho ${worst.bed}: fs = Ms/(0.9·d·As) con el momento de servicio.`));
  }

  const aci = code.beam.deflection === 'aci';
  checks.push(capacityCheck('deflection', aci ? `Deflexión posterior a los elementos no estructurales (claro ${governingSpanIndex + 1})` : `Deflexión total (claro ${governingSpanIndex + 1})`,
    governingSpan.checkedDeflectionMm, governingSpan.deflectionLimitMm, 'mm', refs.deflection,
    aci
      ? `Diferida ξ/(1+50ρ′) con ξ = ${input.longTermXi} sobre la muerta y ${Math.round(input.sustainedLiveRatio * 100)} % de la viva, más la inmediata por viva; límite ℓ/${input.damagesNonstructural ? 480 : 240}.`
      : `Ie por claro con (I₁ + I₂ + 2I₃)/4; diferida ξ/(1+50p′) con ξ = ${input.longTermXi} sobre la muerta y ${Math.round(input.sustainedLiveRatio * 100)} % de la viva (W/Wm).`));
  if (aci) {
    const liveWorst = pickWorst(spans, (span) => (span.liveDeflectionMm ?? 0) / (span.liveDeflectionLimitMm ?? 1));
    checks.push(capacityCheck('deflection-live', `Deflexión inmediata por viva (claro ${spans.indexOf(liveWorst) + 1})`, liveWorst.liveDeflectionMm ?? 0, liveWorst.liveDeflectionLimitMm ?? 1, 'mm', refs.deflection,
      'Entrepisos: ℓ/360.'));
  }
  checks.push({
    id: 'load-factors',
    label: 'Combinaciones de carga',
    status: 'info',
    reference: refs.loadFactors,
    note: `${combinationsText}; ${code.usesStructureGroup ? `${input.combinations[0]!.favorableDead} en la muerta donde favorece; ` : ''}viva nula donde favorece; ${Math.round(input.sustainedLiveRatio * 100)} % de la viva sostenida para flechas diferidas.`,
  });
  if (reinforcement.failed || allSections.some((section) => section.inadmissible)) {
    checks.push({ id: 'arrangement', label: 'Armado admisible', status: 'fail', reference: refs.steelMax, note: 'No hay un arreglo que resista sin exceder el acero máximo o sin caber: aumenta la sección.' });
  }
  if (stirrups.some((item) => item.impractical)) {
    checks.push({ id: 'stirrup-min', label: 'Separación mínima práctica', status: 'fail', reference: complementary('Práctica constructiva'), note: 'Se requieren estribos a menos de 5 cm: aumenta la sección o el diámetro.' });
  }
  if (anchorages.length) {
    const insufficient = anchorages.filter((item) => item.kind === 'insufficient');
    const hooks = anchorages.filter((item) => item.kind === 'hook');
    const worst = pickWorst(anchorages, (item) => Math.min(item.straightMm, item.hookMm) / item.availableMm);
    checks.push({
      id: 'anchorage',
      label: 'Anclaje en apoyos extremos',
      status: insufficient.length ? 'fail' : 'pass',
      demand: Math.min(worst.straightMm, worst.hookMm),
      capacity: worst.availableMm,
      unit: 'mm',
      ratio: Math.min(worst.straightMm, worst.hookMm) / worst.availableMm,
      reference: refs.beamAnchorage,
      note: insufficient.length
        ? `El apoyo de ${input.supportWidthMm} mm no aloja ni el gancho (ldh = ${Math.round(insufficient[0]!.hookMm)} mm): amplía el apoyo o usa barras más delgadas.`
        : hooks.length
          ? `Gancho estándar en ${hooks.map((item) => `${item.end === 'left' ? 'izquierda' : 'derecha'} (${item.bed === 'top' ? 'superior' : 'inferior'})`).join(', ')}: ldh = ${Math.round(hooks[0]!.hookMm)} mm; recta requeriría ${Math.round(hooks[0]!.straightMm)} mm.`
          : 'Las barras rectas desarrollan ld dentro del apoyo.',
    });
  }
  const freeEndHooks = bastions.filter((bastion) => bastion.needsHook && ((bastion.startM <= TOLERANCE && input.leftEnd === 'free') || (bastion.endM >= analysis.totalLengthM - TOLERANCE && input.rightEnd === 'free')));
  if (freeEndHooks.length) {
    checks.push({ id: 'anchorage-free-end', label: 'Anclaje en el extremo del voladizo', status: 'warning', reference: refs.hook,
      note: `Un bastón no alcanza ld antes del extremo libre: dóblalo con gancho estándar (ldh = ${Math.round(code.hookedDevelopmentMm(freeEndHooks[0]!.bars.diameterMm, input.fyMpa, fc))} mm).` });
  }
  checks.push({ id: 'splice', label: 'Traslapes de las corridas', status: 'info', reference: refs.splice,
    note: `Clase B: superior ${Math.round(splices.top)} mm · inferior ${Math.round(splices.bottom)} mm, fuera de las zonas de momento máximo.` });
  if (allSections.some((section) => section.layers === 2)) {
    checks.push({ id: 'two-layers', label: 'Acero en dos lechos', status: 'warning', reference: refs.barSpacing, note: 'Algún armado no cabe en una capa; considera una sección más ancha.' });
  }
  const shortest = Math.min(...input.spans.map((span) => span.lengthM));
  const lengthRatio = shortest * 1e3 / h;
  const deep = code.beam.deepBeam.inclusive ? lengthRatio <= code.beam.deepBeam.ratio : lengthRatio < code.beam.deepBeam.ratio;
  if (deep) {
    checks.push({ id: 'deep-beam', label: 'Relación L/h', status: 'fail', reference: refs.deepBeam,
      note: `L/h = ${lengthRatio.toFixed(1)} ${code.beam.deepBeam.inclusive ? '≤' : '<'} ${code.beam.deepBeam.ratio}: viga de gran peralte; se diseña con puntales y tensores (no implementado).` });
  }

  // Cortes representativos para dibujar: donde rige M⁻ y donde rige M⁺.
  const negativeIndex = moment.min.reduce((best, value, index) => value < moment.min[best]! ? index : best, 0);
  const positiveIndex = moment.max.reduce((best, value, index) => value > moment.max[best]! ? index : best, 0);
  const cutAt = (label: string, index: number): BeamSectionCut => ({ label, xM: stations[index]!, top: topAt(index), bottom: bottomAt(index) });
  const cuts = [
    ...(negativeMoment > TOLERANCE ? [cutAt('Apoyo · M⁻ máx.', negativeIndex)] : []),
    ...(positiveMoment > TOLERANCE ? [cutAt('Claro · M⁺ máx.', positiveIndex)] : []),
  ];

  return {
    ok: true,
    input,
    totalLengthM: analysis.totalLengthM,
    nodesAtM: analysis.nodesAtM,
    selfWeightKnPerM: selfWeight,
    solverRuns: analysis.solverRuns + cracked.analysis.solverRuns,
    diagram: {
      xM: stations,
      momentMaxKnm: moment.max,
      momentMinKnm: moment.min,
      shearMaxKn: shear.max,
      shearMinKn: shear.min,
      capacityPositiveKnm: capacityPositive,
      capacityNegativeKnm: capacityNegative,
      deflectionMm,
    },
    spans,
    stirrupDiameterMm: context.stirrupDiameterMm,
    continuousTop,
    continuousBottom,
    bastions,
    cuts: cuts.length ? cuts : [cutAt('Sección', 0)],
    anchorages,
    splices,
    extremes: { positiveMomentKnm: positiveMoment, negativeMomentKnm: negativeMoment, shearKn: Math.max(...stirrups.map((item) => item.demandKn)) },
    deflection: {
      governingSpan: governingSpanIndex,
      immediateMm: governingSpan.immediateMm,
      totalMm: governingSpan.deflectionMm,
      checkedMm: governingSpan.checkedDeflectionMm,
      limitMm: governingSpan.deflectionLimitMm,
      crackingMomentKnm: crackingMoment,
    },
    checks,
    governingRatio: governingRatio(checks.filter((item) => STRENGTH_CHECKS.has(item.id))),
    status: overallStatus(checks),
  };
}

/** Texto de un grupo de barras, p. ej. «2 #5». */
export const barsText = (group: BarGroup) => `${group.count} ${rebarLabel(group.diameterMm)}`;
