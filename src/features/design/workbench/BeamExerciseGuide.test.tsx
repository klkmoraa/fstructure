// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BeamExerciseGuide } from './BeamExerciseGuide';
import { BEAM_DEFAULTS, type SpanDraft } from './beamModel';
import { evaluateBeamExercise } from './beamExercises';
import { DESIGN_STARTS } from './designStarts';

afterEach(cleanup);

const evaluation = (id: string, rows?: SpanDraft[]) => {
  const start = DESIGN_STARTS.find((item) => item.id === id)!;
  return evaluateBeamExercise('ntc-2023', { ...BEAM_DEFAULTS, ...start.fields }, rows ?? (start.rows as SpanDraft[] | undefined) ?? []);
};

describe('BeamExerciseGuide', () => {
  it('hides unknown and empty exercise identifiers', () => {
    const { container } = render(<BeamExerciseGuide evaluation={null} onDismiss={() => undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows the original case, current solver comparison and dismissal action', () => {
    const onDismiss = vi.fn();
    render(<BeamExerciseGuide evaluation={evaluation('exercise-beam-simple')} onDismiss={onDismiss} />);
    expect(screen.getByRole('heading', { name: 'Viga simplemente apoyada' })).toBeTruthy();
    expect(screen.getByText(/Carga muerta uniforme de 10 kN\/m/)).toBeTruthy();
    expect(screen.getAllByText('31.25 kN·m')).toHaveLength(2);
    expect(screen.getByText('Solver de servicio')).toBeTruthy();
    screen.getByRole('button', { name: 'Ocultar guía' }).click();
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('explains suspended hypotheses and does not show stale numeric comparisons', () => {
    render(<BeamExerciseGuide evaluation={evaluation('exercise-beam-simple', [{ length: '6', dead: '12', live: '0', pointDead: '0', pointLive: '0', pointAt: '3' }, { length: '4', dead: '0', live: '0', pointDead: '0', pointLive: '0', pointAt: '2' }])} onDismiss={() => undefined} />);
    expect(screen.getByRole('status').textContent).toContain('exactamente un claro');
    expect(screen.queryByText('31.25 kN·m')).toBeNull();
    expect(screen.queryByText('Solver de servicio')).toBeNull();
  });

  it('keeps the guide visible when numbers are incomplete without rendering zero', () => {
    const result = evaluateBeamExercise('ntc-2023', { ...BEAM_DEFAULTS, ...DESIGN_STARTS.find((item) => item.id === 'exercise-beam-simple')!.fields }, [{ length: '', dead: '10', live: '0', pointDead: '0', pointLive: '0', pointAt: '2.5' }]);
    render(<BeamExerciseGuide evaluation={result} onDismiss={() => undefined} />);
    expect(screen.getByRole('heading', { name: 'Viga simplemente apoyada' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('Datos incompletos');
    expect(screen.queryByText(/kN·m/)).toBeNull();
  });
});
