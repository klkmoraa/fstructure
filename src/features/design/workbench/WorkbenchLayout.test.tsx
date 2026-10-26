// @vitest-environment jsdom
import { cleanup, createEvent, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkbenchLayout, type WorkbenchChrome } from './WorkbenchLayout';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function drawing() {
  const chrome: WorkbenchChrome = { elements: null, codeControl: null, code: 'ntc-2023', panels: { inputs: false, results: false }, setPanel: vi.fn(), onReport: vi.fn(), mobile: true };
  const { container } = render(<WorkbenchLayout chrome={chrome} title="Viga" inputs={null} stage={<span>Lámina</span>} verdict={{ status: 'pass', label: 'Cumple' }} results={null} report={null} onReset={vi.fn()} />);
  const scroller = container.querySelector<HTMLDivElement>('.dw-stage__scroll')!;
  const content = container.querySelector<HTMLDivElement>('.dw-stage__content')!;
  Object.defineProperties(scroller, { clientWidth: { value: 300 }, clientHeight: { value: 400 } });
  vi.spyOn(scroller, 'getBoundingClientRect').mockImplementation(() => new DOMRect(20, 40, 300, 400));
  // La lámina empieza tras el padding; sólo el dibujo escala. El rect sigue
  // el scroll como en el navegador, sin imponer estilos al componente.
  vi.spyOn(content, 'getBoundingClientRect').mockImplementation(() => new DOMRect(44 - scroller.scrollLeft, 104 - scroller.scrollTop, 300, 1200));
  return scroller;
}

const touches = (left: number, right: number, y: number) => [{ identifier: 1, clientX: left, clientY: y }, { identifier: 2, clientX: right, clientY: y }];

describe('WorkbenchLayout · navegación del dibujo', () => {
  it('amplía alrededor del centro sin multiplicar el margen fijo de la lámina', async () => {
    const user = userEvent.setup();
    const scroller = drawing();
    await user.click(screen.getByRole('button', { name: 'Acercar' }));
    expect(screen.getByRole('button', { name: 'Tamaño normal. Zoom actual 125 %' })).toBeTruthy();
    expect(scroller.scrollLeft).toBeCloseTo((150 - 24) * 0.25);
    expect(scroller.scrollTop).toBeCloseTo((200 - 64) * 0.25);
    await user.click(screen.getByRole('button', { name: /Tamaño normal/ }));
    expect(scroller.scrollLeft).toBeCloseTo(0);
    expect(scroller.scrollTop).toBeCloseTo(0);
  });

  it('limita el pellizco y permite desplazarlo con dos dedos incluso en el zoom máximo', () => {
    const scroller = drawing();
    fireEvent.touchStart(scroller, { touches: touches(130, 170, 240) });
    fireEvent.touchMove(scroller, { touches: touches(50, 250, 240) });
    expect(screen.getByRole('button', { name: 'Tamaño normal. Zoom actual 300 %' })).toBeTruthy();
    const previous = { left: scroller.scrollLeft, top: scroller.scrollTop };
    fireEvent.touchMove(scroller, { touches: touches(30, 230, 210) });
    expect(scroller.scrollLeft).toBeCloseTo(previous.left + 20);
    expect(scroller.scrollTop).toBeCloseTo(previous.top + 30);
    fireEvent.touchCancel(scroller, { touches: [] });
    fireEvent.touchMove(scroller, { touches: touches(10, 210, 190) });
    expect(scroller.scrollLeft).toBeCloseTo(previous.left + 20);
  });

  it('deja el desplazamiento de un dedo y la rueda normal al navegador', () => {
    const scroller = drawing();
    const move = createEvent.touchMove(scroller, { touches: [{ identifier: 1, clientX: 120, clientY: 200 }], cancelable: true });
    fireEvent(scroller, move);
    expect(move.defaultPrevented).toBe(false);
    const wheel = createEvent.wheel(scroller, { deltaY: 80, cancelable: true });
    fireEvent(scroller, wheel);
    expect(wheel.defaultPrevented).toBe(false);
    expect(screen.getByRole('button', { name: 'Tamaño normal. Zoom actual 100 %' })).toBeTruthy();
  });
});
