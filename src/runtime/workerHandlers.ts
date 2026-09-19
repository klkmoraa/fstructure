import { analyzeProjectScenarios, type AnalysisScenario } from '../engine/envelope';
import { analyzeAxleTrain, buildInfluenceLine } from '../engine/influence';
import { certifyResult } from '../engine/certificate';
import { analyzeBuckling } from '../engine/buckling';
import { analyzeModal } from '../engine/modal';
import { handleAnalysisWorkerRequest } from '../engine/analysisWorkerProtocol';
import { runParametricStudy } from '../engine/parametricStudy';
import { analyzeProjectAuto } from '../engine/pDelta';
import { resolveReliability } from '../engine/reliability';
import { summarizeAnalysisResults } from '../engine/resultSummary';
import { findStandardMaterial } from '../data/standardMaterials';
import { findStandardSection } from '../data/standardSections';
import { designReinforcedConcreteBeam } from '../design/concrete/beamDesign';
import { NTC_CONCRETE_2023 } from '../design/concrete/ntcConcrete2023';
import type { AnalysisResult, LoadCombination, MemberModel, ProjectModel } from '../types';
import {
  WORKER_PROTOCOL_VERSION,
  type AnalysisWorkerPayload,
  type CertificateWorkerPayload,
  type CertificateWorkerResult,
  type InfluenceWorkerPayload,
  type InfluenceWorkerResult,
  type StudiesWorkerPayload,
  type StudiesWorkerResult,
  type ParametricWorkerPayload,
  type ParametricWorkerResult,
  type ConcreteBeamDesignWorkerPayload,
  type ConcreteBeamDesignWorkerResult,
  type WorkerDomain,
  type WorkerRequestEnvelope,
  type WorkerResponseEnvelope,
} from './workerProtocol';

const mismatch = <Domain extends WorkerDomain, Result>(domain: Domain, requestId: number): WorkerResponseEnvelope<Domain, Result> => ({
  protocolVersion: WORKER_PROTOCOL_VERSION,
  type: 'error',
  domain,
  requestId,
  error: { code: 'PROTOCOL_MISMATCH', message: 'Versión de protocolo de worker no compatible.' },
});

const domainError = <Domain extends WorkerDomain, Result>(domain: Domain, requestId: number, error: unknown, fallback: string): WorkerResponseEnvelope<Domain, Result> => ({
  protocolVersion: WORKER_PROTOCOL_VERSION,
  type: 'error',
  domain,
  requestId,
  error: { code: 'DOMAIN_ERROR', message: error instanceof Error ? error.message : fallback },
});

export const handleAnalysisEnvelope = (
  request: WorkerRequestEnvelope<'analysis', AnalysisWorkerPayload>,
): WorkerResponseEnvelope<'analysis', AnalysisResult> => {
  if (request.protocolVersion !== WORKER_PROTOCOL_VERSION || request.domain !== 'analysis') return mismatch('analysis', request.requestId);
  const response = handleAnalysisWorkerRequest({ type: 'analyze', requestId: request.requestId, ...request.payload });
  return response.type === 'analysis-result'
    ? { protocolVersion: 1, type: 'success', domain: 'analysis', requestId: response.requestId, result: response.result }
    : domainError('analysis', response.requestId, new Error(response.message), response.message);
};

export const handleScenarioEnvelope = (
  request: WorkerRequestEnvelope<'scenarios', { project: ProjectModel }>,
): WorkerResponseEnvelope<'scenarios', AnalysisScenario[]> => {
  if (request.protocolVersion !== WORKER_PROTOCOL_VERSION || request.domain !== 'scenarios') return mismatch('scenarios', request.requestId);
  try {
    return { protocolVersion: 1, type: 'success', domain: 'scenarios', requestId: request.requestId, result: analyzeProjectScenarios(request.payload.project) };
  } catch (error) {
    return domainError('scenarios', request.requestId, error, 'No se pudieron comparar los escenarios.');
  }
};

export const handleInfluenceEnvelope = (
  request: WorkerRequestEnvelope<'influence', InfluenceWorkerPayload>,
): WorkerResponseEnvelope<'influence', InfluenceWorkerResult> => {
  if (request.protocolVersion !== WORKER_PROTOCOL_VERSION || request.domain !== 'influence') return mismatch('influence', request.requestId);
  try {
    const { project, input } = request.payload;
    const line = buildInfluenceLine(project, input.pathMemberIds, input.target, input.startNodeId);
    return {
      protocolVersion: 1, type: 'success', domain: 'influence', requestId: request.requestId,
      result: { line, axleTrain: input.train ? analyzeAxleTrain(line, input.train) : null },
    };
  } catch (error) {
    return domainError('influence', request.requestId, error, 'No se pudo calcular la línea de influencia.');
  }
};

export const handleCertificateEnvelope = (
  request: WorkerRequestEnvelope<'certificate', CertificateWorkerPayload>,
): WorkerResponseEnvelope<'certificate', CertificateWorkerResult> => {
  if (request.protocolVersion !== WORKER_PROTOCOL_VERSION || request.domain !== 'certificate') return mismatch('certificate', request.requestId);
  try {
    const { project, combinationId } = request.payload;
    const combination = combinationId
      ? project.combinations.find((candidate) => candidate.id === combinationId) ?? null
      : null;
    return {
      protocolVersion: 1,
      type: 'success',
      domain: 'certificate',
      requestId: request.requestId,
      result: certifyResult(project, combination),
    };
  } catch (error) {
    return domainError('certificate', request.requestId, error, 'No se pudo emitir el certificado numérico.');
  }
};

export const handleStudiesEnvelope = (
  request: WorkerRequestEnvelope<'studies', StudiesWorkerPayload>,
): WorkerResponseEnvelope<'studies', StudiesWorkerResult> => {
  if (request.protocolVersion !== WORKER_PROTOCOL_VERSION || request.domain !== 'studies') return mismatch('studies', request.requestId);
  const { project, kind, modes, combinationId } = request.payload;
  const combination = combinationId ? project.combinations.find((item) => item.id === combinationId) ?? null : null;
  try {
    const result: StudiesWorkerResult = kind === 'buckling'
      ? { kind, result: analyzeBuckling(project, combination, { modes }) }
      : { kind, result: analyzeModal(project, { modes }) };
    return { protocolVersion: 1, type: 'success', domain: 'studies', requestId: request.requestId, result };
  } catch (error) {
    return domainError('studies', request.requestId, error, 'No se pudo completar el estudio del modelo.');
  }
};

export const handleParametricEnvelope = (
  request: WorkerRequestEnvelope<'parametric', ParametricWorkerPayload>,
): WorkerResponseEnvelope<'parametric', ParametricWorkerResult> => {
  if (request.protocolVersion !== WORKER_PROTOCOL_VERSION || request.domain !== 'parametric') return mismatch('parametric', request.requestId);
  try {
    return {
      protocolVersion: 1,
      type: 'success',
      domain: 'parametric',
      requestId: request.requestId,
      result: runParametricStudy(request.payload),
    };
  } catch (error) {
    return domainError('parametric', request.requestId, error, 'No se pudo completar el estudio paramétrico.');
  }
};

const requireItem = <T>(value: T | undefined, message: string): T => {
  if (value === undefined) throw new Error(message);
  return value;
};

const combinationReference = (combination: LoadCombination, stateLimit: 'ultimate' | 'service') => ({
  id: combination.id,
  stateLimit,
  jurisdiction: combination.jurisdiction ?? '',
  edition: combination.edition ?? '',
  sourceUrl: combination.sourceUrl ?? '',
});

const catalogPropertiesMatch = (member: MemberModel, section: { area: number; inertiaX: number }, material: { elasticModulus: number }) =>
  Math.abs(member.A - section.area) <= Math.max(1e-12, section.area * 1e-9)
  && Math.abs(member.I - section.inertiaX) <= Math.max(1e-14, section.inertiaX * 1e-9)
  && Math.abs(member.E - material.elasticModulus) <= Math.max(1e-3, material.elasticModulus * 1e-9);

const exactMemberDemand = (analysis: AnalysisResult, memberId: string) => {
  const member = requireItem(analysis.memberResults.find((item) => item.memberId === memberId), 'El análisis no produjo resultados para el miembro de diseño.');
  const summary = requireItem(summarizeAnalysisResults(analysis).members.find((item) => item.memberId === memberId), 'El análisis no produjo diagramas exactos para el miembro de diseño.');
  const moment = summary.diagrams.moment;
  const shear = summary.diagrams.shear;
  const deflection = summary.deformations.v;
  if (!deflection) throw new Error('El análisis no produjo deformación transversal exacta para el miembro de diseño.');
  return {
    spanMm: (member.totalLength ?? member.length) * 1_000,
    positiveMomentKnm: Math.max(0, moment.maximum.value),
    negativeMomentKnm: Math.min(0, moment.minimum.value),
    absoluteShearKn: Math.max(Math.abs(shear.minimum.value), Math.abs(shear.maximum.value)),
    // Internal axial-force convention is tension-positive; compression is negative.
    compressionKn: Math.max(0, -Math.min(member.minAxial, member.maxAxial)),
    governingServiceMomentKnm: Math.abs(moment.minimum.value) > Math.abs(moment.maximum.value) ? moment.minimum.value : moment.maximum.value,
    grossElasticDeflectionMm: Math.abs(deflection.absolute.value) * 1_000,
  };
};

/**
 * Builds the pure NTC input only from catalog identities and exact solver fields.
 * The general catalog has no aggregate metadata, so v1 uses basalt explicitly:
 * it is the lower-E Class 1 option in NTC Table 2.2.1 and is therefore conservative
 * for the immediate deflection estimate until aggregate provenance is persisted.
 */
export const runConcreteBeamDesign = (payload: ConcreteBeamDesignWorkerPayload): ConcreteBeamDesignWorkerResult => {
  const { project, assignment, memberId } = payload;
  if (assignment.memberId !== memberId) throw new Error('La asignación de diseño no pertenece al miembro solicitado.');
  const member = requireItem(project.members.find((item) => item.id === memberId), 'No existe el miembro solicitado para diseño.');
  const ultimateCombination = requireItem(project.combinations.find((item) => item.id === assignment.ultimateCombinationId), 'No existe la combinación última de diseño.');
  const serviceCombination = requireItem(project.combinations.find((item) => item.id === assignment.serviceCombinationId), 'No existe la combinación de servicio de diseño.');
  if (member.type !== 'frame' || member.materialOrigin !== 'catalog' || member.sectionOrigin !== 'catalog' || !member.materialId || !member.sectionId) {
    throw new Error('El diseño requiere una viga de marco con material y sección de catálogo explícitos.');
  }
  const section = requireItem(findStandardSection(member.sectionId), 'No se encontró la sección de catálogo del miembro.');
  const material = requireItem(findStandardMaterial(member.materialId), 'No se encontró el material de catálogo del miembro.');
  if (section.shapeType !== 'RECT' || material.category !== 'CONCRETE') throw new Error('V1 sólo admite una sección rectangular de concreto de catálogo.');
  if (!catalogPropertiesMatch(member, section, material)) throw new Error('Las propiedades del miembro difieren de su catálogo; reasigna el catálogo antes de diseñar.');

  const ultimateAnalysis = analyzeProjectAuto(project, ultimateCombination, { includeEducationTrace: false });
  const serviceAnalysis = analyzeProjectAuto(project, serviceCombination, { includeEducationTrace: false });
  const ultimateReliability = resolveReliability(ultimateAnalysis);
  const serviceReliability = resolveReliability(serviceAnalysis);
  const reliable = ultimateAnalysis.success && serviceAnalysis.success && ultimateReliability.usable && serviceReliability.usable
    && ultimateReliability.level === 'reliable' && serviceReliability.level === 'reliable';

  const safeUltimate = reliable ? exactMemberDemand(ultimateAnalysis, memberId) : null;
  const safeService = reliable ? exactMemberDemand(serviceAnalysis, memberId) : null;
  return designReinforcedConcreteBeam({
    standardId: assignment.standardId,
    memberId,
    analysisId: `${project.id}:${ultimateCombination.id}:${serviceCombination.id}`,
    spanMm: safeUltimate?.spanMm ?? 1,
    section: { catalogId: section.id, origin: 'catalog', shape: 'rectangular', widthMm: section.width * 1_000, heightMm: section.depth * 1_000 },
    concrete: { catalogId: material.id, origin: 'catalog', density: 'normal', coarseAggregate: 'basalt', compressiveStrengthMpa: material.yieldStrength / 1_000 },
    reinforcement: {
      coverMm: assignment.coverMm, maximumAggregateSizeMm: 20,
      longitudinalYieldStrengthMpa: assignment.longitudinalSteelYieldMpa, stirrupYieldStrengthMpa: assignment.stirrupSteelYieldMpa,
      steelElasticModulusMpa: 200_000, preferredLongitudinalDiametersMm: [...assignment.preferredLongitudinalDiametersMm],
      preferredStirrupDiametersMm: [...assignment.preferredStirrupDiametersMm], stirrupLegs: assignment.stirrupLegs, stirrupSpacingIncrementMm: 25,
    },
    system: { ductility: 'low', prestressed: false },
    analysis: {
      reliability: reliable ? 'reliable' : 'unreliable',
      ultimate: {
        combination: combinationReference(ultimateCombination, 'ultimate'), positiveMomentKnm: safeUltimate?.positiveMomentKnm ?? 0,
        negativeMomentKnm: safeUltimate?.negativeMomentKnm ?? 0, absoluteShearKn: safeUltimate?.absoluteShearKn ?? 0, compressionKn: safeUltimate?.compressionKn ?? 0,
      },
      service: {
        combination: combinationReference(serviceCombination, 'service'), governingMomentKnm: safeService?.governingServiceMomentKnm ?? 0,
        grossElasticDeflectionMm: safeService?.grossElasticDeflectionMm ?? 0, grossElasticModulusMpa: material.elasticModulus / 1_000,
        damagesNonstructuralElements: false,
      },
    },
    normativeEvidence: { sourceUrl: NTC_CONCRETE_2023.sourceUrl, sourceSha256: NTC_CONCRETE_2023.sourceSha256, verifiedClauseIds: [...NTC_CONCRETE_2023.implementedClauseIds] },
  });
};

export const handleDesignEnvelope = (
  request: WorkerRequestEnvelope<'design', ConcreteBeamDesignWorkerPayload>,
): WorkerResponseEnvelope<'design', ConcreteBeamDesignWorkerResult> => {
  if (request.protocolVersion !== WORKER_PROTOCOL_VERSION || request.domain !== 'design') return mismatch('design', request.requestId);
  try {
    return { protocolVersion: WORKER_PROTOCOL_VERSION, type: 'success', domain: 'design', requestId: request.requestId, result: runConcreteBeamDesign(request.payload) };
  } catch (error) {
    return domainError('design', request.requestId, error, 'No se pudo preparar el diseño de viga de concreto.');
  }
};
