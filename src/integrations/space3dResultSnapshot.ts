import { analyzeSpace3DProject } from '../modules/space3d/space3d/engine/solver';
import { space3dFramePlanes } from './space3dDesign';
import { SPACE3D_MATERIALS, SPACE3D_SECTION_CATALOG } from '../modules/space3d/space3d/model/sectionLibrary';
import type { Space3DProjectV1, Space3DAnalysisResult, Space3DFrameMember } from '../modules/space3d/space3d/model/types';
import type { ModelDemandSnapshot, ModelMemberRecord, ModelResultInventory, ModelResultTarget, ModelSupportSnapshot } from '../design/elements/modelResultSnapshot';
import { assertFiniteDto, requireMemberStation, requireSupport, requireTarget } from '../design/elements/modelResultSnapshot';

export const space3dRevision = (model: Space3DProjectV1): string => {
  const text = JSON.stringify(model);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  return `${model.id}:${(hash >>> 0).toString(36)}:${text.length}`;
};

const targetList = (model: Space3DProjectV1): ModelResultTarget[] => [
  ...model.loadCases.map((item) => ({ id: item.id, label: item.name, kind: 'case' as const, factors: [{ caseId: item.id, factor: 1 }] })),
  ...model.loadCombinations.map((item) => ({ id: item.id, label: item.name, kind: 'combination' as const, factors: item.terms.map((term) => ({ caseId: term.caseId, factor: term.factor })) })),
];

const familyOf = (member: Space3DFrameMember, dx: number, dy: number, dz: number): ModelMemberRecord['family'] => {
  if (member.type && member.type !== 'frame') return 'other';
  return Math.abs(dy) / Math.hypot(dx, dy, dz) > 0.5 ? 'column' : 'beam';
};

export function space3dResultInventory(model: Space3DProjectV1): ModelResultInventory {
  const nodes = new Map(model.nodes.map((node) => [node.id, node]));
  const planes = space3dFramePlanes(model);
  const stories = model.grid?.stories ?? [];
  const elevations = stories.length ? stories.map((item) => ({ id: `y:${item.elevation}`, label: item.name, heightM: item.elevation }))
    : [...new Set(model.nodes.map((node) => Math.round(node.y * 1e6) / 1e6))].sort((a, b) => a - b).map((heightM, index) => ({ id: `y:${heightM}`, label: `Nivel ${index + 1} · ${heightM} m`, heightM }));
  const members: ModelMemberRecord[] = model.members.flatMap((member) => {
    const a = nodes.get(member.i), b = nodes.get(member.j);
    if (!a || !b) return [];
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, lengthM = Math.hypot(dx, dy, dz);
    if (!(lengthM > 0) || !Number.isFinite(lengthM)) return [];
    const section = SPACE3D_SECTION_CATALOG.find((item) => item.name === member.sectionId);
    const material = SPACE3D_MATERIALS.find((item) => item.id === member.materialId);
    const concreteGrade = material?.category === 'concrete' ? /^concrete-fc(\d+(?:\.\d+)?)$/.exec(material.id) : null;
    const close = (actual: number, expected: number) => Number.isFinite(actual) && Math.abs(actual - expected) <= Math.max(Math.abs(expected) * 1e-8, 1e-12);
    const trustedCatalog = member.sectionOrigin !== 'custom' && section && close(member.A, section.A) && close(member.Iy, section.Iy)
      && close(member.Iz, section.Iz) && close(member.J, section.J) ? section : undefined;
    const shape = trustedCatalog?.shape === 'rect' ? 'rectangular' : trustedCatalog?.shape === 'circle' ? 'circular' : 'other';
    const level = elevations.find((item) => Math.abs(item.heightM - (a.y + b.y) / 2) <= 1e-6);
    return [{
      id: member.id, label: member.label?.trim() || member.id, family: familyOf(member, dx, dy, dz), levelId: level?.id ?? null,
      axisIds: planes.filter((plane) => Math.abs((plane.axis === 'x' ? a.x : a.z) - plane.coordinate) <= 1e-3 && Math.abs((plane.axis === 'x' ? b.x : b.z) - plane.coordinate) <= 1e-3).map((plane) => plane.id),
      lengthM,
      section: {
        shape, widthMm: trustedCatalog && shape !== 'other' ? (trustedCatalog.width ?? 0) * 1000 : null,
        depthMm: trustedCatalog && shape !== 'other' ? (trustedCatalog.depth ?? 0) * 1000 : null,
        fcMpa: concreteGrade && member.materialOrigin !== 'custom' && material && close(member.E, material.E) ? Number(concreteGrade[1]) : null,
        materialLabel: material?.name ?? member.materialId ?? 'Material del modelo',
      }, start: [a.x, a.y, a.z], end: [b.x, b.y, b.z],
    }];
  });
  const inventory: ModelResultInventory = {
    projectId: model.id, kind: 'model3d', revision: space3dRevision(model), targets: targetList(model), members,
    supports: model.nodes.filter((node) => Object.values(node.restraints).some(Boolean)).map((node) => ({ id: node.id, label: node.id, position: [node.x, node.y, node.z] as const })), levels: elevations,
  };
  assertFiniteDto(inventory, 'Inventario 3D');
  return inventory;
}

function resolveTarget(model: Space3DProjectV1, target: ModelResultTarget): Space3DAnalysisResult {
  const run = analyzeSpace3DProject(model, target.id);
  if (!run.success || run.targetKind === 'response-spectrum') {
    const detail = run.issues.map((item) => item.code).join(', ');
    throw new Error(`El Modelo 3D no pudo resolver «${target.label}»${detail ? `: ${detail}` : '.'}`);
  }
  return run;
}

const interpolate = (values: readonly number[], x0: number, x1: number, x: number) => x1 === x0 ? values[0]! : values[0]! + (values[1]! - values[0]!) * ((x - x0) / (x1 - x0));

export function analyzeSpace3dTarget(model: Space3DProjectV1, inventory: ModelResultInventory, request: { memberId: string; targetId: string; xM: number; side: 'left' | 'right'; axisId?: string }): ModelDemandSnapshot {
  const target = requireTarget(inventory, request.targetId);
  const member = requireMemberStation(inventory, request.memberId, request.xM);
  if (request.axisId && !member.axisIds.includes(request.axisId)) throw new Error(`La barra «${member.id}» no pertenece al eje «${request.axisId}».`);
  const run = resolveTarget(model, target);
  const result = run.memberResults.find((item) => item.memberId === member.id);
  const stations = result?.stations;
  if (!result || !stations?.length) throw new Error(`El solver no devolvió estaciones para «${member.id}».`);
  const xM = Math.min(member.lengthM, Math.max(0, request.xM));
  const tolerance = Math.max(1, member.lengthM) * 1e-9;
  const exact = stations.map((station, index) => ({ station, index })).filter(({ station }) => Math.abs(station.x - xM) <= tolerance);
  let selected: typeof stations[number];
  if (exact.length > 1) selected = request.side === 'left' ? exact[0]!.station : exact.at(-1)!.station;
  else if (exact.length === 1) selected = exact[0]!.station;
  else {
    let right = stations.findIndex((station) => station.x > xM);
    if (right <= 0) selected = stations[right < 0 ? stations.length - 1 : 0]!;
    else {
      const left = stations[right - 1]!;
      const next = stations[right]!;
      const mix = (a: number, b: number) => interpolate([a, b], left.x, next.x, xM);
      selected = { ...left, x: xM, N: mix(left.N, next.N), Vy: mix(left.Vy, next.Vy), Vz: mix(left.Vz, next.Vz), T: mix(left.T, next.T), My: mix(left.My, next.My), Mz: mix(left.Mz, next.Mz) };
    }
  }
  const basis = result.basis;
  const snapshot: ModelDemandSnapshot = {
    version: 1, source: { kind: 'model3d', projectId: model.id, revision: inventory.revision, memberId: member.id, ...(request.axisId ? { axisId: request.axisId } : {}) },
    target, station: { xM, side: request.side, lengthM: result.length }, units: 'kN-m',
    axes: { convention: '3D primer orden nativo; N/V/T/My/Mz locales, reacciones globales. Fuera de muestras se interpola linealmente; en saltos se elige la muestra repetida según lado.', localBasis: [basis.x, basis.y, basis.z] },
    actions: { nKn: selected.N, vyKn: selected.Vy, vzKn: selected.Vz, torsionKnm: selected.T, myKnm: selected.My, mzKnm: selected.Mz }, member,
  };
  assertFiniteDto(snapshot, 'Demanda 3D');
  return snapshot;
}

export function analyzeSpace3dSupport(model: Space3DProjectV1, inventory: ModelResultInventory, request: { nodeId: string; targetId: string }): ModelSupportSnapshot {
  const target = requireTarget(inventory, request.targetId);
  const support = requireSupport(inventory, request.nodeId);
  const run = resolveTarget(model, target);
  const reaction = run.nodeResults.find((item) => item.nodeId === support.id)?.reaction;
  if (!reaction) throw new Error(`El solver no devolvió el apoyo «${support.id}».`);
  const snapshot: ModelSupportSnapshot = { version: 1, source: { kind: 'model3d', projectId: model.id, revision: inventory.revision, nodeId: support.id }, target, position: support.position, units: 'kN-m',
    reactionGlobal: { fxKn: reaction.ux, fyKn: reaction.uy, fzKn: reaction.uz, mxKnm: reaction.rx, myKnm: reaction.ry, mzKnm: reaction.rz } };
  assertFiniteDto(snapshot, 'Reacción 3D');
  return snapshot;
}
