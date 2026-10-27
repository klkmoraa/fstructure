// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDefaultProject } from '../../data/defaultProject';
import { PROJECT_STORAGE_KEY } from '../../data/projectStorage';
import { ProjectProvider, useProject } from '../../store/ProjectContext';
import { MobileDock } from './MobileDock';

const Probe = () => {
  const { project, setSelection, undo, canUndo, updateProject, setActiveTool } = useProject();
  return <>
    <output aria-label="carga">{JSON.stringify(project.nodalLoads.find(l => l.id === 'NL1'))}</output>
    <output aria-label="historial">{String(canUndo)}</output>
    <button onClick={() => setSelection({ kind: 'nodalLoad', id: 'NL1' })}>Elegir carga</button>
    <button onClick={() => setSelection({ kind: 'node', id: 'N1' })}>Elegir nodo</button>
    <button onClick={() => setActiveTool('node')}>Otra herramienta</button>
    <button onClick={() => updateProject(p => { p.nodalLoads.find(l => l.id === 'NL1')!.fy = -45; return p; })}>Cambio externo</button>
    <button onClick={undo}>Deshacer prueba</button>
  </>;
};
const load = () => JSON.parse(screen.getByLabelText('carga').textContent!);
const setup = async () => {
  const user = userEvent.setup();
  render(<ProjectProvider><MobileDock inspectorOpen={false} onOpenInspector={() => {}} /><Probe /></ProjectProvider>);
  await user.click(screen.getByRole('button', { name: 'Elegir carga' }));
  await user.click(screen.getByRole('button', { name: 'Valor de NL1' }));
  return { user, input: screen.getByRole('textbox', { name: 'Valor de NL1' }) as HTMLInputElement };
};
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(createDefaultProject()));
});
afterEach(cleanup);

describe('edición de carga como borrador', () => {
  it('cambiar dirección y cancelar no modifica la carga ni el historial', async () => {
    const { user } = await setup(); const before = load();
    await user.click(screen.getByRole('button', { name: 'Hacia arriba' }));
    expect(load()).toEqual(before);
    await user.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(load()).toEqual(before);
    expect(screen.getByLabelText('historial').textContent).toBe('false');
  });
  it('no cierra ni pierde el texto si la magnitud es inválida', async () => {
    const { user, input } = await setup(); const before = load();
    await user.clear(input); await user.type(input, 'no es número{Enter}');
    expect(screen.queryByRole('textbox', { name: 'Valor de NL1' })).toBe(input);
    expect(input.value).toBe('no es número');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('alert').textContent).toMatch(/valor|número|magnitud/i);
    expect(load()).toEqual(before);
  });
  it('confirma magnitud y ángulo juntos; un solo Deshacer recupera ambos', async () => {
    const { user, input } = await setup(); const before = load();
    await user.clear(input); await user.type(input, '12,5 kN');
    const angle = screen.getByRole('textbox', { name: /Ángulo de la carga/ });
    await user.clear(angle); await user.type(angle, '30');
    await user.tab();
    expect(load()).toEqual(before);
    await user.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(load().fx).toBeCloseTo(12.5 * Math.cos(Math.PI / 6), 8);
    expect(load().fy).toBeCloseTo(6.25, 8);
    await user.click(screen.getByRole('button', { name: 'Deshacer prueba' }));
    expect(load()).toEqual(before);
    expect(screen.getByLabelText('historial').textContent).toBe('false');
  });
  it('ángulo inválido bloquea todo y conserva la magnitud escrita', async () => {
    const { user, input } = await setup(); const before = load();
    await user.clear(input); await user.type(input, '35');
    const angle = screen.getByRole('textbox', { name: /Ángulo de la carga/ }) as HTMLInputElement;
    await user.clear(angle); await user.type(angle, 'mal');
    await user.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(load()).toEqual(before);
    expect(angle.value).toBe('mal'); expect(input.value).toBe('35');
    expect(angle.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(angle);
  });
  it('Escape desde el ángulo descarta también la dirección pendiente', async () => {
    const { user } = await setup(); const before = load();
    await user.click(screen.getByRole('button', { name: 'Hacia arriba' }));
    const angle = screen.getByRole('textbox', { name: /Ángulo de la carga/ });
    await user.clear(angle); await user.type(angle, '25');
    fireEvent.keyDown(angle, { key: 'Escape' });
    expect(load()).toEqual(before);
    expect(screen.queryByRole('textbox', { name: 'Valor de NL1' })).toBeNull();
  });
  it.each(['Elegir nodo', 'Otra herramienta'])('%s descarta el borrador', async action => {
    const { user, input } = await setup(); const before = load();
    await user.clear(input); await user.type(input, '99');
    await user.click(screen.getByRole('button', { name: action }));
    expect(screen.queryByRole('textbox', { name: 'Valor de NL1' })).toBeNull();
    expect(load()).toEqual(before);
  });
  it('no sobrescribe un cambio externo con un borrador viejo', async () => {
    const { user, input } = await setup();
    await user.clear(input); await user.type(input, '99');
    await user.click(screen.getByRole('button', { name: 'Cambio externo' }));
    const apply = screen.queryByRole('button', { name: 'Aplicar' });
    if (apply) await user.click(apply);
    expect(load().fy).toBe(-45);
  });
});
