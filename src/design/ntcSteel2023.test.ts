import { expect, it } from 'vitest';
import { analyzeProject } from '../engine/solver';
import { steelTensionProject } from './fixtures/steelTensionProject';
import { summarizeNtcSteelTensionDesign } from './ntcSteel2023';

it.each([false, true])('reutiliza fluencia total para tensión pura, también inclinada (%s), con referencia independiente', (inclined) => {
  const project = steelTensionProject(inclined), analysis = analyzeProject(project, project.combinations[0]!);
  const summary = summarizeNtcSteelTensionDesign({ project, analysis, combinationId: 'U' });
  if (summary.status !== 'available') throw new Error(JSON.stringify(summary));
  expect(summary.highest.demand.value).toBeCloseTo(100, 7);
  expect(summary.highest.resistance.value).toBeCloseTo(.9 * 345000 * .0017290288, 7);
  expect(summary.highest.ratio.value).toBeCloseTo(100 / (.9 * 345000 * .0017290288), 9);
  expect(summary.highest.status).toBe('incomplete');
  expect(summary.highest.missingChecks).toContain('net-section-fracture');
});

it.each(['compression', 'identity', 'provenance', 'area'] as const)('declara el bloqueo y no aprueba %s', (change) => {
  const project = steelTensionProject();
  if (change === 'compression') project.nodalLoads[0]!.fx = -100;
  if (change === 'identity') delete project.members[0]!.sectionId;
  if (change === 'provenance') delete project.combinations[0]!.sourceUrl;
  if (change === 'area') project.members[0]!.A *= 2;
  const summary = summarizeNtcSteelTensionDesign({ project, analysis: analyzeProject(project, project.combinations[0]!), combinationId: 'U' });
  expect(summary.status).toBe('unavailable');
  expect(summary.statusConclusion).toBe('incomplete');
  expect(summary.skipped[0]!.blockers).toContain({ compression: 'positive-tension-required', identity: 'explicit-catalog-identity-required', provenance: 'ntc-ultimate-combination-required', area: 'catalog-properties-drifted' }[change]);
});
