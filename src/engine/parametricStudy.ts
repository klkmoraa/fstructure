import type { ReliabilityLevel } from '../types';
import type { MemberModel, ProjectModel } from '../types';
import { analyzeProjectAuto } from './pDelta';
import { resolveReliability } from './reliability';
import { summarizeAnalysisResults } from './resultSummary';

export const PARAMETRIC_PARAMETERS = ['E', 'A', 'I'] as const;
export type ParametricParameter = (typeof PARAMETRIC_PARAMETERS)[number];

/** Interactive studies are deliberately bounded so one click cannot enqueue an unbounded batch of solves. */
export const PARAMETRIC_MAX_VARIANTS = 7;

export interface ParametricStudyRequest {
  project: ProjectModel;
  combinationId?: string | null;
  memberId: string;
  parameter: ParametricParameter;
  factors: readonly number[];
}

export interface ParametricMemberMetrics {
  axial: number | null;
  shear: number | null;
  moment: number | null;
  deformation: number | null;
}

export interface ParametricStudyVariant {
  factor: number;
  parameterValue: number;
  success: boolean;
  reliability: ReliabilityLevel;
  failureReason?: string;
  metrics: ParametricMemberMetrics;
}

export interface ParametricStudyResult {
  memberId: string;
  parameter: ParametricParameter;
  baseValue: number;
  combinationId: string | null;
  variants: ParametricStudyVariant[];
}

const emptyMetrics = (): ParametricMemberMetrics => ({
  axial: null,
  shear: null,
  moment: null,
  deformation: null,
});

const parameterLabel = (parameter: ParametricParameter): string => parameter === 'E' ? 'E' : parameter === 'A' ? 'A' : 'I';

export const validateParametricFactors = (factors: readonly number[]): number[] => {
  if (!factors.length) throw new Error('El estudio paramétrico necesita al menos un factor.');
  if (factors.length > PARAMETRIC_MAX_VARIANTS) {
    throw new Error(`El estudio paramétrico admite un máximo de ${PARAMETRIC_MAX_VARIANTS} variantes.`);
  }
  const normalized = factors.map((factor) => {
    if (!Number.isFinite(factor) || factor <= 0) throw new Error(`Cada factor paramétrico debe ser positivo y finito (valor recibido: ${factor}).`);
    return factor;
  });
  return normalized;
};

export const parseParametricFactors = (raw: string): number[] => {
  const tokens = raw.trim().split(/[\s,;]+/).filter(Boolean);
  if (!tokens.length) throw new Error('Escribe al menos un factor paramétrico.');
  const factors = tokens.map((token) => {
    const factor = Number(token);
    if (!Number.isFinite(factor)) throw new Error(`El factor paramétrico «${token}» no es válido.`);
    return factor;
  });
  return validateParametricFactors(factors);
};

const valueForParameter = (member: MemberModel, parameter: ParametricParameter): number => member[parameter];

const failureReason = (result: { issues: Array<{ severity: string; message: string }> }): string =>
  result.issues.find((issue) => issue.severity === 'error')?.message
  ?? result.issues[0]?.message
  ?? 'El análisis no produjo un resultado utilizable.';

const runVariant = (
  project: ProjectModel,
  combinationId: string | null,
  memberId: string,
  parameter: ParametricParameter,
  factor: number,
  baseValue: number,
): ParametricStudyVariant => {
  const parameterValue = baseValue * factor;
  if (!Number.isFinite(parameterValue) || parameterValue <= 0) {
    return {
      factor,
      parameterValue,
      success: false,
      reliability: 'failed',
      failureReason: `La variante de ${parameterLabel(parameter)} no produjo un valor positivo y finito.`,
      metrics: emptyMetrics(),
    };
  }
  const variantProject = structuredClone(project);
  const member = variantProject.members.find((candidate) => candidate.id === memberId);
  if (!member) throw new Error(`No existe el miembro ${memberId}.`);
  member[parameter] = parameterValue;

  try {
    const combination = combinationId
      ? variantProject.combinations.find((candidate) => candidate.id === combinationId) ?? null
      : null;
    const analysis = analyzeProjectAuto(variantProject, combination, { includeEducationTrace: false });
    const reliability = resolveReliability(analysis);
    if (!analysis.success) {
      return { factor, parameterValue, success: false, reliability: reliability.level, failureReason: failureReason(analysis), metrics: emptyMetrics() };
    }
    const summary = summarizeAnalysisResults(analysis);
    const memberSummary = summary.members.find((candidate) => candidate.memberId === memberId);
    if (!memberSummary) {
      return { factor, parameterValue, success: false, reliability: 'failed', failureReason: `El análisis no devolvió resultados para el miembro ${memberId}.`, metrics: emptyMetrics() };
    }
    return {
      factor,
      parameterValue,
      success: true,
      reliability: reliability.level,
      metrics: {
        axial: memberSummary.diagrams.axial.absolute.value,
        shear: memberSummary.diagrams.shear.absolute.value,
        moment: memberSummary.diagrams.moment.absolute.value,
        deformation: memberSummary.deformations.v?.absolute.value ?? null,
      },
    };
  } catch (error) {
    return {
      factor,
      parameterValue,
      success: false,
      reliability: 'failed',
      failureReason: error instanceof Error ? error.message : `Falló la variante de ${parameterLabel(parameter)}.`,
      metrics: emptyMetrics(),
    };
  }
};

export const runParametricStudy = (request: ParametricStudyRequest): ParametricStudyResult => {
  const factors = validateParametricFactors(request.factors);
  const member = request.project.members.find((candidate) => candidate.id === request.memberId);
  if (!member) throw new Error(`No existe el miembro ${request.memberId}.`);
  if (member.type === 'rigid') throw new Error('Los miembros rígidos no admiten un estudio paramétrico de E, A o I.');
  const baseValue = valueForParameter(member, request.parameter);
  if (!Number.isFinite(baseValue) || baseValue <= 0) {
    throw new Error(`La propiedad ${parameterLabel(request.parameter)} del miembro ${request.memberId} debe ser positiva y finita.`);
  }
  const combinationId = request.combinationId || null;
  return {
    memberId: request.memberId,
    parameter: request.parameter,
    baseValue,
    combinationId,
    variants: factors.map((factor) => runVariant(request.project, combinationId, request.memberId, request.parameter, factor, baseValue)),
  };
};
