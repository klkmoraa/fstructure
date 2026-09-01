import { applyProjectPatch, compileProjectCommand, type ProjectCommand } from '../commands/projectCommand';
import { standardMaterials } from '../data/standardMaterials';
import { standardSections } from '../data/standardSections';
import { diffProjects, type ProjectDiff } from '../data/projectDiff';
import type { MemberModel, ProjectModel } from '../types';
import { allowedUnits, ProposalUnitError, toBaseUnits, type ProposalQuantity, type ProposalQuantityKind } from './proposalUnits';
import { translatePhase2, type Phase2TranslationKey } from '../i18n/phase2Catalogs';

export type { ProposalQuantity } from './proposalUnits';

export type ProposedOperation =
  | { kind: 'member.update'; memberId: string; changes: Partial<Record<'E' | 'A' | 'I' | 'density', ProposalQuantity>> & { label?: string } }
  | { kind: 'member.section.apply'; memberId: string; sectionId: string }
  | { kind: 'member.material.apply'; memberId: string; materialId: string };

export type LocalProposal = {
  version: 1;
  proposalId: string;
  snapshotHash: string;
  summary: string;
} & (
  | { status: 'ready'; operation: ProposedOperation }
  | { status: 'needs-clarification'; question: string }
  | { status: 'rejected'; reason: string }
);

export interface ProposalRequest {
  intent: string;
  snapshotHash: string;
  memberIds: readonly string[];
  sectionIds: readonly string[];
  materialIds: readonly string[];
}

const proposalId = () => {
  if (!globalThis.crypto?.randomUUID) throw new Error('Web Crypto no puede crear una propuesta local.');
  return globalThis.crypto.randomUUID();
};
const mentioned = (intent: string, ids: readonly string[]) => {
  const lower = intent.toLowerCase();
  const isTokenBoundary = (character: string | undefined) => !character || !/[a-z0-9_]/i.test(character);
  return [...ids].sort((left, right) => right.length - left.length).find((id) => {
    const candidate = id.toLowerCase();
    let from = 0;
    while (from < lower.length) {
      const index = lower.indexOf(candidate, from);
      if (index < 0) return false;
      if (isTokenBoundary(lower[index - 1]) && isTokenBoundary(lower[index + candidate.length])) return true;
      from = index + candidate.length;
    }
    return false;
  });
};
const FIELD_KINDS = { E: 'elasticModulus', A: 'area', I: 'inertia', density: 'density' } as const satisfies Record<'E' | 'A' | 'I' | 'density', ProposalQuantityKind>;
const quantityIn = (intent: string, field: keyof typeof FIELD_KINDS): ProposalQuantity | null => {
  const kind = FIELD_KINDS[field];
  const units = allowedUnits(kind).map((unit) => unit.replace(/[/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|');
  const match = new RegExp(`\\b${field}\\b\\s*=?\\s*(-?\\d+(?:[.,]\\d+)?)\\s*(${units})\\b`, 'i').exec(intent);
  if (!match) return null;
  const unit = allowedUnits(kind).find((candidate) => candidate.toLowerCase() === match[2]!.toLowerCase());
  return unit ? { value: Number.parseFloat(match[1]!.replace(',', '.')), unit } : null;
};

/** Parser local determinista. No hace llamadas de red ni aplica cambios. */
export const proposeLocalCommand = (request: ProposalRequest): LocalProposal => {
  const base = { version: 1 as const, proposalId: proposalId(), snapshotHash: request.snapshotHash };
  const memberId = mentioned(request.intent, request.memberIds);
  if (!memberId) return { ...base, status: 'needs-clarification', summary: 'Falta identificar la barra.', question: 'Indica el identificador de la barra que quieres modificar.' };
  const sectionId = mentioned(request.intent, request.sectionIds);
  if (sectionId) return { ...base, status: 'ready', summary: `Aplicar la sección ${sectionId} a ${memberId}.`, operation: { kind: 'member.section.apply', memberId, sectionId } };
  const materialId = mentioned(request.intent, request.materialIds);
  if (materialId) return { ...base, status: 'ready', summary: `Aplicar el material ${materialId} a ${memberId}.`, operation: { kind: 'member.material.apply', memberId, materialId } };
  const changes: Extract<ProposedOperation, { kind: 'member.update' }>['changes'] = {};
  (Object.keys(FIELD_KINDS) as Array<keyof typeof FIELD_KINDS>).forEach((field) => {
    const quantity = quantityIn(request.intent, field);
    if (quantity) changes[field] = quantity;
  });
  if (Object.keys(changes).length) return { ...base, status: 'ready', summary: `Actualizar ${Object.keys(changes).join(', ')} en ${memberId}.`, operation: { kind: 'member.update', memberId, changes } };
  return { ...base, status: 'rejected', summary: `No existe una operación compatible para ${memberId}.`, reason: 'Nombra una sección, material o propiedad con unidad explícita.' };
};

/** Frontera estricta para cualquier proveedor futuro: no convierte ni ignora datos externos. */
export { validateLocalProposal } from './proposalValidation';

export type ProposalPreparationCode = 'stale-snapshot' | 'unknown-id' | 'bad-units' | 'no-effect' | 'compile-error';
export interface ProposalPreparationFailure {
  ok: false;
  code: ProposalPreparationCode;
  reason: string;
  key: Phase2TranslationKey;
  params?: Record<string, string | number>;
}

const preparationFailure = (
  code: ProposalPreparationCode,
  key: Phase2TranslationKey,
  params?: Record<string, string | number>,
): ProposalPreparationFailure => ({ ok: false, code, reason: translatePhase2('es', key, params), key, params });

const commandFor = (project: ProjectModel, operation: ProposedOperation): ProjectCommand | ProposalPreparationFailure => {
  const member = project.members.find((candidate) => candidate.id === operation.memberId);
  if (!member) return preparationFailure('unknown-id', 'proposal.error.unknownMember', { memberId: operation.memberId });
  if (operation.kind === 'member.section.apply') {
    const section = standardSections.find((candidate) => candidate.id === operation.sectionId);
    return section
      ? { kind: 'member.section.apply', description: `Aplicar sección ${section.name}`, memberId: member.id, sectionId: section.id, properties: { A: section.area, I: section.inertiaX } }
      : preparationFailure('unknown-id', 'proposal.error.unknownSection', { sectionId: operation.sectionId });
  }
  if (operation.kind === 'member.material.apply') {
    const material = standardMaterials.find((candidate) => candidate.id === operation.materialId);
    return material
      ? { kind: 'member.material.apply', description: `Aplicar material ${material.name}`, memberId: member.id, materialId: material.id, properties: { E: material.elasticModulus, G: material.shearModulus, density: material.density } }
      : preparationFailure('unknown-id', 'proposal.error.unknownMaterial', { materialId: operation.materialId });
  }
  const changes: Partial<Omit<MemberModel, 'id'>> = {};
  for (const field of ['E', 'A', 'I', 'density'] as const) {
    const quantity = operation.changes[field];
    if (quantity === undefined) continue;
    try {
      const value = toBaseUnits(quantity, FIELD_KINDS[field]);
      if (!(value > 0)) return preparationFailure('bad-units', 'proposal.error.notPositive', { field });
      changes[field] = value;
    } catch (error) {
      if (error instanceof ProposalUnitError) return preparationFailure('bad-units', error.key, error.params);
      return preparationFailure('bad-units', 'proposal.error.quantityNotFinite');
    }
  }
  if (operation.changes.label !== undefined) changes.label = operation.changes.label;
  return { kind: 'member.update', description: `Actualizar ${Object.keys(changes).join(', ')} en ${member.id}`, memberId: member.id, changes };
};

export type PreparedLocalProposal = { proposal: Extract<LocalProposal, { status: 'ready' }>; command: ProjectCommand; diff: ProjectDiff };
export type ProposalPreparationOutcome = { ok: true; value: PreparedLocalProposal } | ProposalPreparationFailure;
export const prepareLocalProposal = (project: ProjectModel, snapshotHash: string, proposal: Extract<LocalProposal, { status: 'ready' }>): ProposalPreparationOutcome => {
  if (proposal.snapshotHash !== snapshotHash) return preparationFailure('stale-snapshot', 'proposal.error.staleSnapshot');
  const command = commandFor(project, proposal.operation);
  if ('ok' in command) return command;
  const draft = structuredClone(project);
  try {
    const after = applyProjectPatch(draft, compileProjectCommand(draft, command).forward);
    const diff = diffProjects(project, after);
    return diff.identical ? preparationFailure('no-effect', 'proposal.error.noEffect') : { ok: true, value: { proposal, command, diff } };
  } catch {
    return preparationFailure('compile-error', 'proposal.failed');
  }
};

export type ProposalConfirmationCode = 'mismatched-proposal' | 'mismatched-snapshot' | 'project-changed';
export type ProposalConfirmationOutcome =
  | { ok: true; command: ProjectCommand }
  | { ok: false; code: ProposalConfirmationCode; reason: string; key: Phase2TranslationKey };

export const confirmLocalProposal = (
  prepared: PreparedLocalProposal,
  confirmation: { proposalId: string; snapshotHash: string },
  currentHash: string,
): ProposalConfirmationOutcome => {
  if (confirmation.proposalId !== prepared.proposal.proposalId) {
    return { ok: false, code: 'mismatched-proposal', reason: translatePhase2('es', 'proposal.error.mismatchedProposal'), key: 'proposal.error.mismatchedProposal' };
  }
  if (confirmation.snapshotHash !== prepared.proposal.snapshotHash) {
    return { ok: false, code: 'mismatched-snapshot', reason: translatePhase2('es', 'proposal.error.mismatchedSnapshot'), key: 'proposal.error.mismatchedSnapshot' };
  }
  return currentHash === prepared.proposal.snapshotHash
    ? { ok: true, command: prepared.command }
    : { ok: false, code: 'project-changed', reason: translatePhase2('es', 'proposal.error.projectChanged'), key: 'proposal.error.projectChanged' };
};
