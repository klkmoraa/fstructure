import { describe, expect, it } from 'vitest';
import { generateSpace3DBuilding } from './buildingTemplate';
import { analyzeSpace3DProject } from './solver';
import { SPACE3D_GRAVITY } from './memberLoading';

const sumReactions = (result: ReturnType<typeof analyzeSpace3DProject>, key: 'ux' | 'uy') =>
  result.nodeResults.reduce((sum, node) => sum + node.reaction[key], 0);

describe('Space3D building quick template', () => {
  const options = { xSpacings: [6, 5], zSpacings: [4], storyHeights: [3.5, 3], superDeadLoad: 2, liveLoad: 3, lateralCoefficient: 0.1 } as const;

  it('builds grid, columns, beams, supports, cases and combinations', () => {
    const project = generateSpace3DBuilding(options);
    expect(project.grid?.xLines.map((line) => line.id)).toEqual(['A', 'B', 'C']);
    expect(project.grid?.stories.map((story) => story.elevation)).toEqual([0, 3.5, 6.5]);
    // 3×2 ejes × 3 niveles; 6 columnas y 7 vigas por piso.
    expect(project.nodes).toHaveLength(18);
    expect(project.members.filter((member) => member.id.startsWith('C'))).toHaveLength(12);
    expect(project.members.filter((member) => member.id.startsWith('B'))).toHaveLength(14);
    expect(project.loadCases.map((item) => item.id)).toEqual(['DEAD', 'LIVE', 'SX']);
    expect(project.loadCombinations.map((item) => item.id)).toEqual(['SERV', 'U1', 'U2', 'U3']);
  });

  it('carries exactly q·area per story to the supports through the two-way slab distribution', () => {
    const project = generateSpace3DBuilding(options);
    const live = analyzeSpace3DProject(project, 'LIVE');
    expect(live.success).toBe(true);
    expect(sumReactions(live, 'uy')).toBeCloseTo(3 * 11 * 4 * 2, 6);
    expect(live.diagnostics.equilibrium.normalized).toBeLessThan(1e-9);
  });

  it('adds self-weight and superimposed dead load in DEAD', () => {
    const project = generateSpace3DBuilding(options);
    const dead = analyzeSpace3DProject(project, 'DEAD');
    const selfWeight = project.members.reduce((sum, member) => {
      const i = project.nodes.find((node) => node.id === member.i)!;
      const j = project.nodes.find((node) => node.id === member.j)!;
      const length = Math.hypot(j.x - i.x, j.y - i.y, j.z - i.z);
      return sum + (member.density ?? 0) * SPACE3D_GRAVITY * member.A * length / 1000;
    }, 0);
    expect(sumReactions(dead, 'uy')).toBeCloseTo(selfWeight + 2 * 11 * 4 * 2, 6);
  });

  it('resists the static lateral case with a base shear equal to the applied forces', () => {
    const project = generateSpace3DBuilding(options);
    const applied = project.nodalLoads.filter((load) => load.caseId === 'SX').reduce((sum, load) => sum + load.fx, 0);
    const lateral = analyzeSpace3DProject(project, 'SX');
    expect(applied).toBeGreaterThan(0);
    expect(sumReactions(lateral, 'ux')).toBeCloseTo(-applied, 8);
  });

  it('adds one rigid diaphragm per storey, a D + 0.25L mass source and example spectra that analyse', async () => {
    const project = generateSpace3DBuilding(options);
    expect(project.diaphragms?.map((item) => item.nodeIds.length)).toEqual([6, 6]);
    expect(project.massSource?.loads).toEqual([{ caseId: 'DEAD', factor: 1 }, { caseId: 'LIVE', factor: 0.25 }]);
    const { analyzeSpace3DResponseSpectrum } = await import('./responseSpectrum');
    const spectrum = analyzeSpace3DResponseSpectrum(project, 'EX');
    expect(spectrum.success).toBe(true);
    expect(spectrum.sturmVerified).toBe(true);
    // Con diafragmas y 3 modos por piso, los modos cubren toda la masa en X.
    expect(spectrum.cumulativeMassRatio).toBeCloseTo(1, 6);
    expect(spectrum.stories.map((story) => story.name)).toEqual(['Piso 2', 'Piso 1']);
  });

  it('rejects empty or non-finite geometry', () => {
    expect(() => generateSpace3DBuilding({ ...options, xSpacings: [] })).toThrow(RangeError);
    expect(() => generateSpace3DBuilding({ ...options, storyHeights: [Number.NaN] })).toThrow(RangeError);
    expect(() => generateSpace3DBuilding({ ...options, beamSection: 'no existe' })).toThrow(RangeError);
  });
});
