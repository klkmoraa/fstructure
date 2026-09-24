import { designCode, isDesignCodeId, type DesignCode, type DesignCodeId } from './codes';
import {
  CONCRETE_ULTIMATE_STRAIN,
  STEEL_ELASTIC_MODULUS_MPA,
  barArea,
  betaOne,
  capacityCheck,
  complementary,
  equivalentBlockStrengthMpa,
  floorTo,
  governingRatio,
  isPositiveFinite,
  ntc,
  overallStatus,
  type ElementCheck,
} from './shared';

/** Grupo de la construcción según el Reglamento de la CDMX; fija la dimensión mínima de 6.4.2.1.1. */
export type ColumnGroup = 'A' | 'B1' | 'B2';

export interface ColumnDesignInput {
  readonly code: DesignCodeId;
  /** Dimensión paralela al eje X. */
  readonly widthMm: number;
  /** Dimensión paralela al eje Y. */
  readonly depthMm: number;
  readonly coverMm: number;
  readonly fcMpa: number;
  readonly fyMpa: number;
  readonly barDiameterMm: number;
  /** Barras por cara paralela a X, incluyendo esquinas. */
  readonly barsAlongWidth: number;
  /** Barras por cara paralela a Y, incluyendo esquinas. */
  readonly barsAlongDepth: number;
  readonly tieDiameterMm: number;
  readonly maxAggregateMm: number;
  /** Compresión positiva. */
  readonly axialKn: number;
  /**
   * Momento alrededor del eje X (comprime la cara +Y). En marcos con
   * desplazamiento lateral es la parte que no produce desplazamiento (M2b, M2ns).
   */
  readonly momentXKnm: number;
  /** Momento alrededor del eje Y (comprime la cara +X). */
  readonly momentYKnm: number;
  /** Cortante último que actúa en la dirección X. */
  readonly shearXKn: number;
  /** Cortante último que actúa en la dirección Y. */
  readonly shearYKn: number;
  /** Altura libre H de la columna. */
  readonly unbracedLengthM: number;
  /** k: H′ = kH. En marcos con desplazamiento lateral no puede ser menor que 1. */
  readonly effectiveLengthFactor: number;
  /** Curvatura de la columna entre sus extremos. */
  readonly curvature: 'single' | 'double';
  /** |M1/M2|, relación entre el momento menor y el mayor en los extremos (0 a 1). */
  readonly endMomentRatio: number;
  /** βdns: fracción sostenida de la carga axial factorizada (0 a 1). */
  readonly sustainedRatio: number;
  /** Extremos restringidos lateralmente (marco arriostrado). */
  readonly braced: boolean;
  /** Momentos por desplazamiento lateral M2s (sólo `braced = false`). */
  readonly swayMomentXKnm: number;
  readonly swayMomentYKnm: number;
  /** Índice de estabilidad del entrepiso (λest en la NTC, Q en NSR y E.060). */
  readonly stabilityIndex: number;
  /** Sólo NTC: dimensión mínima de 6.4.2.1.1. */
  readonly group: ColumnGroup;
  /** Sólo NTC: columna de planta baja o del primer nivel sujeto a sismo (Lo ≥ H/2). */
  readonly groundFloor: boolean;
}

export interface ColumnBar { readonly x: number; readonly y: number }

export interface InteractionPoint {
  readonly axialKn: number;
  readonly momentKnm: number;
  readonly phi: number;
}

export interface InteractionCurve {
  /** Resistencia nominal, de tensión pura a compresión pura. */
  readonly nominal: readonly InteractionPoint[];
  /** Resistencia de diseño φ·(Pn, Mn), con el φ de la norma. */
  readonly design: readonly InteractionPoint[];
  readonly balanced: InteractionPoint;
}

export interface AxisMagnification {
  /** Esbeltez que se compara con el límite: H/r (NTC) o kH/r (ACI). */
  readonly slenderness: number;
  /** H′/r con la longitud efectiva kH. */
  readonly effectiveSlenderness: number;
  readonly limit: number;
  readonly slender: boolean;
  readonly cm: number;
  readonly criticalLoadKn: number;
  /** Fab / δns: amplificación por curvatura del miembro. */
  readonly factor: number;
  /** Fas / δs: amplificación por desplazamiento lateral (1 en marcos arriostrados). */
  readonly swayFactor: number;
  readonly minimumEccentricityMm: number;
  readonly minimumMomentKnm: number;
  /** Momento de primer orden M2 = M2b + M2s. */
  readonly firstOrderMomentKnm: number;
  /** Momento de diseño con excentricidad mínima y amplificaciones. */
  readonly designMomentKnm: number;
  /** Pu ≥ 0.75·Pc: la columna pandea antes de alcanzar la carga. */
  readonly unstable: boolean;
}

interface ColumnShear {
  readonly demandKn: number;
  readonly effectiveDepthMm: number;
  readonly legs: number;
  readonly concreteStrengthKn: number;
  readonly steelRequiredKn: number;
  /** Separación que exige la resistencia (∞ si el concreto basta). */
  readonly strengthSpacingMm: number;
  /** Separación máxima cuando se requiere refuerzo por cortante. */
  readonly tableSpacingMm: number;
  readonly minimumSteelSpacingMm: number;
  readonly sectionStrengthKn: number;
  readonly strengthKn: number;
}

export interface ColumnTies {
  readonly diameterMm: number;
  readonly minimumDiameterMm: number;
  /** Separación so en las zonas Lo de ambos extremos (NTC 6.4.4.4.2.4); igual a la central en normas sin Lo. */
  readonly endSpacingMm: number;
  /** 0 si la norma no pide zona Lo en el detallado implementado. */
  readonly endLengthMm: number;
  /** Separación fuera de Lo. */
  readonly centerSpacingMm: number;
  /** Grapas por juego para soportar las barras intermedias de cada cara. */
  readonly crossTiesParallelToX: number;
  readonly crossTiesParallelToY: number;
  readonly hxMm: number;
  readonly hxLimitMm: number;
  readonly shear: { readonly x: ColumnShear; readonly y: ColumnShear };
}

export interface ColumnDesignResult {
  readonly ok: true;
  readonly input: ColumnDesignInput;
  readonly bars: readonly ColumnBar[];
  readonly steelAreaMm2: number;
  readonly steelRatio: number;
  readonly grossAreaMm2: number;
  readonly squashLoadKn: number;
  /** φPn,máx: coeficiente de la norma · φ · P0. */
  readonly maximumDesignAxialKn: number;
  readonly aboutX: InteractionCurve;
  readonly aboutY: InteractionCurve;
  readonly capacity: {
    readonly method: 'uniaxial-x' | 'uniaxial-y' | 'bresler-load' | 'bresler-contour' | 'axial';
    readonly ratio: number;
    readonly detail: string;
  };
  readonly ties: ColumnTies;
  /** Traslape Clase B de las barras longitudinales a tensión, mm. */
  readonly spliceLengthMm: number;
  readonly slenderness: { readonly x: number; readonly y: number; readonly limit: number };
  readonly magnification: { readonly x: AxisMagnification; readonly y: AxisMagnification };
  readonly checks: readonly ElementCheck[];
  readonly governingRatio: number;
  readonly status: 'pass' | 'fail' | 'warning';
}

interface ColumnDesignError { readonly ok: false; readonly errors: readonly string[] }

const PHI_TENSION = 0.9;
const TOLERANCE = 1e-9;

export function columnBars(input: Pick<ColumnDesignInput, 'widthMm' | 'depthMm' | 'coverMm' | 'tieDiameterMm' | 'barDiameterMm' | 'barsAlongWidth' | 'barsAlongDepth'>): ColumnBar[] {
  const offset = input.coverMm + input.tieDiameterMm + input.barDiameterMm / 2;
  const xEdge = input.widthMm / 2 - offset;
  const yEdge = input.depthMm / 2 - offset;
  const bars: ColumnBar[] = [];
  const nx = Math.max(2, Math.round(input.barsAlongWidth));
  const ny = Math.max(2, Math.round(input.barsAlongDepth));
  for (let index = 0; index < nx; index += 1) {
    const x = -xEdge + 2 * xEdge * index / (nx - 1);
    bars.push({ x, y: yEdge }, { x, y: -yEdge });
  }
  for (let index = 1; index < ny - 1; index += 1) {
    const y = -yEdge + 2 * yEdge * index / (ny - 1);
    bars.push({ x: -xEdge, y }, { x: xEdge, y });
  }
  return bars;
}

function interactionCurve(
  code: DesignCode,
  sectionDepth: number,
  sectionWidth: number,
  positions: readonly number[],
  barAreaMm2: number,
  fc: number,
  fy: number,
  maximumDesignAxialN: number,
): InteractionCurve {
  const fpp = equivalentBlockStrengthMpa(fc);
  const beta = betaOne(fc);
  const yieldStrain = fy / STEEL_ELASTIC_MODULUS_MPA;
  const top = sectionDepth / 2;
  const extremeTension = Math.min(...positions);
  const dt = top - extremeTension;
  const totalSteel = positions.length * barAreaMm2;
  const gross = sectionDepth * sectionWidth;

  const section = (c: number) => {
    const a = Math.min(beta * c, sectionDepth);
    const concreteForce = fpp * a * sectionWidth;
    let axial = concreteForce;
    let moment = concreteForce * (top - a / 2);
    for (const y of positions) {
      const strain = CONCRETE_ULTIMATE_STRAIN * (c - (top - y)) / c;
      let stress = Math.max(-fy, Math.min(fy, strain * STEEL_ELASTIC_MODULUS_MPA));
      if (top - y < a) stress -= fpp;
      axial += stress * barAreaMm2;
      moment += stress * barAreaMm2 * y;
    }
    return { axialN: axial, momentNmm: moment, netStrain: CONCRETE_ULTIMATE_STRAIN * (dt - c) / c };
  };
  const balancedC = CONCRETE_ULTIMATE_STRAIN * dt / (CONCRETE_ULTIMATE_STRAIN + yieldStrain);
  // E.060 9.3.2.2: φ crece hasta 0.90 cuando φPn baja de min(0.1f′cAg, φPb) a cero.
  const lowAxialN = Math.max(1, Math.min(0.1 * fc * gross, code.compressionFactor * section(balancedC).axialN));
  const evaluate = (c: number): InteractionPoint => {
    const point = section(c);
    return {
      axialKn: point.axialN / 1e3,
      momentKnm: point.momentNmm / 1e6,
      phi: code.columnFactor({ netStrain: point.netStrain, yieldStrain, axialN: point.axialN, lowAxialN }),
    };
  };

  const nominal: InteractionPoint[] = [{ axialKn: -fy * totalSteel / 1e3, momentKnm: 0, phi: PHI_TENSION }];
  const steps = 90;
  for (let index = 1; index <= steps; index += 1) {
    // Distribución geométrica: más puntos donde la curva cambia rápido.
    const c = dt * 0.02 * (60 / 0.02) ** (index / steps);
    const point = evaluate(c);
    if (point.momentKnm < -1e-9) continue;
    nominal.push(point);
  }
  const squash = (fpp * (gross - totalSteel) + fy * totalSteel) / 1e3;
  nominal.push({ axialKn: squash, momentKnm: 0, phi: code.compressionFactor });

  const cap = maximumDesignAxialN / 1e3;
  const design: InteractionPoint[] = [];
  for (const point of nominal) {
    const axial = point.axialKn * point.phi;
    const moment = point.momentKnm * point.phi;
    if (axial <= cap) {
      design.push({ axialKn: axial, momentKnm: moment, phi: point.phi });
      continue;
    }
    const previous = design[design.length - 1];
    if (previous && previous.axialKn < cap) {
      const t = (cap - previous.axialKn) / (axial - previous.axialKn);
      design.push({ axialKn: cap, momentKnm: previous.momentKnm + t * (moment - previous.momentKnm), phi: point.phi });
    }
  }
  design.push({ axialKn: cap, momentKnm: 0, phi: code.compressionFactor });
  return { nominal, design, balanced: evaluate(balancedC) };
}
export function rayCapacity(curve: readonly InteractionPoint[], momentKnm: number, axialKn: number): InteractionPoint | undefined {
  const magnitude = Math.hypot(momentKnm, axialKn);
  if (magnitude < 1e-12) return undefined;
  const dm = Math.abs(momentKnm) / magnitude;
  const dp = axialKn / magnitude;
  let best: { t: number; point: InteractionPoint } | undefined;
  for (let index = 1; index < curve.length; index += 1) {
    const a = curve[index - 1]!;
    const b = curve[index]!;
    const em = b.momentKnm - a.momentKnm;
    const ep = b.axialKn - a.axialKn;
    const denominator = dm * ep - dp * em;
    if (Math.abs(denominator) < 1e-12) continue;
    const t = (a.momentKnm * ep - a.axialKn * em) / denominator;
    const s = (a.momentKnm * dp - a.axialKn * dm) / denominator;
    if (t > 0 && s >= -1e-9 && s <= 1 + 1e-9 && (!best || t > best.t)) {
      best = { t, point: { momentKnm: t * dm, axialKn: t * dp, phi: a.phi + s * (b.phi - a.phi) } };
    }
  }
  return best?.point;
}
export function momentCapacityAt(curve: readonly InteractionPoint[], axialKn: number): number {
  let best = 0;
  for (let index = 1; index < curve.length; index += 1) {
    const a = curve[index - 1]!;
    const b = curve[index]!;
    const low = Math.min(a.axialKn, b.axialKn);
    const high = Math.max(a.axialKn, b.axialKn);
    if (axialKn < low - 1e-9 || axialKn > high + 1e-9) continue;
    const t = high === low ? 0 : (axialKn - a.axialKn) / (b.axialKn - a.axialKn);
    best = Math.max(best, a.momentKnm + t * (b.momentKnm - a.momentKnm));
  }
  return best;
}

function validate(input: ColumnDesignInput): string[] {
  const errors: string[] = [];
  if (!isDesignCodeId(input.code)) return ['Norma de diseño desconocida.'];
  const positive: [keyof ColumnDesignInput, string][] = [
    ['widthMm', 'Base b'], ['depthMm', 'Peralte h'], ['coverMm', 'Recubrimiento'], ['fcMpa', "f'c"], ['fyMpa', 'fy'],
    ['barDiameterMm', 'Diámetro de barra'], ['tieDiameterMm', 'Diámetro de estribo'], ['unbracedLengthM', 'Altura libre'],
    ['effectiveLengthFactor', 'Factor k'], ['maxAggregateMm', 'Agregado máximo'],
  ];
  for (const [key, label] of positive) if (!isPositiveFinite(input[key] as number)) errors.push(`${label} debe ser mayor que cero.`);
  if (!Number.isFinite(input.endMomentRatio) || input.endMomentRatio < 0 || input.endMomentRatio > 1) errors.push('|M1/M2| debe estar entre 0 y 1.');
  if (!Number.isFinite(input.sustainedRatio) || input.sustainedRatio < 0 || input.sustainedRatio > 1) errors.push('βdns debe estar entre 0 y 1.');
  for (const key of ['axialKn', 'momentXKnm', 'momentYKnm', 'shearXKn', 'shearYKn', 'swayMomentXKnm', 'swayMomentYKnm'] as const) {
    if (!Number.isFinite(input[key])) errors.push('Las solicitaciones deben ser números.');
  }
  if (!input.braced) {
    if (!Number.isFinite(input.stabilityIndex) || input.stabilityIndex < 0) errors.push('El índice de estabilidad debe ser cero o positivo.');
    if (input.effectiveLengthFactor < 1) errors.push('En marcos con desplazamiento lateral k no puede ser menor que 1.0.');
  }
  if (!Number.isInteger(input.barsAlongWidth) || input.barsAlongWidth < 2 || input.barsAlongWidth > 12) errors.push('Barras por cara (b) debe ser un entero entre 2 y 12.');
  if (!Number.isInteger(input.barsAlongDepth) || input.barsAlongDepth < 2 || input.barsAlongDepth > 12) errors.push('Barras por cara (h) debe ser un entero entre 2 y 12.');
  if (errors.length) return errors;
  const offset = 2 * (input.coverMm + input.tieDiameterMm) + input.barDiameterMm;
  if (input.widthMm <= offset || input.depthMm <= offset) errors.push('La sección es demasiado pequeña para el recubrimiento y las barras.');
  if (input.fcMpa < 20 || input.fcMpa > 70) errors.push("f'c fuera del intervalo admitido (20–70 MPa).");
  return errors;
}

/**
 * Momento de diseño en una dirección con efectos de esbeltez.
 *
 * Marcos arriostrados: NTC 3.3.5.2.1.1-3.3.5.2.4.3 (H/r < 34 − 12 M1/M2,
 * excentricidad mínima siempre), NSR C.10.10.1 y C.10.10.6 (kℓu/r ≤ 34 − 12 M1/M2
 * ≤ 40, M2,mín = Pu(15 + 0.03h)), E.060 10.12. En todas Mc = δ·M2 con
 * δ = Cm/(1 − Pu/0.75Pc) ≥ 1, Pc = π²EI/(kH)² y EI = 0.4EcIg/(1 + βdns).
 *
 * Marcos con desplazamiento lateral: M2 = M2b + δs·M2s con δs = 1/(1 − Q) ≥ 1
 * (NTC 3.3.5.2.5, NSR C.10.10.7, E.060 10.13); si δs > 1.5 la norma exige
 * ΣPu/ΣPc o un análisis de segundo orden, que este taller no hace.
 */
function magnify(code: DesignCode, input: ColumnDesignInput, depthMm: number, widthMm: number, nonSwayKnm: number, swayKnm: number): AxisMagnification {
  const rules = code.column;
  const pu = input.axialKn;
  const height = input.unbracedLengthM * 1e3;
  const radius = rules.radiusOfGyration(depthMm);
  const k = input.effectiveLengthFactor;
  const slendernessH = height / radius;
  const effectiveSlenderness = k * height / radius;
  const slenderness = rules.neglectUsesEffectiveLength ? effectiveSlenderness : slendernessH;
  const signedRatio = (input.curvature === 'single' ? 1 : -1) * input.endMomentRatio;
  const ec = code.elasticModulusMpa(input.fcMpa);
  const stiffness = 0.4 * ec * (widthMm * depthMm ** 3 / 12) / (1 + input.sustainedRatio);
  const criticalFor = (factor: number) => Math.PI ** 2 * stiffness / (factor * height) ** 2 / 1e3;

  // δ por curvatura del miembro (sin desplazamiento) sobre un M2 dado.
  const amplify = (m2: number, kFactor: number) => {
    const aci = rules.minimumMoment === 'aci';
    const minimumEccentricityMm = aci ? 15 + 0.03 * depthMm : Math.max(0.05 * depthMm, 20);
    const minimumMomentKnm = pu > 0 ? pu * minimumEccentricityMm / 1e3 : 0;
    const governedByMinimum = minimumMomentKnm > m2 + TOLERANCE;
    const cm = governedByMinimum ? 1 : Math.max(rules.cmMinimum, 0.6 + 0.4 * signedRatio);
    const criticalLoadKn = criticalFor(kFactor);
    const base = Math.max(m2, minimumMomentKnm);
    const unstable = pu >= 0.75 * criticalLoadKn;
    const factor = unstable ? Number.POSITIVE_INFINITY : Math.max(1, cm / (1 - pu / (0.75 * criticalLoadKn)));
    return { minimumEccentricityMm, minimumMomentKnm, cm, criticalLoadKn, base, unstable, factor };
  };

  if (input.braced) {
    const limit = Math.min(34 - 12 * signedRatio, rules.neglectCap);
    // NTC: se desprecia si H/r < límite; NSR y E.060: si kℓu/r ≤ límite.
    const slender = pu > 0 && (rules.neglectUsesEffectiveLength ? slenderness > limit : slenderness >= limit);
    const amplified = amplify(nonSwayKnm, k);
    if (!slender) {
      // NTC aplica la excentricidad mínima siempre (5.3.2.1); en ACI M2,mín sólo en miembros esbeltos.
      const design = rules.minimumMoment === 'eccentricity' ? amplified.base : nonSwayKnm;
      return {
        slenderness, effectiveSlenderness, limit, slender, cm: amplified.cm, criticalLoadKn: amplified.criticalLoadKn, factor: 1, swayFactor: 1,
        minimumEccentricityMm: amplified.minimumEccentricityMm, minimumMomentKnm: rules.minimumMoment === 'eccentricity' ? amplified.minimumMomentKnm : 0,
        firstOrderMomentKnm: nonSwayKnm, designMomentKnm: design, unstable: false,
      };
    }
    return {
      slenderness, effectiveSlenderness, limit, slender, cm: amplified.cm, criticalLoadKn: amplified.criticalLoadKn, factor: amplified.factor, swayFactor: 1,
      minimumEccentricityMm: amplified.minimumEccentricityMm, minimumMomentKnm: amplified.minimumMomentKnm,
      firstOrderMomentKnm: nonSwayKnm,
      designMomentKnm: amplified.unstable ? amplified.base : amplified.factor * amplified.base,
      unstable: amplified.unstable,
    };
  }

  // Marco con desplazamiento lateral.
  const q = input.stabilityIndex;
  const neglect = pu <= 0 || (rules.swayNeglectInclusive ? slenderness <= rules.swayNeglectLimit : slenderness < rules.swayNeglectLimit);
  const swayFactor = neglect ? 1 : q < 1 ? Math.max(1, 1 / (1 - q)) : Number.POSITIVE_INFINITY;
  const firstOrder = nonSwayKnm + swayKnm;
  const m2 = nonSwayKnm + (Number.isFinite(swayFactor) ? swayFactor : 1) * swayKnm;
  // NTC 3.3.5.2.5.5 y E.060 10.13.5: si H/r ≥ 35/√(Pu/f′cAg) se amplifica además con δns y k de marco arriostrado.
  const individualLimit = pu > 0 ? 35 / Math.sqrt(pu * 1e3 / (input.fcMpa * widthMm * depthMm)) : Number.POSITIVE_INFINITY;
  const individual = rules.swayIndividualCheck === 'inclusive' ? slendernessH >= individualLimit
    : rules.swayIndividualCheck === 'strict' ? slendernessH > individualLimit : false;
  const amplified = amplify(m2, Math.min(k, 1));
  const base = rules.minimumMoment === 'eccentricity' ? amplified.base : m2;
  const design = individual ? (amplified.unstable ? amplified.base : amplified.factor * amplified.base) : base;
  return {
    slenderness, effectiveSlenderness, limit: rules.swayNeglectLimit, slender: !neglect, cm: amplified.cm, criticalLoadKn: amplified.criticalLoadKn,
    factor: individual ? amplified.factor : 1, swayFactor,
    minimumEccentricityMm: amplified.minimumEccentricityMm, minimumMomentKnm: rules.minimumMoment === 'eccentricity' || individual ? amplified.minimumMomentKnm : 0,
    firstOrderMomentKnm: firstOrder, designMomentKnm: design, unstable: individual && amplified.unstable,
  };
}

/**
 * Cortante en una dirección de columna con estribos. NTC: 5.5.3.1.1-5.5.3.1.2,
 * 6.4.3.2.1 y tabla 6.4.4.4.5.1. NSR y E.060: Vc = 0.17(1 + Nu/14Ag)√f′c·b·d,
 * nulo con tensión, s ≤ d/2 ≤ 600 mm (d/4 ≤ 300 mm si Vs > 0.33√f′c·b·d) y
 * Av,mín donde Vu > 0.5φVc.
 */
function columnShear(code: DesignCode, input: ColumnDesignInput, along: 'x' | 'y', gross: number, legs: number): ColumnShear {
  const fc = input.fcMpa;
  const fy = input.fyMpa;
  const phi = code.shearFactor;
  const depthDimension = along === 'x' ? input.widthMm : input.depthMm;
  const width = along === 'x' ? input.depthMm : input.widthMm;
  const d = depthDimension - input.coverMm - input.tieDiameterMm - input.barDiameterMm / 2;
  const demand = Math.abs(along === 'x' ? input.shearXKn : input.shearYKn);
  let concreteN: number;
  if (code.column.ties === 'ntc') {
    const axialStress = Math.min(input.axialKn * 1e3 / (6 * gross), 0.05 * fc);
    concreteN = Math.min(0.42 * Math.sqrt(fc) * width * d, Math.max(0, (0.17 * Math.sqrt(fc) + axialStress) * width * d));
  } else {
    concreteN = input.axialKn > 0 ? 0.17 * (1 + input.axialKn * 1e3 / (14 * gross)) * Math.sqrt(fc) * width * d : 0;
  }
  const steelRequiredN = Math.max(0, demand * 1e3 / phi - concreteN);
  const tieArea = legs * barArea(input.tieDiameterMm);
  const strengthSpacing = steelRequiredN > 0 ? tieArea * fy * d / steelRequiredN : Number.POSITIVE_INFINITY;
  const high = steelRequiredN > 0.33 * Math.sqrt(fc) * width * d;
  const tableSpacing = steelRequiredN <= 0
    ? Number.POSITIVE_INFINITY
    : code.column.ties === 'ntc'
      ? (high ? Math.min(d / 4, 3 * depthDimension / 8, 300) : Math.min(d / 2, 3 * depthDimension / 4, 600))
      : (high ? Math.min(d / 4, 300) : Math.min(d / 2, 600));
  const minimumApplies = code.column.ties === 'ntc' || demand * 1e3 > 0.5 * phi * concreteN;
  const minimumSteelSpacing = minimumApplies ? tieArea * fy / (Math.max(0.062 * Math.sqrt(fc), 0.35) * width) : Number.POSITIVE_INFINITY;
  return {
    demandKn: demand,
    effectiveDepthMm: d,
    legs,
    concreteStrengthKn: phi * concreteN / 1e3,
    steelRequiredKn: steelRequiredN / 1e3,
    strengthSpacingMm: strengthSpacing,
    tableSpacingMm: tableSpacing,
    minimumSteelSpacingMm: minimumSteelSpacing,
    sectionStrengthKn: phi * (concreteN + 0.66 * Math.sqrt(fc) * width * d) / 1e3,
    strengthKn: 0,
  };
}

const withSpacing = (code: DesignCode, shear: ColumnShear, input: ColumnDesignInput, spacing: number): ColumnShear => {
  const d = shear.effectiveDepthMm;
  const steel = shear.legs * barArea(input.tieDiameterMm) * input.fyMpa * d / spacing;
  return { ...shear, strengthKn: shear.concreteStrengthKn + code.shearFactor * steel / 1e3 };
};

const roundSpacing = (value: number) => Math.max(50, floorTo(value, 25) || floorTo(value, 5));

/**
 * Grapas por cara con la regla de 150 mm (NSR C.7.10.5.3, E.060 7.10.5.3):
 * esquinas y barras alternas apoyadas; si la separación libre entre barras
 * vecinas excede 150 mm, todas.
 */
const aciCrossTies = (barsOnFace: number, clearSpacingMm: number) => {
  const interior = Math.max(0, barsOnFace - 2);
  return clearSpacingMm > 150 ? interior : Math.floor(interior / 2);
};

export function designColumn(input: ColumnDesignInput): ColumnDesignResult | ColumnDesignError {
  const errors = validate(input);
  if (errors.length) return { ok: false, errors };

  const code = designCode(input.code);
  const rules = code.column;
  const { widthMm: b, depthMm: h, fcMpa: fc, fyMpa: fy } = input;
  const bars = columnBars(input);
  const area = barArea(input.barDiameterMm);
  const steel = bars.length * area;
  const gross = b * h;
  const fpp = equivalentBlockStrengthMpa(fc);
  const squashN = fpp * (gross - steel) + fy * steel;
  // φPn,máx = coeficiente · φ · P0 (NTC: PR0 = 0.65P0; NSR C.10.3.6.2: 0.75φP0; E.060 10.3.6.2: 0.80φP0).
  const maximumDesignAxialN = code.maximumAxialCoefficient * code.compressionFactor * squashN;
  const aboutX = interactionCurve(code, h, b, bars.map((bar) => bar.y), area, fc, fy, maximumDesignAxialN);
  const aboutY = interactionCurve(code, b, h, bars.map((bar) => bar.x), area, fc, fy, maximumDesignAxialN);
  const cap = maximumDesignAxialN / 1e3;
  // Término de carga axial pura en Bresler: φP0 sin el coeficiente de φPn,máx.
  const pr0 = code.compressionFactor * squashN / 1e3;

  const pu = input.axialKn;
  const appliedX = Math.abs(input.momentXKnm);
  const appliedY = Math.abs(input.momentYKnm);
  const swayX = input.braced ? 0 : Math.abs(input.swayMomentXKnm);
  const swayY = input.braced ? 0 : Math.abs(input.swayMomentYKnm);
  const magnification = { x: magnify(code, input, h, b, appliedX, swayX), y: magnify(code, input, b, h, appliedY, swayY) };

  const uniaxial = (curve: InteractionCurve, moment: number) => {
    if (moment < TOLERANCE) {
      const limit = pu >= 0 ? cap : PHI_TENSION * fy * steel / 1e3;
      return { ratio: Math.abs(pu) / limit, detail: `φPn,máx = ${limit.toFixed(0)} kN` };
    }
    const hit = rayCapacity(curve.design, moment, pu);
    return hit
      ? { ratio: Math.hypot(moment, pu) / Math.hypot(hit.momentKnm, hit.axialKn), detail: `PR = ${hit.axialKn.toFixed(0)} kN · MR = ${hit.momentKnm.toFixed(1)} kN·m` }
      : { ratio: Number.POSITIVE_INFINITY, detail: 'Fuera del diagrama' };
  };

  // Flexión aplicada (con mínimos y amplificación) en los ejes con momento; los
  // ejes sin momento se revisan aparte con su momento mínimo, si la norma lo pide.
  const hasX = appliedX + swayX > TOLERANCE;
  const hasY = appliedY + swayY > TOLERANCE;
  const mx = hasX ? magnification.x.designMomentKnm : 0;
  const my = hasY ? magnification.y.designMomentKnm : 0;
  let capacity: ColumnDesignResult['capacity'];
  if (mx === 0 && my === 0) {
    const x = uniaxial(aboutX, magnification.x.designMomentKnm);
    const y = uniaxial(aboutY, magnification.y.designMomentKnm);
    capacity = x.ratio >= y.ratio
      ? { method: 'uniaxial-x', ratio: x.ratio, detail: `${magnification.x.designMomentKnm > TOLERANCE ? 'Momento mínimo en X · ' : ''}${x.detail}` }
      : { method: 'uniaxial-y', ratio: y.ratio, detail: `${magnification.y.designMomentKnm > TOLERANCE ? 'Momento mínimo en Y · ' : ''}${y.detail}` };
  } else if (my === 0 || mx === 0) {
    const main = my === 0 ? uniaxial(aboutX, mx) : uniaxial(aboutY, my);
    const other = my === 0 ? uniaxial(aboutY, magnification.y.designMomentKnm) : uniaxial(aboutX, magnification.x.designMomentKnm);
    capacity = main.ratio >= other.ratio
      ? { method: my === 0 ? 'uniaxial-x' : 'uniaxial-y', ratio: main.ratio, detail: main.detail }
      : { method: my === 0 ? 'uniaxial-y' : 'uniaxial-x', ratio: other.ratio, detail: `Momento mínimo en la otra dirección · ${other.detail}` };
  } else {
    const hitX = pu > 0 ? rayCapacity(aboutX.design, mx, pu) : undefined;
    const hitY = pu > 0 ? rayCapacity(aboutY.design, my, pu) : undefined;
    const inverse = hitX && hitY ? 1 / hitX.axialKn + 1 / hitY.axialKn - 1 / pr0 : Number.NaN;
    const pr = inverse > 0 ? Math.min(cap, 1 / inverse) : 0;
    if (pu > 0 && pr / pr0 >= 0.1) {
      capacity = { method: 'bresler-load', ratio: pu / pr, detail: `PR = ${pr.toFixed(0)} kN (1/PR = 1/PRx + 1/PRy − 1/PR0)` };
    } else {
      const mrx = momentCapacityAt(aboutX.design, pu);
      const mry = momentCapacityAt(aboutY.design, pu);
      const ratio = mrx > 0 && mry > 0 ? mx / mrx + my / mry : Number.POSITIVE_INFINITY;
      capacity = { method: 'bresler-contour', ratio, detail: `Carga axial baja: MRx = ${mrx.toFixed(1)} · MRy = ${mry.toFixed(1)} kN·m` };
    }
  }

  // Refuerzo transversal.
  const offset = input.coverMm + input.tieDiameterMm + input.barDiameterMm / 2;
  const alongWidth = (b - 2 * offset) / (input.barsAlongWidth - 1);
  const alongDepth = (h - 2 * offset) / (input.barsAlongDepth - 1);
  const clearAlongWidth = alongWidth - input.barDiameterMm;
  const clearAlongDepth = alongDepth - input.barDiameterMm;
  const ntcTies = rules.ties === 'ntc';
  // NTC 6.4.4.4.2.6: cada barra intermedia soportada; ACI: esquinas, alternas y la regla de 150 mm.
  const crossTiesParallelToY = ntcTies ? Math.max(0, input.barsAlongWidth - 2) : aciCrossTies(input.barsAlongWidth, clearAlongWidth);
  const crossTiesParallelToX = ntcTies ? Math.max(0, input.barsAlongDepth - 2) : aciCrossTies(input.barsAlongDepth, clearAlongDepth);
  const hx = Math.max(alongWidth, alongDepth);
  const hxLimit = pu * 1e3 > 0.3 * gross * fc || fc > 70 ? 300 : 500;
  const shearX = columnShear(code, input, 'x', gross, 2 + crossTiesParallelToX);
  const shearY = columnShear(code, input, 'y', gross, 2 + crossTiesParallelToY);
  const grade56 = fy > 420 * 1.02;
  const detailLimit = ntcTies
    ? Math.min(16 * input.barDiameterMm, 48 * input.tieDiameterMm)
    : Math.min(16 * input.barDiameterMm, 48 * input.tieDiameterMm, Math.min(b, h));
  const endLimit = Math.min(grade56 ? Math.min(6 * input.barDiameterMm, 150) : Math.min(8 * input.barDiameterMm, 200), Math.min(b, h) / 4);
  const centerLimit = Math.min(
    detailLimit,
    shearX.strengthSpacingMm, shearX.tableSpacingMm, shearX.minimumSteelSpacingMm,
    shearY.strengthSpacingMm, shearY.tableSpacingMm, shearY.minimumSteelSpacingMm,
  );
  const centerSpacing = roundSpacing(centerLimit);
  const endSpacing = ntcTies ? Math.min(centerSpacing, roundSpacing(endLimit)) : centerSpacing;
  const height = input.unbracedLengthM * 1e3;
  const endLength = Math.max(height / 6, Math.max(b, h), 600, input.groundFloor ? height / 2 : 0);
  const minimumTie = rules.minimumTieDiameter(input.barDiameterMm);
  const ties: ColumnTies = {
    diameterMm: input.tieDiameterMm,
    minimumDiameterMm: minimumTie,
    endSpacingMm: endSpacing,
    endLengthMm: ntcTies ? Math.min(height / 2, Math.ceil(endLength / 50) * 50) : 0,
    centerSpacingMm: centerSpacing,
    crossTiesParallelToX,
    crossTiesParallelToY,
    hxMm: hx,
    hxLimitMm: hxLimit,
    shear: { x: withSpacing(code, shearX, input, centerSpacing), y: withSpacing(code, shearY, input, centerSpacing) },
  };
  const development = code.developmentLength({
    diameterMm: input.barDiameterMm,
    fyMpa: fy,
    fcMpa: fc,
    topBar: false,
    clearSpacingMm: Math.min(clearAlongWidth, clearAlongDepth),
    clearCoverMm: input.coverMm + input.tieDiameterMm,
    minimumStirrups: true,
  });
  const spliceLengthMm = code.spliceLengthMm(development);

  const refs = code.refs;
  const ratio = steel / gross;
  const minimumDimension = Math.min(b, h);
  const requiredMinimumDimension = input.group === 'B2' ? 250 : 300;
  const minimumClear = rules.minimumClearSpacing(input.barDiameterMm, input.maxAggregateMm);
  const slenderX = magnification.x.slenderness;
  const slenderY = magnification.y.slenderness;
  const governingAxis = slenderX >= slenderY ? magnification.x : magnification.y;
  const unstable = magnification.x.unstable || magnification.y.unstable;
  const effective = Math.max(magnification.x.effectiveSlenderness, magnification.y.effectiveSlenderness);
  const swayFactor = Math.max(magnification.x.swayFactor, magnification.y.swayFactor);
  const secondOrderRatio = Math.max(...[magnification.x, magnification.y]
    .filter((axis) => axis.firstOrderMomentKnm > TOLERANCE)
    .map((axis) => axis.designMomentKnm / axis.firstOrderMomentKnm), 0);

  const limitFail = rules.slendernessLimit?.kind === 'fail' && effective > rules.slendernessLimit.value;
  const secondOrderNeeded = rules.slendernessLimit?.kind === 'second-order' && effective > rules.slendernessLimit.value;
  const swayFail = !input.braced && (swayFactor > 1.5 || input.stabilityIndex > rules.maximumStabilityIndex);
  const ratioFail = secondOrderRatio > rules.secondOrderRatioLimit + 1e-9;
  const anySlender = magnification.x.slender || magnification.y.slender;
  const slenderNote = unstable
    ? 'Pu ≥ 0.75·Pc: la columna pandea. Aumenta la sección o reduce la altura libre.'
    : limitFail
      ? `kH/r = ${effective.toFixed(0)} > ${rules.slendernessLimit!.value}: la norma no admite esta esbeltez.`
      : swayFail
        ? input.stabilityIndex > rules.maximumStabilityIndex
          ? `Q = ${input.stabilityIndex.toFixed(2)} > ${rules.maximumStabilityIndex}: el entrepiso es inestable según la norma.`
          : `δs = ${Number.isFinite(swayFactor) ? swayFactor.toFixed(2) : '∞'} > 1.5: se requiere ΣPu/ΣPc o un análisis de segundo orden (no implementados).`
        : ratioFail
          ? `Momento con efectos de segundo orden ${secondOrderRatio.toFixed(2)} veces el de primer orden (> ${rules.secondOrderRatioLimit}).`
          : secondOrderNeeded
            ? "H′/r > 100: se requiere un análisis elástico de segundo orden."
            : !input.braced
              ? `Marco con desplazamiento: δs = ${swayFactor.toFixed(2)}${anySlender ? '' : ' (esbeltez despreciable)'}; δns X = ${magnification.x.factor.toFixed(2)}, Y = ${magnification.y.factor.toFixed(2)}.`
              : anySlender
                ? `Momentos amplificados δ X = ${magnification.x.factor.toFixed(2)}, Y = ${magnification.y.factor.toFixed(2)} (${rules.radiusNote}).`
                : `La esbeltez se desprecia (${rules.radiusNote}).`;

  const checks: ElementCheck[] = [
    { ...capacityCheck('strength', 'Flexocompresión', capacity.ratio, 1, '', refs.columnStrength, capacity.detail), demand: capacity.ratio, capacity: 1, unit: '' },
    { ...capacityCheck('ratio-min', `Cuantía mínima (${rules.ratioMin * 100} %)`, rules.ratioMin, ratio, '', refs.columnRatio), demand: rules.ratioMin * 100, capacity: ratio * 100, unit: '%' },
    { ...capacityCheck('ratio-max', `Cuantía máxima (${rules.ratioMax * 100} %)`, ratio, rules.ratioMax, '', refs.columnRatio), demand: ratio * 100, capacity: rules.ratioMax * 100, unit: '%' },
  ];
  if (rules.geometryLimits) {
    checks.push(
      // Sólo NTC (geometryLimits).
      capacityCheck('min-dimension', `Dimensión mínima (Grupo ${input.group})`, requiredMinimumDimension, minimumDimension, 'mm', ntc('6.4.2.1.1')),
      { ...capacityCheck('aspect', 'Relación de lados', Math.max(b, h) / minimumDimension, 4, '', ntc('6.4.2.1.1')), unit: '' },
    );
  }
  checks.push(
    capacityCheck('bar-spacing', 'Separación libre entre barras', minimumClear, Math.min(clearAlongWidth, clearAlongDepth), 'mm', refs.columnBarSpacing),
    {
      id: 'slenderness',
      label: input.braced ? 'Esbeltez' : 'Esbeltez y desplazamiento lateral',
      // El límite es el umbral para despreciar la esbeltez, no una capacidad: no se reporta como utilización.
      status: unstable || limitFail || swayFail || ratioFail ? 'fail' : secondOrderNeeded ? 'warning' : 'pass',
      reference: input.braced ? refs.slenderness : refs.sway,
      note: `${rules.neglectUsesEffectiveLength ? 'kH/r' : 'H/r'} = ${governingAxis.slenderness.toFixed(1)}${Number.isFinite(governingAxis.limit) ? ` (límite para despreciarla ${governingAxis.limit.toFixed(0)})` : ''}. ${slenderNote}`,
    },
    { ...capacityCheck('tie-diameter', 'Diámetro de estribo', minimumTie, input.tieDiameterMm, 'mm', refs.tieDiameter) },
  );
  if (ntcTies) {
    checks.push(
      capacityCheck('tie-end-spacing', 'Estribos en Lo', endSpacing, endLimit, 'mm', ntc('6.4.4.4.2.4'),
        `so ≤ ${grade56 ? '6db y 150 mm' : '8db y 200 mm'} y b/4; Lo = ${Math.round(ties.endLengthMm)} mm desde cada extremo.`),
      capacityCheck('tie-center-spacing', 'Estribos fuera de Lo', centerSpacing, detailLimit, 'mm', refs.tieSpacing),
      capacityCheck('hx', 'Separación hx de barras soportadas', hx, hxLimit, 'mm', refs.lateralSupport,
        `${crossTiesParallelToX + crossTiesParallelToY} grapas por juego para soportar las barras intermedias.`),
    );
  } else {
    checks.push(
      capacityCheck('tie-center-spacing', 'Separación de estribos', centerSpacing, detailLimit, 'mm', refs.tieSpacing, '16db, 48de y la menor dimensión.'),
      { id: 'lateral-support', label: 'Barras con apoyo lateral', status: 'info', reference: refs.lateralSupport,
        note: `Esquinas y barras alternas en estribo; ${crossTiesParallelToX + crossTiesParallelToY} grapas por juego para que ninguna barra quede a más de 150 mm libres de una apoyada.` },
    );
  }
  for (const [axis, shear] of [['X', ties.shear.x], ['Y', ties.shear.y]] as const) {
    if (shear.demandKn <= TOLERANCE) continue;
    checks.push(
      capacityCheck(`shear-${axis.toLowerCase()}`, `Cortante en ${axis}`, shear.demandKn, shear.strengthKn, 'kN', refs.columnShear,
        `${shear.legs} ramas · φVc = ${shear.concreteStrengthKn.toFixed(1)} kN · FR ${code.shearFactor}.`),
      capacityCheck(`shear-section-${axis.toLowerCase()}`, `Cortante máximo por sección en ${axis}`, shear.demandKn, shear.sectionStrengthKn, 'kN', refs.columnShearSection),
    );
  }
  checks.push({ id: 'splice', label: 'Traslape de barras longitudinales', status: 'info', reference: refs.splice,
    note: `Clase B a tensión: ${Math.round(spliceLengthMm)} mm (si las barras pueden quedar en compresión, la norma admite traslapes más cortos).` });
  if (input.axialKn < 0) {
    checks.push({ id: 'tension', label: 'Columna en tensión', status: 'warning', reference: complementary('Criterio complementario'), note: 'Con tensión neta el concreto no aporta al cortante; revisa el anclaje de las barras.' });
  }

  return {
    ok: true,
    input,
    bars,
    steelAreaMm2: steel,
    steelRatio: ratio,
    grossAreaMm2: gross,
    squashLoadKn: squashN / 1e3,
    maximumDesignAxialKn: cap,
    aboutX,
    aboutY,
    capacity,
    ties,
    spliceLengthMm,
    slenderness: { x: slenderX, y: slenderY, limit: magnification.x.limit },
    magnification,
    checks,
    governingRatio: governingRatio(checks.filter((item) => item.id === 'strength' || item.id.startsWith('shear-'))),
    status: overallStatus(checks),
  };
}

