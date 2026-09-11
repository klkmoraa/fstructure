// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
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
  it('renders a single quote notification toast per reload and allows dismiss', () => {
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

    // Toast element exists in document.body via createPortal
    const toast = document.body.querySelector('.solver2d-quote-toast');
    expect(toast).toBeTruthy();

    const quoteText = document.body.querySelector('.solver2d-quote-toast__text');
    expect(quoteText).toBeTruthy();
    expect(quoteText?.textContent?.startsWith('“')).toBe(true);
    expect(quoteText?.textContent?.endsWith('”')).toBe(true);

    const quoteAuthor = document.body.querySelector('.solver2d-quote-toast__author');
    expect(quoteAuthor).toBeTruthy();
    expect(quoteAuthor?.textContent?.startsWith('— ')).toBe(true);

    const initialText = quoteText?.textContent;

    // Clicking toast does NOT change the quote (fixed per page reload)
    fireEvent.click(toast!);
    const currentQuoteText = document.body.querySelector('.solver2d-quote-toast__text');
    expect(currentQuoteText?.textContent).toBe(initialText);

    // Close button dismisses the toast
    const closeBtn = document.body.querySelector('.solver2d-quote-toast__close') as HTMLButtonElement;
    expect(closeBtn).toBeTruthy();
    fireEvent.click(closeBtn);

    const dismissedToast = document.body.querySelector('.solver2d-quote-toast');
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
    render(
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

    const toast = document.body.querySelector('.solver2d-quote-toast');
    expect(toast).toBeTruthy();
  });

  it('automatically dismisses the quote toast after 7000ms without pausing', () => {
    vi.useFakeTimers();
    try {
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

      const toast = document.body.querySelector('.solver2d-quote-toast');
      expect(toast).toBeTruthy();

      // Mouse enter/leave does NOT pause or reset the timer
      fireEvent.mouseEnter(toast!);
      act(() => {
        vi.advanceTimersByTime(3500);
      });
      fireEvent.mouseLeave(toast!);
      act(() => {
        vi.advanceTimersByTime(3500);
        vi.runAllTimers();
      });

      expect(document.body.querySelector('.solver2d-quote-toast')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
