import { standardMaterials } from '../../data/standardMaterials';
import { standardSections } from '../../data/standardSections';
import { withResolvedGeneratedLoads } from '../../engine/generatedLoads';
import { analyzeModel2dCases, hydrateModel2dCases, type Model2dAnalysisRequest } from './model2dAnalysis';
import {
  probeLoads,
  type ExternalStructureSource, type StructureCase, type StructureMember, type StructureNode, type StructureSource, type StructureSupport,
} from './structure';
import type { LoadCase, MemberModel, NodeModel, ProjectModel } from '../../types';

/**
 * El Modelo 2D como fuente de la mesa Estructura (modo Diseño de FStructure).
 *
 * Modelar y diseñar son la misma mesa: este adaptador traduce el modelo del
 * proyecto a un `ExternalStructureSource` para `designStructure`. El proyecto
 * no se modifica: se arma una proyección para el solver.
 *
 * Traducción:
 * - Barras `frame` de concreto: con inclinación hasta 30° son vigas; más
 *   empinadas, columnas. Armaduras, brazos rígidos y barras de acero o madera
 *   no se diseñan en concreto y se declaran.
 * - Sección: la del catálogo si es rectangular; si no, el rectángulo con el
 *   mismo A e I (h = √(12I/A), b = A/h).
 * - Casos por categoría: permanente → carga muerta; variable → carga viva,
 *   partida por barra cargada para alternarla; accidental → acción lateral
 *   (cada una por separado y en ambos sentidos). Inactivos y «otro» no entran.
 *   Las combinaciones del modelo no se usan: el taller aplica las de la norma.
 * - Análisis de primer orden aunque el modelo pida P-Δ: el taller amplifica
 *   momentos con δs; sumar ambos contaría dos veces el segundo orden.
 */

const CONCRETE_E_RANGE_KPA = [15e6, 50e6] as const;
const PROBE_CASE = 'design§probe';

const supportOf = (node: NodeModel): StructureSupport => {
  const support = node.support;
  if (support.type === 'fixed') return 'fixed';
  if (support.type === 'pin') return 'pinned';
  if (support.type === 'roller') return 'roller';
  if (support.type === 'custom') {
    if (support.restrainR && support.restrainX && support.restrainY) return 'fixed';
    if (support.restrainX || support.restrainY) return support.restrainX && support.restrainY ? 'pinned' : 'roller';
  }
  return 'free';
};

const concreteOf = (member: MemberModel) => {
  const material = member.materialId ? standardMaterials.find((item) => item.id === member.materialId) : undefined;
  if (material) return material.category === 'CONCRETE' ? { concrete: true, fcMpa: material.yieldStrength / 1e3 } : { concrete: false, fcMpa: null, name: material.name };
  return { concrete: member.E >= CONCRETE_E_RANGE_KPA[0] && member.E <= CONCRETE_E_RANGE_KPA[1], fcMpa: null };
};

/** b × h de la barra: la sección rectangular del catálogo o el rectángulo equivalente en A e I. */
const sectionOf = (member: MemberModel) => {
  const catalog = member.sectionId ? standardSections.find((item) => item.id === member.sectionId) : undefined;
  if (catalog?.shapeType === 'RECT') return { widthMm: catalog.width * 1e3, heightMm: catalog.depth * 1e3 };
  const height = Math.sqrt(12 * member.I / member.A);
  return { widthMm: member.A / height * 1e3, heightMm: height * 1e3 };
};

interface ProjectedCase {
  readonly case: StructureCase;
  /** Id del caso en la proyección para el solver. */
  readonly solverId: string;
}

/** Firma corta del modelo: cambia con cualquier dato que afecte el diseño. */
const revisionOf = (project: ProjectModel) => {
  const text = JSON.stringify([project.nodes, project.members, project.loadCases, project.nodalLoads, project.memberLoads,
    project.prescribedDisplacements ?? [], project.memberInitialEffects ?? [], project.generatedLoadSources ?? [], project.nodeLinks ?? [], project.multiPointConstraints ?? []]);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  return `${project.id}:${(hash >>> 0).toString(36)}:${text.length}`;
};

export function model2dDesignSource(project: ProjectModel, analyzeCases?: (request: Model2dAnalysisRequest) => ReturnType<StructureSource['analyze']>): ExternalStructureSource {
  const resolved = withResolvedGeneratedLoads(project);
  const nodeIndex = new Map(project.nodes.map((node, index) => [node.id, index]));
  const nodes: StructureNode[] = project.nodes.map((node) => ({ x: node.x, y: node.y, support: supportOf(node) }));
  const errors: string[] = [];
  const notes: string[] = [];
  let fcMpa: number | null = null;

  // Cargas de referencia por barra para dibujar la viga (uniformes de longitud completa y la mayor puntual).
  const category = new Map(project.loadCases.map((item) => [item.id, item]));
  const displayLoads = (member: MemberModel) => {
    let dead = 0;
    let live = 0;
    let point: { deadKn: number; liveKn: number; atM: number } | undefined;
    const length = Math.hypot(project.nodes[nodeIndex.get(member.j)!]!.x - project.nodes[nodeIndex.get(member.i)!]!.x, project.nodes[nodeIndex.get(member.j)!]!.y - project.nodes[nodeIndex.get(member.i)!]!.y);
    for (const load of resolved.memberLoads) {
      const loadCase = category.get(load.caseId);
      if (load.memberId !== member.id || !loadCase?.active || (loadCase.category !== 'permanent' && loadCase.category !== 'variable')) continue;
      const isDead = loadCase.category === 'permanent';
      if (load.type === 'distributed' && load.coordinateSystem === 'global' && load.start <= 1e-9 && load.end >= 1 - 1e-9 && (load.qyStart ?? 0) === (load.qyEnd ?? 0)) {
        if (isDead) dead -= load.qyStart ?? 0; else live -= load.qyStart ?? 0;
      } else if (load.type === 'point' && load.coordinateSystem === 'global' && (load.py ?? 0) < 0) {
        const magnitude = -(load.py ?? 0);
        if (!point || magnitude > point.deadKn + point.liveKn) point = { deadKn: isDead ? magnitude : 0, liveKn: isDead ? 0 : magnitude, atM: (load.position ?? load.start) * length };
      }
    }
    return { dead: Math.max(0, dead), live: Math.max(0, live), point };
  };

  const members: StructureMember[] = project.members.map((member) => {
    const i = nodeIndex.get(member.i)!;
    const j = nodeIndex.get(member.j)!;
    const a = nodes[i]!;
    const b = nodes[j]!;
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const slope = length > 0 ? Math.abs(b.y - a.y) / length : 0;
    const material = concreteOf(member);
    const section = sectionOf(member);
    const loads = displayLoads(member);
    const base = {
      id: member.id,
      label: member.label?.trim() || member.id,
      i,
      j,
      section,
      flexuralStiffnessKnM2: member.E * member.I,
      displayDeadKnPerM: loads.dead,
      displayLiveKnPerM: loads.live,
      ...(loads.point ? { displayPoint: loads.point } : {}),
    };
    if (member.type !== 'frame') return { ...base, kind: 'other' as const, reason: member.type === 'truss' ? 'barra de armadura (sólo axial)' : 'brazo rígido' };
    if (!material.concrete) return { ...base, kind: 'other' as const, reason: material.name ? `material ${material.name}` : 'su módulo de elasticidad no es de concreto' };
    if (member.rigidOffsetI || member.rigidOffsetJ) notes.push(`${base.label}: tiene zonas rígidas; sus diagramas se leen sobre la parte flexible.`);
    if (material.fcMpa !== null) fcMpa = fcMpa === null ? material.fcMpa : Math.min(fcMpa, material.fcMpa);
    return { ...base, kind: slope <= 0.5 ? 'beam' as const : 'column' as const };
  });

  // Casos: muertos enteros, vivos partidos por barra y laterales; el sondeo se agrega al crear la fuente.
  const active = (item: LoadCase) => item.active;
  const ignoredCases = project.loadCases.filter((item) => !active(item) || item.category === 'other').map((item) => `${item.name}${item.active ? '' : ' (inactivo)'}`);
  const projected: ProjectedCase[] = [];
  const projection = {
    loadCases: [] as LoadCase[],
    memberLoads: [] as ProjectModel['memberLoads'],
    nodalLoads: [] as ProjectModel['nodalLoads'],
    prescribedDisplacements: [] as NonNullable<ProjectModel['prescribedDisplacements']>,
    memberInitialEffects: [] as NonNullable<ProjectModel['memberInitialEffects']>,
  };
  /** Copia a `solverId` lo del caso `caseId`: las cargas de barra (todas, las de una barra o ninguna) y lo demás si `rest`. */
  const carry = (caseId: string, solverId: string, memberLoads: 'all' | 'none' | string, rest: boolean) => {
    if (memberLoads !== 'none') {
      projection.memberLoads.push(...resolved.memberLoads.filter((load) => load.caseId === caseId && (memberLoads === 'all' || load.memberId === memberLoads)).map((load) => ({ ...load, caseId: solverId })));
    }
    if (!rest) return;
    projection.nodalLoads.push(...resolved.nodalLoads.filter((load) => load.caseId === caseId).map((load) => ({ ...load, caseId: solverId })));
    projection.prescribedDisplacements.push(...(resolved.prescribedDisplacements ?? []).filter((item) => item.caseId === caseId).map((item) => ({ ...item, caseId: solverId })));
    projection.memberInitialEffects.push(...(resolved.memberInitialEffects ?? []).filter((item) => item.caseId === caseId).map((item) => ({ ...item, caseId: solverId })));
  };
  for (const loadCase of project.loadCases.filter(active)) {
    if (loadCase.category === 'permanent' || loadCase.category === 'accidental') {
      const kind = loadCase.category === 'permanent' ? 'dead' as const : 'lateral' as const;
      projection.loadCases.push({ ...loadCase });
      carry(loadCase.id, loadCase.id, 'all', true);
      projected.push({ case: { id: loadCase.id, label: loadCase.name, kind }, solverId: loadCase.id });
    } else if (loadCase.category === 'variable') {
      // La viva de cada barra cargada es un caso: así se alterna barra por barra.
      const loaded = [...new Set(resolved.memberLoads.filter((load) => load.caseId === loadCase.id).map((load) => load.memberId))];
      for (const memberId of loaded) {
        const solverId = `${loadCase.id}§${memberId}`;
        projection.loadCases.push({ id: solverId, name: `${loadCase.name} · ${memberId}`, category: 'variable', active: true, selfWeightFactor: 0 });
        carry(loadCase.id, solverId, memberId, false);
        const label = project.members.find((member) => member.id === memberId)?.label?.trim() || memberId;
        projected.push({ case: { id: solverId, label: `${loadCase.name} · ${label}`, kind: 'live' }, solverId });
      }
      const rest = resolved.nodalLoads.some((load) => load.caseId === loadCase.id)
        || (resolved.prescribedDisplacements ?? []).some((item) => item.caseId === loadCase.id)
        || (resolved.memberInitialEffects ?? []).some((item) => item.caseId === loadCase.id)
        || (loadCase.selfWeightFactor ?? 0) !== 0;
      if (rest) {
        const solverId = `${loadCase.id}§resto`;
        projection.loadCases.push({ id: solverId, name: `${loadCase.name} · nudos`, category: 'variable', active: true, selfWeightFactor: loadCase.selfWeightFactor ?? 0 });
        carry(loadCase.id, solverId, 'none', true);
        projected.push({ case: { id: solverId, label: `${loadCase.name} · nudos`, kind: 'live' }, solverId });
      }
    }
  }
  const beams = members.filter((member) => member.kind === 'beam').length;
  const columns = members.filter((member) => member.kind === 'column').length;
  const deadCases = projected.filter((item) => item.case.kind === 'dead').length;
  const liveCases = projected.filter((item) => item.case.kind === 'live').length;
  const lateralCases = projected.filter((item) => item.case.kind === 'lateral').length;
  if (!project.members.length) errors.push('El Modelo 2D está vacío: dibuja barras, apoyos y cargas.');
  else if (!beams && !columns) errors.push('El Modelo 2D no tiene barras de concreto que diseñar (vigas o columnas con material de concreto).');
  if (project.members.length && !deadCases && !liveCases) errors.push('El Modelo 2D no tiene casos permanentes ni variables activos con cargas.');
  const nonlinear = project.members.some((member) => member.axialBehavior && member.axialBehavior !== 'both')
    || (project.nodeLinks ?? []).some((link) => link.behavior !== 'linear');
  if (nonlinear) notes.push('El modelo tiene comportamientos no lineales (cables, contactos o vínculos unilaterales): cada caso se resuelve por separado y la superposición es aproximada.');
  if (project.settings.analysisMode === 'p-delta') notes.push('El modelo pide P-Δ; el taller analiza en primer orden y amplifica momentos con δs.');
  if (project.combinations.length) notes.push('Las combinaciones del modelo no se usan: el taller aplica las de la norma con la categoría de cada caso.');
  // Flechas de la lámina: la primera acción lateral, sumada por elevación.
  const firstLateral = projected.find((item) => item.case.kind === 'lateral');
  const lateralByLevel = new Map<number, number>();
  for (const load of firstLateral ? resolved.nodalLoads.filter((item) => item.caseId === firstLateral.solverId && item.fx !== 0) : []) {
    const y = Math.round(project.nodes[nodeIndex.get(load.nodeId)!]!.y * 200) / 200;
    lateralByLevel.set(y, (lateralByLevel.get(y) ?? 0) + load.fx);
  }
  const lateralLevels = [...lateralByLevel.entries()].sort((a, b) => a[0] - b[0]).map(([y, kN]) => ({ y, kN: Math.abs(kN) }));
  const includesSelfWeight = project.loadCases.some((item) => item.active && item.category === 'permanent' && (item.selfWeightFactor ?? 0) > 0);

  return {
    label: project.name,
    revision: revisionOf(project),
    summary: { members: project.members.length, beams, columns, skipped: project.members.length - beams - columns, deadCases, liveCases, lateralCases, ignoredCases },
    fcMpa,
    includesSelfWeight,
    errors,
    create({ braced }): StructureSource | null {
      if (errors.length) return null;
      const cases: ProjectedCase[] = braced ? projected.filter((item) => item.case.kind !== 'lateral') : [...projected];
      const probe = braced ? [] : probeLoads(nodes, members);
      if (!braced && probe.length) cases.push({ case: { id: PROBE_CASE, label: 'Sondeo lateral', kind: 'probe' }, solverId: PROBE_CASE });
      const base: ProjectModel = {
        ...resolved,
        loadCases: [
          ...projection.loadCases,
          ...(!braced && probe.length ? [{ id: PROBE_CASE, name: 'Sondeo lateral', category: 'other' as const, active: true, selfWeightFactor: 0 }] : []),
        ],
        combinations: [],
        memberLoads: projection.memberLoads,
        nodalLoads: [
          ...projection.nodalLoads,
          ...(!braced ? probe.map((item, index) => ({ id: `${PROBE_CASE}-${index}`, nodeId: project.nodes[item.node]!.id, caseId: PROBE_CASE, fx: item.fx, fy: 0, mz: 0 })) : []),
        ],
        prescribedDisplacements: projection.prescribedDisplacements,
        memberInitialEffects: projection.memberInitialEffects,
        // Las fuentes con caso ya están resueltas arriba; sólo queda la cimentación elástica.
        generatedLoadSources: (project.generatedLoadSources ?? []).filter((item) => item.kind === 'elastic-foundation'),
        movingLoadCases: [],
        settings: { ...project.settings, analysisMode: 'first-order' },
      };
      const cache = new Map<string, ReturnType<StructureSource['analyze']>>();
      return {
        kind: 'model2d',
        label: `Modelo 2D · ${project.name}`,
        nodes,
        members,
        cases: cases.map((item) => item.case),
        braced,
        notes,
        lateralLevels: braced ? [] : lateralLevels,
        analyze(overrides) {
          const key = overrides?.size ? [...overrides.entries()].map(([index, value]) => `${index}:${value.toPrecision(6)}`).join('|') : '';
          const cached = cache.get(key);
          if (cached) return cached;
          const model: ProjectModel = overrides?.size
            ? { ...base, members: base.members.map((member, index) => overrides.has(index) ? { ...member, I: overrides.get(index)! } : member) }
            : base;
          const request: Model2dAnalysisRequest = { model, cases: cases.map((item) => ({ solverId: item.solverId, label: item.case.label })) };
          const outcome = analyzeCases ? analyzeCases(request) : hydrateModel2dCases(analyzeModel2dCases(request));
          if (cache.size > 24) cache.delete(cache.keys().next().value!);
          cache.set(key, outcome);
          return outcome;
        },
      };
    },
  };
}
