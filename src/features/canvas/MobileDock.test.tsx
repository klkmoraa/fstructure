// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultProject } from '../../data/defaultProject';
import { PROJECT_STORAGE_KEY } from '../../data/projectStorage';
import { ProjectProvider, useProject } from '../../store/ProjectContext';
import { emitWorkspaceCommand } from '../workspace/workspaceCommands';
import { MobileDock } from './MobileDock';

const Probe = () => {
  const { activeTool, project, setSelection } = useProject();
  return <>
    <output aria-label="herramienta activa">{activeTool}</output>
    <output aria-label="NL1 fy">{project.nodalLoads.find((load) => load.id === 'NL1')?.fy}</output>
    <button type="button" onClick={() => setSelection({ kind: 'nodalLoad', id: 'NL1' })}>elegir NL1</button>
  </>;
};

const montar = (onOpenInspector = vi.fn()) => {
  render(<ProjectProvider><MobileDock inspectorOpen={false} onOpenInspector={onOpenInspector} /><Probe /></ProjectProvider>);
  return { onOpenInspector };
};

beforeAll(() => {
  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 0);
    window.cancelAnimationFrame = (handle: number) => window.clearTimeout(handle);
  }
});
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(createDefaultProject()));
});
afterEach(cleanup);

describe('dock dinámico', () => {
  it('la cápsula aparece con la herramienta y Terminar vuelve a Seleccionar', async () => {
    const user = userEvent.setup();
    montar();
    expect(screen.queryByRole('toolbar', { name: /opciones/i })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Nodo' }));
    const capsule = screen.getByRole('toolbar', { name: 'Opciones de Nodo' });
    await user.click(within(capsule).getByRole('button', { name: 'Terminar' }));

    expect(screen.getByLabelText('herramienta activa').textContent).toBe('select');
    expect(screen.queryByRole('toolbar', { name: /opciones/i })).toBeNull();
  });

  it('Carga recuerda el último tipo elegido en su cápsula', async () => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole('button', { name: 'Herramientas de carga' }));
    await user.click(screen.getByRole('button', { name: 'Carga distribuida' }));
    await user.click(screen.getByRole('button', { name: 'Seleccionar' }));
    await user.click(screen.getByRole('button', { name: 'Herramientas de carga' }));
    expect(screen.getByLabelText('herramienta activa').textContent).toBe('distributedLoad');
  });

  it('Más herramientas abre la hoja sin la paleta de comandos y elige Desplazar', async () => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole('button', { name: 'Más herramientas' }));
    expect(screen.queryByRole('button', { name: 'Abrir la paleta de comandos' })).toBeNull();
    await user.click(screen.getByRole('menuitemradio', { name: /Desplazar/ }));
    expect(screen.getByLabelText('herramienta activa').textContent).toBe('pan');
    expect(screen.queryByRole('dialog', { name: 'Más herramientas' })).toBeNull();
  });

  it('el valor de una carga se escribe con el teclado del teléfono y conserva su sentido', async () => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole('button', { name: 'elegir NL1' }));
    await user.click(screen.getByRole('button', { name: 'Valor de NL1' }));
    const campo = screen.getByRole('textbox', { name: 'Valor de NL1' }) as HTMLInputElement;
    // El campo es del sistema: teclado completo, no sólo cifras.
    expect(campo.readOnly).toBe(false);
    expect(campo.getAttribute('inputmode')).toBe('text');
    expect(document.activeElement).toBe(campo);
    await user.type(campo, '35 kN{Enter}');
    // 20 kN hacia abajo → 35 kN hacia abajo.
    expect(screen.getByLabelText('NL1 fy').textContent).toBe('-35');

    await user.click(screen.getByRole('button', { name: 'Valor de NL1' }));
    await user.click(screen.getByRole('button', { name: 'Invertir sentido' }));
    expect(screen.getByLabelText('NL1 fy').textContent).toBe('35');
  });

  it('al colocar una carga el lienzo abre su valor en el dock', async () => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole('button', { name: 'elegir NL1' }));
    act(() => emitWorkspaceCommand('edit-load-value', { id: 'NL1' }));
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Valor de NL1' }));
  });
});
