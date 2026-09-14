/// <reference types="node" />

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const MANIFEST_PATH = resolve(ROOT, 'docs/design/structural-design-migration.md');
const NORMATIVE_REGISTRY_PATH = resolve(ROOT, 'docs/design/normative-sources.json');

const EXPECTED_SOURCE_COMMIT = 'd80b45c011631e41384e7ad2f77ffad460e8cd5b';
const EXPECTED_SOURCE_ARTIFACTS = new Map(
  `dd28f1e7b17437741337da169e87889f77ae2fe81d41996ac81f4d0d624d9a33  .gitignore
1666b49e90519f5412ee9fa4f066949fd1f3b75ff10ec9a008346d6b00fafa56  README.md
f753e271911e2368e56586ef062827ed8d1803cddb2769e12a8f65c72375c653  docs/qa/fidelity-ledger.md
11cb1c56a1f6ef7ef97ee8e0ad65758ab4f91d9e1114c24c3cb0714f48706ca7  docs/references/normative/README.md
5e36049f65ee38b7811898a5901c1b9b7c3b780dc8085454a9b8e1c79a1495f9  docs/references/normative/ntc-acero-cdmx-2020.pdf
cccf4adc874d09d260f1b1a31b1e31a7e1dec02ec745427ad738c33c8a112731  docs/references/normative/ntc-concreto-cdmx-2017.pdf
d6df0ca3ca4c9f9facafd6dc13b7fe99f677c3bf0a81041d27d163b8b7517df7  docs/references/normative/ntc-sismo-cdmx-2020.pdf
3fc936943df3bcf2d56ae148990a46887e1a6976307c5ca87dcb7c9a019674f0  docs/references/normative/ntc-viento-cdmx-2017.pdf
fffe40c368d5ed0f1e6234a319d7d2eb3923c0f412ce71ff83170f0939a8a204  docs/research/technical-landscape.md
d450f86fb4ad4d8299021f078cb47d562ceebbe52938b48dbc321a6d1155ddc0  docs/superpowers/plans/2026-09-13-fstructure-design-workbench.md
9ab9897dd2015d7f8b86317755e7e520a183d73534bc6acea9c277fdfc77e955  docs/superpowers/specs/2026-09-13-fstructure-design-workbench-design.md
6957d9bf9cd174188797677e54d0ab019e056171c30a251152478e42f5d7410d  index.html
a0855ec32f81a9f9f5f84b07b5cb89a6f209f715dbe07a898e6cad2443b7c236  package.json
0ec35ca5320ae918488d6fbbea4a87f517f62332a74aa8fc4fb2ea05cfa960af  pnpm-lock.yaml
9f5588f63173d7edfdf46cc69f5efcb6970045810c2786e72992124f60e33df4  public/brand/fusionstructure-mark.svg
a3c71f540233dac28a6557882d9b0c758ca93b8339d785fe54ffe5954e9e02fe  public/concepts/design-workbench-desktop.png
1e28864d43cdd25f4854b221f66d15e5ee644902c23cef3415179e98b1f5c464  public/concepts/design-workbench-mobile.png
f9b2e1d688772adc0705d75b9883ba818a34d212f29b3d86ba2e8b676eb5146b  src/App.test.tsx
e3f4df7628c35477afd7f8af64504f2cafb01d369e332748f3023eacf2bee145  src/App.tsx
8e6bd3e93349fa8a507ac335d6904a46d4abd86694cf82eddd948a00de04440d  src/appState.test.ts
af81ceb9bf4bb17c4b912fed7d45c3225cd3f7c134bf5757a448521bd4a8d4ff  src/appState.ts
e500d7fa0329a43c2ca8ade8d5266f854f96441a9bc4b708b804870b9a781d84  src/components/AppShell.tsx
0bebff4d1c18b9d7b66579ea95bb9e5201cdde10666a571d2978fe589963d3e9  src/components/DesignInspector.tsx
dbb0cfa152c04a9d7bb51113d8a16e6ec255b08f601442b3852e5d06f2e66b82  src/components/DetailSheet.tsx
71f81b98da87d191f294e69f154902bf2d87ed6ec46a020dd0e284406dd67aa7  src/components/EvidencePanel.tsx
09f0dd69df6a43d69cc3a5f51d9d2f37917b2433e5cad29b6c114f8632ad1240  src/components/ModelCanvas.tsx
506880903ebef7fff9053adb9a18f39ffe9f9f204d32fa5d50e3376f7daefa37  src/components/ProjectRail.tsx
2678c729b1627c1a01e8e2e3638259c3bf2acaf65a9aa5b1d3717e63c3fdb1d8  src/components/ResultStack.tsx
d6670a2eb5fb5c1d03b86bbb28dace06c7f7f8509cfc383ce93ee1a940613ab4  src/components/StatusBadge.tsx
f0b5daea6e0c281f4cd9888ae77a8c8782eed89f723937517d1807a458ab0381  src/components/Topbar.tsx
f683426daad9a318365b72051dbff2c455e12629d68c2ea9c1e34c5514215e3b  src/components/icons.tsx
9acc3a651508e62d74203c3769c9d1d6c48b5ecf050ffdc95300822de31d5cd7  src/data/brandTokens.ts
b6e15407023c9d2ff3d203a1636c5a65df2f9aef68ee81723fd867c2c9e9e8b1  src/data/references.ts
cd1d373bb4044867f36ec2efd87239ecef931076bdf61677857c36a17b1cee4f  src/domain/demoDesign.ts
88c4abc2761633771e39f5622c7d0ea26af6ae722af9f4afb80f530b56a24b09  src/domain/design.ts
68c61b62e810ffb615cc1749ae20f66b085b2fe82c413f774274aeb80b6cf42c  src/domain/designTransforms.test.ts
7ca5bffce3ed4c9788742f27a8fd5deaa2fe2bef63267aaa71ed82cf24be1031  src/domain/designTransforms.ts
f11b5c2fb8b63400f9ddecc0948af6b9292b128c90c0e8a7c51463f2b6bec8b0  src/main.tsx
69e702aa939eb46cce2fabc6ffb3eb848fddec47dd2b06d9deae1dedabd31eed  src/styles/global.css
a1a0f2c043130eac2e20455c614a1db744bfa2afc8840abb46a0b620b65446f2  src/styles/tokens.css
41d887398d7f5d55f973da60312928314017744ad220e85df5f2d3a88e6cc730  src/styles/workbench.css
91a3c8962a0edcb956206a501d943fe99e1c78c6d4d8b5c9a948a3362c75978c  src/test/setup.ts
65996936fbb042915f7b74a200fcdde7e410f32a669b1ab9597cfaa4b0faddb5  src/vite-env.d.ts
18eef6f87ef638fb29585831d4c1898a1d06b725164f01d36be48120f6afa6d7  tsconfig.app.json
770b4140bbb581e2dfd9ea9946ffc9c75a1d86ba7d2db5f77c83e37cbdf9d808  tsconfig.json
2fba2f25e1859f193b54edef5d2d2cd08cae2a37fab64c08699f6f8672bea2cc  tsconfig.node.json
509442b5590ab975be841f4c099fa369abb0cc947c69afa4bc65e24cf487de62  vite.config.ts`
    .split('\n')
    .map((line) => {
      const [sha256, ...pathParts] = line.split('  ');
      return [pathParts.join('  '), sha256] as const;
    }),
);

type MigrationArtifact = {
  sourcePath: string;
  sourceSha256: string;
  status: 'migrated' | 'replaced' | 'excluded';
  reason: string;
  destinationPaths?: string[];
};

type AcceptedConcept = {
  path: string;
  width: number;
  height: number;
  sha256: string;
};

type MigrationManifest = {
  sourceCommit: string;
  artifacts: MigrationArtifact[];
  acceptedConcepts: AcceptedConcept[];
};

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

const readManifest = (): MigrationManifest => {
  const markdown = readFileSync(MANIFEST_PATH, 'utf8').replace(/\r\n/g, '\n');
  const embeddedJson = markdown.match(/```json migration-manifest\n([\s\S]*?)\n```/);
  expect(embeddedJson, 'falta el bloque `json migration-manifest`').not.toBeNull();
  return JSON.parse(embeddedJson![1]) as MigrationManifest;
};

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

const pngDimensions = (bytes: Buffer): { width: number; height: number } => {
  expect(bytes.subarray(1, 4).toString('ascii')).toBe('PNG');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
};

const walk = (directory: string): string[] => {
  if (!existsSync(directory)) return [];
  return readdirSync(directory).flatMap((entry) => {
    const path = resolve(directory, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
};

describe('manifiesto de migración de Diseño Estructural', () => {
  it('ancla el commit fuente e inventaría cada artefacto con estado, razón y SHA-256', () => {
    const manifest = readManifest();

    expect(manifest.sourceCommit).toBe(EXPECTED_SOURCE_COMMIT);
    expect(manifest.artifacts).toHaveLength(EXPECTED_SOURCE_ARTIFACTS.size);
    expect(new Set(manifest.artifacts.map(({ sourcePath }) => sourcePath)).size).toBe(EXPECTED_SOURCE_ARTIFACTS.size);

    for (const artifact of manifest.artifacts) {
      expect(EXPECTED_SOURCE_ARTIFACTS.has(artifact.sourcePath), `artefacto inesperado: ${artifact.sourcePath}`).toBe(true);
      expect(artifact.sourceSha256, artifact.sourcePath).toBe(EXPECTED_SOURCE_ARTIFACTS.get(artifact.sourcePath));
      expect(['migrated', 'replaced', 'excluded'], artifact.sourcePath).toContain(artifact.status);
      expect(artifact.reason.trim().length, artifact.sourcePath).toBeGreaterThan(0);
      if (artifact.status !== 'excluded') {
        expect(artifact.destinationPaths?.length, `${artifact.sourcePath} no declara destino`).toBeGreaterThan(0);
      }
    }
  });

  it('verifica bytes, dimensiones y SHA-256 de los dos conceptos aceptados', () => {
    const manifest = readManifest();
    const expected = [
      { path: 'public/concepts/design-workbench-desktop.png', width: 1586, height: 992, sha256: 'a3c71f540233dac28a6557882d9b0c758ca93b8339d785fe54ffe5954e9e02fe' },
      { path: 'public/concepts/design-workbench-mobile.png', width: 853, height: 1844, sha256: '1e28864d43cdd25f4854b221f66d15e5ee644902c23cef3415179e98b1f5c464' },
    ];

    expect(manifest.acceptedConcepts).toEqual(expected);
    for (const concept of expected) {
      const bytes = readFileSync(resolve(ROOT, concept.path));
      expect(pngDimensions(bytes)).toEqual({ width: concept.width, height: concept.height });
      expect(sha256(bytes)).toBe(concept.sha256);
    }
  });

  it('impide incorporar PDFs normativos al repositorio único', () => {
    const normativeDirectory = resolve(ROOT, 'docs/references/normative');
    const presentPdfs = walk(normativeDirectory).filter((path) => path.toLowerCase().endsWith('.pdf'));
    const trackedPdfs = execFileSync('git', ['ls-files', '*.pdf'], { cwd: ROOT, encoding: 'utf8' })
      .trim()
      .split('\n')
      .filter(Boolean);

    expect(presentPdfs).toEqual([]);
    expect(trackedPdfs).toEqual([]);
  });

  it('mantiene el registro normativo pending bloqueado y exige evidencia reproducible para verificar', () => {
    const registry = JSON.parse(readFileSync(NORMATIVE_REGISTRY_PATH, 'utf8')) as NormativeRegistry;

    expect(normativeRegistryErrors(registry)).toEqual([]);

    const pendingStandard = registry.standards[0];
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
      sourceUrl: pendingStandard.officialElectronicAnnex.url,
      sourceSha256: pendingStandard.officialElectronicAnnex.sha256,
      evidence: [{ page: 7, excerpt, excerptSha256: sha256(Buffer.from(excerpt, 'utf8')), verifiedAt: '2026-09-14' }],
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
        ...pendingStandard,
        status: 'official-clauses-verified',
        clauseVerificationStatus: 'verified',
        implementationGate: 'open-for-verified-clauses-only',
        verifiedClauses: [{ ...validClause, sourceSha256: '0'.repeat(64) }],
      }],
    };
    expect(normativeRegistryErrors(invalidEvidence)).toContain(
      `${pendingStandard.id}: evidencia no coincide con una fuente oficial registrada`,
    );

    const coherentVerified: NormativeRegistry = {
      policy,
      standards: [{
        ...pendingStandard,
        status: 'official-clauses-verified',
        clauseVerificationStatus: 'verified',
        implementationGate: 'open-for-verified-clauses-only',
        verifiedClauses: [validClause],
      }],
    };
    expect(normativeRegistryErrors(coherentVerified)).toEqual([]);
  });
});
