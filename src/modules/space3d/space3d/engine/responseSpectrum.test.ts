/**
 * Espectro de respuesta: un piso rígido con espectro plano tiene la respuesta
 * de un oscilador de un grado de libertad, V = M·A y u = A/ω²; con varios
 * pisos, el cortante del piso más bajo es el cortante basal.
 */
import { describe, expect, it } from 'vitest';
import { analyzeSpace3DModal } from './analysisModes';
import { SPACE3D_GRAVITY } from './memberLoading';
import { analyzeSpace3DResponseSpectrum, space3DCqcCorrelation, space3DSpectrumAcceleration } from './responseSpectrum';
import {
  SPACE3D_ANALYSIS_SPACE,
  SPACE3D_SCHEMA_VERSION,
  fixedSpace3DRestraints,
  freeSpace3DRestraints,
  type Space3DFrameMember,
  type Space3DProjectV1,
  type Space3DResponseSpectrumCase,
} from '../model/types';

const E = 30_000_000;
const G = 12_500_000;
const I = 0.0054;
const a = 6;
const h = 3.5;
const m = 12;

const column = (id: string, i: string, j: string): Space3DFrameMember => ({
  id, i, j, E, G, A: 0.25, Iy: I, Iz: I, J: 0.0091,
  orientation: { localYReferenceGlobal: [1, 0, 0], rollRadians: 0 },
});

const corners = [[0, 0], [a, 0], [a, a], [0, a]] as const;

const building = (stories: number, rsCase: Partial<Space3DResponseSpectrumCase> = {}, points: readonly (readonly [number, number])[] = [[0, 0.5], [4, 0.5]]): Space3DProjectV1 => ({
  analysisSpace: SPACE3D_ANALYSIS_SPACE,
  schemaVersion: SPACE3D_SCHEMA_VERSION,
  id: 'rs', name: 'rs', units: 'kN-m',
  nodes: Array.from({ length: stories + 1 }, (_, level) => corners.map(([x, z], index) => ({
    id: `N${level}-${index}`, x, y: level * h, z, restraints: level === 0 ? fixedSpace3DRestraints() : freeSpace3DRestraints(),
  }))).flat(),
  members: Array.from({ length: stories }, (_, level) => corners.map((_, index) => column(`C${level}-${index}`, `N${level}-${index}`, `N${level + 1}-${index}`))).flat(),
  nodalLoads: [],
  loadCases: [{ id: 'LC1', name: 'LC1' }],
  loadCombinations: [],
  prescribedDisplacements: [], memberLoads: [], memberInitialEffects: [], nodeLinks: [],
  multiPointConstraints: [], generatedLoadSources: [], movingLoadCases: [],
  nodalMasses: Array.from({ length: stories }, (_, level) => corners.map((_, index) => ({ id: `M${level}-${index}`, nodeId: `N${level + 1}-${index}`, mass: m * 1000 }))).flat(),
  diaphragms: Array.from({ length: stories }, (_, level) => ({ id: `D${level + 1}`, name: `Piso ${level + 1}`, nodeIds: corners.map((_, index) => `N${level + 1}-${index}`) })),
  spectrumFunctions: [{ id: 'SP', name: 'Plano', points }],
  responseSpectrumCases: [{ id: 'EX', name: 'Sismo X', functionId: 'SP', direction: 'x', scale: 1, dampingRatio: 0.05, modes: 3 * stories, combination: 'cqc', ...rsCase }],
});

describe('Space3D response spectrum', () => {
  it('interpolates the spectrum and keeps its end values outside the range', () => {
    const spectrum = { points: [[0, 0.4], [0.5, 1], [2, 0.25]] as const };
    expect(space3DSpectrumAcceleration(spectrum, 0)).toBe(0.4);
    expect(space3DSpectrumAcceleration(spectrum, 0.25)).toBeCloseTo(0.7, 12);
    expect(space3DSpectrumAcceleration(spectrum, 1.25)).toBeCloseTo(0.625, 12);
    expect(space3DSpectrumAcceleration(spectrum, 9)).toBe(0.25);
  });

  it('uses the Der Kiureghian CQC correlation', () => {
    // ξ = 5 %, r = 0,9: 8ξ²(1+r)r^1,5 / ((1−r²)² + 4ξ²r(1+r)²).
    expect(space3DCqcCorrelation(10, 9, 0.05)).toBeCloseTo(0.4730, 3);
    expect(space3DCqcCorrelation(10, 10, 0.05)).toBe(1);
    expect(space3DCqcCorrelation(10, 9, 0)).toBe(0);
  });

  it('gives V = M·A and u = A/ω² for a one-storey rigid diaphragm with a flat spectrum', () => {
    const result = analyzeSpace3DResponseSpectrum(building(1), 'EX');
    expect(result.success).toBe(true);
    const A = 0.5 * SPACE3D_GRAVITY;
    expect(result.baseShear).toBeCloseTo(4 * m * A, 6);
    const omega2 = (3 * E * I / h ** 3) / m;
    const roof = result.analysis!.nodeResults.find((node) => node.nodeId === 'N1-2')!;
    expect(Math.abs(roof.displacement.ux)).toBeCloseTo(A / omega2, 10);
    // Los dos modos repetidos X/Z se mezclan; Z sólo guarda ruido de redondeo.
    expect(Math.abs(roof.displacement.uz)).toBeLessThan(1e-8 * Math.abs(roof.displacement.ux));
    expect(result.cumulativeMassRatio).toBeCloseTo(1, 9);
    // Reacciones: el cortante basal repartido entre cuatro columnas iguales.
    const reaction = result.analysis!.nodeResults.find((node) => node.nodeId === 'N0-0')!.reaction.ux;
    expect(Math.abs(reaction)).toBeCloseTo(m * A, 6);
  });

  it('combines storey drifts mode by mode and closes the base storey shear on the base shear', () => {
    const project = building(4, {}, [[0, 0.3], [0.2, 0.8], [0.6, 0.8], [3, 0.16]]);
    const result = analyzeSpace3DResponseSpectrum(project, 'EX');
    expect(result.success).toBe(true);
    expect(result.stories).toHaveLength(4);
    const bottom = result.stories[result.stories.length - 1];
    expect(Math.abs(bottom.shear[0])).toBeCloseTo(result.baseShear, 6);
    expect(result.stories.every((story) => story.drift[0] !== null && Math.abs(story.drift[0]) > 0)).toBe(true);
    expect(bottom.mass).toBeCloseTo(4 * m, 9);

    // SRSS a mano con los mismos modos: V = √Σ(Γ²·A)².
    const srss = analyzeSpace3DResponseSpectrum({ ...project, responseSpectrumCases: [{ ...project.responseSpectrumCases![0], combination: 'srss' }] }, 'EX');
    const modal = analyzeSpace3DModal(project, { modes: 12 });
    const manual = Math.sqrt(modal.modes.reduce((sum, mode) => {
      const A = space3DSpectrumAcceleration(project.spectrumFunctions![0], mode.period) * SPACE3D_GRAVITY;
      const effective = mode.participatingMassRatioX * (4 * 4 * m);
      return sum + (effective * A) ** 2;
    }, 0));
    expect(srss.baseShear / manual).toBeCloseTo(1, 9);
  });

  it('refuses a case without a spectrum instead of inventing one', () => {
    const project = building(1);
    const result = analyzeSpace3DResponseSpectrum({ ...project, responseSpectrumCases: [] }, 'EX');
    expect(result.success).toBe(false);
  });
});
