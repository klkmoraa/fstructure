// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultProject } from '../../../data/defaultProject';
import { PROJECT_STORAGE_KEY } from '../../../data/projectStorage';
import { ProjectProvider } from '../../../store/ProjectContext';
import { DesignWorkbench } from './DesignWorkbench';
import { ShellSlotHost, ShellToolSlotsProvider } from '../../workspace/ShellToolSlots';
import { WorkbenchStorageContext } from './workbenchStorage';
import { FOOTING_DEFAULTS, footingToInput } from './footingModel';

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(createDefaultProject()));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

// El taller abre en Estructura; estas pruebas parten de la viga continua.
const renderWorkbench = () => render(<ProjectProvider><DesignWorkbench nativeTool={false} startElement="beam" /></ProjectProvider>);
const results = () => screen.getByRole('region', { name: 'Resultados' });

describe('DesignWorkbench', () => {
  it('responde a un fallo al copiar sin perder el formulario', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));
    render(<ProjectProvider><ShellToolSlotsProvider mobile={false}><ShellSlotHost slot="action" /><DesignWorkbench startElement="beam" /></ShellToolSlotsProvider></ProjectProvider>);
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

  it('ofrece sugerencias de f′c para la columna en opciones avanzadas y actualiza su conversión', async () => {
    const user = userEvent.setup();
    renderWorkbench();
    await user.click(screen.getByRole('radio', { name: 'Zapata' }));
    await user.click(screen.getByRole('button', { name: 'Más opciones' }));
    const suggested = screen.getByRole('combobox', { name: 'f′c de la columna sugerido' });
    await user.selectOptions(suggested, '300');

    expect((screen.getByRole('textbox', { name: 'f′c de la columna' }) as HTMLInputElement).value).toBe('300');
    const savedDraft = JSON.parse(localStorage.getItem('fstructure.design-workbench.footing')!) as Record<string, string>;
    expect(savedDraft.colFc).toBe('300');
    expect(footingToInput('ntc-2023', { ...FOOTING_DEFAULTS, ...savedDraft }).columnFcMpa).toBeCloseTo(300 * 0.0980665, 5);
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

  it('aplica un preset de apoyos sin tocar claros o cargas y lo deshace como una sola edición', async () => {
    const user = userEvent.setup();
    renderWorkbench();
    const length = screen.getByRole('textbox', { name: 'Claro 1 · L (m)' }) as HTMLInputElement;
    const dead = screen.getByRole('textbox', { name: 'Claro 1 · CM (kN/m)' }) as HTMLInputElement;
    const original = { length: length.value, dead: dead.value };
    await user.selectOptions(screen.getByRole('combobox', { name: 'Configuración rápida de apoyos' }), 'cantilever-left');
    expect((screen.getByRole('radiogroup', { name: 'Extremo izquierdo' }).querySelector('[aria-checked="true"]') as HTMLElement).textContent).toContain('Empotre');
    expect((screen.getByRole('radiogroup', { name: 'Extremo derecho' }).querySelector('[aria-checked="true"]') as HTMLElement).textContent).toContain('Libre');
    expect(length.value).toBe(original.length);
    expect(dead.value).toBe(original.dead);
    await user.click(screen.getByRole('heading', { name: 'Viga' }));
    await user.keyboard('{Control>}z{/Control}');
    expect(screen.getByRole('radiogroup', { name: 'Extremo izquierdo' }).querySelector('[aria-checked="true"]')?.textContent).toContain('Apoyo');
    expect((screen.getByRole('textbox', { name: 'Claro 1 · L (m)' }) as HTMLInputElement).value).toBe(original.length);
    expect((screen.getByRole('textbox', { name: 'Claro 1 · CM (kN/m)' }) as HTMLInputElement).value).toBe(original.dead);
  });

  it('expone el diámetro transversal sin abrir Avanzado y muestra su alcance complementario al elegir #2', async () => {
    const user = userEvent.setup();
    renderWorkbench();
    const stirrup = screen.getByRole('combobox', { name: 'Estribo' }) as HTMLSelectElement;
    expect([...stirrup.options].some((option) => option.textContent?.startsWith('#2 ·'))).toBe(true);
    await user.selectOptions(stirrup, '6.4');
    expect(await within(results()).findByText(/aceptación normativa no está verificada/i)).toBeTruthy();
    expect(await within(results()).findByText(/no establece un mínimo normativo/i)).toBeTruthy();
    expect(within(results()).getByText('Revisar')).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Revisión pendiente · 100 %\./ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Cumple · 100 %\./ })).toBeNull();
  });

  it('cambia de elemento con el teclado y recuerda el último', async () => {
    const user = userEvent.setup();
    renderWorkbench();
    await user.click(screen.getByRole('radio', { name: 'Viga' }));
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('radio', { name: 'Estructura' }).getAttribute('aria-checked')).toBe('true');
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Columna' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('img', { name: /Diagrama de interacción/ })).toBeTruthy();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('img', { name: /Planta de zapata/ })).toBeTruthy();
    expect(JSON.parse(localStorage.getItem('fstructure.design-workbench.element')!)).toBe('footing');
  });

  it('ofrece los cinco elementos, Estructura primero', () => {
    renderWorkbench();
    const dock = screen.getByRole('radiogroup', { name: 'Elemento a diseñar' });
    expect(within(dock).getAllByRole('radio').map((radio) => radio.textContent)).toEqual(['Estructura', 'Viga', 'Columna', 'Zapata', 'Secciones']);
  });

  it('abre Nuevo diseño desde el dock y cancelar conserva el borrador vigente', async () => {
    const user = userEvent.setup();
    renderWorkbench();
    const length = screen.getByRole('textbox', { name: 'Claro 1 · L (m)' }) as HTMLInputElement;
    await user.clear(length);
    await user.type(length, '7');
    await user.click(screen.getByRole('button', { name: 'Nuevo diseño' }));
    expect(await screen.findByRole('dialog', { name: 'Nuevo diseño' })).toBeTruthy();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Nuevo diseño' })).toBeNull();
    expect((screen.getByRole('textbox', { name: 'Claro 1 · L (m)' }) as HTMLInputElement).value).toBe('7');
  });

  it('abre el selector inicial y cancelar no cambia el origen guardado del pórtico', async () => {
    const user = userEvent.setup();
    localStorage.setItem('fstructure.design-workbench.frame', JSON.stringify({ source: 'model', tag: 'Actual' }));
    render(<ProjectProvider><DesignWorkbench nativeTool={false} startElement="frame" startPicker modelSource={null} /></ProjectProvider>);
    expect(await screen.findByRole('dialog', { name: 'Nuevo diseño' })).toBeTruthy();
    await user.keyboard('{Escape}');
    expect(JSON.parse(localStorage.getItem('fstructure.design-workbench.frame')!).source).toBe('model');
  });

  it('inicia una receta con campos y claros reales y conserva la pieza anterior en memoria', async () => {
    const user = userEvent.setup();
    renderWorkbench();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Norma de diseño' }), 'e060');
    const length = screen.getByRole('textbox', { name: 'Claro 1 · L (m)' }) as HTMLInputElement;
    await user.clear(length);
    await user.type(length, '7');
    await user.click(screen.getByRole('button', { name: 'Nuevo diseño' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo diseño' });
    await user.click(within(dialog).getByRole('tab', { name: 'Ejercicio' }));
    await user.click(await within(dialog).findByRole('button', { name: /Viga simplemente apoyada/ }));
    expect(screen.queryByRole('dialog', { name: 'Nuevo diseño' })).toBeNull();
    expect((screen.getByRole('textbox', { name: 'Claro 1 · L (m)' }) as HTMLInputElement).value).toBe('5');
    expect((screen.getByRole('textbox', { name: 'Claro 1 · CM (kN/m)' }) as HTMLInputElement).value).toBe('10');
    expect(screen.getByRole('heading', { name: 'Viga simplemente apoyada' })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Norma de diseño' })).toHaveProperty('value', 'e060');
    const memory = JSON.parse(localStorage.getItem('fstructure.design-workbench.memory')!);
    expect(memory).toEqual(expect.arrayContaining([expect.objectContaining({
      element: 'beam', fields: expect.objectContaining({ tag: '', selfWeight: 'yes' }),
      rows: expect.arrayContaining([expect.objectContaining({ length: '7' })]),
    })]));
  });

  it('mantiene editable la referencia, suspende al cambiar apoyos, oculta con deshacer y recupera al abrir Memoria', async () => {
    const user = userEvent.setup();
    render(<ProjectProvider><DesignWorkbench nativeTool={false} startElement="beam" startPicker /></ProjectProvider>);
    const picker = await screen.findByRole('dialog', { name: 'Nuevo diseño' });
    await user.click(within(picker).getByRole('tab', { name: 'Ejercicio' }));
    await user.click(await within(picker).findByRole('button', { name: /Viga simplemente apoyada/ }));
    expect(screen.getByRole('heading', { name: 'Viga simplemente apoyada' })).toBeTruthy();

    const length = screen.getByRole('textbox', { name: 'Claro 1 · L (m)' });
    const dead = screen.getByRole('textbox', { name: 'Claro 1 · CM (kN/m)' });
    await user.clear(length);
    const guide = screen.getByRole('region', { name: 'Viga simplemente apoyada' });
    expect(within(guide).getByRole('heading', { name: 'Viga simplemente apoyada' })).toBeTruthy();
    expect(within(guide).getByRole('status').textContent).toMatch(/Datos incompletos/);
    expect(within(guide).queryByText(/kN·m/)).toBeNull();
    await user.type(length, '5');
    await user.clear(length); await user.type(length, '6');
    await user.clear(dead); await user.type(dead, '12');
    expect(screen.getAllByText('54.00 kN·m')).toHaveLength(2);

    const supports = screen.getByRole('heading', { name: 'Apoyos' }).closest('section')!;
    const leftSupports = within(supports).getByRole('radiogroup', { name: 'Extremo izquierdo' });
    await user.click(within(leftSupports).getByRole('radio', { name: 'Empotre' }));
    expect(within(screen.getByRole('form', { name: 'Datos del elemento' })).getByRole('status').textContent).toMatch(/Comparación suspendida.*apoyos simples/);
    expect(screen.queryByText('54.00 kN·m')).toBeNull();
    await user.click(within(leftSupports).getByRole('radio', { name: 'Apoyo' }));
    expect(screen.getAllByText('54.00 kN·m')).toHaveLength(2);

    await new Promise((resolve) => setTimeout(resolve, 750));
    await user.click(screen.getByRole('button', { name: 'Ocultar guía' }));
    expect(screen.queryByRole('heading', { name: 'Viga simplemente apoyada' })).toBeNull();
    await user.keyboard('{Control>}z{/Control}');
    expect(screen.getByRole('heading', { name: 'Viga simplemente apoyada' })).toBeTruthy();

    await user.click(within(results()).getByRole('button', { name: 'Guardar' }));
    await user.click(screen.getByRole('button', { name: /Guardado/ }));
    const memory = await screen.findByRole('dialog', { name: 'Memoria del proyecto' });
    expect(JSON.parse(localStorage.getItem('fstructure.design-workbench.memory')!)).toEqual(expect.arrayContaining([expect.objectContaining({ fields: expect.objectContaining({ exercise: 'exercise-beam-simple' }) })]));
    await user.click(within(memory).getByRole('button', { name: 'Abrir V simple' }));
    expect(await screen.findByRole('heading', { name: 'Viga simplemente apoyada' })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Claro 1 · L (m)' })).toHaveProperty('value', '6');
    expect(screen.getAllByText('54.00 kN·m')).toHaveLength(2);
  });

  it('ignora ids de ejercicio heredados en borradores del taller sin romper la viga', () => {
    localStorage.setItem('fstructure.design-workbench.beam', JSON.stringify({ exercise: 'constructor' }));
    renderWorkbench();
    expect(screen.getByRole('heading', { name: 'Viga' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Viga simplemente apoyada' })).toBeNull();
  });

  it('mantiene abierto el selector y el formulario al no haber presupuesto para conservarlos', async () => {
    const user = userEvent.setup();
    const entries: Record<string, unknown> = {};
    const storage = {
      read: (key: string) => entries[key],
      write: (key: string, value: unknown) => { entries[key] = structuredClone(value); },
      canWrite: () => false,
    };
    render(<WorkbenchStorageContext.Provider value={storage as never}><ProjectProvider><DesignWorkbench nativeTool={false} startElement="beam" /></ProjectProvider></WorkbenchStorageContext.Provider>);
    await user.click(screen.getByRole('button', { name: 'Nuevo diseño' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo diseño' });
    await user.click(within(dialog).getByRole('tab', { name: 'Pieza' }));
    await user.click(await within(dialog).findByRole('button', { name: /Zapata aislada/ }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/No hay espacio suficiente para conservar/i);
    expect(screen.getByRole('dialog', { name: 'Nuevo diseño' })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Claro 1 · L (m)' })).toHaveProperty('value', '5');
    expect(screen.getByRole('button', { name: 'Abrir memoria del proyecto' })).toBeTruthy();
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
    await user.click(await within(results()).findByRole('button', { name: 'Guardar' }));
    expect(await within(results()).findByText('Guardado · V-9')).toBeTruthy();
    await user.click(within(results()).getByRole('button', { name: /Guardado · V-9/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Memoria del proyecto' });
    expect(within(dialog).getByText(/V-9 · Viga 25 × 50 cm/)).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: /Exportar memoria \(1\)/ })).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Quitar V-9 de la memoria' }));
    expect(within(dialog).getByText(/Aún no hay elementos/)).toBeTruthy();
  });

  it('mantiene Memoria abierta y muestra un aviso si abrir no puede conservar el borrador actual', async () => {
    const user = userEvent.setup();
    const data: Record<string, unknown> = {
      memory: [{ id: 'target', element: 'footing', code: 'ntc-2023', savedAt: '2026-10-01', fields: { tag: 'Z guardada' } }],
      beam: { tag: 'V actual', width: '25' },
    };
    const storage = {
      read: (key: string) => data[key],
      write: (key: string, value: unknown) => { data[key] = structuredClone(value); },
      canWrite: () => false,
    };
    render(<WorkbenchStorageContext.Provider value={storage as never}><ProjectProvider><DesignWorkbench nativeTool={false} startElement="beam" /></ProjectProvider></WorkbenchStorageContext.Provider>);

    await user.click(screen.getByRole('button', { name: 'Viga sin guardar' }));
    const dialog = await screen.findByRole('dialog', { name: 'Memoria del proyecto' });
    await user.click(within(dialog).getByRole('button', { name: 'Abrir Z guardada' }));

    expect(screen.getByRole('dialog', { name: 'Memoria del proyecto' })).toBeTruthy();
    expect(await within(dialog).findByRole('status')).toHaveProperty('textContent', expect.stringMatching(/No hay espacio suficiente.*conservar los borradores/i));
    expect(screen.getByRole('textbox', { name: 'Claro 1 · L (m)' })).toHaveProperty('value', '5');
  });

  it('abre Memoria y explica que hace falta liberar almacenamiento si guardar queda bloqueado', async () => {
    const user = userEvent.setup();
    const data: Record<string, unknown> = {};
    const storage = {
      read: (key: string) => data[key],
      write: (key: string, value: unknown) => { data[key] = structuredClone(value); },
      canWrite: () => false,
    };
    render(<WorkbenchStorageContext.Provider value={storage as never}><ProjectProvider><DesignWorkbench nativeTool={false} startElement="beam" /></ProjectProvider></WorkbenchStorageContext.Provider>);

    await user.click(await within(results()).findByRole('button', { name: 'Guardar' }));

    const dialog = await screen.findByRole('dialog', { name: 'Memoria del proyecto' });
    expect(await within(dialog).findByRole('status')).toHaveProperty('textContent', expect.stringMatching(/No hay espacio suficiente para guardar/i));
    expect(screen.getByRole('textbox', { name: 'Claro 1 · L (m)' })).toHaveProperty('value', '5');
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
    expect(await screen.findByText(/^Propuesta: .* cm con /)).toBeTruthy();
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
