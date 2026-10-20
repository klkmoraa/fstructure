// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyzeProject } from '../../engine/solver';
import { availableSolver2dCorpus, resolveCorpusProject } from '../../engine/solver2dCorpus';
import { ProjectProvider } from '../../store/ProjectContext';
import { elasticDemandView } from '../results/elasticDemand';
import { ElasticDemandLegend } from './ElasticDemandLegend';

afterEach(cleanup);

const fixture = () => {
  const project = resolveCorpusProject(availableSolver2dCorpus.find((item) => item.id === 'triangular-truss')!);
  project.members = project.members.map((member) => ({ ...member, materialOrigin: 'catalog', materialId: 'steel-a36' }));
  project.nodalLoads[0].fy = -6000;
  return { project, analysis: analyzeProject(project) };
};

describe('ElasticDemandLegend', () => {
  it('always gives the actual evaluated maximum and lets the user select it', () => {
    const { project, analysis } = fixture();
    const view = elasticDemandView(project, analysis);
    const onSelectMember = vi.fn();
    render(<ProjectProvider><ElasticDemandLegend view={view} selectedMemberId="AB" onSelectMember={onSelectMember} /></ProjectProvider>);
    const maximum = screen.getByTestId('canvas-demand-maximum');
    expect(maximum.textContent).toContain('1.50');
    expect(maximum.textContent).toContain('150.0');
    expect(screen.getByTestId('canvas-demand-selected').textContent).toContain('90.0');
    expect(screen.getByTestId('canvas-demand-coverage').textContent).toContain('3 de 3');
    fireEvent.click(maximum.querySelector('button')!);
    expect(onSelectMember).toHaveBeenCalledWith(view.status === 'available' ? view.highest.memberId : 'missing');
  });

  it('keeps an unavailable selected member distinct from a measured zero', () => {
    const { project, analysis } = fixture();
    project.members[0] = { ...project.members[0], materialOrigin: 'custom', materialId: undefined };
    render(<ProjectProvider><ElasticDemandLegend view={elasticDemandView(project, analysis)} selectedMemberId="AB" /></ProjectProvider>);
    const selected = screen.getByTestId('canvas-demand-selected');
    expect(selected.getAttribute('data-status')).toBe('unavailable');
    expect(selected.textContent).not.toContain('0.00');
    expect(screen.getByTestId('canvas-demand-coverage').textContent).toContain('2 de 3');
    expect(screen.getByText(/Falta Fy:/)).toBeTruthy();
  });

  it('does not publish a maximum for absent or unreliable analysis', () => {
    const { project, analysis } = fixture();
    const draw = (view: ReturnType<typeof elasticDemandView>) => <ProjectProvider><ElasticDemandLegend view={view} /></ProjectProvider>;
    const { rerender } = render(draw(elasticDemandView(project, null)));
    expect(screen.queryByTestId('canvas-demand-maximum')).toBeNull();
    expect(screen.getByTestId('canvas-demand-legend').getAttribute('data-status')).toBe('unavailable');
    rerender(draw(elasticDemandView(project, { ...analysis, reliability: { ...analysis.reliability!, level: 'unreliable' } })));
    expect(screen.queryByTestId('canvas-demand-maximum')).toBeNull();
    expect(screen.getByText(/análisis no es confiable/)).toBeTruthy();
  });

  it('marks limited confidence while keeping its governing cause available', () => {
    const { project, analysis } = fixture();
    const view = elasticDemandView(project, analysis);
    render(<ProjectProvider><ElasticDemandLegend view={{ ...view, confidence: 'limited', governingCheck: {
      id: 'condition', label: 'internal', message: 'internal', value: 1e9, limitedAbove: 1e8, unreliableAbove: 1e12, level: 'limited',
    } }} /></ProjectProvider>);
    expect(screen.getByTestId('canvas-demand-legend').getAttribute('data-confidence')).toBe('limited');
    expect(screen.getByTestId('canvas-demand-limited')).toBeTruthy();
    expect(screen.getByText(/Check gobernante:/)).toBeTruthy();
  });
});
