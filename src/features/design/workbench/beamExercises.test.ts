import { describe, expect, it } from 'vitest';
import { BEAM_DEFAULTS, type SpanDraft } from './beamModel';
import { evaluateBeamExercise } from './beamExercises';

const legacyExercise = (id: string) => {
  if (id === 'exercise-beam-simple') return {
    fields: { exercise: id, leftEnd: 'pin', rightEnd: 'roller', selfWeight: 'no' },
    rows: [{ length: '5', dead: '10', live: '0', pointDead: '0', pointLive: '0', pointAt: '2.5' }],
  };
  if (id === 'exercise-beam-cantilever') return {
    fields: { exercise: id, leftEnd: 'fixed', rightEnd: 'free', selfWeight: 'no' },
    rows: [{ length: '2', dead: '5', live: '0', pointDead: '0', pointLive: '0', pointAt: '1' }],
  };
  return {
    fields: { exercise: id, leftEnd: 'pin', rightEnd: 'roller', selfWeight: 'no', points: 'yes' },
    rows: [{ length: '4', dead: '0', live: '0', pointDead: '10', pointLive: '0', pointAt: '2' }],
  };
};
const evaluate = (id: string, fields: Record<string, string> = {}, rows?: SpanDraft[]) => {
  const recipe = legacyExercise(id);
  const result = evaluateBeamExercise('ntc-2023', { ...BEAM_DEFAULTS, ...recipe.fields, ...fields }, rows ?? recipe.rows);
  if (!result) throw new Error(`Missing exercise evaluation for ${id}`);
  return result;
};

describe('referencias de ejercicios de viga', () => {
  it.each([
    ['exercise-beam-simple', 31.25],
    ['exercise-beam-cantilever', 10],
    ['exercise-beam-point', 10],
  ])('compara %s con el valor de servicio', (id, expected) => {
    const result = evaluate(id);
    expect(result.status).toBe('comparable');
    if (result.status === 'comparable') {
      expect(result.expectedKnm).toBeCloseTo(expected, 6);
      expect(result.solverKnm).toBeCloseTo(expected, 6);
      expect(result.differenceKnm).toBeCloseTo(0, 6);
    }
  });

  it('actualiza la fórmula y el solver al editar L y q', () => {
    const result = evaluate('exercise-beam-simple', {}, [{ length: '6', dead: '12', live: '0', pointDead: '0', pointLive: '0', pointAt: '3' }]);
    expect(result.status).toBe('comparable');
    if (result.status === 'comparable') {
      expect(result.expectedKnm).toBeCloseTo(54, 6);
      expect(result.solverKnm).toBeCloseTo(54, 6);
    }
  });

  it('usa propiedades brutas físicas de secciones T/L al resolver la guía', () => {
    const result = evaluate('exercise-beam-simple', { sectionType: 'T', width: '25', height: '50', flangeWidth: '100', flangeThickness: '12' });
    expect(result.status).toBe('comparable');
    if (result.status === 'comparable') {
      expect(result.expectedKnm).toBeCloseTo(31.25, 6);
      expect(result.solverKnm).toBeCloseTo(31.25, 6);
    }
  });

  it('suma CM y CV por estación antes de buscar el pico de servicio', () => {
    const uniform = evaluate('exercise-beam-simple', {}, [{ length: '5', dead: '2', live: '3', pointDead: '0', pointLive: '0', pointAt: '2.5' }]);
    const point = evaluate('exercise-beam-point', {}, [{ length: '4', dead: '0', live: '0', pointDead: '4', pointLive: '6', pointAt: '2' }]);
    expect(uniform.status).toBe('comparable');
    expect(point.status).toBe('comparable');
    if (uniform.status === 'comparable') expect(uniform.solverKnm).toBeCloseTo(15.625, 6);
    if (point.status === 'comparable') expect(point.solverKnm).toBeCloseTo(10, 6);
  });

  it.each(['', 'exercise-beam-other', 'constructor', 'toString', '__proto__', 'hasOwnProperty'])('no produce guía para el id desconocido %s', (exercise) => {
    expect(evaluateBeamExercise('ntc-2023', { ...BEAM_DEFAULTS, exercise }, [])).toBeNull();
  });

  it.each([
    ['dos claros', 'exercise-beam-simple', {}, [{ length: '5', dead: '10', live: '0', pointDead: '0', pointLive: '0', pointAt: '2.5' }, { length: '5', dead: '10', live: '0', pointDead: '0', pointLive: '0', pointAt: '2.5' }]],
    ['peso propio', 'exercise-beam-simple', { selfWeight: 'yes' }, undefined],
    ['apoyos incompatibles', 'exercise-beam-simple', { leftEnd: 'fixed' }, undefined],
    ['puntual fuera del centro', 'exercise-beam-point', {}, [{ length: '4', dead: '0', live: '0', pointDead: '10', pointLive: '0', pointAt: '1' }]],
    ['carga uniforme adicional', 'exercise-beam-point', {}, [{ length: '4', dead: '1', live: '0', pointDead: '10', pointLive: '0', pointAt: '2' }]],
  ])('suspende comparación sin números obsoletos por %s', (_why, id, fields, rows) => {
    const result = evaluate(id, fields, rows);
    expect(result.status).toBe('changed');
    expect(result).not.toHaveProperty('expectedKnm');
    expect(result).not.toHaveProperty('solverKnm');
    expect(result).not.toHaveProperty('differenceKnm');
  });

  it('trata un valor vacío como dato incompleto, nunca como cero', () => {
    const result = evaluate('exercise-beam-simple', {}, [{ length: '', dead: '10', live: '0', pointDead: '0', pointLive: '0', pointAt: '2.5' }]);
    expect(result.status).toBe('invalid');
    expect(result).not.toHaveProperty('solverKnm');
  });
});
