// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { StrictMode } from 'react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultProject } from '../../../data/defaultProject';
import { PROJECT_STORAGE_KEY } from '../../../data/projectStorage';
import type { JsonValue } from '../../../shared/project/unifiedProjectBundle';
import { ProjectProvider } from '../../../store/ProjectContext';
import { DesignWorkbench } from './DesignWorkbench';
import { ShellSlotHost, ShellToolSlotsProvider } from '../../workspace/ShellToolSlots';
import { createProjectWorkbenchStorage, parseWorkbenchDocument, WORKBENCH_DOCUMENT_KIND, WorkbenchStorageContext } from './workbenchStorage';
import { BEAM_DEFAULTS, DEFAULT_SPANS } from './beamModel';
import { EMPTY_BEAM_DETAILS } from './beamDetailDraft';
import { FOOTING_DEFAULTS, footingToInput } from './footingModel';
import { SECTION_DEFAULTS } from './concreteStudioModel';
import { proposeFlexureDimensions, type FlexureExerciseInput, type FlexureDimensionBounds } from '../../../design/elements/flexureExercise';
import type { ReinforcementAlternativesResponse } from '../../../design/elements/reinforcementAlternatives';

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(createDefaultProject()));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

class PendingProposalWorker {
  static instance: PendingProposalWorker | null = null;
  onmessage: ((event: MessageEvent<ReinforcementAlternativesResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  posted: { requestId: number; kind: string } | null = null;
  terminated = false;
  constructor() { PendingProposalWorker.instance = this; }
  postMessage(message: { requestId: number; kind: string }) { this.posted = message; }
  terminate() { this.terminated = true; }
  reply(response: Omit<ReinforcementAlternativesResponse, 'requestId'>) {
    this.onmessage?.({ data: { ...response, requestId: this.posted?.requestId ?? 1 } as ReinforcementAlternativesResponse } as MessageEvent<ReinforcementAlternativesResponse>);
  }
}

class PendingFlexureWorker {
  static instance: PendingFlexureWorker | null = null;
  onmessage: ((event: MessageEvent<{ requestId: number; proposal: { widthMm: number; heightMm: number; result: ReturnType<typeof proposeFlexureDimensions> extends infer T ? T extends { result: infer R } ? R : never : never } | null }>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  posted: { requestId: number; input: FlexureExerciseInput; bounds: FlexureDimensionBounds } | null = null;
  terminated = false;
  constructor() { PendingFlexureWorker.instance = this; }
  postMessage(message: { requestId: number; input: FlexureExerciseInput; bounds: FlexureDimensionBounds }) { this.posted = message; }
  terminate() { this.terminated = true; }
  reply() {
    if (!this.posted) throw new Error('No se inició la búsqueda.');
    const { requestId, input, bounds } = this.posted;
    this.onmessage?.({ data: { requestId, proposal: proposeFlexureDimensions(input, bounds) } } as MessageEvent<{ requestId: number; proposal: null }>);
  }
}

const renderFlexureExercise = () => render(<ProjectProvider><DesignWorkbench nativeTool={false} startElement="flexure" startPicker startCategory="exercise" /></ProjectProvider>);
const openFlexureExercise = async (user: ReturnType<typeof userEvent.setup>) => {
  renderFlexureExercise();
  await user.click(screen.getByRole('button', { name: 'Iniciar diseño: Flexión con momento dado' }));
};
const prepareFlexureSizing = async (user: ReturnType<typeof userEvent.setup>) => {
  await openFlexureExercise(user);
  for (const [label, value] of [[/Mu \(positivo: tensión abajo; negativo: tensión arriba\)/, '200'], [/f′c/, '255'], [/^fy$/, '4280'], [/Barras abajo/, '6']] as const) {
    const field = screen.getByRole('textbox', { name: label });
    await user.clear(field);
    await user.type(field, value);
  }
  await user.click(screen.getByRole('radio', { name: 'Dimensionar sección' }));
}

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

  it('permite editar la preferencia de stock sin perder la mesa en React StrictMode', async () => {
    const user = userEvent.setup();
    render(<StrictMode><ProjectProvider><DesignWorkbench nativeTool={false} startElement="flexure" startPicker startCategory="exercise" /></ProjectProvider></StrictMode>);
    await user.click(screen.getByRole('button', { name: 'Iniciar diseño: Flexión con momento dado' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Criterio de comparación' }), 'available-bars');
    await user.click(screen.getByText('Diámetros en existencia · solo esta sesión'));
    const firstStock = screen.getAllByRole('checkbox')[0]!;
    await user.click(firstStock);
    expect((firstStock as HTMLInputElement).checked).toBe(false);
    expect(screen.getByRole('button', { name: 'Comparar armados' })).toBeTruthy();
    expect(screen.queryByText('No se pudo cargar esta superficie.')).toBeNull();
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
    expect(screen.getByRole('button', { name: /^Revisión pendiente · 99 %\./ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Cumple · 99 %\./ })).toBeNull();
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

  it('dimensiona con b/h vacíos y sólo guarda la propuesta al aplicarla; deshacer restaura el borrador', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('Worker', PendingFlexureWorker);
    await prepareFlexureSizing(user);
    expect(screen.queryByRole('textbox', { name: 'Base b' })).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Peralte h' })).toBeNull();
    await screen.findByRole('button', { name: 'Cancelar búsqueda' });
    const worker = PendingFlexureWorker.instance!;
    expect(JSON.parse(localStorage.getItem('fstructure.design-workbench.flexure')!).width).toBe('');
    worker.reply();
    await screen.findByText(/Vista previa:/);
    const proposal = proposeFlexureDimensions(worker.posted!.input, worker.posted!.bounds)!;
    const sectionSvg = screen.getByRole('img', { name: 'Esquema de sección rectangular a flexión' });
    const previewBars = [...sectionSvg.querySelectorAll('circle')];
    expect(previewBars.length).toBeGreaterThan(0);
    for (const previewBar of previewBars) {
      const cx = Number(previewBar.getAttribute('cx'));
      const cy = Number(previewBar.getAttribute('cy'));
      expect(Number.isFinite(cx)).toBe(true);
      expect(Number.isFinite(cy)).toBe(true);
      expect(cx).toBeGreaterThanOrEqual(90);
      expect(cx).toBeLessThanOrEqual(230);
      expect(cy).toBeGreaterThanOrEqual(30);
      expect(cy).toBeLessThanOrEqual(190);
    }
    await user.click(screen.getByRole('button', { name: 'Aplicar dimensiones' }));
    await waitFor(() => expect(JSON.parse(localStorage.getItem('fstructure.design-workbench.flexure')!).width).toBe(String(proposal.widthMm / 10)));
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    await waitFor(() => expect(JSON.parse(localStorage.getItem('fstructure.design-workbench.flexure')!).width).toBe(''));
    expect(JSON.parse(localStorage.getItem('fstructure.design-workbench.flexure')!).height).toBe('');
  });

  it('cancela la búsqueda y descarta una respuesta tardía', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('Worker', PendingFlexureWorker);
    await prepareFlexureSizing(user);
    await screen.findByRole('button', { name: 'Cancelar búsqueda' });
    const worker = PendingFlexureWorker.instance!;
    await user.click(screen.getByRole('button', { name: 'Cancelar búsqueda' }));
    await waitFor(() => expect(worker.terminated).toBe(true));
    worker.reply();
    expect(screen.queryByText(/Vista previa:/)).toBeNull();
    expect(JSON.parse(localStorage.getItem('fstructure.design-workbench.flexure')!).width).toBe('');
  });

  it('ofrece seis elementos, Estructura primero', () => {
    renderWorkbench();
    const dock = screen.getByRole('radiogroup', { name: 'Elemento a diseñar' });
    expect(within(dock).getAllByRole('radio').map((radio) => radio.textContent)).toEqual(['Estructura', 'Viga', 'Columna', 'Zapata', 'Flexión', 'Secciones']);
  });

  it('Flexión recibe el momento directamente y distingue blanco de cero', async () => {
    const user = userEvent.setup();
    renderWorkbench();
    await user.click(screen.getByRole('radio', { name: 'Flexión' }));
    const moment = screen.getByRole('textbox', { name: /Mu \(positivo: tensión abajo; negativo: tensión arriba\)/ });
    expect((moment as HTMLInputElement).value).toBe('');
    expect(screen.getByText('Completa Mu, sección y materiales para calcular.')).toBeTruthy();
    await user.type(moment, '0');
    await waitFor(() => expect(within(results()).getAllByText('0.0 kN·m').length).toBeGreaterThan(0));
    expect(JSON.parse(localStorage.getItem('fstructure.design-workbench.flexure')!).moment).toBe('0');
  });

  it.each([
    ['200', 'topCount', '', 'topBar', 'not-a-number', 'Barras abajo', 'Barras arriba'],
    ['-200', 'bottomCount', '', 'bottomBar', 'not-a-number', 'Barras arriba', 'Barras abajo'],
  ])('sólo presenta y valida el lecho a tensión para Mu=%s conservando el opuesto crudo', async (moment, unusedCount, unusedCountValue, unusedBar, unusedBarValue, activeLabel, inactiveLabel) => {
    const user = userEvent.setup();
    localStorage.setItem('fstructure.design-workbench.flexure', JSON.stringify({
      width: '40', height: '60', cover: '4', fc: '255', fy: '4280', stirrup: '9.5', aggregate: '19', moment,
      topCount: '2', topBar: '15.9', bottomCount: '6', bottomBar: '15.9', objective: 'required', tag: '', place: '', exercise: '',
      [unusedCount]: unusedCountValue, [unusedBar]: unusedBarValue,
    }));
    renderWorkbench();
    await user.click(screen.getByRole('radio', { name: 'Flexión' }));
    expect(screen.getByRole('textbox', { name: activeLabel })).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: inactiveLabel })).toBeNull();
    expect(within(results()).getByText('As requerida')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(screen.getByRole('button', { name: /Guardado/ })).toBeTruthy();
    const saved = JSON.parse(localStorage.getItem('fstructure.design-workbench.flexure')!);
    expect(saved[unusedCount]).toBe(unusedCountValue);
    expect(saved[unusedBar]).toBe(unusedBarValue);
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
    await user.click(await within(dialog).findByRole('button', { name: /Viga con claros y cargas/ }));
    expect(screen.queryByRole('dialog', { name: 'Nuevo diseño' })).toBeNull();
    expect((screen.getByRole('textbox', { name: 'Claro 1 · L (m)' }) as HTMLInputElement).value).toBe('');
    expect((screen.getByRole('textbox', { name: 'Claro 1 · CM (kN/m)' }) as HTMLInputElement).value).toBe('');
    expect(screen.queryByRole('meter')).toBeNull();
    expect(screen.getByRole('combobox', { name: 'Norma de diseño' })).toHaveProperty('value', 'e060');
    const memory = JSON.parse(localStorage.getItem('fstructure.design-workbench.memory')!);
    expect(memory).toEqual(expect.arrayContaining([expect.objectContaining({
      element: 'beam', fields: expect.objectContaining({ tag: '', selfWeight: 'yes' }),
      rows: expect.arrayContaining([expect.objectContaining({ length: '7' })]),
    })]));
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

  it.each([
    ['Sección con acciones dadas'],
    ['Columna con acciones dadas'],
    ['Viga con claros y cargas'],
  ])('inicia %s incompleto y no resuelve un ejemplo', async (title) => {
    const user = userEvent.setup();
    render(<ProjectProvider><DesignWorkbench nativeTool={false} startElement="beam" startPicker startCategory="exercise" /></ProjectProvider>);
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo diseño' });
    await user.click(within(dialog).getByRole('button', { name: `Iniciar diseño: ${title}` }));
    expect(screen.queryByRole('dialog', { name: 'Nuevo diseño' })).toBeNull();
    expect(screen.queryByRole('meter')).toBeNull();
    expect(screen.getByRole('form', { name: 'Datos del elemento' })).toBeTruthy();
  });

  it('cancela la comparación de columna al editar y descarta su respuesta pendiente', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('Worker', PendingProposalWorker);
    render(<ProjectProvider><DesignWorkbench nativeTool={false} startElement="column" /></ProjectProvider>);
    await user.click(screen.getByText('Alternativas constructivas'));
    await user.click(screen.getByRole('button', { name: 'Comparar acero' }));
    const worker = PendingProposalWorker.instance!;
    expect(worker.terminated).toBe(false);
    const axial = screen.getByRole('textbox', { name: 'Pu' });
    await user.clear(axial);
    worker.reply({ kind: 'alternatives', candidates: [{ id: 'late', geometry: { widthMm: 400, heightMm: 400 },
      reinforcement: { bed: 'top', group: { count: 6, diameterMm: 25.4 }, diametersMm: Array(6).fill(25.4) },
      arrangement: { shape: 'rectangle', distribution: 'column-perimeter', outlinePointsMm: [{ xMm: -200, yMm: -200 }, { xMm: 200, yMm: -200 }, { xMm: 200, yMm: 200 }, { xMm: -200, yMm: 200 }], bars: [], layers: 1, spacingBasis: 'horizontal-per-layer', clearSpacingMm: 30, requiredClearSpacingMm: 25, longitudinalDiametersMm: Array(6).fill(25.4) },
      checked: { status: 'pass', checks: [], excluded: [] }, steelAreaMm2: 3000, assumedLengthM: 3, steelWeightKg: 70,
      weightAssumption: 'test', applyFields: { bar: '25.4' } }] });
    await waitFor(() => expect(worker.terminated).toBe(true));
    expect((screen.getByRole('combobox', { name: 'Varilla' }) as HTMLSelectElement).value).toBe('19.1');
    expect(screen.getByText(/Búsqueda cancelada/)).toBeTruthy();
  });

  it('previsualiza una alternativa de columna y aplica sólo el armado al solicitarlo', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('Worker', PendingProposalWorker);
    render(<ProjectProvider><DesignWorkbench nativeTool={false} startElement="column" /></ProjectProvider>);
    await user.click(screen.getByText('Alternativas constructivas'));
    await user.click(screen.getByRole('button', { name: 'Comparar acero' }));
    PendingProposalWorker.instance!.reply({ kind: 'alternatives', candidates: [{ id: 'candidate', geometry: { widthMm: 400, heightMm: 400 },
      reinforcement: { bed: 'top', group: { count: 20, diameterMm: 25.4 }, diametersMm: Array(20).fill(25.4) },
      arrangement: { shape: 'rectangle', distribution: 'column-perimeter', outlinePointsMm: [{ xMm: -200, yMm: -200 }, { xMm: 200, yMm: -200 }, { xMm: 200, yMm: 200 }, { xMm: -200, yMm: 200 }], bars: [{ xMm: 0, yMm: -150, diameterMm: 25.4, layer: 1, bed: 'top' }], beds: ['top'], layers: 1, spacingBasis: 'horizontal-per-layer', clearSpacingMm: 30, requiredClearSpacingMm: 25, longitudinalDiametersMm: Array(20).fill(25.4) },
      checked: { status: 'pass', checks: [], excluded: [] }, steelAreaMm2: 10134, assumedLengthM: 3, steelWeightKg: 238,
      weightAssumption: 'test', applyFields: { bar: '25.4', barsWidth: '4', barsDepth: '5' } }] });
    await screen.findByRole('img', { name: /Acomodo efectivo:/ });
    expect(screen.getByRole('img', { name: /Acomodo efectivo:/ }).querySelectorAll('circle').length).toBe(1);
    expect((screen.getByRole('combobox', { name: 'Varilla' }) as HTMLSelectElement).value).toBe('19.1');
    await user.click(screen.getByRole('button', { name: 'Aplicar este armado' }));
    await waitFor(() => expect((screen.getByRole('combobox', { name: 'Varilla' }) as HTMLSelectElement).value).toBe('25.4'));
    expect((screen.getByRole('textbox', { name: 'Base b (X)' }) as HTMLInputElement).value).toBe('40');
    expect((screen.getByRole('textbox', { name: 'Peralte h (Y)' }) as HTMLInputElement).value).toBe('40');
    expect((screen.getByRole('textbox', { name: 'Pu' }) as HTMLInputElement).value).toBe('900');
  });

  it('permite comparar en Experimental aunque la distribución esté congestionada y cancela al cambiar norma', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('Worker', PendingProposalWorker);
    localStorage.setItem('fstructure.design-workbench.section', JSON.stringify({
      ...SECTION_DEFAULTS, shape: 'square', width: '20', height: '20', cover: '5', bar: '25.4',
      barLayout: 'zones', cornerBarCount: '3', faceBarCount: '3',
    }));
    render(<ProjectProvider><DesignWorkbench nativeTool={false} startElement="section" /></ProjectProvider>);
    expect(screen.getByRole('button', { name: 'Comparar acero' }).hasAttribute('disabled')).toBe(false);
    expect(screen.getByRole('textbox', { name: 'Barras por esquina' })).toHaveProperty('max', '3');
    expect(screen.getByRole('textbox', { name: 'Barras por cara' })).toHaveProperty('max', '3');
    await user.click(screen.getByRole('button', { name: 'Comparar acero' }));
    expect(PendingProposalWorker.instance?.posted).toMatchObject({ kind: 'section' });
    await user.selectOptions(screen.getByRole('combobox', { name: 'Norma de diseño' }), 'e060');
    await waitFor(() => expect(PendingProposalWorker.instance?.terminated).toBe(true));
    PendingProposalWorker.instance?.reply({ kind: 'alternatives', candidates: [] });
    expect((screen.getByRole('combobox', { name: 'Diámetro longitudinal' }) as HTMLSelectElement).value).toBe('25.4');
    expect(screen.getByText(/Búsqueda cancelada: cambiaron los datos de entrada/)).toBeTruthy();
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

  it('rechaza atómicamente un detalle sin desincronizar reporte, memoria, historial ni transiciones', async () => {
    const user = userEvent.setup();
    const details = { kind: 'beam', version: 1, loads: [{ id: 'p1', span: '1', kind: 'point', category: 'dead', start: '2.5', end: '', startValue: '10', endValue: '10' }], bastions: [], stirrupZones: [] };
    const data: Record<string, unknown> = {
      beam: { tag: 'V-1' }, 'beam-details': details, 'beam-spans': [{ ...DEFAULT_SPANS[0]! }], element: 'beam', 'memory-active': 'v1',
      memory: [{ id: 'v1', element: 'beam', code: 'ntc-2023', savedAt: '2026-10-09', fields: { tag: 'V-1' }, rows: [{ ...DEFAULT_SPANS[0]! }], details }],
    };
    const storage = {
      read: (key: string) => data[key],
      write: (key: string, value: unknown) => { data[key] = structuredClone(value); },
      canWrite: (writes: Record<string, unknown>) => {
        const next = writes['beam-details'] as typeof details | undefined;
        return !next?.loads.some((load) => load.startValue === '20');
      },
    };
    render(<WorkbenchStorageContext.Provider value={storage as never}><ProjectProvider><DesignWorkbench nativeTool={false} startElement="beam" /></ProjectProvider></WorkbenchStorageContext.Provider>);

    await user.click(screen.getByRole('button', { name: 'Cargas generales y detalle físico' }));
    const load = screen.getByRole('textbox', { name: 'P (kN)' }) as HTMLInputElement;
    const momentBefore = within(results()).getByText(/Mu positivo/).parentElement?.textContent;
    fireEvent.change(load, { target: { value: '20' } });

    expect(load.value).toBe('10');
    expect(data['beam-details']).toEqual(details);
    expect(within(results()).getByText(/Mu positivo/).parentElement?.textContent).toBe(momentBefore);
    expect(await screen.findByText(/cambio fue rechazado por falta de espacio y no se guardó/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Guardado · V-1' })).toBeTruthy();

    await user.click(screen.getByRole('heading', { name: 'Viga' }));
    await user.keyboard('{Control>}z{/Control}');
    expect(load.value).toBe('10');
    expect(data['beam-details']).toEqual(details);

    await user.click(screen.getByRole('button', { name: 'Guardado · V-1' }));
    const savedDialog = await screen.findByRole('dialog', { name: 'Memoria del proyecto' });
    await user.click(within(savedDialog).getByRole('button', { name: 'Guardar como nuevo' }));
    expect((data.memory as Array<{ details: typeof details }>)[1]?.details).toEqual(details);
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Nuevo diseño' }));
    const startDialog = await screen.findByRole('dialog', { name: 'Nuevo diseño' });
    await user.click(within(startDialog).getByRole('tab', { name: 'Pieza' }));
    await user.click(await within(startDialog).findByRole('button', { name: 'Iniciar diseño: Viga apoyada' }));
    expect(data['beam-details']).toMatchObject({ kind: 'beam', version: 1, loads: [], bastions: [], stirrupZones: [] });

    await user.click(screen.getByRole('button', { name: 'Viga sin guardar' }));
    const memoryDialog = await screen.findByRole('dialog', { name: 'Memoria del proyecto' });
    await user.click(within(memoryDialog).getAllByRole('button', { name: 'Abrir V-1' })[0]!);
    await user.click(screen.getByRole('button', { name: 'Cargas generales y detalle físico' }));
    expect((await screen.findByRole('textbox', { name: 'P (kN)' }) as HTMLInputElement).value).toBe('10');
    expect(data['beam-details']).toEqual(details);

    fireEvent.change(screen.getByRole('textbox', { name: 'P (kN)' }), { target: { value: '' } });
    expect((screen.getByRole('textbox', { name: 'P (kN)' }) as HTMLInputElement).value).toBe('');
    expect(data['beam-details']).toMatchObject({ loads: [{ startValue: '', endValue: '' }] });
  });

  it('no activa armado propio si se rechaza agregar una región física', async () => {
    const user = userEvent.setup();
    const data: Record<string, unknown> = { beam: { rebarMode: 'auto' }, 'beam-details': EMPTY_BEAM_DETAILS };
    const storage = {
      read: (key: string) => data[key],
      write: (key: string, value: unknown) => { data[key] = structuredClone(value); },
      canWrite: (writes: Record<string, unknown>) => {
        const next = writes['beam-details'] as { bastions?: unknown[] } | undefined;
        return !next?.bastions?.length;
      },
    };
    render(<WorkbenchStorageContext.Provider value={storage as never}><ProjectProvider><DesignWorkbench nativeTool={false} startElement="beam" /></ProjectProvider></WorkbenchStorageContext.Provider>);
    await user.click(screen.getByRole('button', { name: 'Cargas generales y detalle físico' }));
    await user.click(screen.getByRole('button', { name: 'Agregar bastón' }));
    expect(data.beam).toMatchObject({ rebarMode: 'auto' });
    expect(data['beam-details']).toMatchObject({ bastions: [] });
  });

  it('preflighta detalle y armado como lote indivisible cerca del límite del documento', async () => {
    const user = userEvent.setup();
    const nextDetails = { ...EMPTY_BEAM_DETAILS, bastions: [{ id: 'b1', bed: 'top' as const, count: '', diameterMm: '', startM: '', endM: '' }] };
    const ownBeam = { ...BEAM_DEFAULTS, rebarMode: 'own', ownBastions: 'custom' };
    const makeDocument = (regularFields: number, padLength: number) => {
      let fieldIndex = 0;
      const memory = Array.from({ length: 60 }, (_, itemIndex) => {
        const fields: Record<string, string> = {};
        const itemFields = Math.min(96 - (itemIndex === 0 ? 8 : 0), regularFields - fieldIndex);
        for (let index = 0; index < itemFields; index++, fieldIndex++) fields[`f${String(fieldIndex).padStart(5, '0')}`] = 'x'.repeat(32);
        if (itemIndex === 0) {
          let remaining = padLength;
          for (const key of ['pad-a', 'pad-b', 'pad-c', 'pad-d', 'pad-e', 'pad-f', 'pad-g', 'pad-h']) {
            const length = Math.min(32, remaining);
            fields[key] = 'p'.repeat(length);
            remaining -= length;
          }
        }
        return { id: `m${itemIndex}`, element: 'beam', code: 'ntc-2023', savedAt: '2026-10-09', fields };
      });
      return { kind: WORKBENCH_DOCUMENT_KIND, schemaVersion: 7, entries: {
        beam: { ...BEAM_DEFAULTS }, 'beam-details': EMPTY_BEAM_DETAILS, 'beam-spans': DEFAULT_SPANS.map((span) => ({ ...span })), memory,
      } };
    };
    const writesFit = (raw: ReturnType<typeof makeDocument>, withBeam: boolean) => {
      const entries = raw.entries;
      const candidate = { ...entries, 'beam-details': nextDetails, ...(withBeam ? { beam: ownBeam } : {}) };
      return JSON.stringify({ ...raw, entries: candidate }).length <= 240_000;
    };
    let fullFieldCount = 0;
    let low = 0;
    let high = 60 * 96 - 8;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      if (writesFit(makeDocument(middle, 256), false)) { fullFieldCount = middle; low = middle + 1; }
      else high = middle - 1;
    }
    let initial: ReturnType<typeof makeDocument> | undefined;
    for (let count = Math.max(0, fullFieldCount - 8); count <= fullFieldCount + 1 && !initial; count++) {
      const noPad = makeDocument(count, 0);
      const detailLength = JSON.stringify({ ...noPad, entries: { ...noPad.entries, 'beam-details': nextDetails } }).length;
      const batchLength = JSON.stringify({ ...noPad, entries: { ...noPad.entries, 'beam-details': nextDetails, beam: ownBeam } }).length;
      const padLength = 240_000 - detailLength;
      if (padLength >= 0 && padLength <= 256 && batchLength + padLength > 240_000) initial = makeDocument(count, padLength);
    }
    expect(initial).toBeDefined();
    const persisted: unknown[] = [];
    const storage = createProjectWorkbenchStorage(initial, (document) => persisted.push(document), 60_000);
    expect(storage.canWrite?.({ 'beam-details': nextDetails as unknown as JsonValue })).toBe(true);
    expect(storage.canWrite?.({ 'beam-details': nextDetails as unknown as JsonValue, beam: ownBeam })).toBe(false);
    render(<WorkbenchStorageContext.Provider value={storage}><ProjectProvider><DesignWorkbench nativeTool={false} startElement="beam" /></ProjectProvider></WorkbenchStorageContext.Provider>);
    await user.click(screen.getByRole('button', { name: 'Cargas generales y detalle físico' }));
    await user.click(screen.getByRole('button', { name: 'Agregar bastón' }));

    expect(screen.queryByRole('group', { name: 'Bastón 1' })).toBeNull();
    expect(storage.read('beam')).toMatchObject({ rebarMode: 'auto' });
    expect(storage.read('beam-details')).toEqual(EMPTY_BEAM_DETAILS);
    expect(await screen.findByText(/cambio fue rechazado por falta de espacio/i)).toBeTruthy();
    expect(within(results()).getByText(/Mu positivo/)).toBeTruthy();
    storage.flush();
    const reopened = parseWorkbenchDocument(persisted.at(-1));
    expect(reopened.beam).toMatchObject({ rebarMode: 'auto' });
    expect(reopened['beam-details']).toEqual(EMPTY_BEAM_DETAILS);
    expect(reopened.memory).toHaveLength(60);
  });

  it('mantiene el historial si el lote completo de deshacer es rechazado y permite reintentarlo', async () => {
    const user = userEvent.setup();
    const data: Record<string, unknown> = { beam: { ...BEAM_DEFAULTS }, 'beam-details': EMPTY_BEAM_DETAILS, 'beam-spans': DEFAULT_SPANS.map((span) => ({ ...span })) };
    let rejectUndo = true;
    const batches: Record<string, unknown>[] = [];
    const storage = {
      read: (key: string) => data[key],
      write: (key: string, value: unknown) => { data[key] = structuredClone(value); },
      canWrite: (writes: Record<string, unknown>) => {
        batches.push(writes);
        return !(rejectUndo && (writes.beam as typeof BEAM_DEFAULTS | undefined)?.rebarMode === 'auto' && JSON.stringify(writes['beam-details']) === JSON.stringify(EMPTY_BEAM_DETAILS));
      },
    };
    render(<WorkbenchStorageContext.Provider value={storage as never}><ProjectProvider><DesignWorkbench nativeTool={false} startElement="beam" /></ProjectProvider></WorkbenchStorageContext.Provider>);
    await user.click(screen.getByRole('button', { name: 'Cargas generales y detalle físico' }));
    await user.click(screen.getByRole('button', { name: 'Agregar bastón' }));
    expect(data.beam).toMatchObject({ rebarMode: 'own', ownBastions: 'custom' });
    expect(data['beam-details']).toMatchObject({ bastions: [{ id: expect.any(String) }] });
    expect(batches.at(-1)).toEqual(expect.objectContaining({ beam: expect.any(Object), 'beam-details': expect.any(Object) }));

    await user.click(screen.getByRole('heading', { name: 'Viga' }));
    await user.keyboard('{Control>}z{/Control}');
    expect(data.beam).toMatchObject({ rebarMode: 'own' });
    expect(data['beam-details']).toMatchObject({ bastions: [{ id: expect.any(String) }] });
    expect(batches.at(-1)).toEqual(expect.objectContaining({ beam: expect.any(Object), 'beam-details': expect.any(Object), 'beam-spans': expect.any(Array) }));

    rejectUndo = false;
    await user.keyboard('{Control>}z{/Control}');
    expect(data.beam).toMatchObject({ rebarMode: 'auto' });
    expect(data['beam-details']).toEqual(EMPTY_BEAM_DETAILS);
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
    await user.click(screen.getByRole('button', { name: 'Proponer sección' }));
    expect(await screen.findByText(/^Sección propuesta: .* cm/)).toBeTruthy();
    expect((screen.getByRole('textbox', { name: 'Base b (X)' }) as HTMLInputElement).value).not.toBe('40');
    expect((screen.getByRole('textbox', { name: 'Barras cara b' }) as HTMLInputElement).value).toBe('3');
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
