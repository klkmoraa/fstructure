/**
 * Comandos reversibles sobre el proyecto espacial.
 *
 * `applySpace3DCommand` es una función pura: recibe un snapshot y devuelve otro.
 * El historial de deshacer/rehacer guarda snapshots, no comandos inversos, que
 * es la forma barata de garantizar que deshacer nunca reconstruye un estado que
 * el validador no aceptaría.
 *
 * Todo comando termina comparando los problemas del modelo antes y después: se
 * rechaza el que introduce uno nuevo (mover un nudo encima de otro anula la
 * longitud de una barra), y se acepta el que convive con los que ya había —de
 * lo contrario un modelo derivado de 2D, que nace incompleto a propósito, no
 * podría completarse nunca.
 */
import { validateSpace3DProject } from '../model/validation';
import {
  SPACE3D_LIMITS,
  type Space3DDiaphragm,
  type Space3DFrameMember,
  type Space3DGridSystem,
  type Space3DLoadCase,
  type Space3DLoadCombination,
  type Space3DMassSource,
  type Space3DMemberLoad,
  type Space3DNodalLoad,
  type Space3DNode,
  type Space3DProjectV1,
  type Space3DResponseSpectrumCase,
  type Space3DRestraints,
  type Space3DSpectrumFunction,
} from '../model/types';

export type Space3DCommand =
  | { readonly kind: 'add-node'; readonly node: Space3DNode }
  | { readonly kind: 'update-node'; readonly nodeId: string; readonly changes: Partial<Omit<Space3DNode, 'id'>> }
  | { readonly kind: 'delete-node'; readonly nodeId: string }
  | { readonly kind: 'add-member'; readonly member: Space3DFrameMember }
  | { readonly kind: 'update-member'; readonly memberId: string; readonly changes: Partial<Omit<Space3DFrameMember, 'id'>> }
  | { readonly kind: 'delete-member'; readonly memberId: string }
  | { readonly kind: 'set-restraints'; readonly nodeId: string; readonly restraints: Space3DRestraints }
  | { readonly kind: 'add-nodal-load'; readonly load: Space3DNodalLoad }
  | { readonly kind: 'update-nodal-load'; readonly loadId: string; readonly changes: Partial<Omit<Space3DNodalLoad, 'id'>> }
  | { readonly kind: 'delete-nodal-load'; readonly loadId: string }
  | { readonly kind: 'add-member-load'; readonly load: Space3DMemberLoad }
  | { readonly kind: 'delete-member-load'; readonly loadId: string }
  /** Crea el caso o reemplaza el del mismo identificador. */
  | { readonly kind: 'upsert-load-case'; readonly loadCase: Space3DLoadCase }
  /** Borra el caso; si hay cargas o combinaciones que lo usan, se rechaza. */
  | { readonly kind: 'delete-load-case'; readonly caseId: string }
  | { readonly kind: 'upsert-combination'; readonly combination: Space3DLoadCombination }
  | { readonly kind: 'delete-combination'; readonly combinationId: string }
  /** Guarda (o, con `null`, retira) la rejilla de ejes y pisos. */
  | { readonly kind: 'set-grid'; readonly grid: Space3DGridSystem | null }
  | { readonly kind: 'rename-project'; readonly name: string }
  /** Reemplaza (o, con `null`, retira) los diafragmas rígidos. */
  | { readonly kind: 'set-diaphragms'; readonly diaphragms: readonly Space3DDiaphragm[] | null }
  /** Fija (o, con `null`, vuelve a la masa propia) la fuente de masa. */
  | { readonly kind: 'set-mass-source'; readonly massSource: Space3DMassSource | null }
  | { readonly kind: 'upsert-spectrum-function'; readonly spectrum: Space3DSpectrumFunction }
  /** Se rechaza si algún caso espectral la usa. */
  | { readonly kind: 'delete-spectrum-function'; readonly functionId: string }
  | { readonly kind: 'upsert-response-spectrum-case'; readonly spectrumCase: Space3DResponseSpectrumCase }
  | { readonly kind: 'delete-response-spectrum-case'; readonly caseId: string }
  /**
   * Varias ediciones como un solo paso: se aplican en orden y, si una falla,
   * no se aplica ninguna. Deshacer revierte el lote entero.
   */
  | { readonly kind: 'batch'; readonly commands: readonly Space3DCommand[] };

type Space3DCommandErrorCode =
  | 'empty-id'
  | 'duplicate-id'
  | 'missing-entity'
  | 'node-in-use'
  | 'self-referential'
  | 'invalid-value'
  | 'limit-exceeded'
  | 'invalid-result'
  | 'case-in-use'
  | 'function-in-use';

export class Space3DCommandError extends Error {
  readonly code: Space3DCommandErrorCode;

  constructor(code: Space3DCommandErrorCode, detail: string) {
    super(`${code}: ${detail}`);
    this.name = 'Space3DCommandError';
    this.code = code;
  }
}

const fail = (code: Space3DCommandErrorCode, detail: string): never => { throw new Space3DCommandError(code, detail); };

const requireId = (id: string, kind: string) => {
  if (typeof id !== 'string' || id.trim() === '') fail('empty-id', `${kind} sin identificador`);
};

const requireUnique = (ids: readonly string[], id: string, kind: string) => {
  if (ids.includes(id)) fail('duplicate-id', `ya existe ${kind} «${id}»`);
};

const requireExisting = <T extends { id: string }>(items: readonly T[], id: string, kind: string): T => {
  const found = items.find((item) => item.id === id);
  if (!found) fail('missing-entity', `no existe ${kind} «${id}»`);
  return found as T;
};

const POSITIVE_MEMBER_FIELDS = ['E', 'G', 'A', 'Iy', 'Iz', 'J'] as const;
const LOAD_COMPONENTS = ['fx', 'fy', 'fz', 'mx', 'my', 'mz'] as const;

const requireFinite = (value: unknown, label: string) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail('invalid-value', `${label} debe ser un número finito`);
};

const requirePositive = (value: unknown, label: string) => {
  requireFinite(value, label);
  if ((value as number) <= 0) fail('invalid-value', `${label} debe ser mayor que cero`);
};

const checkNodeShape = (node: Space3DNode) => {
  requireId(node.id, 'el nudo');
  for (const axis of ['x', 'y', 'z'] as const) {
    requireFinite(node[axis], `nudo ${node.id}.${axis}`);
    if (Math.abs(node[axis]) > SPACE3D_LIMITS.maxCoordinateMagnitude) {
      fail('invalid-value', `nudo ${node.id}.${axis} fuera del rango admitido`);
    }
  }
};

const checkMemberShape = (member: Space3DFrameMember) => {
  requireId(member.id, 'la barra');
  if (member.type === 'truss') {
    for (const field of ['E', 'A'] as const) requirePositive(member[field], `barra ${member.id}.${field}`);
    // A truss has no flexural or torsional stiffness. Keep the values finite
    // and non-negative so a zero remains a valid, lossless axial member.
    for (const field of ['G', 'Iy', 'Iz', 'J'] as const) {
      requireFinite(member[field], `barra ${member.id}.${field}`);
      if (member[field] < 0) fail('invalid-value', `barra ${member.id}.${field} no puede ser negativa`);
    }
  } else {
    for (const field of POSITIVE_MEMBER_FIELDS) requirePositive(member[field], `barra ${member.id}.${field}`);
  }
  requireFinite(member.orientation?.rollRadians, `barra ${member.id}.rollRadians`);
  const reference = member.orientation?.localYReferenceGlobal;
  if (!Array.isArray(reference) || reference.length !== 3) fail('invalid-value', `barra ${member.id}: referencia de orientación inválida`);
  reference.forEach((component, index) => requireFinite(component, `barra ${member.id}.localYReferenceGlobal[${index}]`));
};

const checkLoadShape = (load: Space3DNodalLoad) => {
  requireId(load.id, 'la carga');
  for (const component of LOAD_COMPONENTS) requireFinite(load[component], `carga ${load.id}.${component}`);
};

const issueKey = (issue: { entityKind: string; entityId: string; code: string; field: string }) =>
  `${issue.entityKind}:${issue.entityId}:${issue.code}:${issue.field}`;

/**
 * Un comando se rechaza si **empeora** el modelo, no si el modelo ya estaba mal.
 *
 * Exigir un modelo íntegro después de cada comando parece más seguro y es justo
 * lo contrario: un proyecto derivado de 2D nace con la inercia del eje débil sin
 * definir, y una regla así impediría precisamente las ediciones que sirven para
 * completarlo. Se comparan los problemas antes y después, y sólo los nuevos
 * bloquean.
 */
const finish = (before: Space3DProjectV1, project: Space3DProjectV1): Space3DProjectV1 => {
  const previous = new Set(validateSpace3DProject(before).map(issueKey));
  const introduced = validateSpace3DProject(project).filter((issue) => !previous.has(issueKey(issue)));
  if (introduced.length > 0) {
    const detail = introduced.slice(0, 3).map((item) => `${item.entityKind}:${item.entityId}:${item.code}`).join(', ');
    fail('invalid-result', detail);
  }
  return project;
};

export const applySpace3DCommand = (project: Space3DProjectV1, command: Space3DCommand): Space3DProjectV1 => {
  switch (command.kind) {
    case 'add-node': {
      checkNodeShape(command.node);
      requireUnique(project.nodes.map((node) => node.id), command.node.id, 'el nudo');
      return finish(project, { ...project, nodes: [...project.nodes, command.node] });
    }

    case 'update-node': {
      const current = requireExisting(project.nodes, command.nodeId, 'el nudo');
      const next = { ...current, ...command.changes, id: current.id };
      checkNodeShape(next);
      return finish(project, { ...project, nodes: project.nodes.map((node) => (node.id === current.id ? next : node)) });
    }

    case 'delete-node': {
      requireExisting(project.nodes, command.nodeId, 'el nudo');
      const members = project.members.filter((member) => member.i === command.nodeId || member.j === command.nodeId);
      const loads = project.nodalLoads.filter((load) => load.nodeId === command.nodeId);
      if (members.length > 0 || loads.length > 0) {
        const consumers = [...members.map((item) => item.id), ...loads.map((item) => item.id)].join(', ');
        fail('node-in-use', `el nudo «${command.nodeId}» todavía es usado por: ${consumers}`);
      }
      // Un diafragma sin el nudo sigue siendo el mismo diafragma; con menos de
      // dos nudos ya no restringe nada y se retira. Deshacer lo recupera.
      const diaphragms = project.diaphragms
        ?.map((item) => ({ ...item, nodeIds: item.nodeIds.filter((id) => id !== command.nodeId) }))
        .filter((item) => item.nodeIds.length >= 2);
      return finish(project, {
        ...project,
        nodes: project.nodes.filter((node) => node.id !== command.nodeId),
        ...(diaphragms ? { diaphragms } : {}),
      });
    }

    case 'add-member': {
      checkMemberShape(command.member);
      requireUnique(project.members.map((member) => member.id), command.member.id, 'la barra');
      requireExisting(project.nodes, command.member.i, 'el nudo');
      requireExisting(project.nodes, command.member.j, 'el nudo');
      if (command.member.i === command.member.j) fail('self-referential', 'una barra no puede unir un nudo consigo mismo');
      return finish(project, { ...project, members: [...project.members, command.member] });
    }

    case 'update-member': {
      const current = requireExisting(project.members, command.memberId, 'la barra');
      const next = { ...current, ...command.changes, id: current.id };
      checkMemberShape(next);
      requireExisting(project.nodes, next.i, 'el nudo');
      requireExisting(project.nodes, next.j, 'el nudo');
      if (next.i === next.j) fail('self-referential', 'una barra no puede unir un nudo consigo mismo');
      return finish(project, { ...project, members: project.members.map((member) => (member.id === current.id ? next : member)) });
    }

    case 'delete-member': {
      requireExisting(project.members, command.memberId, 'la barra');
      // Las cargas de la barra no tienen sentido sin ella: se van con ella y
      // vuelven con ella al deshacer, porque el historial guarda snapshots.
      return finish(project, {
        ...project,
        members: project.members.filter((member) => member.id !== command.memberId),
        memberLoads: project.memberLoads.filter((load) => load.memberId !== command.memberId),
      });
    }

    case 'set-restraints': {
      const current = requireExisting(project.nodes, command.nodeId, 'el nudo');
      for (const dof of ['ux', 'uy', 'uz', 'rx', 'ry', 'rz'] as const) {
        if (typeof command.restraints[dof] !== 'boolean') fail('invalid-value', `apoyo ${command.nodeId}.${dof}`);
      }
      const next = { ...current, restraints: { ...command.restraints } };
      return finish(project, { ...project, nodes: project.nodes.map((node) => (node.id === current.id ? next : node)) });
    }

    case 'add-nodal-load': {
      checkLoadShape(command.load);
      requireUnique(project.nodalLoads.map((load) => load.id), command.load.id, 'la carga');
      requireExisting(project.nodes, command.load.nodeId, 'el nudo');
      requireExisting(project.loadCases, command.load.caseId, 'el caso de carga');
      return finish(project, { ...project, nodalLoads: [...project.nodalLoads, command.load] });
    }

    case 'update-nodal-load': {
      const current = requireExisting(project.nodalLoads, command.loadId, 'la carga');
      const next = { ...current, ...command.changes, id: current.id };
      checkLoadShape(next);
      requireExisting(project.nodes, next.nodeId, 'el nudo');
      requireExisting(project.loadCases, next.caseId, 'el caso de carga');
      return finish(project, { ...project, nodalLoads: project.nodalLoads.map((load) => (load.id === current.id ? next : load)) });
    }

    case 'delete-nodal-load': {
      requireExisting(project.nodalLoads, command.loadId, 'la carga');
      return finish(project, { ...project, nodalLoads: project.nodalLoads.filter((load) => load.id !== command.loadId) });
    }

    case 'add-member-load': {
      requireId(command.load.id, 'la carga en barra');
      requireUnique(project.memberLoads.map((load) => load.id), command.load.id, 'la carga en barra');
      requireExisting(project.members, command.load.memberId, 'la barra');
      requireExisting(project.loadCases, command.load.caseId, 'el caso de carga');
      return finish(project, { ...project, memberLoads: [...project.memberLoads, command.load] });
    }

    case 'delete-member-load': {
      requireExisting(project.memberLoads, command.loadId, 'la carga en barra');
      return finish(project, { ...project, memberLoads: project.memberLoads.filter((load) => load.id !== command.loadId) });
    }

    case 'upsert-load-case': {
      requireId(command.loadCase.id, 'el caso de carga');
      if (typeof command.loadCase.name !== 'string') fail('invalid-value', 'el caso necesita un nombre');
      if (command.loadCase.selfWeightFactor !== undefined) requireFinite(command.loadCase.selfWeightFactor, 'multiplicador de peso propio');
      if (project.loadCombinations.some((item) => item.id === command.loadCase.id)) fail('duplicate-id', `ya existe una combinación «${command.loadCase.id}»`);
      const exists = project.loadCases.some((item) => item.id === command.loadCase.id);
      return finish(project, {
        ...project,
        loadCases: exists
          ? project.loadCases.map((item) => (item.id === command.loadCase.id ? command.loadCase : item))
          : [...project.loadCases, command.loadCase],
      });
    }

    case 'delete-load-case': {
      requireExisting(project.loadCases, command.caseId, 'el caso de carga');
      const used = project.nodalLoads.some((load) => load.caseId === command.caseId)
        || project.memberLoads.some((load) => load.caseId === command.caseId)
        || project.loadCombinations.some((item) => item.terms.some((term) => term.caseId === command.caseId))
        || (project.massSource?.loads.some((term) => term.caseId === command.caseId) ?? false);
      if (used) fail('case-in-use', `el caso «${command.caseId}» todavía tiene cargas, combinaciones o aporta masa`);
      return finish(project, { ...project, loadCases: project.loadCases.filter((item) => item.id !== command.caseId) });
    }

    case 'upsert-combination': {
      requireId(command.combination.id, 'la combinación');
      if (project.loadCases.some((item) => item.id === command.combination.id)) fail('duplicate-id', `ya existe un caso «${command.combination.id}»`);
      if (!Array.isArray(command.combination.terms) || command.combination.terms.length === 0) fail('invalid-value', 'la combinación necesita al menos un término');
      for (const term of command.combination.terms) {
        requireExisting(project.loadCases, term.caseId, 'el caso de carga');
        requireFinite(term.factor, `factor de ${term.caseId}`);
      }
      const exists = project.loadCombinations.some((item) => item.id === command.combination.id);
      return finish(project, {
        ...project,
        loadCombinations: exists
          ? project.loadCombinations.map((item) => (item.id === command.combination.id ? command.combination : item))
          : [...project.loadCombinations, command.combination],
      });
    }

    case 'delete-combination': {
      requireExisting(project.loadCombinations, command.combinationId, 'la combinación');
      return finish(project, { ...project, loadCombinations: project.loadCombinations.filter((item) => item.id !== command.combinationId) });
    }

    case 'set-grid': {
      if (command.grid === null) {
        const { grid: _removed, ...rest } = project;
        return finish(project, rest);
      }
      for (const list of [command.grid.xLines, command.grid.zLines]) {
        for (const line of list) { requireId(line.id, 'el eje'); requireFinite(line.coordinate, `eje ${line.id}`); }
      }
      for (const story of command.grid.stories) { requireId(story.id, 'el piso'); requireFinite(story.elevation, `piso ${story.id}`); }
      return finish(project, { ...project, grid: command.grid });
    }

    case 'rename-project': {
      if (typeof command.name !== 'string' || command.name.trim() === '') fail('empty-id', 'el proyecto necesita un nombre');
      return finish(project, { ...project, name: command.name.trim() });
    }

    case 'set-diaphragms': {
      if (command.diaphragms === null || command.diaphragms.length === 0) {
        const { diaphragms: _removed, ...rest } = project;
        return finish(project, rest);
      }
      const owner = new Map<string, string>();
      const ids = new Set<string>();
      for (const diaphragm of command.diaphragms) {
        requireId(diaphragm.id, 'el diafragma');
        if (ids.has(diaphragm.id)) fail('duplicate-id', `ya existe el diafragma «${diaphragm.id}»`);
        ids.add(diaphragm.id);
        if (diaphragm.nodeIds.length < 2) fail('invalid-value', `el diafragma «${diaphragm.id}» necesita al menos dos nudos`);
        for (const nodeId of diaphragm.nodeIds) {
          requireExisting(project.nodes, nodeId, 'el nudo');
          const previous = owner.get(nodeId);
          if (previous !== undefined) fail('invalid-value', `el nudo «${nodeId}» ya pertenece a «${previous}»`);
          owner.set(nodeId, diaphragm.id);
        }
      }
      return finish(project, { ...project, diaphragms: command.diaphragms });
    }

    case 'set-mass-source': {
      if (command.massSource === null) {
        const { massSource: _removed, ...rest } = project;
        return finish(project, rest);
      }
      if (typeof command.massSource.selfMass !== 'boolean') fail('invalid-value', 'masa propia');
      for (const term of command.massSource.loads) {
        requireExisting(project.loadCases, term.caseId, 'el caso de carga');
        requireFinite(term.factor, `factor de masa de ${term.caseId}`);
        if (term.factor < 0) fail('invalid-value', `el factor de masa de ${term.caseId} no puede ser negativo`);
      }
      return finish(project, { ...project, massSource: command.massSource });
    }

    case 'upsert-spectrum-function': {
      const spectrum = command.spectrum;
      requireId(spectrum.id, 'el espectro');
      if (spectrum.points.length === 0) fail('invalid-value', 'el espectro necesita al menos un punto');
      spectrum.points.forEach(([period, acceleration], index) => {
        requireFinite(period, `periodo ${index + 1}`);
        requireFinite(acceleration, `Sa ${index + 1}`);
        if (period < 0 || acceleration < 0) fail('invalid-value', `el punto ${index + 1} del espectro no puede ser negativo`);
        if (index > 0 && !(period > spectrum.points[index - 1][0])) fail('invalid-value', 'los periodos del espectro deben crecer');
      });
      const list = project.spectrumFunctions ?? [];
      const exists = list.some((item) => item.id === spectrum.id);
      return finish(project, {
        ...project,
        spectrumFunctions: exists ? list.map((item) => (item.id === spectrum.id ? spectrum : item)) : [...list, spectrum],
      });
    }

    case 'delete-spectrum-function': {
      requireExisting(project.spectrumFunctions ?? [], command.functionId, 'el espectro');
      if ((project.responseSpectrumCases ?? []).some((item) => item.functionId === command.functionId)) {
        fail('function-in-use', `el espectro «${command.functionId}» lo usa un caso espectral`);
      }
      return finish(project, { ...project, spectrumFunctions: (project.spectrumFunctions ?? []).filter((item) => item.id !== command.functionId) });
    }

    case 'upsert-response-spectrum-case': {
      const spectrumCase = command.spectrumCase;
      requireId(spectrumCase.id, 'el caso espectral');
      requireExisting(project.spectrumFunctions ?? [], spectrumCase.functionId, 'el espectro');
      requirePositive(spectrumCase.scale, 'factor de escala');
      requireFinite(spectrumCase.dampingRatio, 'amortiguamiento');
      if (spectrumCase.dampingRatio < 0 || spectrumCase.dampingRatio >= 1) fail('invalid-value', 'el amortiguamiento debe estar entre 0 y 1');
      if (!Number.isInteger(spectrumCase.modes) || spectrumCase.modes < 1 || spectrumCase.modes > 500) fail('invalid-value', 'el número de modos va de 1 a 500');
      const list = project.responseSpectrumCases ?? [];
      const exists = list.some((item) => item.id === spectrumCase.id);
      return finish(project, {
        ...project,
        responseSpectrumCases: exists ? list.map((item) => (item.id === spectrumCase.id ? spectrumCase : item)) : [...list, spectrumCase],
      });
    }

    case 'delete-response-spectrum-case': {
      requireExisting(project.responseSpectrumCases ?? [], command.caseId, 'el caso espectral');
      return finish(project, { ...project, responseSpectrumCases: (project.responseSpectrumCases ?? []).filter((item) => item.id !== command.caseId) });
    }

    case 'batch': {
      if (!Array.isArray(command.commands) || command.commands.length === 0) fail('invalid-value', 'el lote está vacío');
      return command.commands.reduce<Space3DProjectV1>((current, item) => applySpace3DCommand(current, item), project);
    }
  }
};
