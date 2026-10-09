// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDefaultProject } from '../../../data/defaultProject';
import { PROJECT_STORAGE_KEY } from '../../../data/projectStorage';
import { ProjectProvider } from '../../../store/ProjectContext';
import DesignSurface from './DesignSurface';
import { setToolIntent } from '../toolIntent';

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(createDefaultProject()));
});
afterEach(cleanup);

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

  it('la entrada desde un modelo y una barra abre directo a Estructura, sin selector', async () => {
    setToolIntent({ tool: 'design', kind: 'model', member: 'B-1' });
    render(<ProjectProvider><DesignSurface /></ProjectProvider>);
    expect(await screen.findByRole('heading', { name: 'Estructura' })).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: 'Nuevo diseño' })).toBeNull();
  });
});
