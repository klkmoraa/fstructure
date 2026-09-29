import { analyzeBeam, type BeamAnalysis, type BeamEnd, type BeamSpanLoads, type CaseResponse } from './beamAnalysis';
import { designCode, isDesignCodeId, type BlockArea, type DesignCode, type DesignCodeId, type DevelopmentLength, type LoadCombination } from './codes';
import {
  CONCRETE_UNIT_WEIGHT_KN_M3,
  STEEL_ELASTIC_MODULUS_MPA,
  barArea,
  betaOne,
  equivalentBlockStrengthMpa,
  capacityCheck,
  tracedAt,
  complementary,
  flexuralCapacity,
  floorTo,
  governingRatio,
  isPositiveFinite,
  overallStatus,
  rebarLabel,
  requiredFlexuralSteelMm2,
  type ElementCheck,
  type FlexureFactor,
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
  /** Armado propio que sustituye la propuesta automática; sin él, el motor propone. */
  readonly provided?: BeamProvidedReinforcement | null;
  /**
   * Patín de una viga T (losa a ambos lados) o L (losa de un lado). `widthMm`
   * es entonces el ancho del alma bw y `heightMm` el peralte total. El patín
   * trabaja en compresión con momento positivo; con negativo rige el alma.
   */
  readonly flange?: BeamFlange | null;
}

export interface BeamFlange {
  readonly kind: 'T' | 'L';
  /** Ancho efectivo del patín bf (incluye el alma); lo fija quien diseña y se revisa contra `flangeWidthLimit`. */
  readonly widthMm: number;
  readonly thicknessMm: number;
  /** La: distancia libre a la viga paralela vecina; sin ella el límite sale de t y Ln. */
  readonly clearDistanceMm?: number | null;
}

export interface FlangeWidthLimit {
  /** bf máximo, alma incluida. */
  readonly widthMm: number;
  /** Vuelo máximo desde la cara del alma, por lado. */
  readonly overhangMm: number;
  readonly governs: string;
}

/**
 * Ancho efectivo máximo del patín (NTC tabla 5.2.1.4.2): vuelo desde la cara
 * del alma de min(8t, La/2, Ln/8) a cada lado en vigas T y de min(6t, La/2,
 * Ln/12) en vigas L. Ln es el claro libre de la viga.
 */
export function flangeWidthLimit(kind: BeamFlange['kind'], webMm: number, thicknessMm: number, clearSpanMm: number, clearDistanceMm?: number | null): FlangeWidthLimit {
  const tee = kind === 'T';
  const candidates: [number, string][] = [
    [(tee ? 8 : 6) * thicknessMm, tee ? '8t' : '6t'],
    [clearSpanMm / (tee ? 8 : 12), tee ? 'Ln/8' : 'Ln/12'],
    ...(clearDistanceMm && clearDistanceMm > 0 ? [[clearDistanceMm / 2, 'La/2'] as [number, string]] : []),
  ];
  const [overhangMm, governs] = candidates.reduce((best, item) => item[0] < best[0] ? item : best);
  return { widthMm: webMm + (tee ? 2 : 1) * overhangMm, overhangMm, governs };
}

/** Claro libre menor de la viga: Ln de la tabla 5.2.1.4.2. */
export const beamClearSpanMm = (input: { readonly spans: readonly Pick<BeamSpanLoads, 'lengthM'>[]; readonly supportWidthMm: number }) =>
  Math.min(...input.spans.map((span) => Math.max(span.lengthM * 1e3 - input.supportWidthMm, span.lengthM * 1e3 / 2)));

/**
 * Armado que fija la persona usuaria. Las corridas son las suyas; los bastones
 * se siguen proponiendo donde no alcanzan (`auto`), se omiten (`none`, la
 * flexión se revisa sólo con las corridas) o son los suyos (`custom`). Los
 * estribos van por zonas en cada claro (`stirrupZones`), a una separación
 * uniforme en todos los claros o se calculan si `stirrupSpacingMm` es `null`.
 */
export interface BeamProvidedReinforcement {
  readonly top: BarGroup;
  readonly bottom: BarGroup;
  readonly bastions: 'auto' | 'none' | 'custom';
  /** Bastones propios (`bastions: 'custom'`); sin traslapes en un mismo lecho. */
  readonly customBastions?: readonly ProvidedBastion[];
  readonly stirrupSpacingMm: number | null;
  /** Estribos por claro; una entrada `null` deja ese claro a `stirrupSpacingMm` o al cálculo. */
  readonly stirrupZones?: readonly (ProvidedStirrupZone | null)[] | null;
}

export interface ProvidedBastion {
  readonly bed: 'top' | 'bottom';
  readonly count: number;
  readonly diameterMm: number;
  /** Desde el extremo izquierdo de la viga, m. */
  readonly startM: number;
  readonly endM: number;
}

/** Estribos de un claro: zona densa desde cada apoyo y separación al centro. */
export interface ProvidedStirrupZone {
  readonly endSpacingMm: number;
  readonly endLengthM: number;
  readonly centerSpacingMm: number;
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
  /** Bastón propio: el tramo que exigen el corte teórico y ld (null si no hace falta). */
  readonly requiredSpanM?: { readonly startM: number; readonly endM: number } | null;
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
  /** Cortante en la estación que rige contra `strengthKn` (con zonas, puede no ser el máximo del claro). */
  readonly checkedDemandKn: number;
  /** Dónde rige, m desde el extremo izquierdo de la viga. */
  readonly checkedAtM: number;
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

interface BeamDesignError {
  readonly ok: false;
  readonly errors: readonly string[];
}

/** Las separaciones son límites geométricos, no una utilización de resistencia. */
const STRENGTH_CHECKS = new Set(['flexure-positive', 'flexure-negative', 'shear', 'shear-section', 'deflection', 'deflection-live']);
const AUTO_BAR_DIAMETERS = [12.7, 15.9, 19.1, 22.2, 25.4, 28.6, 31.8];
const AUTO_STIRRUP_DIAMETERS = [9.5, 12.7, 15.9];
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

/** Bloque de compresión de una sección T/L con el patín comprimido: área para una profundidad a. */
const flangeBlock = (webMm: number, flange: BeamFlange): BlockArea => (a) =>
  Math.min(a, flange.thicknessMm) * flange.widthMm + Math.max(0, a - flange.thicknessMm) * webMm;

/**
 * Resistencia a flexión de una sección T/L con el patín en compresión, por
 * equilibrio con el bloque equivalente (mismas hipótesis que la rectangular):
 * si el bloque cabe en el patín es rectangular de ancho bf; si no, el vuelo del
 * patín aporta Cf = f″c(bf − bw)hf y el alma el resto.
 */
function flangeFlexure(areaMm2: number, webMm: number, flange: BeamFlange, depthMm: number, fyMpa: number, fcMpa: number, extremeDepthMm: number, factor: FlexureFactor) {
  const fpp = equivalentBlockStrengthMpa(fcMpa);
  const tension = areaMm2 * fyMpa;
  const { widthMm: bf, thicknessMm: hf } = flange;
  let blockDepth: number;
  let nominalNmm: number;
  if (tension <= fpp * bf * hf) {
    blockDepth = tension / (fpp * bf);
    nominalNmm = tension * (depthMm - blockDepth / 2);
  } else {
    const overhang = fpp * (bf - webMm) * hf;
    blockDepth = (tension - overhang) / (fpp * webMm);
    nominalNmm = overhang * (depthMm - hf / 2) + (tension - overhang) * (depthMm - blockDepth / 2);
  }
  const neutralAxis = blockDepth / betaOne(fcMpa);
  const netTensileStrain = neutralAxis > 0 ? 0.003 * (extremeDepthMm - neutralAxis) / neutralAxis : Number.POSITIVE_INFINITY;
  const resistanceFactor = factor(netTensileStrain, fyMpa / STEEL_ELASTIC_MODULUS_MPA);
  return { strengthKnm: resistanceFactor * nominalNmm / 1e6, nominalKnm: nominalNmm / 1e6, resistanceFactor, netTensileStrain };
}

/** Acero para `momentKnm` en sección T/L; recorre hasta el acero balanceado del bloque y afina por bisección. */
function requiredFlangeSteelMm2(momentKnm: number, webMm: number, flange: BeamFlange, depthMm: number, fyMpa: number, fcMpa: number, extremeDepthMm: number, factor: FlexureFactor): number | undefined {
  if (momentKnm <= 0) return 0;
  const balanced = equivalentBlockStrengthMpa(fcMpa) * flangeBlock(webMm, flange)(betaOne(fcMpa) * 600 * depthMm / (fyMpa + 600)) / fyMpa;
  const strength = (area: number) => flangeFlexure(area, webMm, flange, depthMm, fyMpa, fcMpa, extremeDepthMm, factor).strengthKnm;
  const steps = 400;
  let previous = 0;
  for (let step = 1; step <= steps; step += 1) {
    const area = balanced * step / steps;
    if (strength(area) >= momentKnm) {
      let low = previous;
      let high = area;
      for (let iteration = 0; iteration < 60; iteration += 1) {
        const middle = (low + high) / 2;
        if (strength(middle) >= momentKnm) high = middle; else low = middle;
      }
      return high;
    }
    previous = area;
  }
  return undefined;
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
  // Momento positivo en viga T/L: el patín trabaja en compresión.
  const flange = bed === 'bottom' ? input.flange ?? null : null;
  const block = flange ? flangeBlock(b, flange) : null;
  const maximum = block ? code.beam.maximumSteelForBlock(block, depth, extremeDepth, fc, fy) : code.beam.maximumSteel(b, depth, extremeDepth, fc, fy);
  const required = (flange
    ? requiredFlangeSteelMm2(demandKnm, b, flange, depth, fy, fc, extremeDepth, code.flexureFactor)
    : requiredFlexuralSteelMm2(demandKnm, b, depth, fy, fc, extremeDepth, code.flexureFactor, code.tensionControlledStrain)) ?? Number.POSITIVE_INFINITY;
  const capacity = flange
    ? flangeFlexure(Math.min(area, maximum), b, flange, depth, fy, fc, extremeDepth, code.flexureFactor)
    : flexuralCapacity(Math.min(area, maximum), b, depth, fy, fc, extremeDepth, code.flexureFactor);
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

/**
 * Bastones propios: su sección con las corridas y el tramo que exigen el corte
 * teórico más max(d, 12db) y ld a cada lado del pico, como los propuestos.
 */
function customBastions(
  context: SectionContext,
  stations: readonly number[],
  totalLength: number,
  bed: 'top' | 'bottom',
  demand: readonly number[],
  continuousSection: BedSection,
  provided: readonly ProvidedBastion[],
): { bastions: BeamBastion[]; failed: boolean } {
  const bastions: BeamBastion[] = [];
  let failed = false;
  for (const item of provided.filter((bastion) => bastion.bed === bed)) {
    const inside = stations.map((x, index) => ({ x, index })).filter(({ x }) => x >= item.startM - TOLERANCE && x <= item.endM + TOLERANCE);
    const peak = inside.reduce((best, station) => demand[station.index]! > demand[best.index]! ? station : best, inside[0] ?? { x: item.startM, index: 0 });
    const peakDemand = demand[peak.index] ?? 0;
    const section = evaluateSection(context, bed, continuousSection.continuous, { count: item.count, diameterMm: item.diameterMm }, peakDemand);
    if (!section) { failed = true; continue; }
    const development = developmentOf(context, section, item.diameterMm);
    const ld = development.lengthMm;
    // Donde las corridas no bastan dentro del bastón: su corte teórico.
    const exceeding = inside.filter(({ index }) => demand[index]! > continuousSection.strengthKnm * (1 + 1e-9) + TOLERANCE).map(({ index }) => index);
    let requiredSpanM: BeamBastion['requiredSpanM'] = null;
    if (exceeding.length) {
      const extension = Math.max(section.effectiveDepthMm, 12 * item.diameterMm) / 1e3;
      const theoreticalStart = stations[Math.max(0, exceeding[0]! - 1)]!;
      const theoreticalEnd = stations[Math.min(stations.length - 1, exceeding[exceeding.length - 1]! + 1)]!;
      requiredSpanM = {
        startM: Math.max(0, Math.min(theoreticalStart - extension, peak.x - ld / 1e3)),
        endM: Math.min(totalLength, Math.max(theoreticalEnd + extension, peak.x + ld / 1e3)),
      };
    }
    bastions.push({
      bed,
      bars: { count: item.count, diameterMm: item.diameterMm },
      startM: item.startM,
      endM: item.endM,
      requiredSpanM,
      peakAtM: peak.x,
      demandKnm: peakDemand,
      developmentLengthMm: ld,
      developmentFavorable: development.favorable,
      needsHook: (item.startM <= TOLERANCE && peak.x - ld / 1e3 < -TOLERANCE) || (item.endM >= totalLength - TOLERANCE && peak.x + ld / 1e3 > totalLength + TOLERANCE),
      section,
    });
  }
  return { bastions, failed };
}

const sectionAt = (x: number, bed: 'top' | 'bottom', continuous: BedSection, bastions: readonly BeamBastion[]): BedSection =>
  bastions.find((bastion) => bastion.bed === bed && x >= bastion.startM - TOLERANCE && x <= bastion.endM + TOLERANCE)?.section ?? continuous;

/** Inercia de la sección transformada agrietada, mm⁴; con patín comprimido, T si el eje neutro baja al alma. */
function crackedInertia(section: BedSection, widthMm: number, modularRatio: number, flange: BeamFlange | null = null) {
  const transformed = modularRatio * section.areaMm2;
  const d = section.effectiveDepthMm;
  const top = flange ? flange.widthMm : widthMm;
  const neutral = (-transformed + Math.sqrt(transformed ** 2 + 2 * top * transformed * d)) / top;
  if (!flange || neutral <= flange.thicknessMm) return top * neutral ** 3 / 3 + transformed * (d - neutral) ** 2;
  const { widthMm: bf, thicknessMm: hf } = flange;
  const overhang = (bf - widthMm) * hf;
  const a = widthMm / 2;
  const b = overhang + transformed;
  const c = -(overhang * hf / 2 + transformed * d);
  const kd = (-b + Math.sqrt(b ** 2 - 4 * a * c)) / (2 * a);
  return widthMm * kd ** 3 / 3 + (bf - widthMm) * hf ** 3 / 12 + overhang * (kd - hf / 2) ** 2 + transformed * (d - kd) ** 2;
}

/**
 * Inercia efectiva de una sección según la norma:
 * NTC tabla 13.4.3.2: Ie = Icr/(1 − ((2/3)Mcr/Ma)²(1 − Icr/Ig)) si Ma > (2/3)Mcr;
 * NSR C.9-8 (Branson): Ie = (Mcr/Ma)³Ig + (1 − (Mcr/Ma)³)Icr;
 * E.060 9.6.2.3: Icr si Ma > Mcr.
 */
function effectiveInertia(code: DesignCode, section: BedSection, widthMm: number, grossInertia: number, modularRatio: number, crackingMomentKnm: number, serviceMomentKnm: number, flange: BeamFlange | null = null) {
  const cracked = () => crackedInertia(section, widthMm, modularRatio, flange);
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
  if (input.flange) {
    const { widthMm: bf, thicknessMm: hf } = input.flange;
    if (!isPositiveFinite(bf) || bf < input.widthMm) errors.push('El ancho efectivo del patín debe ser al menos el ancho del alma.');
    if (!isPositiveFinite(hf) || hf >= input.heightMm) errors.push('El espesor del patín debe ser mayor que cero y menor que el peralte.');
    const la = input.flange.clearDistanceMm;
    if (la !== undefined && la !== null && !(Number.isFinite(la) && la >= 0)) errors.push('La separación libre a la viga vecina debe ser cero (sin dato) o positiva.');
  }
  if (input.provided) {
    for (const [bed, group] of [['superiores', input.provided.top], ['inferiores', input.provided.bottom]] as const) {
      if (!Number.isInteger(group.count) || group.count < 2 || group.count > 16) errors.push(`Corridas ${bed}: entre 2 y 16 barras.`);
      if (!isPositiveFinite(group.diameterMm)) errors.push(`Corridas ${bed}: diámetro inválido.`);
    }
    const spacing = input.provided.stirrupSpacingMm;
    if (spacing !== null && (!Number.isFinite(spacing) || spacing < 50)) errors.push('La separación de estribos debe ser de al menos 5 cm.');
    const total = input.spans.reduce((sum, span) => sum + span.lengthM, 0);
    if (input.provided.bastions === 'custom') {
      const custom = input.provided.customBastions ?? [];
      if (custom.length > 16) errors.push('Hasta 16 bastones propios.');
      custom.forEach((bastion, index) => {
        const label = `Bastón ${index + 1}`;
        if (!Number.isInteger(bastion.count) || bastion.count < 1 || bastion.count > 12) errors.push(`${label}: entre 1 y 12 barras.`);
        if (!isPositiveFinite(bastion.diameterMm)) errors.push(`${label}: diámetro inválido.`);
        if (!Number.isFinite(bastion.startM) || !Number.isFinite(bastion.endM) || bastion.startM < 0 || bastion.endM <= bastion.startM || bastion.endM > total + 1e-6) {
          errors.push(`${label}: debe ir de 0 a ${Number.isFinite(total) ? total.toFixed(2) : 'L'} m con inicio antes del fin.`);
        }
      });
      for (const bed of ['top', 'bottom'] as const) {
        const sorted = custom.filter((bastion) => bastion.bed === bed).sort((left, right) => left.startM - right.startM);
        if (sorted.some((bastion, index) => index > 0 && bastion.startM < sorted[index - 1]!.endM - 1e-6)) {
          errors.push(`Bastones ${bed === 'top' ? 'superiores' : 'inferiores'} traslapados: únelos en uno con la suma de barras.`);
        }
      }
    }
    (input.provided.stirrupZones ?? []).forEach((zone, index) => {
      if (!zone) return;
      const span = input.spans[index];
      if (!span) { errors.push(`Estribos: el claro ${index + 1} no existe.`); return; }
      if (!Number.isFinite(zone.endSpacingMm) || zone.endSpacingMm < 50 || !Number.isFinite(zone.centerSpacingMm) || zone.centerSpacingMm < 50) {
        errors.push(`Estribos del claro ${index + 1}: separaciones de al menos 5 cm.`);
      }
      if (!Number.isFinite(zone.endLengthM) || zone.endLengthM < 0 || 2 * zone.endLengthM > span.lengthM + 1e-6) {
        errors.push(`Estribos del claro ${index + 1}: la zona de cada extremo va de 0 a la mitad del claro.`);
      }
    });
  }
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
  forcedSpacingMm: number | null = null,
  zone: ProvidedStirrupZone | null = null,
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
  const maximumAt = indexes.reduce((best, index) => shearAt(index) > shearAt(best) ? index : best, indexes[0]!);
  if (zone) {
    // Zonas propias: cada estación se revisa con la separación que le toca.
    const endZones = zone.endLengthM > 0 ? [
      { startM: span.startM, endM: span.startM + zone.endLengthM },
      { startM: spanEnd - zone.endLengthM, endM: spanEnd },
    ] : [];
    const spacingAt = (x: number) => endZones.some((item) => x >= item.startM - 1e-9 && x <= item.endM + 1e-9) ? zone.endSpacingMm : zone.centerSpacingMm;
    const ratioAt = (index: number) => shearAt(index) / strengthAt(spacingAt(analysis.stations[index]!));
    const governing = indexes.reduce((best, index) => ratioAt(index) > ratioAt(best) ? index : best, indexes[0]!);
    return {
      denseSpacingMm: zone.endSpacingMm,
      centerSpacingMm: zone.centerSpacingMm,
      maximumSpacingMm: maximumSpacing,
      denseZones: endZones,
      demandKn: demand,
      checkedDemandKn: shearAt(governing),
      checkedAtM: analysis.stations[governing]!,
      concreteStrengthKn: phi * concreteN / 1e3,
      strengthKn: strengthAt(spacingAt(analysis.stations[governing]!)),
      maximumSectionStrengthKn: phi * (concreteN + 0.66 * Math.sqrt(fc) * b * depthMm) / 1e3,
      impractical: false,
    };
  }
  if (forcedSpacingMm !== null) {
    return {
      denseSpacingMm: forcedSpacingMm,
      centerSpacingMm: forcedSpacingMm,
      maximumSpacingMm: maximumSpacing,
      denseZones: [],
      demandKn: demand,
      checkedDemandKn: demand,
      checkedAtM: analysis.stations[maximumAt]!,
      concreteStrengthKn: phi * concreteN / 1e3,
      strengthKn: strengthAt(forcedSpacingMm),
      maximumSectionStrengthKn: phi * (concreteN + 0.66 * Math.sqrt(fc) * b * depthMm) / 1e3,
      impractical: false,
    };
  }
  return {
    denseSpacingMm: dense,
    centerSpacingMm: uniform ? dense : center,
    maximumSpacingMm: maximumSpacing,
    denseZones: uniform ? [] : zones,
    demandKn: demand,
    checkedDemandKn: demand,
    checkedAtM: analysis.stations[maximumAt]!,
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
  const provided = input.provided ?? null;
  const noBastions = { bastions: [] as BeamBastion[], failed: false };
  for (const stirrupDiameterMm of stirrupDiameters) {
    const context: SectionContext = { input, code, stirrupDiameterMm };
    const continuousBottom = provided
      ? evaluateSection(context, 'bottom', provided.bottom, null, 0)
      : chooseContinuous(context, 'bottom', barDiameters, positiveDemand.some((value) => value > TOLERANCE));
    const continuousTop = provided
      ? evaluateSection(context, 'top', provided.top, null, 0)
      : chooseContinuous(context, 'top', barDiameters, negativeDemand.some((value) => value > TOLERANCE));
    if (!continuousBottom || !continuousTop) continue;
    const custom = provided?.bastions === 'custom';
    const withBastions = provided?.bastions !== 'none' && !custom;
    const bottom = custom ? customBastions(context, analysis.stations, analysis.totalLengthM, 'bottom', positiveDemand, continuousBottom, provided?.customBastions ?? [])
      : withBastions ? designBastions(context, analysis.stations, analysis.totalLengthM, 'bottom', positiveDemand, continuousBottom, barDiameters) : noBastions;
    const top = custom ? customBastions(context, analysis.stations, analysis.totalLengthM, 'top', negativeDemand, continuousTop, provided?.customBastions ?? [])
      : withBastions ? designBastions(context, analysis.stations, analysis.totalLengthM, 'top', negativeDemand, continuousTop, barDiameters) : noBastions;
    const bastions = [...bottom.bastions, ...top.bastions];
    const depth = Math.min(continuousBottom.effectiveDepthMm, continuousTop.effectiveDepthMm, ...bastions.map((bastion) => bastion.section.effectiveDepthMm));
    const stirrups = spans.map((span, index) => designSpanStirrups(context, analysis, shear, index, span, depth, provided?.stirrupSpacingMm ?? null, provided?.stirrupZones?.[index] ?? null));
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
  const flange = input.flange ?? null;
  const hf = flange?.thicknessMm ?? 0;
  const overhangArea = flange ? (flange.widthMm - b) * hf : 0;
  const grossArea = b * h + overhangArea;
  // Centroide desde la fibra superior y momento de inercia de la sección bruta (rectangular o T/L).
  const centroidTop = flange ? (b * h * h / 2 + overhangArea * hf / 2) / grossArea : h / 2;
  const grossInertia = flange
    ? b * h ** 3 / 12 + b * h * (h / 2 - centroidTop) ** 2 + (flange.widthMm - b) * hf ** 3 / 12 + overhangArea * (centroidTop - hf / 2) ** 2
    : b * h ** 3 / 12;
  // T/L: el peso propio es el del alma bajo la losa; la losa va en la carga muerta que se captura.
  const selfWeight = input.includeSelfWeight ? CONCRETE_UNIT_WEIGHT_KN_M3 * b * (h - hf) / 1e6 : 0;
  const baseAnalysisInput = {
    spans: input.spans,
    leftEnd: input.leftEnd,
    rightEnd: input.rightEnd,
    selfWeightKnPerM: selfWeight,
    elasticModulusKpa: ec * 1e3,
    areaM2: grossArea / 1e6,
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
  if (!reinforcement) {
    return { ok: false, errors: [input.provided
      ? 'El armado propio no cabe en dos capas dentro de la base: usa menos barras, otro diámetro o una sección más ancha.'
      : 'No caben dos varillas corridas en la base: aumenta la sección o usa otro diámetro.'] };
  }
  const { continuousTop, continuousBottom, bastions, stirrups, context } = reinforcement;
  const capacityPositive = stations.map((x) => sectionAt(x, 'bottom', continuousBottom, bastions).strengthKnm);
  const capacityNegative = stations.map((x) => -sectionAt(x, 'top', continuousTop, bastions).strengthKnm);

  // 2 · Servicio: inercia efectiva por claro y un segundo análisis del solver con esas inercias.
  const modularRatio = STEEL_ELASTIC_MODULUS_MPA / ec;
  // Mcr con la fibra en tensión: abajo con momento positivo, arriba con negativo (iguales en la rectangular).
  const crackingMoment = fr * grossInertia / (h - centroidTop) / 1e6;
  const crackingNegative = fr * grossInertia / centroidTop / 1e6;
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
    const endInertia = (station: number) => effectiveInertia(code, topAt(station), b, grossInertia, modularRatio, crackingNegative, Math.max(0, -serviceMoment.min[station]!));
    let inertia: number;
    let rhoPrime: number;
    if (isCantilever(index)) {
      // Voladizo: la sección del apoyo (NSR C.9.5.2.4, E.060 9.6.2.4 d).
      const support = index === 0 ? last : first;
      inertia = endInertia(support);
      rhoPrime = bottomAt(support).areaMm2 / (b * topAt(support).effectiveDepthMm);
    } else {
      const midInertia = effectiveInertia(code, bottomAt(middle), b, grossInertia, modularRatio, crackingMoment, Math.max(0, serviceMoment.max[middle]!), flange);
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
  const shearWorst = pickWorst(stirrups, (item) => item.checkedDemandKn / item.strengthKn);
  const sectionWorst = pickWorst(stirrups, (item) => item.demandKn / item.maximumSectionStrengthKn);
  const widestSpacing = (item: SpanStirrups) => Math.max(item.denseSpacingMm, item.centerSpacingMm);
  const stirrupSpacingWorst = pickWorst(stirrups, (item) => widestSpacing(item) / item.maximumSpacingMm);
  const governingSpan = pickWorst(spans, (span) => span.checkedDeflectionMm / span.deflectionLimitMm);
  const governingSpanIndex = spans.indexOf(governingSpan);
  const combinationsText = input.combinations.map((combination) => combination.label).join(' · ');

  // Viga: la demanda es la envolvente de las combinaciones con la viva por claros (patrones).
  const envelope = `Envolvente de ${combinationsText} · viva por claros`;
  const at = (index: number, bed: 'inferior' | 'superior') => `x = ${stations[index]!.toFixed(2)} m · lecho ${bed}`;
  const checks: ElementCheck[] = [
    capacityCheck('flexure-positive', 'Flexión positiva', Math.max(0, moment.max[positiveWorst.index]!), capacityPositive[positiveWorst.index]!, 'kN·m', input.flange ? refs.flexureT : refs.flexure,
      `Rige en x = ${stations[positiveWorst.index]!.toFixed(2)} m · FR ${sectionAt(stations[positiveWorst.index]!, 'bottom', continuousBottom, bastions).resistanceFactor.toFixed(2)}.`),
  ].map((check) => tracedAt(check, at(positiveWorst.index, 'inferior'), envelope));
  if (negativeMoment > TOLERANCE) {
    checks.push(tracedAt(capacityCheck('flexure-negative', 'Flexión negativa', Math.max(0, -moment.min[negativeWorst.index]!), -capacityNegative[negativeWorst.index]!, 'kN·m', refs.flexure,
      `Rige en x = ${stations[negativeWorst.index]!.toFixed(2)} m · FR ${sectionAt(stations[negativeWorst.index]!, 'top', continuousTop, bastions).resistanceFactor.toFixed(2)}.`),
    at(negativeWorst.index, 'superior'), envelope));
  }
  checks.push(capacityCheck('steel-max', 'Acero máximo', steelWorst.areaMm2, steelWorst.maximumMm2, 'mm²', refs.steelMax, code.beam.maximumSteelNote));
  if (input.flange && code.beam.flangeWidthLimits) {
    const clearSpan = beamClearSpanMm(input);
    const limit = flangeWidthLimit(input.flange.kind, b, input.flange.thicknessMm, clearSpan, input.flange.clearDistanceMm);
    checks.push(capacityCheck('flange-width', 'Ancho efectivo del patín', input.flange.widthMm, limit.widthMm, 'mm', refs.flangeWidth,
      `Vuelo ≤ ${Math.round(limit.overhangMm)} mm ${input.flange.kind === 'T' ? 'a cada lado' : 'de un lado'} (rige ${limit.governs}; Ln = ${Math.round(clearSpan)} mm${input.flange.clearDistanceMm ? '' : ', sin La capturada'}).`));
  }
  if (minimumWorst) {
    checks.push(capacityCheck('steel-min', 'Acero mínimo', minimumOf(minimumWorst), minimumWorst.areaMm2, 'mm²', refs.steelMin,
      `Lecho ${minimumWorst.bed === 'top' ? 'superior' : 'inferior'}.`));
  }
  checks.push(
    tracedAt(capacityCheck('shear', 'Cortante', shearWorst.checkedDemandKn, shearWorst.strengthKn, 'kN', refs.shear, `Claro ${stirrups.indexOf(shearWorst) + 1} · FR ${code.shearFactor}.`),
      `Claro ${stirrups.indexOf(shearWorst) + 1} · x = ${shearWorst.checkedAtM.toFixed(2)} m`, envelope),
    tracedAt(capacityCheck('shear-section', 'Cortante máximo por sección', sectionWorst.demandKn, sectionWorst.maximumSectionStrengthKn, 'kN', refs.shearSection,
      'Si no cumple, hay que aumentar la sección: más estribos no ayudan.'), `Claro ${stirrups.indexOf(sectionWorst) + 1}`, envelope),
    capacityCheck('stirrup-spacing', 'Separación de estribos', widestSpacing(stirrupSpacingWorst), stirrupSpacingWorst.maximumSpacingMm, 'mm', refs.stirrupSpacing),
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
  checks.push(tracedAt(capacityCheck('deflection', aci ? `Deflexión posterior a los elementos no estructurales (claro ${governingSpanIndex + 1})` : `Deflexión total (claro ${governingSpanIndex + 1})`,
    governingSpan.checkedDeflectionMm, governingSpan.deflectionLimitMm, 'mm', refs.deflection,
    aci
      ? `Diferida ξ/(1+50ρ′) con ξ = ${input.longTermXi} sobre la muerta y ${Math.round(input.sustainedLiveRatio * 100)} % de la viva, más la inmediata por viva; límite ℓ/${input.damagesNonstructural ? 480 : 240}.`
      : `Ie por claro con (I₁ + I₂ + 2I₃)/4; diferida ξ/(1+50p′) con ξ = ${input.longTermXi} sobre la muerta y ${Math.round(input.sustainedLiveRatio * 100)} % de la viva (W/Wm).`),
    `Claro ${governingSpanIndex + 1}`, `Servicio: CM + ${Math.round(input.sustainedLiveRatio * 100)} % CV sostenida, sin factores`));
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
  if (input.provided?.bastions === 'custom') {
    const needed = bastions.filter((bastion) => bastion.requiredSpanM);
    const shortfall = (bastion: BeamBastion) => bastion.requiredSpanM
      ? Math.max(0, bastion.startM - bastion.requiredSpanM.startM, bastion.requiredSpanM.endM - bastion.endM) : 0;
    const worst = needed.length ? pickWorst(needed, shortfall) : undefined;
    const label = (bastion: BeamBastion) => `bastón ${bastion.bed === 'top' ? 'superior' : 'inferior'} de x = ${bastion.startM.toFixed(2)} m`;
    checks.push(worst && shortfall(worst) > 0.005
      ? { id: 'bastion-length', label: 'Longitud de los bastones', status: 'fail', reference: refs.beamAnchorage,
        note: `El ${label(worst)} debe ir de ${worst.requiredSpanM!.startM.toFixed(2)} a ${worst.requiredSpanM!.endM.toFixed(2)} m: corte teórico más max(d, 12db) y ld = ${Math.round(worst.developmentLengthMm)} mm desde el pico.` }
      : { id: 'bastion-length', label: 'Longitud de los bastones', status: 'pass', reference: refs.beamAnchorage,
        note: needed.length ? 'Cada bastón pasa el corte teórico max(d, 12db) y desarrolla ld a ambos lados del pico.' : 'Las corridas bastan; los bastones propios no son necesarios por resistencia.' });
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
