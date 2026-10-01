// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultProject } from '../../../data/defaultProject';
import { PROJECT_STORAGE_KEY } from '../../../data/projectStorage';
import { ProjectProvider } from '../../../store/ProjectContext';
import { DesignWorkbench } from './DesignWorkbench';
import { ShellSlotHost, ShellToolSlotsProvider } from '../../workspace/ShellToolSlots';

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(createDefaultProject()));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const renderWorkbench = () => render(<ProjectProvider><DesignWorkbench nativeTool={false} /></ProjectProvider>);
const results = () => screen.getByRole('region', { name: 'Resultados' });

describe('DesignWorkbench', () => {
  it('responde a un fallo al copiar sin perder el formulario', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));
    render(<ProjectProvider><ShellToolSlotsProvider mobile={false}><ShellSlotHost slot="action" /><DesignWorkbench /></ShellToolSlotsProvider></ProjectProvider>);
    await user.click(await screen.findByRole('button', { name: 'Copiar memoria de cálculo' }));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringMatching(/No se pudo copiar/));
    expect((screen.getByRole('textbox', { name: 'Claro 1 · L (m)' }) as HTMLInputElement).value).toBe('5');
  });

  it('desde un error abre Datos y enfoca el primer campo inválido', async () => {
    const user = userEvent.setup();
    renderWorkbench();
    const length = screen.getByRole('textbox', { name: 'Claro 1 · L (m)' });
    await user.clear(length);
    await user.click(screen.getByRole('button', { name: 'Datos' }));
    await user.click(screen.getByRole('button', { name: 'Revisar datos' }));
    await waitFor(() => expect(document.activeElement).toBe(length));
    expect(screen.getByRole('button', { name: 'Datos' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('abre con una viga continua de ejemplo ya calculada por el solver 2D', async () => {
    const user = userEvent.setup();
    renderWorkbench();
    expect(screen.getByRole('radio', { name: 'Viga' }).getAttribute('aria-checked')).toBe('true');
    expect(await within(results()).findByText('Cumple lo evaluado')).toBeTruthy();
    expect(within(results()).getByText(/Revisión incompleta: 5 verificaciones/)).toBeTruthy();
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

  it('filtra la revisión y enseña lo que queda sin evaluar con su ubicación', async () => {
    const user = userEvent.setup();
    renderWorkbench();
    const filter = await within(results()).findByRole('radiogroup', { name: 'Filtrar comprobaciones' });
    await user.click(within(filter).getByRole('radio', { name: /Sin evaluar 5/ }));
    expect(within(results()).getByRole('button', { name: /Torsión/ })).toBeTruthy();
    await user.click(within(results()).getByRole('button', { name: /Torsión/ }));
    expect(within(results()).getByText(/NTC-C 5\.8/)).toBeTruthy();
    await user.click(within(filter).getByRole('radio', { name: /Todas/ }));
    await user.click(within(results()).getByRole('button', { name: /Flexión positiva/ }));
    expect(within(results()).getByText(/lecho inferior/)).toBeTruthy();
    expect(within(results()).getAllByText(/Envolvente de/).length).toBeGreaterThan(0);
  });

  it('deshace y rehace los cambios del formulario con Ctrl+Z fuera de los campos', async () => {
    const user = userEvent.setup();
    renderWorkbench();
    await user.click(screen.getByRole('radio', { name: 'Columna' }));
    const width = screen.getByRole('textbox', { name: /Base b/ }) as HTMLInputElement;
    await user.clear(width);
    await user.type(width, '55');
    expect(width.value).toBe('55');
    await new Promise((resolve) => setTimeout(resolve, 800));
    await user.click(screen.getByRole('heading', { name: 'Columna' }));
    await user.keyboard('{Control>}z{/Control}');
    expect((screen.getByRole('textbox', { name: /Base b/ }) as HTMLInputElement).value).toBe('40');
    await user.keyboard('{Control>}{Shift>}z{/Shift}{/Control}');
    expect((screen.getByRole('textbox', { name: /Base b/ }) as HTMLInputElement).value).toBe('55');
  });

  it('guarda el elemento en la memoria del proyecto y lo lista con su clave', async () => {
    const user = userEvent.setup();
    renderWorkbench();
    await user.type(screen.getByRole('textbox', { name: 'Clave' }), 'V-9');
    await user.click(await within(results()).findByRole('button', { name: 'Agregar' }));
    expect(await within(results()).findByText('Guardado en la memoria como V-9')).toBeTruthy();
    await user.click(within(results()).getByRole('button', { name: /Guardado en la memoria/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Memoria del proyecto' });
    expect(within(dialog).getByText(/V-9 · Viga 25 × 50 cm/)).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: /Exportar memoria \(1\)/ })).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Quitar V-9 de la memoria' }));
    expect(within(dialog).getByText(/Aún no hay elementos/)).toBeTruthy();
  });

  it('ofrece columnas circulares con zuncho, vigas T y los cinco tipos de cimentación', async () => {
    const user = userEvent.setup();
    renderWorkbench();
    await user.click(screen.getByRole('radio', { name: 'T' }));
    expect(await screen.findByRole('textbox', { name: /Patín bf/ })).toBeTruthy();
    expect((await screen.findAllByRole('img', { name: /viga T con patín/ })).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('radio', { name: 'Columna' }));
    await user.click(screen.getByRole('radio', { name: 'Circular' }));
    expect(await screen.findByRole('img', { name: /Sección circular de columna/ })).toBeTruthy();
    await user.click(screen.getByRole('radio', { name: 'Zuncho' }));
    expect(await screen.findByRole('img', { name: /zuncho/ })).toBeTruthy();
    await user.click(screen.getByRole('radio', { name: 'Zapata' }));
    const type = () => screen.getByRole('combobox', { name: 'Tipo de cimentación' });
    await user.selectOptions(type(), 'strip');
    expect(await screen.findByRole('img', { name: /zapata corrida/ })).toBeTruthy();
    await user.selectOptions(type(), 'combined');
    expect(await screen.findByRole('img', { name: /Planta de zapata combinada/ })).toBeTruthy();
    expect(within(results()).getByText(/^Zapata combinada/)).toBeTruthy();
    await user.selectOptions(type(), 'strap');
    expect(await screen.findByRole('img', { name: /zapata de lindero/ })).toBeTruthy();
    await user.selectOptions(type(), 'mat');
    expect(await screen.findByRole('img', { name: /losa de cimentación/ })).toBeTruthy();
    expect(within(results()).getByText(/^Losa de cimentación/)).toBeTruthy();
  });

  it('propone la sección de la columna con un clic', async () => {
    const user = userEvent.setup();
    renderWorkbench();
    await user.click(screen.getByRole('radio', { name: 'Columna' }));
    const axial = screen.getByRole('textbox', { name: /^Pu/ });
    await user.clear(axial);
    await user.type(axial, '3000');
    await user.click(screen.getByRole('button', { name: 'Proponer' }));
    expect(await screen.findByText(/^Propuesta: /)).toBeTruthy();
    expect(within(results()).queryByText('No cumple')).toBeNull();
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
    await user.click(screen.getByRole('button', { name: /Cumple lo evaluado · \d+ %\. Ver resultados/ }));
    expect(results().dataset.open).toBe('true');
  });
});
