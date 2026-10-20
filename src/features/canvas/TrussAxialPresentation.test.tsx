// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { availableSolver2dCorpus, resolveCorpusProject } from '../../engine/solver2dCorpus';
import { analyzeProject } from '../../engine/solver';
import { trussAxialReadings } from '../results/trussAxial';
import { AxialDiagramSigns, TrussAxialLayer, TrussAxialTable } from './TrussAxialPresentation';

it('muestra estados y valores convertidos sin interceptar la selección del lienzo', () => {
  const project = resolveCorpusProject(availableSolver2dCorpus.find((item) => item.id === 'triangular-truss')!);
  project.settings.units = 'N-mm';
  const readings = trussAxialReadings(project, analyzeProject(project));
  const { container } = render(<svg><TrussAxialLayer project={project} readings={readings} toScreen={(x, y) => ({ x: x * 50, y: -y * 50 })} language="es" showValues /></svg>);
  expect(container.querySelectorAll('[data-truss-state]')).toHaveLength(3);
  expect(container.querySelector('[data-truss-state="tension"] title')?.textContent).toContain('22500');
  expect(container.querySelector('[data-truss-state="compression"] title')?.textContent).toContain('-37500');
  expect(container.querySelector('.truss-axial-layer')?.getAttribute('pointer-events')).toBe('none');
  expect(container.querySelectorAll('text')).toHaveLength(3);
});

it('permite seleccionar e inspeccionar una barra desde su lectura axial', () => {
  const project = resolveCorpusProject(availableSolver2dCorpus.find((item) => item.id === 'triangular-truss')!);
  const readings = trussAxialReadings(project, analyzeProject(project));
  const select = vi.fn();
  const { rerender } = render(<TrussAxialTable project={project} readings={readings} language="es" onSelect={select} selectedMemberId="AB" />);
  fireEvent.click(screen.getByRole('button', { name: /AC/ }));
  expect(select).toHaveBeenCalledWith('AC');
  rerender(<TrussAxialTable project={project} readings={new Map()} language="es" onSelect={select} selectedMemberId="AB" />);
  expect(screen.queryByRole('table')).toBeNull();
});

it('reserva valores para la barra seleccionada cuando el modelo está alejado', () => {
  const project = resolveCorpusProject(availableSolver2dCorpus.find((item) => item.id === 'triangular-truss')!);
  const readings = trussAxialReadings(project, analyzeProject(project));
  const { container } = render(<svg><TrussAxialLayer project={project} readings={readings} toScreen={(x, y) => ({ x: x * 10, y: -y * 10 })} language="es" showValues selectedMemberId="AC" /></svg>);
  expect(container.querySelectorAll('text')).toHaveLength(1);
  expect(container.querySelector('[data-member-id="AC"] text')).not.toBeNull();
});


it('separa la curva axial por su cero sin cambiar su geometría al invertir el lado', () => {
  const curve = <path d="M 0 -20 C 30 -10 60 10 100 20" />;
  const { container, rerender } = render(<svg><AxialDiagramSigns baselineStart={{ x: 0, y: 0 }} baselineEnd={{ x: 100, y: 0 }} positivePoint={{ x: 0, y: -1 }} extent={200}>{curve}</AxialDiagramSigns></svg>);
  const polygon = (state: string) => {
    const group = container.querySelector(`[data-axial-state="${state}"]`)!;
    const id = group.getAttribute('clip-path')!.slice(5, -1);
    return [...container.querySelectorAll('clipPath')].find((clip) => clip.id === id)!.querySelector('polygon')!.getAttribute('points')!;
  };
  expect(container.querySelectorAll('[data-axial-state] path')).toHaveLength(2);
  expect(polygon('tension')).toBe('-200,0 300,0 300,-200 -200,-200');
  expect(polygon('compression')).toBe('-200,0 300,0 300,200 -200,200');
  rerender(<svg><AxialDiagramSigns baselineStart={{ x: 0, y: 0 }} baselineEnd={{ x: 100, y: 0 }} positivePoint={{ x: 0, y: 1 }} extent={200}>{curve}</AxialDiagramSigns></svg>);
  expect(polygon('tension')).toBe('-200,0 300,0 300,200 -200,200');
  expect([...container.querySelectorAll('[data-axial-state] path')].every((path) => path.getAttribute('d') === 'M 0 -20 C 30 -10 60 10 100 20')).toBe(true);
});
