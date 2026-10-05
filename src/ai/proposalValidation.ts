import type { LocalProposal, ProposalQuantity, ProposedOperation } from './localCommandProposal';
import { translatePhase2, type Phase2TranslationKey } from '../i18n/phase2Catalogs';

export interface ProposalValidationFailure {
  ok: false;
  /** Ruta del campo culpable, en notación de puntos. */
  path: string;
  reason: string;
  key: Phase2TranslationKey;
  params?: Record<string, string | number>;
}

export type ProposalValidationOutcome<T> = { ok: true; value: T } | ProposalValidationFailure;

const fail = (
  path: string,
  key: Phase2TranslationKey,
  params?: Record<string, string | number>,
): ProposalValidationFailure => ({
  ok: false,
  path,
  reason: translatePhase2('es', key, params),
  key,
  params,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Rechaza toda clave que no forme parte del contrato, incluso si parece inocua. */
const rejectExtraKeys = (
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
): ProposalValidationFailure | null => {
  const extra = Object.keys(value).filter((key) => !allowed.includes(key));
  return extra.length ? fail(path, 'proposal.error.extraKeys', { extra: extra.join(', ') }) : null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256 = /^[a-f0-9]{64}$/i;

const validateQuantity = (value: unknown, path: string): ProposalValidationOutcome<ProposalQuantity> => {
  if (!isRecord(value)) return fail(path, 'proposal.error.quantityShape');
  const extra = rejectExtraKeys(value, ['value', 'unit'], path);
  if (extra) return extra;
  if (typeof value.value !== 'number' || !Number.isFinite(value.value)) {
    return fail(`${path}.value`, 'proposal.error.quantityValue');
  }
  if (typeof value.unit !== 'string' || !value.unit) {
    return fail(`${path}.unit`, 'proposal.error.quantityUnit');
  }
  return { ok: true, value: { value: value.value, unit: value.unit } };
};

const PROPOSED_OPERATION_KINDS = [
  'member.update',
  'member.section.apply',
  'member.material.apply',
] as const;

const validateOperation = (value: unknown, path: string): ProposalValidationOutcome<ProposedOperation> => {
  if (!isRecord(value)) return fail(path, 'proposal.error.operationShape');
  const kind = value.kind;
  if (typeof kind !== 'string' || !(PROPOSED_OPERATION_KINDS as readonly string[]).includes(kind)) {
    return fail(`${path}.kind`, 'proposal.error.operationKind', { kinds: PROPOSED_OPERATION_KINDS.join(', ') });
  }
  if (typeof value.memberId !== 'string' || !value.memberId) {
    return fail(`${path}.memberId`, 'proposal.error.missingMemberId');
  }

  if (kind === 'member.section.apply' || kind === 'member.material.apply') {
    const catalogKey = kind === 'member.section.apply' ? 'sectionId' : 'materialId';
    const extra = rejectExtraKeys(value, ['kind', 'memberId', catalogKey], path);
    if (extra) return extra;
    const id = value[catalogKey];
    if (typeof id !== 'string' || !id) return fail(`${path}.${catalogKey}`, 'proposal.error.missingCatalogId');
    return kind === 'member.section.apply'
      ? { ok: true, value: { kind, memberId: value.memberId, sectionId: id } }
      : { ok: true, value: { kind, memberId: value.memberId, materialId: id } };
  }

  const extra = rejectExtraKeys(value, ['kind', 'memberId', 'changes'], path);
  if (extra) return extra;
  if (!isRecord(value.changes)) return fail(`${path}.changes`, 'proposal.error.changesShape');
  const extraChanges = rejectExtraKeys(value.changes, ['E', 'A', 'I', 'density', 'label'], `${path}.changes`);
  if (extraChanges) return extraChanges;
  if (!Object.keys(value.changes).length) return fail(`${path}.changes`, 'proposal.error.noChanges');

  const changes: Extract<ProposedOperation, { kind: 'member.update' }>['changes'] = {};
  for (const field of ['E', 'A', 'I', 'density'] as const) {
    if (!(field in value.changes)) continue;
    const quantity = validateQuantity(value.changes[field], `${path}.changes.${field}`);
    if (!quantity.ok) return quantity;
    changes[field] = quantity.value;
  }
  if ('label' in value.changes) {
    if (typeof value.changes.label !== 'string') return fail(`${path}.changes.label`, 'proposal.error.labelType');
    if (value.changes.label.length > 60) return fail(`${path}.changes.label`, 'proposal.error.labelLength');
    changes.label = value.changes.label;
  }
  return { ok: true, value: { kind: 'member.update', memberId: value.memberId, changes } };
};

/** Convierte cualquier respuesta desconocida en una propuesta cerrada o en un diagnóstico preciso. */
export const validateLocalProposal = (input: unknown): ProposalValidationOutcome<LocalProposal> => {
  if (!isRecord(input)) return fail('', 'proposal.error.notObject');

  const statusKeys = {
    ready: 'operation',
    'needs-clarification': 'question',
    rejected: 'reason',
  } as const;
  const status = input.status;
  if (typeof status !== 'string' || !Object.hasOwn(statusKeys, status)) {
    return fail('status', 'proposal.error.unknownStatus', { statuses: Object.keys(statusKeys).join(', ') });
  }
  const statusField = statusKeys[status as keyof typeof statusKeys];
  const extra = rejectExtraKeys(input, ['version', 'proposalId', 'snapshotHash', 'status', 'summary', statusField], '');
  if (extra) return extra;
  if (input.version !== 1) return fail('version', 'proposal.error.version');
  if (typeof input.proposalId !== 'string' || !UUID.test(input.proposalId)) return fail('proposalId', 'proposal.error.proposalId');
  if (typeof input.snapshotHash !== 'string' || !SHA256.test(input.snapshotHash)) return fail('snapshotHash', 'proposal.error.snapshotHash');
  if (typeof input.summary !== 'string' || !input.summary.trim() || input.summary.length > 240) return fail('summary', 'proposal.error.summary');

  const base = {
    version: 1 as const,
    proposalId: input.proposalId,
    snapshotHash: input.snapshotHash,
    summary: input.summary,
  };

  if (status === 'ready') {
    const operation = validateOperation(input.operation, 'operation');
    if (!operation.ok) return operation;
    return { ok: true, value: { ...base, status: 'ready', operation: operation.value } };
  }

  const text = input[statusField];
  if (typeof text !== 'string' || !text.trim() || text.length > 240) return fail(statusField, 'proposal.error.freeText');
  return status === 'needs-clarification'
    ? { ok: true, value: { ...base, status: 'needs-clarification', question: text } }
    : { ok: true, value: { ...base, status: 'rejected', reason: text } };
};
