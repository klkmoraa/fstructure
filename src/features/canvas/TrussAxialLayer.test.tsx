// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { availableSolver2dCorpus, resolveCorpusProject } from '../../engine/solver2dCorpus';
import { analyzeProject } from '../../engine/solver';
import { trussAxialReadings } from '../results/trussAxial';
import { TrussAxialLayer, TrussAxialTable } from './TrussAxialPresentation';

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
