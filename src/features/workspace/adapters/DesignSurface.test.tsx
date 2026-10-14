// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDefaultProject } from '../../../data/defaultProject';
import { PROJECT_STORAGE_KEY } from '../../../data/projectStorage';
import { ProjectProvider } from '../../../store/ProjectContext';
import DesignSurface, { modelSelectionDestination } from './DesignSurface';
import { setToolIntent } from '../toolIntent';

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(createDefaultProject()));
});
afterEach(cleanup);

it('conserva el territorio 3D al ver origen aunque el snapshot no tenga eje', () => {
  expect(modelSelectionDestination(undefined, 'model3d')).toBe('model3d');
  expect(modelSelectionDestination('x:0', undefined)).toBe('model3d');
  expect(modelSelectionDestination(undefined, 'model2d')).toBe('model2d');
});

describe('DesignSurface: entrada al selector de arranques', () => {
  it('abre el selector de Home y cancelar no normaliza el origen previo del pórtico', async () => {
    const user = userEvent.setup();
    localStorage.setItem('fstructure.design-workbench.frame', JSON.stringify({ source: 'model', tag: 'Borrador' }));
    setToolIntent({ tool: 'design', kind: 'frame', picker: true });
    render(<ProjectProvider><DesignSurface /></ProjectProvider>);
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo diseño' });
    expect(dialog).toBeTruthy();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Nuevo diseño' })).toBeNull();
    expect(JSON.parse(localStorage.getItem('fstructure.design-workbench.frame')!).source).toBe('model');
  });

  it('en el proyecto los formularios propios se mandan al cálculo individual, aun con una intención vieja', async () => {
    setToolIntent({ tool: 'design', kind: 'frame', picker: true, category: 'exercise' });
    render(<ProjectProvider><DesignSurface /></ProjectProvider>);
    expect((await screen.findByRole('tab', { name: 'Proyecto' })).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Pieza' })).toBeTruthy();
    expect(screen.queryByRole('tab', { name: 'Ejercicio' })).toBeNull();
    expect(screen.getByText(/Calcular por separado/)).toBeTruthy();
  });

  it('la entrada desde un modelo y una barra abre directo a Estructura, sin selector', async () => {
    setToolIntent({ tool: 'design', kind: 'model', member: 'B-1' });
    render(<ProjectProvider><DesignSurface /></ProjectProvider>);
    expect(await screen.findByRole('heading', { name: 'Estructura' })).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: 'Nuevo diseño' })).toBeNull();
  });
});
