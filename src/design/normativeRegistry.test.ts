/// <reference types="node" />

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Registro normativo de Diseño: sólo se implementan cláusulas verificadas, con
 * página, extracto y SHA-256 reproducibles (docs/design/normative-sources.json).
 */
const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const NORMATIVE_REGISTRY_PATH = resolve(ROOT, 'docs/design/normative-sources.json');

type OfficialDocument = {
  url: string;
  sha256: string;
};

type PageEvidence = {
  page?: number;
  excerpt?: string;
  excerptSha256?: string;
  verifiedAt?: string;
};

type VerifiedClause = {
  clauseId?: string;
  pages?: number[];
  sourceUrl?: string;
  sourceSha256?: string;
  evidence?: PageEvidence[];
};

type NormativeStandard = {
  id: string;
  status: string;
  publicationNotice: OfficialDocument;
  officialElectronicAnnex: OfficialDocument;
  verifiedClauses: VerifiedClause[];
  clauseVerificationStatus: string;
  implementationGate?: string;
};

type NormativeRegistry = {
  policy: {
    verifiedClauseEvidenceSchema?: {
      version: number;
      clauseFields: string[];
      pageEvidenceFields: string[];
    };
  };
  standards: NormativeStandard[];
};

const EXPECTED_CLAUSE_FIELDS = ['clauseId', 'pages', 'sourceUrl', 'sourceSha256', 'evidence'];
const EXPECTED_PAGE_EVIDENCE_FIELDS = ['page', 'excerpt', 'excerptSha256', 'verifiedAt'];

const sha256 = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');

const normativeRegistryErrors = (registry: NormativeRegistry): string[] => {
  const errors: string[] = [];
  const evidenceSchema = registry.policy.verifiedClauseEvidenceSchema;

  if (evidenceSchema?.version !== 1) errors.push('policy: falta verifiedClauseEvidenceSchema v1');
  if (JSON.stringify(evidenceSchema?.clauseFields) !== JSON.stringify(EXPECTED_CLAUSE_FIELDS)) {
    errors.push('policy: campos de cláusula incompletos');
  }
  if (JSON.stringify(evidenceSchema?.pageEvidenceFields) !== JSON.stringify(EXPECTED_PAGE_EVIDENCE_FIELDS)) {
    errors.push('policy: campos de evidencia por página incompletos');
  }

  for (const standard of registry.standards) {
    const prefix = `${standard.id}:`;
    const isPending = standard.clauseVerificationStatus === 'pending';
    const isVerified = standard.clauseVerificationStatus === 'verified';
    const statusSaysPending = standard.status.includes('pending');
    const statusSaysVerified = standard.status.includes('verified');
    const gateIsBlocked = standard.implementationGate?.startsWith('blocked-') === true;

    if (!isPending && !isVerified) errors.push(`${prefix} clauseVerificationStatus inválido`);
    if (!standard.implementationGate) errors.push(`${prefix} falta implementationGate`);

    if (isPending) {
      if (!statusSaysPending || statusSaysVerified) errors.push(`${prefix} estado pending incoherente`);
      if (standard.verifiedClauses.length > 0) errors.push(`${prefix} pending no admite verifiedClauses`);
      if (!gateIsBlocked) errors.push(`${prefix} pending requiere implementationGate bloqueado`);
    }

    if (isVerified) {
      if (statusSaysPending || !statusSaysVerified) errors.push(`${prefix} estado verified incoherente`);
      if (standard.verifiedClauses.length === 0) errors.push(`${prefix} verified requiere cláusulas verificadas`);
      if (gateIsBlocked) errors.push(`${prefix} verified no puede conservar gate pending`);
    }

    const registeredSources = [standard.publicationNotice, standard.officialElectronicAnnex];

    for (const clause of standard.verifiedClauses) {
      if (!clause.clauseId?.trim()) errors.push(`${prefix} cláusula sin clauseId`);

      const pages = clause.pages ?? [];
      if (pages.length === 0 || pages.some((page) => !Number.isInteger(page) || page < 1) || new Set(pages).size !== pages.length) {
        errors.push(`${prefix} cláusula con páginas inválidas`);
      }

      const sourceMatches = registeredSources.some(
        ({ url, sha256: sourceSha256 }) => clause.sourceUrl === url && clause.sourceSha256 === sourceSha256,
      );
      if (!sourceMatches) errors.push(`${prefix} evidencia no coincide con una fuente oficial registrada`);

      const evidence = clause.evidence ?? [];
      const evidencePages = evidence.map(({ page }) => page).sort((a, b) => (a ?? 0) - (b ?? 0));
      if (JSON.stringify(evidencePages) !== JSON.stringify([...pages].sort((a, b) => a - b))) {
        errors.push(`${prefix} evidencia no cubre exactamente las páginas declaradas`);
      }

      for (const pageEvidence of evidence) {
        if (!pageEvidence.excerpt?.trim()) errors.push(`${prefix} evidencia sin extracto`);
        if (pageEvidence.excerpt && pageEvidence.excerptSha256 !== sha256(Buffer.from(pageEvidence.excerpt, 'utf8'))) {
          errors.push(`${prefix} hash de extracto incoherente`);
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(pageEvidence.verifiedAt ?? '')) {
          errors.push(`${prefix} fecha de verificación inválida`);
        }
      }
    }
  }

  return errors;
};

describe('registro normativo de Diseño', () => {
  it('abre sólo las cláusulas verificadas y exige evidencia reproducible', () => {
    const registry = JSON.parse(readFileSync(NORMATIVE_REGISTRY_PATH, 'utf8')) as NormativeRegistry;

    expect(normativeRegistryErrors(registry)).toEqual([]);

    const currentStandard = registry.standards[0];
    expect(currentStandard).toMatchObject({
      id: 'ntc-cdmx-2023-concrete',
      status: 'official-clauses-verified',
      clauseVerificationStatus: 'verified',
      implementationGate: 'open-for-verified-clauses-only',
    });
    expect(currentStandard.verifiedClauses.map(({ clauseId }) => clauseId)).toEqual([
      '2.2.1-2.2.7.3',
      '3.6.1',
      '3.8.2.1-3.8.2.2',
      '5.2.1.1.2',
      '5.2.1.3.1',
      '5.2.2.1.1.1',
      '5.5.2.2',
      '5.5.3.1.1-5.5.3.1.2',
      '5.5.3.6.1-5.5.3.6.2',
      '6.3.1.1-6.3.2.2',
      '6.3.3.1.1',
      '6.3.3.3.1',
      '6.3.5.1.1-6.3.5.2.1',
      '6.3.5.4.1-6.3.5.4.4',
      '6.3.7.6.2.2',
      '13.4.1.1',
      '13.4.2.1-13.4.3.3',
      '13.6.1-13.6.2.1',
      '14.2.1',
      // Taller de diseño (viga continua, columna y zapata), verificadas el 2026-09-23.
      '3.3.5.2.1.1-3.3.5.2.2.1',
      '3.3.5.2.4.1-3.3.5.2.4.3',
      '3.8.2.1 (tabla 3.8.2.1, incisos b a d)',
      '3.8.2.2 (tabla 3.8.2.2)',
      '5.3.2.1',
      '5.4.1.2',
      '5.5.3.2.1 y 5.5.3.8.1',
      '5.6.1.7-5.6.2.1.1',
      '5.6.3.1.1',
      '6.7.4.2.2.2 y 6.7.4.4.2.3',
      '6.4.2.1.1',
      '6.4.3.1.1-6.4.3.2.1',
      '6.4.4.4.2.4',
      '6.4.4.4.2.6',
      '6.4.4.4.5.1 (tabla 6.4.4.4.5.1)',
      '14.7.3.2-14.7.3.3',
      '9.4.3',
      '9.4.6.1',
      '9.4.7.8',
      '9.4.8.2',
      '14.4.2.1',
      '14.4.2.4 (tabla 14.4.2.4)',
      '14.4.2.6 (tabla 14.4.2.6)',
      '13.4.4.1',
      '13.6.2 (tabla 13.6.2)',
      '13.4.1.1 (límites a y b)',
      // Limitaciones cerradas: inercia promedio, separación en columnas, ganchos, traslapes,
      // marcos no restringidos, Jc, acero mínimo y separación en zapatas (2026-09-23).
      '13.4.3.5',
      '14.2.3',
      '14.4.3.1-14.4.3.2',
      '14.5.2.1 (tabla 14.5.2.1)',
      '3.3.5.2.2.2 y 3.3.5.2.5.1-3.3.5.2.5.5',
      '6.7.4.4.2.4 (comentario, fig. C6.7.4.4 a)',
      '6.7.6.1.1-6.7.6.1.2',
      '6.7.4.2.2.3 (tabla 6.7.4.2.2.3)',
      '6.7.7.2.2',
      '9.4.7.2',
    ]);
    expect(registry.standards[1]).toMatchObject({
      id: 'ntc-cdmx-2023-criteria-actions',
      status: 'official-clauses-verified',
      clauseVerificationStatus: 'verified',
      implementationGate: 'open-for-verified-clauses-only',
    });
    expect(registry.standards[1]!.verifiedClauses.map(({ clauseId }) => clauseId)).toEqual(['3.4.1', '6.1.1', 'tabla 6.1.2.2']);
    // Normas adicionales del taller: cada una con su propio documento oficial y hash.
    for (const [index, id, count] of [[2, 'nsr-10-titulo-c', 36], [3, 'e060-2009-concreto-armado', 34]] as const) {
      expect(registry.standards[index]).toMatchObject({
        id,
        status: 'official-clauses-verified',
        clauseVerificationStatus: 'verified',
        implementationGate: 'open-for-verified-clauses-only',
      });
      expect(registry.standards[index]!.verifiedClauses).toHaveLength(count);
    }
    const policy = {
      ...registry.policy,
      verifiedClauseEvidenceSchema: {
        version: 1,
        clauseFields: EXPECTED_CLAUSE_FIELDS,
        pageEvidenceFields: EXPECTED_PAGE_EVIDENCE_FIELDS,
      },
    };
    const excerpt = 'Extracto normativo de prueba';
    const validClause: VerifiedClause = {
      clauseId: 'fixture-clause',
      pages: [7],
      sourceUrl: currentStandard.officialElectronicAnnex.url,
      sourceSha256: currentStandard.officialElectronicAnnex.sha256,
      evidence: [{ page: 7, excerpt, excerptSha256: sha256(Buffer.from(excerpt, 'utf8')), verifiedAt: '2026-09-14' }],
    };

    const pendingStandard: NormativeStandard = {
      ...currentStandard,
      status: 'official-bundle-identified-clause-verification-pending',
      clauseVerificationStatus: 'pending',
      implementationGate: 'blocked-until-concrete-pages-and-clauses-are-verified',
      verifiedClauses: [],
    };

    const contradictoryStatus: NormativeRegistry = {
      policy,
      standards: [{ ...pendingStandard, clauseVerificationStatus: 'verified' }],
    };
    expect(normativeRegistryErrors(contradictoryStatus)).toContain(`${pendingStandard.id}: estado verified incoherente`);

    const clauseWhilePending: NormativeRegistry = {
      policy,
      standards: [{ ...pendingStandard, verifiedClauses: [validClause] }],
    };
    expect(normativeRegistryErrors(clauseWhilePending)).toContain(`${pendingStandard.id}: pending no admite verifiedClauses`);

    const invalidEvidence: NormativeRegistry = {
      policy,
      standards: [{
        ...currentStandard,
        status: 'official-clauses-verified',
        clauseVerificationStatus: 'verified',
        implementationGate: 'open-for-verified-clauses-only',
        verifiedClauses: [{ ...validClause, sourceSha256: '0'.repeat(64) }],
      }],
    };
    expect(normativeRegistryErrors(invalidEvidence)).toContain(
      `${currentStandard.id}: evidencia no coincide con una fuente oficial registrada`,
    );

    const coherentVerified: NormativeRegistry = {
      policy,
      standards: [{
        ...currentStandard,
        status: 'official-clauses-verified',
        clauseVerificationStatus: 'verified',
        implementationGate: 'open-for-verified-clauses-only',
        verifiedClauses: [validClause],
      }],
    };
    expect(normativeRegistryErrors(coherentVerified)).toEqual([]);
  });
});
