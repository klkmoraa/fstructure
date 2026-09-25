/**
 * Análisis por espectro de respuesta, como el caso «Response Spectrum» de
 * ETABS/SAP2000:
 *
 *   1. modos con Lanczos sobre la masa de la fuente de masa;
 *   2. por modo, el factor de participación Γ = φᵀ·M·r en la dirección del
 *      caso y la aceleración espectral A = Sa(T)·g·escala;
 *   3. respuesta modal máxima u = Γ·A/ω²·φ, con sus fuerzas de inercia
 *      F = M·Γ·A·φ, y de ahí esfuerzos y reacciones como en estática;
 *   4. combinación modal CQC (Der Kiureghian, amortiguamiento constante) o
 *      SRSS de cada magnitud por separado.
 *
 * Una envolvente CQC no tiene signo; se le da el del modo dominante de cada
 * magnitud para que diagramas y deformada se lean. Las derivas y cortantes de
 * piso se combinan modo a modo, no se restan envolventes.
 */
import { computeSpace3DModalBasis, space3DParticipatingMass, space3DParticipation } from './analysisModes';
import { expandSpace3DVector } from './equations';
import { SPACE3D_GRAVITY } from './memberLoading';
import { recoverSpace3DResult } from './solver';
import { computeSpace3DStoryResponse } from './storyResponse';
import type {
  Space3DAnalysisIssue,
  Space3DAnalysisResult,
  Space3DMemberEndForces,
  Space3DMemberStation,
  Space3DProjectV1,
  Space3DResponseSpectrumCase,
  Space3DSpectrumFunction,
  Space3DStoryResponse,
} from '../model/types';

const DOF_PER_NODE = 6;

/** Sa(T) en g por interpolación lineal; fuera del rango, el extremo más cercano. */
export const space3DSpectrumAcceleration = (spectrum: Pick<Space3DSpectrumFunction, 'points'>, period: number): number => {
  const points = spectrum.points;
  if (points.length === 0) return 0;
  if (!(period > points[0][0])) return points[0][1];
  for (let index = 1; index < points.length; index += 1) {
    const [t1, a1] = points[index];
    if (period <= t1) {
      const [t0, a0] = points[index - 1];
      return a0 + ((a1 - a0) * (period - t0)) / (t1 - t0);
    }
  }
  return points[points.length - 1][1];
};

/** Correlación modal CQC con amortiguamiento ξ igual en todos los modos. */
export const space3DCqcCorrelation = (omegaI: number, omegaJ: number, damping: number): number => {
  if (omegaI === omegaJ) return 1;
  if (!(damping > 0)) return 0;
  const r = omegaJ / omegaI;
  const numerator = 8 * damping * damping * (1 + r) * r ** 1.5;
  const denominator = (1 - r * r) ** 2 + 4 * damping * damping * r * (1 + r) ** 2;
  return numerator / denominator;
};

export interface Space3DSpectrumMode {
  readonly period: number;
  /** Sa(T) de la función, en g. */
  readonly spectralAcceleration: number;
  readonly participationFactor: number;
  readonly massRatio: number;
  /** Cortante basal del modo en la dirección del caso, kN (con signo). */
  readonly baseShear: number;
}

export interface Space3DResponseSpectrumResult {
  readonly success: boolean;
  readonly caseId: string;
  readonly direction: 'x' | 'z';
  readonly combination: 'cqc' | 'srss';
  /** Envolvente con el signo del modo dominante. */
  readonly analysis: Space3DAnalysisResult | null;
  readonly modes: readonly Space3DSpectrumMode[];
  readonly baseShear: number;
  /** Suma de razones de masa de los modos usados en la dirección del caso. */
  readonly cumulativeMassRatio: number;
  readonly totalMass: number;
  readonly stories: readonly Space3DStoryResponse[];
  readonly sturmVerified: boolean;
  readonly issues: readonly Space3DAnalysisIssue[];
  readonly reason: string;
}

const failure = (spectrumCase: Pick<Space3DResponseSpectrumCase, 'id' | 'direction' | 'combination'>, reason: string, issues: readonly Space3DAnalysisIssue[] = []): Space3DResponseSpectrumResult => Object.freeze({
  success: false,
  caseId: spectrumCase.id,
  direction: spectrumCase.direction,
  combination: spectrumCase.combination,
  analysis: null,
  modes: Object.freeze([]),
  baseShear: 0,
  cumulativeMassRatio: 0,
  totalMass: 0,
  stories: Object.freeze([]),
  sturmVerified: false,
  issues: Object.freeze([...issues]),
  reason,
});

const STATION_FIELDS = ['N', 'Vy', 'Vz', 'T', 'My', 'Mz', 'u', 'v', 'w'] as const;
const END_FIELDS = ['N', 'Vy', 'Vz', 'T', 'My', 'Mz'] as const;
const DOF_FIELDS = ['ux', 'uy', 'uz', 'rx', 'ry', 'rz'] as const;

export const analyzeSpace3DResponseSpectrum = (project: Space3DProjectV1, caseId: string): Space3DResponseSpectrumResult => {
  const spectrumCase = (project.responseSpectrumCases ?? []).find((item) => item.id === caseId);
  if (!spectrumCase) return failure({ id: caseId, direction: 'x', combination: 'cqc' }, 'El caso espectral no existe.', [{ code: 'unknown-target', entityKind: 'response-spectrum-case', entityId: caseId, field: '' }]);
  const spectrum = (project.spectrumFunctions ?? []).find((item) => item.id === spectrumCase.functionId);
  if (!spectrum) return failure(spectrumCase, 'El espectro del caso no existe.', [{ code: 'missing-reference', entityKind: 'response-spectrum-case', entityId: caseId, field: 'functionId' }]);

  const basis = computeSpace3DModalBasis(project, { modes: spectrumCase.modes });
  if (!basis.ok) return failure(spectrumCase, basis.result.reason, basis.result.issues);
  const { assembly, mass, pairs } = basis;
  const axis = spectrumCase.direction === 'x' ? 0 : 2;
  const participating = space3DParticipatingMass(assembly, mass)[axis];
  if (!(participating > 0)) return failure(spectrumCase, 'No hay masa que pueda moverse en la dirección del caso.');

  // Respuesta de cada modo como un estado estático.
  const omegas = pairs.map((pair) => Math.sqrt(pair.value));
  const modal = pairs.map((pair, index) => {
    const shape = expandSpace3DVector(assembly.equations, pair.vector);
    const gamma = space3DParticipation(mass, shape, axis);
    const period = 2 * Math.PI / omegas[index];
    const sa = space3DSpectrumAcceleration(spectrum, period);
    const acceleration = sa * SPACE3D_GRAVITY * spectrumCase.scale;
    const factor = gamma * acceleration;
    const displacement = shape.map((value) => (factor / pair.value) * value);
    const forces = shape.map((value, dof) => mass.diagonal[dof] * factor * value);
    let baseShear = 0;
    for (let dof = axis; dof < forces.length; dof += DOF_PER_NODE) baseShear += forces[dof];
    const state = recoverSpace3DResult(project, assembly, null, displacement, { relativeResidual: pair.bound, conditionEstimate: Number.NaN }, { loadVector: forces });
    return {
      summary: Object.freeze({ period, spectralAcceleration: sa, participationFactor: gamma, massRatio: (gamma * gamma) / participating, baseShear }),
      displacement,
      forces,
      state,
    };
  });

  const count = modal.length;
  const correlation = Array.from({ length: count }, (_, i) => Float64Array.from({ length: count }, (_, j) => (
    spectrumCase.combination === 'srss' ? (i === j ? 1 : 0) : space3DCqcCorrelation(omegas[i], omegas[j], spectrumCase.dampingRatio)
  )));
  /** Combinación modal con el signo del modo que más aporta. */
  const combine = (values: Float64Array): number => {
    let sum = 0;
    let dominant = 0;
    for (let i = 0; i < count; i += 1) {
      const vi = values[i];
      if (vi === 0) continue;
      if (Math.abs(vi) > Math.abs(dominant)) dominant = vi;
      const row = correlation[i];
      for (let j = 0; j < count; j += 1) sum += row[j] * vi * values[j];
    }
    const magnitude = Math.sqrt(Math.max(0, sum));
    return dominant < 0 ? -magnitude : magnitude;
  };
  const buffer = new Float64Array(count);
  const over = (value: (mode: number) => number): number => {
    for (let mode = 0; mode < count; mode += 1) buffer[mode] = value(mode);
    return combine(buffer);
  };

  const first = modal[0].state;
  const nodeResults = first.nodeResults.map((node, nodeIndex) => Object.freeze({
    nodeId: node.nodeId,
    displacement: Object.freeze(Object.fromEntries(DOF_FIELDS.map((field) => [field, over((mode) => modal[mode].state.nodeResults[nodeIndex].displacement[field])]))) as unknown as typeof node.displacement,
    reaction: Object.freeze(Object.fromEntries(DOF_FIELDS.map((field) => [field, over((mode) => modal[mode].state.nodeResults[nodeIndex].reaction[field])]))) as unknown as typeof node.reaction,
  }));
  const memberResults = first.memberResults.map((member, memberIndex) => {
    const end = (side: 'start' | 'end'): Space3DMemberEndForces => Object.freeze(Object.fromEntries(
      END_FIELDS.map((field) => [field, over((mode) => modal[mode].state.memberResults[memberIndex][side][field])]),
    )) as unknown as Space3DMemberEndForces;
    const stations = member.stations?.map((station, stationIndex): Space3DMemberStation => Object.freeze({
      x: station.x,
      ...Object.fromEntries(STATION_FIELDS.map((field) => [field, over((mode) => modal[mode].state.memberResults[memberIndex].stations?.[stationIndex]?.[field] ?? 0)])),
    }) as Space3DMemberStation);
    return Object.freeze({ ...member, start: end('start'), end: end('end'), ...(stations ? { stations: Object.freeze(stations) } : {}) });
  });

  const stories = computeSpace3DStoryResponse(project, {
    displacements: modal.map((item) => item.displacement),
    forces: modal.map((item) => item.forces),
    mass: mass.diagonal,
    combine,
  });
  const baseShear = Math.abs(over((mode) => modal[mode].summary.baseShear));
  const cumulativeMassRatio = modal.reduce((sum, item) => sum + item.summary.massRatio, 0);
  const worstEquilibrium = Math.max(...modal.map((item) => item.state.diagnostics.equilibrium.normalized));
  const analysis: Space3DAnalysisResult = Object.freeze({
    success: true,
    targetId: spectrumCase.id,
    targetKind: 'response-spectrum',
    nodeResults: Object.freeze(nodeResults),
    memberResults: Object.freeze(memberResults),
    issues: Object.freeze([]),
    diagnostics: Object.freeze({
      ...first.diagnostics,
      relativeResidual: Math.max(...pairs.map((pair) => pair.bound)),
      // La envolvente no está en equilibrio (no es un estado); cada modo sí.
      equilibrium: Object.freeze({ ...first.diagnostics.equilibrium, normalized: worstEquilibrium }),
    }),
    ...(stories.length > 0 ? { stories: Object.freeze(stories) } : {}),
  });

  return Object.freeze({
    success: true,
    caseId: spectrumCase.id,
    direction: spectrumCase.direction,
    combination: spectrumCase.combination,
    analysis,
    modes: Object.freeze(modal.map((item) => item.summary)),
    baseShear,
    cumulativeMassRatio,
    totalMass: participating,
    stories: Object.freeze(stories),
    sturmVerified: basis.sturmVerified,
    issues: Object.freeze([]),
    reason: `${count} modos, ${spectrumCase.combination.toUpperCase()}; masa participante ${(cumulativeMassRatio * 100).toFixed(1)} %.`,
  });
};
