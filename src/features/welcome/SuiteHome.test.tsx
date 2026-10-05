// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDefaultProject } from '../../data/defaultProject';
import type { ProjectModel } from '../../types';
import { SuiteHome, type SuiteHomeProps } from './SuiteHome';

afterEach(cleanup);

const project: ProjectModel = { ...createDefaultProject(), name: 'Nave Norte' };

const renderHome = (props: Partial<SuiteHomeProps> = {}) => {
  const handlers = { onOpenTool: vi.fn(), onResume: vi.fn(), onLanguageChange: vi.fn(), onThemeChange: vi.fn() };
  render(<SuiteHome language="es" theme="dark" project={project} lastTool="space3d" {...handlers} {...props} />);
  return handlers;
};

describe('Inicio de FusionStructure', () => {
  it('presenta las cuatro herramientas con código, estado y apertura directa', () => {
    const { onOpenTool } = renderHome();
    const tools = screen.getByRole('navigation', { name: 'Herramientas' });
    const buttons = [...tools.querySelectorAll('button')];
    expect(buttons.map((button) => button.querySelector('strong')?.textContent)).toEqual(['FStructure', 'Solver 3D', 'Elementos finitos', 'Diseño']);
    expect(buttons.map((button) => button.querySelector('.fs-tool__code')?.textContent)).toEqual(['FS-A01', 'FS-A02', 'FS-A03', 'FS-A04']);
    fireEvent.click(screen.getByRole('button', { name: /Abrir Elementos finitos/ }));
    expect(onOpenTool).toHaveBeenCalledWith('fem');
  });

  it('no tiene la barra de navegación del 2D: sólo marca, idioma y tema', () => {
    renderHome();
    expect(screen.queryByRole('search')).toBeNull();
    expect(screen.queryByRole('navigation', { name: /Navegación de FStructure/ })).toBeNull();
    expect(screen.getByRole('group', { name: 'Idioma' })).toBeTruthy();
  });

  it('el escenario muestra el pórtico y cambia a la escena de la herramienta al pasar por ella', () => {
    renderHome({ theme: 'light' });
    const stage = document.querySelector('.fs-suite__stage')!;
    expect(stage.getAttribute('data-preview')).toBe('portal');
    expect(stage.querySelector('img.is-shown')?.getAttribute('src')).toBe('./assets/suite/portal-day.png');
    fireEvent.mouseEnter(screen.getByRole('button', { name: /Abrir Solver 3D/ }));
    expect(stage.getAttribute('data-preview')).toBe('space3d');
    expect(stage.querySelector('img.is-shown')?.getAttribute('src')).toBe('./assets/suite/space3d-day.png');
    fireEvent.mouseLeave(screen.getByRole('navigation', { name: 'Herramientas' }));
    expect(stage.getAttribute('data-preview')).toBe('portal');
  });

  it('continúa el proyecto abierto directamente en la mesa de la última herramienta', () => {
    const { onOpenTool, onResume } = renderHome();
    fireEvent.click(screen.getByRole('button', { name: /Continuar\s*Nave Norte\s*en Solver 3D/ }));
    expect(onResume).toHaveBeenCalledWith('space3d');
    expect(onOpenTool).not.toHaveBeenCalled();
  });

  it('acredita a Cristian Mora y enlaza el repositorio', () => {
    renderHome({ language: 'en' });
    expect(screen.getByText(/Cristian Mora/)).toBeTruthy();
    expect(screen.getByRole('link', { name: /GitHub/ }).getAttribute('href')).toBe('https://github.com/klkmoraa/fstructure');
  });
});
