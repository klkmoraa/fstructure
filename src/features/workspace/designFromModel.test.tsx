// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createConcreteFrameProject } from '../../data/defaultProject';
import { PROJECT_STORAGE_KEY } from '../../data/projectStorage';
import { model2dDesignSource } from '../../design/elements/model2dSource';
import { ProjectProvider } from '../../store/ProjectContext';
import { DesignWorkbench } from '../design/workbench/DesignWorkbench';
import { reportFromMemoryItem } from '../design/workbench/designMemory';
import { DEFAULT_BAYS, DEFAULT_STORIES, FRAME_DEFAULTS, FRAME_LEGACY } from '../design/workbench/frameModel';

const project = createConcreteFrameProject();

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(project));
});
afterEach(cleanup);

const results = () => screen.getByRole('region', { name: 'Resultados' });

describe('modelar y diseñar: la mesa Estructura con el Modelo 2D', () => {
  it('al iniciar una receta consume el modelo y el miembro de entrada anterior', async () => {
    const user = userEvent.setup();
    const member = project.members.find((item) => item.type === 'frame')!;
    render(<ProjectProvider><DesignWorkbench nativeTool={false} startElement="frame" startSource="model" focusMember={member.id}
      modelSource={model2dDesignSource(project)} /></ProjectProvider>);
    const origin = () => screen.getByRole('radiogroup', { name: 'Origen de la estructura' });
    expect(within(origin()).getByRole('radio', { name: 'Modelo 2D' }).getAttribute('aria-checked')).toBe('true');
    await user.click(screen.getByRole('button', { name: 'Nuevo diseño' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo diseño' });
    await user.click(within(dialog).getByRole('button', { name: 'Iniciar diseño: Pórtico de vivienda · 1 nivel' }));
    expect(within(origin()).getByRole('radio', { name: 'Pórtico rápido' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('textbox', { name: 'Nivel 1 · F (kN)' })).toBeTruthy();
  });

  it('al abrir un pórtico de memoria consume el origen y miembro que traía la entrada', async () => {
    const user = userEvent.setup();
    const savedFrame = { ...FRAME_DEFAULTS, ...FRAME_LEGACY, source: 'frame', tag: 'Pórtico guardado' };
    localStorage.setItem('fstructure.design-workbench.memory', JSON.stringify([{
      id: 'quick-frame', element: 'frame', code: 'ntc-2023', savedAt: '2026-10-01T00:00:00.000Z',
      fields: savedFrame, rows: DEFAULT_BAYS.map((row) => ({ ...row })), levels: DEFAULT_STORIES.map((row) => ({ ...row })),
    }]));
    localStorage.setItem('fstructure.design-workbench.memory-active', JSON.stringify('quick-frame'));
    const member = project.members.find((item) => item.type === 'frame')!;
    render(<ProjectProvider><DesignWorkbench nativeTool={false} startElement="frame" startSource="model" focusMember={member.id}
      modelSource={model2dDesignSource(project)} /></ProjectProvider>);
    await user.click(await screen.findByRole('button', { name: 'Cambios sin guardar' }));
    const memory = await screen.findByRole('dialog', { name: 'Memoria del proyecto' });
    await user.click(within(memory).getByRole('button', { name: 'Abrir Pórtico guardado' }));
    await user.click(await screen.findByRole('button', { name: 'Abrir sin guardar' }));
    expect(within(screen.getByRole('radiogroup', { name: 'Origen de la estructura' })).getByRole('radio', { name: 'Pórtico rápido' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.queryByText(/La barra .* no está en/)).toBeNull();
  });

  it('diseña las barras del modelo sin pedir su geometría y vuelve al 2D', async () => {
    const user = userEvent.setup();
    const onOpenModel = vi.fn();
    // El acceso desde 2D debe ganar al elemento y origen sueltos guardados.
    localStorage.setItem('fstructure.design-workbench.element', JSON.stringify('beam'));
    localStorage.setItem('fstructure.design-workbench.frame', JSON.stringify({ source: 'frame' }));
    render(<ProjectProvider><DesignWorkbench nativeTool={false} startSource="model" modelSource={model2dDesignSource(project)} onOpenModel={onOpenModel} /></ProjectProvider>);
    expect(screen.getByRole('radio', { name: 'Modelo 2D' }).getAttribute('aria-checked')).toBe('true');
    // La geometría y las cargas son del modelo: el taller no las pide.
    expect(screen.queryByRole('textbox', { name: 'Claro 1 · L (m)' })).toBeNull();
    expect(screen.getByText(/f′c: 28.*MPa \(modelo\)/)).toBeTruthy();
    expect(await screen.findByRole('img', { name: /Utilización de el Modelo 2D: 2 líneas de viga y 6 columnas/ }, { timeout: 5000 })).toBeTruthy();
    const grid = within(results()).getByRole('table', { name: /Cociente que rige en cada miembro/ });
    await user.click(within(grid).getByRole('button', { name: /Viga del nivel 2/ }));
    expect(await screen.findByRole('img', { name: /Elevación de la viga de 2 claros/ })).toBeTruthy();
    await user.click(screen.getAllByRole('button', { name: 'Editar en Modelo' })[0]!);
    expect(onOpenModel).toHaveBeenCalledTimes(1);
  });

  it('la memoria vuelve a diseñar el modelo con la fuente que se le entrega', () => {
    const item = { id: 'm1', element: 'frame' as const, code: 'nsr-10' as const, savedAt: '2026-10-03', fields: { source: 'model', tag: 'M-1' }, rows: [], levels: [] };
    const withModel = reportFromMemoryItem(item, model2dDesignSource(project));
    if (!withModel.ok) throw new Error(withModel.errors.join('\n'));
    expect(withModel.report.title).toMatch(/^Modelo 2D «Pórtico de concreto»/);
    const withoutModel = reportFromMemoryItem(item);
    expect(withoutModel.ok).toBe(false);
  });
});
