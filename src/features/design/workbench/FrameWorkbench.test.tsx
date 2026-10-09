// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultProject } from '../../../data/defaultProject';
import { PROJECT_STORAGE_KEY } from '../../../data/projectStorage';
import { ProjectProvider } from '../../../store/ProjectContext';
import { DesignWorkbench } from './DesignWorkbench';
import { DEFAULT_BAYS, DEFAULT_STORIES, FRAME_DEFAULTS, FRAME_LEGACY, frameReportFromDraft } from './frameModel';
import { memoText } from './designReport';
import { reportFromMemoryItem } from './designMemory';
import { buildDesignMemoriaPdf } from './designReportPdf';

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(createDefaultProject()));
});
afterEach(cleanup);

const results = () => screen.getByRole('region', { name: 'Resultados' });

describe('mesa Estructura con el pórtico rápido', () => {
  it('un modelo sin pórticos no detiene la mesa: abre el pórtico rápido y, si se elige, ofrece salidas', async () => {
    const user = userEvent.setup();
    const empty3d = { label: '3D', axes: [], columns: [], source: () => { throw new Error('sin ejes'); } };
    const onOpenSpace3D = vi.fn();
    render(<ProjectProvider><DesignWorkbench nativeTool={false} startElement="frame" startSource="model3d" modelAxes={empty3d} onOpenSpace3D={onOpenSpace3D} /></ProjectProvider>);
    expect(screen.getByRole('radio', { name: 'Pórtico rápido' }).getAttribute('aria-checked')).toBe('true');
    expect(await screen.findByRole('img', { name: /Utilización de el pórtico/ })).toBeTruthy();
    // Elegir el 3D vacío no muestra un error: ofrece modelar aquí o en el 3D.
    await user.click(screen.getByRole('radio', { name: 'Modelo 3D' }));
    expect(screen.queryByText('Revisa los datos')).toBeNull();
    await user.click(await screen.findByRole('button', { name: 'Modelar en 3D' }));
    expect(onOpenSpace3D).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: 'Pórtico rápido' }));
    expect(screen.getByRole('radio', { name: 'Pórtico rápido' }).getAttribute('aria-checked')).toBe('true');
  });

  it('con el 3D vacío, «Crear edificio» abre el 3D con su plantilla', async () => {
    const user = userEvent.setup();
    const empty3d = { label: '3D', axes: [], columns: [], source: () => { throw new Error('sin ejes'); } };
    const onCreateBuilding = vi.fn();
    render(<ProjectProvider><DesignWorkbench nativeTool={false} startElement="frame" startSource="frame" modelAxes={empty3d} onOpenSpace3D={vi.fn()} onCreateBuilding={onCreateBuilding} /></ProjectProvider>);
    await user.click(screen.getByRole('radio', { name: 'Modelo 3D' }));
    await user.click(await screen.findByRole('button', { name: 'Crear edificio' }));
    expect(onCreateBuilding).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'Modelar en 3D' })).toBeNull();
  });

  it('diseña vigas y columnas juntas y abre el miembro elegido', async () => {
    const user = userEvent.setup();
    render(<ProjectProvider><DesignWorkbench nativeTool={false} startElement="frame" startSource="frame" /></ProjectProvider>);
    expect(screen.getByRole('heading', { name: 'Estructura' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Pórtico rápido' }).getAttribute('aria-checked')).toBe('true');
    expect(await screen.findByRole('img', { name: /Utilización de el pórtico: 2 líneas de viga y 6 columnas/ })).toBeTruthy();
    const grid = within(results()).getByRole('table', { name: /Cociente que rige en cada miembro/ });
    // Dos niveles: una viga continua y tres columnas por renglón.
    expect(within(grid).getAllByRole('button')).toHaveLength(8);
    await user.click(within(grid).getByRole('button', { name: /Columna del eje 1, nivel 1/ }));
    expect(await screen.findByRole('img', { name: /Diagrama de interacción/ })).toBeTruthy();
    expect(within(results()).getByRole('heading', { name: 'Columna del eje 1, nivel 1' })).toBeTruthy();
    // Un claro más: la matriz crece con el eje nuevo.
    await user.click(screen.getByRole('button', { name: 'Agregar claro' }));
    expect(await within(within(results()).getByRole('table', { name: /Cociente que rige/ })).findByRole('button', { name: /Columna del eje 4, nivel 2/ })).toBeTruthy();
    // El diagrama de la estructura se cambia y los miembros se eligen en el dibujo.
    await user.click(screen.getByRole('radio', { name: 'Momento' }));
    expect(screen.getByRole('img', { name: /Envolvente de momento en el pórtico/ })).toBeTruthy();
    await user.click(screen.getAllByRole('button', { name: /^Viga del nivel 2 · V2·1/ })[0]!);
    expect(await screen.findByRole('img', { name: /Elevación de la viga de 3 claros/ })).toBeTruthy();
  });

  it('señala en el diagrama y la leyenda una revisión transversal pendiente', async () => {
    const draft = { ...FRAME_DEFAULTS, source: 'frame', stirrup: '6.4', columnWidth: '80', columnHeight: '80', wallLoad: '0' };
    localStorage.setItem('fstructure.design-workbench.frame', JSON.stringify(draft));
    render(<ProjectProvider><DesignWorkbench nativeTool={false} startElement="frame" startSource="frame" /></ProjectProvider>);
    expect(await screen.findByText('* Revisión pendiente')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /revisión pendiente/ }).length).toBeGreaterThan(0);
    const drawing = screen.getByRole('img', { name: /Utilización de el pórtico/ });
    expect(drawing.querySelector('.dw-frame__member[data-band="review"]')).toBeTruthy();
    expect(drawing.querySelector('.dw-frame__ratios text[data-band="review"]')?.getAttribute('aria-label')).toContain('revisión pendiente');
  });

  it('«Proponer» busca la viga y la columna con menos concreto que cumplen y Ctrl+Z las devuelve', async () => {
    const user = userEvent.setup();
    render(<ProjectProvider><DesignWorkbench nativeTool={false} startElement="frame" startSource="frame" /></ProjectProvider>);
    const beamHeight = () => (screen.getByRole('textbox', { name: /Viga h/ }) as HTMLInputElement).value;
    expect(beamHeight()).toBe('55');
    await user.click(screen.getByRole('button', { name: 'Proponer' }));
    const note = await screen.findByText(/Ctrl\+Z lo deshace/, undefined, { timeout: 10_000 });
    const [, b, h, c] = /Viga (\d+) × (\d+) y columna (\d+) ×/.exec(note.textContent ?? '')!;
    expect(beamHeight()).toBe(h);
    expect((screen.getByRole('textbox', { name: /Viga b/ }) as HTMLInputElement).value).toBe(b);
    expect((screen.getByRole('textbox', { name: /Columna h/ }) as HTMLInputElement).value).toBe(c);
    // El resultado de la mesa cumple con lo propuesto.
    expect(await within(results()).findByText(/Cumple/)).toBeTruthy();
    await user.keyboard('{Control>}z{/Control}');
    expect(beamHeight()).toBe('55');
  }, 20_000);

  it('sin Modelo 2D ofrece modelar aquí y no inventa resultados', async () => {
    const user = userEvent.setup();
    render(<ProjectProvider><DesignWorkbench nativeTool={false} startElement="frame" startSource="frame" /></ProjectProvider>);
    await user.click(screen.getByRole('radio', { name: 'Modelo 2D' }));
    expect(screen.getByText('Sin Modelo 2D')).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'Pórtico rápido' })).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: 'Claro 1 · L (m)' })).toBeNull();
  });

  it('sin fuerzas laterales no pide la columna F y el marco arriostrado no se desplaza', async () => {
    const user = userEvent.setup();
    render(<ProjectProvider><DesignWorkbench nativeTool={false} startElement="frame" startSource="frame" /></ProjectProvider>);
    expect(screen.getByRole('textbox', { name: 'Nivel 1 · F (kN)' })).toBeTruthy();
    await user.click(screen.getByRole('radio', { name: 'Arriostrado' }));
    expect(screen.queryByRole('textbox', { name: 'Nivel 1 · F (kN)' })).toBeNull();
    expect(await within(results()).findByText('Arriostrado')).toBeTruthy();
  });

  it('la memoria del proyecto recalcula el pórtico desde su borrador', () => {
    const outcome = frameReportFromDraft('nsr-10', { ...FRAME_DEFAULTS, ...FRAME_LEGACY, tag: 'P-2' }, DEFAULT_BAYS, DEFAULT_STORIES);
    if (!outcome.ok) throw new Error(outcome.errors.join('\n'));
    expect(outcome.report.element).toBe('frame');
    expect(memoText(outcome.report)).toMatch(/^PÓRTICO 2 claros × 2 niveles/m);
    expect(outcome.report.figures.length).toBeGreaterThanOrEqual(6);
    const fromMemory = reportFromMemoryItem({
      id: 'p1', element: 'frame', code: 'nsr-10', savedAt: '2026-10-03', fields: { ...FRAME_DEFAULTS, tag: 'P-2', source: 'frame' },
      rows: DEFAULT_BAYS.map((bay) => ({ ...bay })), levels: DEFAULT_STORIES.map((story) => ({ ...story })),
    });
    expect(fromMemory.ok && fromMemory.report.governingRatio).toBeCloseTo(outcome.report.governingRatio, 9);
  });

  it.each(['ntc-2023', 'nsr-10', 'e060'] as const)('genera el PDF del pórtico con %s', async (code) => {
    const outcome = frameReportFromDraft(code, { ...FRAME_DEFAULTS, ...FRAME_LEGACY }, DEFAULT_BAYS, DEFAULT_STORIES);
    if (!outcome.ok) throw new Error(outcome.errors.join('\n'));
    const bytes = await buildDesignMemoriaPdf([outcome.report], { figures: false });
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
  });
});
