// @vitest-environment jsdom
import { useRef } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCanvasDockReservation } from './useCanvasDockReservation';

const Harness = () => {
  const ref = useRef<SVGSVGElement>(null);
  const rect = useCanvasDockReservation(ref, { width: 806, height: 232 }, true);
  return <div className="app-shell">
    <svg ref={ref} />
    <nav className="mdock"><div className="mdock__context" /></nav>
    <output aria-label="reservation">{JSON.stringify(rect)}</output>
  </div>;
};

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.spyOn(SVGElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(19, 67, 806, 232));
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    return this.classList.contains('mdock__context') ? new DOMRect(293, 264, 258, 52) : new DOMRect();
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('reserva real de la cápsula del canvas', () => {
  it('reserva sólo la intersección de la cápsula con el SVG, en coordenadas del lienzo', () => {
    render(<Harness />);
    expect(JSON.parse(screen.getByLabelText('reservation').textContent!)).toEqual({ x: 274, y: 197, width: 258, height: 35 });
  });

  it('libera la reserva cuando la cápsula deja de ser visible y la recupera al volver', async () => {
    const { container } = render(<Harness />);
    const capsule = container.querySelector<HTMLElement>('.mdock__context')!;
    await act(async () => { capsule.style.display = 'none'; });
    expect(screen.getByLabelText('reservation').textContent).toBe('null');
    await act(async () => { capsule.style.display = ''; });
    expect(JSON.parse(screen.getByLabelText('reservation').textContent!).width).toBe(258);
  });
});
