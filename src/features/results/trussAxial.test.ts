import { describe, expect, it } from 'vitest';
import { analyzeProject } from '../../engine/solver';
import { availableSolver2dCorpus, resolveCorpusProject } from '../../engine/solver2dCorpus';
import { trussAxialReadings } from './trussAxial';

const triangle = () => resolveCorpusProject(availableSolver2dCorpus.find((item) => item.id === 'triangular-truss')!);

describe('lectura axial de armaduras', () => {
  it('conserva el signo físico del triángulo 3–4–5 y cambia al invertir la carga', () => {
    const project = triangle();
    const result = analyzeProject(project);
    const original = JSON.stringify(result);
    const readings = trussAxialReadings(project, result);
    expect(readings.get('AB')?.state).toBe('tension');
    expect(readings.get('AB')?.axial).toBeCloseTo(22.5, 8);
    expect(readings.get('AC')?.state).toBe('compression');
    expect(readings.get('AC')?.axial).toBeCloseTo(-37.5, 8);
    expect(readings.get('BC')?.axial).toBeCloseTo(-37.5, 8);
    expect(JSON.stringify(result)).toBe(original);
    project.nodalLoads[0].fy *= -1;
    const reversed = trussAxialReadings(project, analyzeProject(project));
    expect(reversed.get('AB')?.state).toBe('compression');
    expect(reversed.get('AC')?.state).toBe('tension');
  });

  it('distingue cero real de ausencia de resultados, errores y resultados no fiables', () => {
    const project = triangle();
    project.nodalLoads = [];
    const zero = analyzeProject(project);
    expect([...trussAxialReadings(project, zero).values()].every((reading) => reading.state === 'zero')).toBe(true);
    expect(trussAxialReadings(project, zero).size).toBe(3);
    expect(trussAxialReadings(project, null).size).toBe(0);
    expect(trussAxialReadings(project, { ...zero, success: false }).size).toBe(0);
    expect(trussAxialReadings(project, { ...zero, reliability: { ...zero.reliability!, level: 'unreliable' } }).size).toBe(0);
    const invalid = { ...zero, memberResults: zero.memberResults.map((member) => ({ ...member, maxAxial: NaN })) };
    expect(trussAxialReadings(project, invalid).size).toBe(0);
  });

  it('excluye elementos de pórtico aunque tengan un estado axial ajeno', () => {
    const project = triangle();
    const analysis = analyzeProject(project);
    project.members[0].type = 'frame';
    expect(trussAxialReadings(project, analysis).has('AB')).toBe(false);
  });
});
