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

describe('Solver2DHome component', () => {
  it('renders the creator credit at the bottom crediting Cristian Mora', () => {
    render(
      <Solver2DHome
        language="es"
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

    // Creator label and name
    expect(screen.getByText('Creador:')).toBeTruthy();
    expect(screen.getByText('Cristian Mora')).toBeTruthy();

    // Link to GitHub
    const githubLink = screen.getByRole('link', { name: /github\.com\/klkmoraa\/fstructure/i });
    expect(githubLink).toBeTruthy();
    expect(githubLink.getAttribute('href')).toBe('https://github.com/klkmoraa/fstructure');
    expect(githubLink.getAttribute('target')).toBe('_blank');
  });

  it('renders the creator and repository link in English', () => {
    render(<Solver2DHome language="en" theme="light" project={dummyProject}
      onContinue={vi.fn()} onCreateBlank={vi.fn()} onOpenTemplates={vi.fn()}
      onOpenClassroom={vi.fn()} onOpenImport={vi.fn()} onOpenProjects={vi.fn()}
      recents={<div>Recents</div>} />);
    expect(screen.getByText('Creator:')).toBeTruthy();
    expect(screen.getByRole('link', { name: /github\.com\/klkmoraa\/fstructure/i }).getAttribute('href')).toBe('https://github.com/klkmoraa/fstructure');
  });
});
