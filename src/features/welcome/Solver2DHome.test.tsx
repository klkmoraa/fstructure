// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
  it('renders a random quote notification toast with quotes and author, and allows dismiss/shuffle', () => {
    const { container } = render(
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

    // Toast element exists
    const toast = container.querySelector('.solver2d-quote-toast');
    expect(toast).toBeTruthy();

    const quoteText = container.querySelector('.solver2d-quote-toast__text');
    expect(quoteText).toBeTruthy();
    expect(quoteText?.textContent?.startsWith('“')).toBe(true);
    expect(quoteText?.textContent?.endsWith('”')).toBe(true);

    const quoteAuthor = container.querySelector('.solver2d-quote-toast__author');
    expect(quoteAuthor).toBeTruthy();
    expect(quoteAuthor?.textContent?.startsWith('— ')).toBe(true);

    const initialText = quoteText?.textContent;

    // Clicking toast changes the quote
    fireEvent.click(toast!);
    const newQuoteText = container.querySelector('.solver2d-quote-toast__text');
    expect(newQuoteText?.textContent).not.toBe(initialText);

    // Close button dismisses the toast
    const closeBtn = container.querySelector('.solver2d-quote-toast__close') as HTMLButtonElement;
    expect(closeBtn).toBeTruthy();
    fireEvent.click(closeBtn);

    const dismissedToast = container.querySelector('.solver2d-quote-toast');
    expect(dismissedToast).toBeNull();
  });

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

  it('renders correctly in English when language="en"', () => {
    const { container } = render(
      <Solver2DHome
        language="en"
        theme="light"
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

    expect(screen.getByText('Creator:')).toBeTruthy();
    expect(screen.getByText('Cristian Mora')).toBeTruthy();

    const toast = container.querySelector('.solver2d-quote-toast');
    expect(toast).toBeTruthy();
  });
});
