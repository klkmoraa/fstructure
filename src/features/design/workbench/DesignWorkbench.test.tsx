// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDefaultProject } from '../../../data/defaultProject';
import { PROJECT_STORAGE_KEY } from '../../../data/projectStorage';
import { ProjectProvider } from '../../../store/ProjectContext';
import { DesignWorkbench } from './DesignWorkbench';

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(createDefaultProject()));
});
afterEach(cleanup);

const renderWorkbench = () => render(<ProjectProvider><DesignWorkbench nativeTool={false} /></ProjectProvider>);
const results = () => screen.getByRole('region', { name: 'Resultados' });

describe('DesignWorkbench', () => {
  it('abre con una viga continua de ejemplo ya calculada por el solver 2D', async () => {
    const user = userEvent.setup();
    renderWorkbench();
    expect(screen.getByRole('radio', { name: 'Viga' }).getAttribute('aria-checked')).toBe('true');
    expect(await within(results()).findByText('Cumple')).toBeTruthy();
    expect(screen.getByRole('img', { name: /Elevación de la viga de 2 claros/ })).toBeTruthy();
    expect(screen.getAllByRole('img', { name: /sección 25 por 50/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole('img', { name: /Despiece/ })).toBeTruthy();
    expect(within(results()).queryByRole('table')).toBeNull();
    await user.click(within(results()).getByRole('button', { name: 'Detalle del cálculo' }));
    expect(within(results()).getByRole('table')).toBeTruthy();
  });

  it('agrega y quita claros y muestra errores en lugar de un resultado con datos inválidos', async () => {
    const user = userEvent.setup();
    renderWorkbench();
    await user.click(screen.getByRole('button', { name: 'Agregar claro' }));
    expect(await screen.findByRole('img', { name: /de 3 claros/ })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Quitar claro 3' }));
    expect(await screen.findByRole('img', { name: /de 2 claros/ })).toBeTruthy();

    await user.click(screen.getByRole('switch', { name: /Cargas puntuales/ }));
    const pointLoad = screen.getByRole('textbox', { name: 'Claro 1 · P CM (kN)' });
    await user.clear(pointLoad);
    await user.type(pointLoad, '50');
    const position = screen.getByRole('textbox', { name: 'Claro 1 · a (m)' });
    await user.clear(position);
    await user.type(position, '9');
    expect(await screen.findByText(/la carga puntual debe quedar/)).toBeTruthy();
    await user.clear(position);
    await user.type(position, '1.5');
    expect(await screen.findByRole('img', { name: /Despiece/ })).toBeTruthy();

    const length = screen.getByRole('textbox', { name: 'Claro 1 · L (m)' });
    await user.clear(length);
    expect(await screen.findByText('Revisa los datos')).toBeTruthy();
    await user.type(length, '14');
    expect((await within(results()).findAllByText('No cumple')).length).toBeGreaterThan(0);
  });

  it('cambia de elemento con el teclado y recuerda el último', async () => {
    const user = userEvent.setup();
    renderWorkbench();
    await user.click(screen.getByRole('radio', { name: 'Viga' }));
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Columna' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('img', { name: /Diagrama de interacción/ })).toBeTruthy();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('img', { name: /Planta de zapata/ })).toBeTruthy();
    expect(JSON.parse(localStorage.getItem('fstructure.design-workbench.element')!)).toBe('footing');
  });

  it('está aislado del Modelo 2D: sólo sus elementos propios', () => {
    renderWorkbench();
    const dock = screen.getByRole('radiogroup', { name: 'Elemento a diseñar' });
    expect(within(dock).getAllByRole('radio')).toHaveLength(3);
    expect(screen.queryByRole('radio', { name: 'Del modelo 2D' })).toBeNull();
  });

  it('muestra y oculta los paneles de datos y resultados sobre el lienzo', async () => {
    const user = userEvent.setup();
    renderWorkbench();
    const inputs = () => screen.getByRole('form', { name: 'Datos del elemento' });
    const toggle = screen.getByRole('button', { name: 'Datos' });
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    await user.click(toggle);
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    expect(inputs().dataset.open).toBe('false');
    await user.click(screen.getByRole('button', { name: 'Ocultar resultados' }));
    expect(results().dataset.open).toBe('false');
    await user.click(screen.getByRole('button', { name: /Cumple · \d+ %\. Ver resultados/ }));
    expect(results().dataset.open).toBe('true');
  });
});
