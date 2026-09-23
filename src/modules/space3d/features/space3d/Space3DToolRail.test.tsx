// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { translate, type Language } from '../../i18n/catalogs';
import { Space3DConsoleTools } from './Space3DToolRail';

afterEach(cleanup);

const renderRail = (language: Language) => render(
  <Space3DConsoleTools
    t={(key, vars) => translate(language, key, vars)}
    activeTool="select"
    onSelectTool={vi.fn()}
    onNewNode={vi.fn()}
    onNewMember={vi.fn()}
    onNewLoad={vi.fn()}
    onEditSupport={vi.fn()}
    onOpenGenerative={vi.fn()}
    canNewMember
    canNewLoad
    canEditSupport
    canShowResults={false}
    onShowResults={vi.fn()}
    onMore={vi.fn()}
    moreOpen={false}
  />,
);

/**
 * WCAG 2.5.3 (Label in Name): quien usa control por voz dice lo que ve. Si el
 * botón muestra "Generar 3D" pero se llama "Generador de estructuras 3D", la
 * orden no lo encuentra. El texto visible debe estar dentro del nombre.
 */
describe('Space3D rail · generador 3D', () => {
  it('keeps the visible label inside the accessible name', () => {
    renderRail('es');
    const button = document.querySelector('.space3d-rail-button--generative') as HTMLButtonElement;
    expect(button).not.toBeNull();

    const visible = button.querySelector('span')?.textContent?.trim() ?? '';
    const name = button.getAttribute('aria-label') ?? '';
    expect(visible).toBe('Generar 3D');
    expect(name.toLowerCase()).toContain(visible.toLowerCase());

    // Y se puede localizar por lo que se ve, como haría el control por voz.
    expect(screen.getByRole('button', { name: /generar 3d/i })).toBe(button);
  });

  it('keeps the longer wording as a description, not as the name', () => {
    renderRail('es');
    const button = screen.getByRole('button', { name: /generar 3d/i });
    expect(button.getAttribute('title')).toBe('Generador de estructuras 3D');
  });
});
