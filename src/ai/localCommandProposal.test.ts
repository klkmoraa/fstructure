import { describe, expect, it } from 'vitest';
import { createDefaultProject } from '../data/defaultProject';
import { standardSections } from '../data/standardSections';
import {
  confirmLocalProposal,
  prepareLocalProposal,
  proposeLocalCommand,
  type LocalProposal,
  type ProposalRequest,
} from './localCommandProposal';
import { validateLocalProposal } from './proposalValidation';
import { allowedUnits, ProposalUnitError, toBaseUnits } from './proposalUnits';

const HASH = 'a'.repeat(64);
const OTHER_HASH = 'b'.repeat(64);
const UUID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

const request = (intent: string, memberIds: readonly string[] = ['M1']): ProposalRequest => ({
  intent,
  snapshotHash: HASH,
  memberIds,
  sectionIds: standardSections.slice(0, 3).map((section) => section.id),
  materialIds: ['steel-a992'],
});

const readyProposal = (operation: unknown, overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  version: 1,
  proposalId: UUID,
  snapshotHash: HASH,
  status: 'ready',
  summary: 'Cambio propuesto',
  operation,
  ...overrides,
});

const validated = (input: unknown): LocalProposal => {
  const outcome = validateLocalProposal(input);
  if (!outcome.ok) throw new Error(`${outcome.path}: ${outcome.reason}`);
  return outcome.value;
};

describe('frontera de propuestas · validación cerrada', () => {
  it('rechaza claves extra y devuelve la ruta del contrato', () => {
    const outcome = validateLocalProposal({ ...readyProposal({ kind: 'member.section.apply', memberId: 'M1', sectionId: 's' }), extra: true });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.path).toBe('');
  });

  it('rechaza números escritos como texto en una cantidad', () => {
    const outcome = validateLocalProposal(readyProposal({ kind: 'member.update', memberId: 'M1', changes: { E: { value: '210', unit: 'GPa' } } }));
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.path).toBe('operation.changes.E.value');
  });

  it('acepta etiquetas acotadas como parte de un cambio de miembro', () => {
    const outcome = validateLocalProposal(readyProposal({ kind: 'member.update', memberId: 'M1', changes: { label: 'Marco principal' } }));
    expect(outcome.ok).toBe(true);
  });

  it('rechaza un estado inventado en lugar de interpretarlo', () => {
    const outcome = validateLocalProposal({ version: 1, proposalId: UUID, snapshotHash: HASH, status: 'applied', summary: 'x' });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.path).toBe('status');
  });

  it('rechaza nombres heredados como estados del contrato', () => {
    const outcome = validateLocalProposal({ version: 1, proposalId: UUID, snapshotHash: HASH, status: 'toString', summary: 'x' });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.path).toBe('status');
  });
});

describe('frontera de propuestas · unidades explícitas', () => {
  it('convierte unidades admitidas y publica la lista cerrada', () => {
    expect(toBaseUnits({ value: 210, unit: 'GPa' }, 'elasticModulus')).toBeCloseTo(2.1e8, 3);
    expect(toBaseUnits({ value: 100, unit: 'cm2' }, 'area')).toBeCloseTo(0.01, 12);
    expect(allowedUnits('area')).toEqual(['m2', 'cm2', 'mm2', 'in2']);
  });

  it('rechaza una unidad de otra magnitud con un error identificable', () => {
    expect(() => toBaseUnits({ value: 210, unit: 'GPa' }, 'area')).toThrow(ProposalUnitError);
  });
});

describe('frontera de propuestas · compilación y confirmación', () => {
  it('prepara un cambio sobre una copia y no toca el proyecto real', () => {
    const project = createDefaultProject();
    const before = JSON.stringify(project);
    const outcome = prepareLocalProposal(project, HASH, validated(readyProposal({
      kind: 'member.update', memberId: 'M1', changes: { A: { value: 200, unit: 'cm2' } },
    })) as Extract<LocalProposal, { status: 'ready' }>);
    expect(outcome.ok).toBe(true);
    expect(JSON.stringify(project)).toBe(before);
  });

  it('propaga la causa cuando el miembro ya no existe', () => {
    const outcome = prepareLocalProposal(createDefaultProject(), HASH, validated(readyProposal({
      kind: 'member.update', memberId: 'M99', changes: { A: { value: 200, unit: 'cm2' } },
    })) as Extract<LocalProposal, { status: 'ready' }>);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.code).toBe('unknown-id');
  });

  it('vuelve a exigir la misma huella al confirmar', () => {
    const prepared = prepareLocalProposal(createDefaultProject(), HASH, validated(readyProposal({
      kind: 'member.update', memberId: 'M1', changes: { A: { value: 200, unit: 'cm2' } },
    })) as Extract<LocalProposal, { status: 'ready' }>);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    const outcome = confirmLocalProposal(prepared.value, { proposalId: UUID, snapshotHash: HASH }, OTHER_HASH);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.code).toBe('project-changed');
  });
});

describe('proveedor local · identificación precisa', () => {
  it('no confunde un identificador que sólo aparece como prefijo', () => {
    const proposal = proposeLocalCommand(request('pon E = 210 GPa en M123', ['M1', 'M12']));
    expect(proposal.status).toBe('needs-clarification');
  });
});
