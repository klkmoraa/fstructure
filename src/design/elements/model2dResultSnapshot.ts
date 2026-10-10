import { evaluateDiagramAt } from '../../engine/diagram';
import { analyzeProjectAuto } from '../../engine/pDelta';
import { findStandardMaterial, standardMaterials } from '../../data/standardMaterials';
import { standardSections } from '../../data/standardSections';
import type { ProjectModel } from '../../types';
import type { ModelDemandSnapshot, ModelMemberRecord, ModelResultInventory, ModelResultTarget, ModelSupportSnapshot } from './modelResultSnapshot';
import { assertFiniteDto, requireMemberStation, requireSupport, requireTarget } from './modelResultSnapshot';

const finite = (n: number) => Number.isFinite(n);

export const model2dRevision = (project: ProjectModel): string => {
  const text = JSON.stringify(project);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  return `${project.id}:${(hash >>> 0).toString(36)}:${text.length}`;
};

const targetsOf = (project: ProjectModel): ModelResultTarget[] => [
  ...project.loadCases.map((item) => ({ id: item.id, label: item.name, kind: 'case' as const, factors: [{ caseId: item.id, factor: 1 }] })),
  ...project.combinations.map((item) => ({ id: item.id, label: item.name, kind: 'combination' as const,
    factors: Object.entries(item.factors).map(([caseId, factor]) => ({ caseId, factor })) })),
];

const materialLabel = (materialId?: string) => materialId
  ? findStandardMaterial(materialId)?.name ?? materialId
  : 'Material del modelo';

function memberRecords(project: ProjectModel): { members: ModelMemberRecord[]; levels: ModelResultInventory['levels'] } {
  const nodes = new Map(project.nodes.map((node) => [node.id, node]));
  const elevations = [...new Set(project.nodes.map((node) => Math.round(node.y * 1e6) / 1e6))].sort((a, b) => a - b);
  const levels = elevations.map((heightM, index) => ({ id: `y:${heightM}`, label: `Nivel ${index + 1} · ${heightM} m`, heightM }));
  const members = project.members.flatMap((member) => {
    const a = nodes.get(member.i), b = nodes.get(member.j);
    if (!a || !b) return [];
    const dx = b.x - a.x, dy = b.y - a.y, lengthM = Math.hypot(dx, dy);
    if (!(lengthM > 0) || !finite(lengthM)) return [];
    const catalog = member.sectionId ? standardSections.find((item) => item.id === member.sectionId) : undefined;
    const material = member.materialId ? standardMaterials.find((item) => item.id === member.materialId) : undefined;
    const close = (actual: number, expected: number) => Number.isFinite(actual) && Math.abs(actual - expected) <= Math.max(Math.abs(expected) * 1e-8, 1e-12);
    const trustedCatalog = member.sectionOrigin !== 'custom' && catalog && close(member.A, catalog.area) && close(member.I, catalog.inertiaX) ? catalog : undefined;
    const shape: ModelMemberRecord['section']['shape'] = trustedCatalog?.shapeType === 'RECT' ? 'rectangular' : trustedCatalog?.shapeType === 'HSS_ROUND' ? 'circular' : 'other';
    const horizontal = Math.abs(dy) <= Math.max(1, lengthM) * 1e-8;
    const levelHeight = horizontal ? (a.y + b.y) / 2 : null;
    const level = levelHeight === null ? undefined : levels.find((item) => Math.abs(item.heightM - levelHeight) <= 1e-6);
    return [{
      id: member.id, label: member.label?.trim() || member.id,
      family: (member.type === 'frame' ? (Math.abs(dy) / lengthM > 0.5 ? 'column' : 'beam') : 'other') as ModelMemberRecord['family'],
      levelId: level?.id ?? null, axisIds: [], lengthM,
      section: {
        shape, widthMm: trustedCatalog && shape !== 'other' ? trustedCatalog.width * 1000 : null,
        depthMm: trustedCatalog && shape !== 'other' ? trustedCatalog.depth * 1000 : null,
        fcMpa: material?.category === 'CONCRETE' && member.materialOrigin !== 'custom' && close(member.E, material.elasticModulus) ? material.yieldStrength / 1000 : null,
        materialLabel: materialLabel(member.materialId),
      },
      start: [a.x, a.y, 0] as const, end: [b.x, b.y, 0] as const,
    }];
  });
  return { members, levels };
}

export function model2dResultInventory(project: ProjectModel): ModelResultInventory {
  const { members, levels } = memberRecords(project);
  const groundedLinks = new Set((project.nodeLinks ?? []).filter((item) => !item.nodeJ).map((item) => item.nodeI));
  const inventory: ModelResultInventory = {
    projectId: project.id, kind: 'model2d', revision: model2dRevision(project), targets: targetsOf(project), members,
    supports: project.nodes.filter((node) => node.support.type !== 'none' || node.support.spring || groundedLinks.has(node.id))
      .map((node) => ({ id: node.id, label: node.id, position: [node.x, node.y, 0] as const })), levels,
  };
  assertFiniteDto(inventory, 'Inventario 2D');
  return inventory;
}

/** Runs one native case/combination and extracts the simultaneous local vector. */
export function analyzeModel2dTarget(project: ProjectModel, inventory: ModelResultInventory, request: { memberId: string; targetId: string; xM: number; side: 'left' | 'right' }): ModelDemandSnapshot {
  const target = requireTarget(inventory, request.targetId);
  const member = requireMemberStation(inventory, request.memberId, request.xM);
  const targetModel = project.combinations.find((item) => item.id === target.id);
  const factors = targetModel?.factors ?? { [target.id]: 1 };
  const run = analyzeProjectAuto(project, { id: target.id, name: target.label, factors: { ...factors } }, { includeEducationTrace: false });
  if (!run.success) throw new Error(`El Modelo 2D no pudo resolver «${target.label}»: ${run.issues.find((issue) => issue.severity === 'error')?.message ?? 'revisa el modelo'}.`);
  const result = run.memberResults.find((item) => item.memberId === member.id);
  if (!result) throw new Error(`El solver no devolvió la barra «${member.id}».`);
  const point = evaluateDiagramAt(result.diagramSegments, result.diagramJumps, request.xM, request.side);
  if (!point) throw new Error(`El solver no devolvió estaciones para «${member.id}».`);
  const lengthM = result.length;
  const start = member.start, end = member.end;
  const dx = end[0] - start[0], dy = end[1] - start[1];
  const analysisMode = project.settings.analysisMode ?? 'first-order';
  const snapshot: ModelDemandSnapshot = {
    version: 1, source: { kind: 'model2d', projectId: project.id, revision: inventory.revision, memberId: member.id },
    target, station: { xM: request.xM, side: request.side, lengthM }, units: 'kN-m',
    axes: { convention: `2D ${analysisMode === 'p-delta' ? 'P-Δ nativo' : 'primer orden nativo'}; ejes locales +x i→j, N a tracción positiva, V/M con signo del diagrama.`, localBasis: [[dx / member.lengthM, dy / member.lengthM, 0], [-dy / member.lengthM, dx / member.lengthM, 0]] },
    actions: { nKn: point.axial, vyKn: point.shear, vzKn: 0, torsionKnm: 0, myKnm: 0, mzKnm: point.moment }, member,
  };
  assertFiniteDto(snapshot, 'Demanda 2D');
  return snapshot;
}

export function analyzeModel2dSupport(project: ProjectModel, inventory: ModelResultInventory, request: { nodeId: string; targetId: string }): ModelSupportSnapshot {
  const target = requireTarget(inventory, request.targetId);
  const support = requireSupport(inventory, request.nodeId);
  const targetModel = project.combinations.find((item) => item.id === target.id);
  const run = analyzeProjectAuto(project, { id: target.id, name: target.label, factors: { ...(targetModel?.factors ?? { [target.id]: 1 }) } }, { includeEducationTrace: false });
  if (!run.success) throw new Error(`El Modelo 2D no pudo resolver «${target.label}».`);
  const reaction = run.nodeResults.find((item) => item.nodeId === support.id);
  if (!reaction) throw new Error(`El solver no devolvió el apoyo «${support.id}».`);
  const snapshot: ModelSupportSnapshot = { version: 1, source: { kind: 'model2d', projectId: project.id, revision: inventory.revision, nodeId: support.id }, target, position: support.position, units: 'kN-m',
    reactionGlobal: { fxKn: reaction.rx, fyKn: reaction.ry, fzKn: 0, mxKnm: 0, myKnm: 0, mzKnm: reaction.rm } };
  assertFiniteDto(snapshot, 'Reacción 2D');
  return snapshot;
}
