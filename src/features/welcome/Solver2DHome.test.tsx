// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDefaultProject } from '../../data/defaultProject';
import type { ProjectModel } from '../../types';
import { Solver2DHome } from './Solver2DHome';

vi.mock('../structural-assets', () => ({
  ThreeStructuralImage: () => <div data-testid="structural-image" />,
}));

afterEach(cleanup);

const dummyProject: ProjectModel = {
  ...createDefaultProject(),
  name: 'Prueba Pórtico',
};

const renderHome = (language: 'es' | 'en') => render(
  <Solver2DHome
    language={language}
    theme="dark"
    project={dummyProject}
    onContinue={vi.fn()}
    onCreateBlank={vi.fn()}
    onOpenTemplates={vi.fn()}
    onOpenClassroom={vi.fn()}
    onOpenImport={vi.fn()}
    onOpenProjects={vi.fn()}
    recents={<div data-testid="recents-slot">Recientes</div>}
  />,
);

describe('Solver2DHome component', () => {
  it('conserva una cita legible dentro del contenido, sin aviso flotante', () => {
    renderHome('es');
    const quote = document.querySelector('.solver2d-quote-inline');
    expect(quote?.textContent).toMatch(/^“.+” — .+/);
    expect(quote?.querySelector('cite')?.textContent).toMatch(/^— /);
    expect(document.querySelector('.solver2d-quote-toast')).toBeNull();
  });

  it('acredita a Cristian Mora y enlaza el repositorio', () => {
    renderHome('es');
    expect(screen.getByText('Creador:')).toBeTruthy();
    expect(screen.getByText('Cristian Mora')).toBeTruthy();
    const githubLink = screen.getByRole('link', { name: /github\.com\/klkmoraa\/fstructure/i });
    expect(githubLink.getAttribute('href')).toBe('https://github.com/klkmoraa/fstructure');
    expect(githubLink.getAttribute('target')).toBe('_blank');
  });

  it('presenta el contenido en inglés cuando cambia el idioma', () => {
    renderHome('en');
    expect(screen.getByRole('heading', { level: 1, name: 'From line to diagram.' })).toBeTruthy();
    expect(screen.getByText('Creator:')).toBeTruthy();
    expect(document.querySelector('.solver2d-quote-inline')?.textContent).toMatch(/^“.+” — .+/);
  });
});
