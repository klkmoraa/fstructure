import { expect, it } from 'vitest';
import { availableSolver2dCorpus, resolveCorpusProject } from '../../engine/solver2dCorpus';
import { analyzeProject } from '../../engine/solver';
import { analyzeProjectPDelta } from '../../engine/pDelta';
import { serializeCanonicalResult } from '../../engine/canonicalResult';
import { InMemoryUnifiedBundleRepository } from '../../storage/unifiedBundleRepository';
import { UnifiedProjectSession } from '../../storage/unifiedProjectSession';
import { normalizeProject } from '../../data/migrate';

it('preserves the numerical corpus through canonical shell save/open', async () => {
  const session = new UnifiedProjectSession(new InMemoryUnifiedBundleRepository());
  for (const fixture of availableSolver2dCorpus) {
    const project = resolveCorpusProject(fixture);
    const run = (model: typeof project) => fixture.id === 'p-delta'
      ? analyzeProjectPDelta(model, undefined, { maxLoadSteps: 16, maxIterationsPerStep: 40 })
      : analyzeProject(model, fixture.id === 'load-combination' ? model.combinations[0] : undefined, { includeEducationTrace: false });
    const before = run(project);
    await session.save2D(normalizeProject(project));
    const reopened = (await session.open(project.id))!;
    const after = run(reopened);
    expect(serializeCanonicalResult(after), fixture.id).toBe(serializeCanonicalResult(before));
  }
});
