// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { PROJECT_STORAGE_KEY } from '../../data/projectStorage';
import { analyzeProject } from '../../engine/solver';
import { availableSolver2dCorpus, resolveCorpusProject } from '../../engine/solver2dCorpus';
import { ProjectProvider, useProject } from '../../store/ProjectContext';
import { ResultsPanel } from './ResultsPanel';
import partialExample from '../../../public/examples/armadura-fijo-movil.fusionstructure.json';

beforeEach(() => {
  localStorage.clear();
  const project = resolveCorpusProject(availableSolver2dCorpus.find((item) => item.id === 'triangular-truss')!);
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(project));
});
afterEach(cleanup);

function AnalyzedTruss() {
  const { analyze, setSelection, setResultTab } = useProject();
  useEffect(() => { analyze(); setSelection({ kind: 'member', id: 'AB' }); setResultTab('axial'); }, [analyze, setSelection, setResultTab]);
  return <ResultsPanel status="active" defaultDesktopExpanded />;
}

it('muestra las fuerzas parciales sin habilitar una deformada ni presentar el análisis como estable', async () => {
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(partialExample));
  render(<ProjectProvider><div className="app-shell"><AnalyzedTruss /></div></ProjectProvider>);
  expect(await screen.findByRole('heading', { name: 'Equilibrio de fuerzas · Experimental' })).not.toBeNull();
  expect(screen.getByText('-1.000')).not.toBeNull();
  expect(screen.getByText('1.000')).not.toBeNull();
  expect(screen.queryByText('No se generaron resultados')).toBeNull();
  fireEvent.click(screen.getByRole('tab', { name: 'Deformada' }));
  expect(screen.getByRole('region', { name: 'Sólo equilibrio de fuerzas' })).not.toBeNull();
  expect(screen.queryByRole('img')).toBeNull();
});

it('conserva el diagrama N individual y el cursor al seleccionar una barra desde la tabla global', async () => {
  const { container } = render(<ProjectProvider><div className="app-shell"><AnalyzedTruss /></div></ProjectProvider>);
  const diagram = await screen.findByRole('img', { name: /axial.*AB/i }, { timeout: 5000 });
  expect(diagram.querySelector('.chart-line')?.getAttribute('d')).toContain('C');
  expect(container.querySelectorAll('.diagram-focus-cards .result-extreme-card')).toHaveLength(1);
  fireEvent.keyDown(diagram, { key: 'End' });
  expect(container.querySelector('.chart-hover.pinned')).not.toBeNull();
  expect(container.querySelector('.diagram-cursor-readout')?.textContent).toContain('22.500');
  const details = container.querySelector('details.truss-axial-summary')!;
  expect(details.hasAttribute('open')).toBe(false);
  fireEvent.click(details.querySelector('summary')!);
  fireEvent.click(screen.getByRole('button', { name: 'AC' }));
  expect(await screen.findByRole('img', { name: /axial.*AC/i })).not.toBeNull();
  expect(container.querySelector('.chart-hover.pinned')).toBeNull();
});

it('conserva el signo de N variable en extremos, puntos, cursor y saltos', async () => {
  const project = resolveCorpusProject(availableSolver2dCorpus.find((item) => item.id === 'cantilever-point')!);
  project.nodalLoads = [{ id: 'end', nodeId: 'B', caseId: 'LC1', fx: -10, fy: 0, mz: 0 }];
  project.memberLoads = [
    { id: 'axial-distributed', memberId: 'AB', caseId: 'LC1', type: 'distributed', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, qxStart: 10, qxEnd: 10, qyStart: 0, qyEnd: 0 },
    { id: 'axial-point', memberId: 'AB', caseId: 'LC1', type: 'point', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, position: .5, px: -10, py: 0 },
  ];
  const result = analyzeProject(project).memberResults[0];
  expect(result.minAxial).toBeCloseTo(-10, 8);
  expect(result.maxAxial).toBeCloseTo(20, 8);
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(project));
  const { container } = render(<ProjectProvider><div className="app-shell"><AnalyzedTruss /></div></ProjectProvider>);
  const diagram = await screen.findByRole('img', { name: /axial.*AB/i }, { timeout: 5000 });
  const cards = container.querySelectorAll('.diagram-focus-cards .result-extreme-card');
  expect(cards).toHaveLength(2);
  expect((cards[0].parentElement as HTMLElement).style.getPropertyValue('--axial')).toBe('var(--sc-color-axial-tension)');
  expect((cards[1].parentElement as HTMLElement).style.getPropertyValue('--axial')).toBe('var(--sc-color-axial-compression)');
  const zero = diagram.querySelector<SVGGElement>('.chart-critical.zero')!;
  expect(zero.style.color).toBe('var(--muted)');
  const negative = [...diagram.querySelectorAll<SVGGElement>('.chart-critical')].find((point) => Number(point.querySelector('circle')?.getAttribute('cy')) > 100)!;
  expect(negative.style.color).toBe('var(--sc-color-axial-compression)');
  expect(diagram.querySelector('[data-axial-state="compression"] .chart-jump')).not.toBeNull();
  expect(diagram.querySelectorAll('.chart-jump')).toHaveLength(2);
  fireEvent.keyDown(diagram, { key: 'End' });
  expect(diagram.querySelector<SVGCircleElement>('.chart-hover circle')!.style.fill).toBe('var(--sc-color-axial-compression)');
  expect(container.querySelector<HTMLElement>('.diagram-cursor-readout .axial-text')!.style.getPropertyValue('--axial')).toBe('var(--sc-color-axial-compression)');
  for (let step = 0; step < 5; step += 1) fireEvent.keyDown(diagram, { key: 'ArrowLeft', shiftKey: true });
  expect(diagram.querySelector<SVGCircleElement>('.chart-hover circle')!.style.fill).toBe('var(--muted)');
  fireEvent.keyDown(diagram, { key: 'Home' });
  expect(diagram.querySelector<SVGCircleElement>('.chart-hover circle')!.style.fill).toBe('var(--sc-color-axial-tension)');
});

it('mantiene neutro un diagrama axial íntegramente nulo', async () => {
  const project = resolveCorpusProject(availableSolver2dCorpus.find((item) => item.id === 'cantilever-point')!);
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(project));
  const { container } = render(<ProjectProvider><div className="app-shell"><AnalyzedTruss /></div></ProjectProvider>);
  const diagram = await screen.findByRole('img', { name: /axial.*AB/i }, { timeout: 5000 });
  expect(diagram.querySelector('[data-axial-state]')).toBeNull();
  expect(container.querySelector<HTMLElement>('.diagram-result-layout')!.style.getPropertyValue('--axial')).toBe('var(--muted)');
  fireEvent.keyDown(diagram, { key: 'End' });
  expect(diagram.querySelector<SVGCircleElement>('.chart-hover circle')!.style.fill).toBe('var(--muted)');
});
