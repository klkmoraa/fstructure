// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultProject } from '../../../data/defaultProject';
import { PROJECT_STORAGE_KEY } from '../../../data/projectStorage';
import { ProjectProvider } from '../../../store/ProjectContext';
import { DesignWorkbench } from './DesignWorkbench';

/** El giro cambia las media queries del layout, sin simular el teclado. */
function viewport(initialWidth: number, initialHeight: number) {
  let width = initialWidth;
  let height = initialHeight;
  const queries: { target: EventTarget; matches: () => boolean }[] = [];
  vi.stubGlobal('matchMedia', (media: string) => {
    const target = new EventTarget();
    const matches = () => media.split(',').some((part) => {
      const limits = [...part.matchAll(/max-(width|height):\s*(\d+)px/g)];
      return limits.length > 0 && limits.every(([, axis, value]) => (axis === 'width' ? width : height) <= Number(value));
    });
    Object.defineProperties(target, { media: { value: media }, matches: { get: matches } });
    queries.push({ target, matches });
    return target;
  });
  return (nextWidth: number, nextHeight: number) => act(() => {
    const previous = queries.map((query) => query.matches());
    width = nextWidth;
    height = nextHeight;
    queries.forEach((query, index) => { if (query.matches() !== previous[index]) query.target.dispatchEvent(new Event('change')); });
  });
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(createDefaultProject()));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const renderBeam = () => render(<ProjectProvider><DesignWorkbench nativeTool={false} startElement="beam" /></ProjectProvider>);

describe('DesignWorkbench · teléfono', () => {
  it('reencuadra la pieza elegida moviendo sólo el selector horizontal', async () => {
    viewport(320, 740);
    const bounds = HTMLElement.prototype.getBoundingClientRect;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains('dw-dock__group')) return new DOMRect(12, 60, 296, 58);
      const strip = this.closest<HTMLElement>('.dw-dock__group');
      if (strip && this.classList.contains('sc-tool-button')) {
        const index = [...strip.querySelectorAll('.sc-tool-button')].indexOf(this);
        return new DOMRect(12 + index * 60 - strip.scrollLeft, 63, 58, 52);
      }
      return bounds.call(this);
    });
    const user = userEvent.setup();
    renderBeam();
    document.documentElement.scrollTop = 120;
    await user.click(screen.getByRole('button', { name: 'Datos' }));
    await user.click(screen.getByRole('radio', { name: 'Secciones' }));
    const selected = screen.getByRole('radio', { name: 'Secciones' });
    const strip = selected.closest<HTMLElement>('.dw-dock__group')!;
    expect(selected.getAttribute('aria-checked')).toBe('true');
    expect(strip.scrollLeft).toBeGreaterThan(0);
    expect(selected.getBoundingClientRect().right).toBeLessThanOrEqual(strip.getBoundingClientRect().right);
    expect(document.documentElement.scrollTop).toBe(120);
    expect(screen.getByRole('button', { name: 'Datos' }).getAttribute('aria-pressed')).toBe('true');
    document.documentElement.scrollTop = 0;
  });

  it('mantiene la vista activa al tocar su pestaña y conserva los campos al volver del dibujo', async () => {
    viewport(390, 844);
    const user = userEvent.setup();
    renderBeam();
    const data = screen.getByRole('button', { name: 'Datos' });
    await user.click(data);
    const length = screen.getByRole('textbox', { name: 'Claro 1 · L (m)' });
    await user.clear(length);
    await user.type(length, '6.25');
    await user.click(data);
    expect(data.getAttribute('aria-pressed')).toBe('true');
    await user.click(screen.getByRole('button', { name: 'Dibujo' }));
    await user.click(data);
    expect((length as HTMLInputElement).value).toBe('6.25');
    expect(data.getAttribute('aria-pressed')).toBe('true');
  });

  it('llega directo al armado y a la sección sin abrir el teclado ni perder el armado elegido', async () => {
    viewport(320, 740);
    const user = userEvent.setup();
    renderBeam();
    await user.click(screen.getByRole('button', { name: 'Datos' }));
    await user.click(screen.getByRole('button', { name: 'Ir a armado' }));
    const reinforcement = screen.getByRole('region', { name: 'Acero longitudinal y transversal' });
    await waitFor(() => expect(document.activeElement).toBe(reinforcement));
    await user.click(within(reinforcement).getByRole('radio', { name: 'Propio' }));
    const bars = within(reinforcement).getByRole('textbox', { name: 'Corridas abajo' });
    await user.clear(bars);
    await user.type(bars, '4');
    await user.click(screen.getByRole('button', { name: 'Ir a sección y materiales' }));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('region', { name: 'Geometría y materiales' })));
    await user.click(screen.getAllByRole('button', { name: 'Volver al dibujo' })[0]!);
    expect(screen.getByRole('button', { name: 'Dibujo' }).getAttribute('aria-pressed')).toBe('true');
    await user.click(screen.getByRole('button', { name: 'Datos' }));
    await user.click(screen.getByRole('button', { name: 'Ir a armado' }));
    expect((bars as HTMLInputElement).value).toBe('4');
    expect(within(reinforcement).getByRole('radio', { name: 'Propio' }).getAttribute('aria-checked')).toBe('true');
  });

  it('conserva Resultados al girar a horizontal y al cambiar el espacio disponible', async () => {
    const resize = viewport(390, 844);
    const user = userEvent.setup();
    renderBeam();
    const results = screen.getByRole('button', { name: 'Resultados' });
    await user.click(results);
    resize(844, 390);
    expect(results.getAttribute('aria-pressed')).toBe('true');
    await user.click(results);
    expect(results.getAttribute('aria-pressed')).toBe('true');
    resize(900, 700);
    expect(results.getAttribute('aria-pressed')).toBe('true');
    resize(320, 740);
    expect(results.getAttribute('aria-pressed')).toBe('true');
  });
});
