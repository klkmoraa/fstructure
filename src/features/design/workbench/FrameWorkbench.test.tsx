// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDefaultProject } from '../../../data/defaultProject';
import { PROJECT_STORAGE_KEY } from '../../../data/projectStorage';
import { ProjectProvider } from '../../../store/ProjectContext';
import { DesignWorkbench } from './DesignWorkbench';
import { DEFAULT_BAYS, DEFAULT_STORIES, FRAME_DEFAULTS, frameReportFromDraft } from './frameModel';
import { memoText } from './designReport';
import { reportFromMemoryItem } from './designMemory';
import { buildDesignMemoriaPdf } from './designReportPdf';

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(createDefaultProject()));
});
afterEach(cleanup);

const results = () => screen.getByRole('region', { name: 'Resultados' });

describe('mesa Estructura con el pórtico generado', () => {
  it('diseña vigas y columnas juntas y abre el miembro elegido', async () => {
    const user = userEvent.setup();
    render(<ProjectProvider><DesignWorkbench nativeTool={false} startElement="frame" /></ProjectProvider>);
    expect(screen.getByRole('heading', { name: 'Estructura' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Pórtico generado' }).getAttribute('aria-checked')).toBe('true');
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

  it('sin Modelo 2D la fuente lo explica y no inventa resultados', async () => {
    const user = userEvent.setup();
    render(<ProjectProvider><DesignWorkbench nativeTool={false} startElement="frame" /></ProjectProvider>);
    await user.click(screen.getByRole('radio', { name: 'Modelo 2D' }));
    expect(screen.getByText('Sin Modelo 2D')).toBeTruthy();
    expect(await screen.findByText(/No hay Modelo 2D en este proyecto/)).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: 'Claro 1 · L (m)' })).toBeNull();
  });

  it('sin fuerzas laterales no pide la columna F y el marco arriostrado no se desplaza', async () => {
    const user = userEvent.setup();
    render(<ProjectProvider><DesignWorkbench nativeTool={false} startElement="frame" /></ProjectProvider>);
    expect(screen.getByRole('textbox', { name: 'Nivel 1 · F (kN)' })).toBeTruthy();
    await user.click(screen.getByRole('radio', { name: 'Arriostrado' }));
    expect(screen.queryByRole('textbox', { name: 'Nivel 1 · F (kN)' })).toBeNull();
    expect(await within(results()).findByText('Arriostrado')).toBeTruthy();
  });

  it('la memoria del proyecto recalcula el pórtico desde su borrador', () => {
    const outcome = frameReportFromDraft('nsr-10', { ...FRAME_DEFAULTS, tag: 'P-2' }, DEFAULT_BAYS, DEFAULT_STORIES);
    if (!outcome.ok) throw new Error(outcome.errors.join('\n'));
    expect(outcome.report.element).toBe('frame');
    expect(memoText(outcome.report)).toMatch(/^PÓRTICO 2 claros × 2 niveles/m);
    expect(outcome.report.figures.length).toBeGreaterThanOrEqual(6);
    const fromMemory = reportFromMemoryItem({
      id: 'p1', element: 'frame', code: 'nsr-10', savedAt: '2026-10-03', fields: { ...FRAME_DEFAULTS, tag: 'P-2' },
      rows: DEFAULT_BAYS.map((bay) => ({ ...bay })), levels: DEFAULT_STORIES.map((story) => ({ ...story })),
    });
    expect(fromMemory.ok && fromMemory.report.governingRatio).toBeCloseTo(outcome.report.governingRatio, 9);
  });

  it.each(['ntc-2023', 'nsr-10', 'e060'] as const)('genera el PDF del pórtico con %s', async (code) => {
    const outcome = frameReportFromDraft(code, FRAME_DEFAULTS, DEFAULT_BAYS, DEFAULT_STORIES);
    if (!outcome.ok) throw new Error(outcome.errors.join('\n'));
    const bytes = await buildDesignMemoriaPdf([outcome.report], { figures: false });
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
  });
});
