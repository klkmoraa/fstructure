import { useLayoutEffect, useState, type RefObject } from 'react';
import type { CanvasSafeRect } from './canvasChromeGeometry';
import type { ViewportSize } from './canvasInteraction';

/** La cápsula es absoluta: sólo se reserva su intersección visible con el SVG. */
export const useCanvasDockReservation = (
  canvasRef: RefObject<SVGSVGElement | null>,
  viewport: ViewportSize,
  enabled: boolean,
): CanvasSafeRect | null => {
  const [reservation, setReservation] = useState<CanvasSafeRect | null>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const shell = canvas?.closest('.app-shell');
    const dock = shell?.querySelector<HTMLElement>('.mdock');
    if (!enabled || !canvas || !shell || !dock) {
      setReservation(null);
      return;
    }

    let context: HTMLElement | null = null;
    const measure = () => {
      const nextContext = dock.querySelector<HTMLElement>('.mdock__context');
      if (nextContext !== context) {
        if (context) resize.unobserve(context);
        context = nextContext;
        if (context) resize.observe(context);
      }
      const area = canvas.getBoundingClientRect();
      const overlay = context?.getBoundingClientRect();
      let next: CanvasSafeRect | null = null;
      if (overlay && area.width > 0 && area.height > 0
        && getComputedStyle(context!).visibility !== 'hidden'
        && getComputedStyle(context!).display !== 'none') {
        const left = Math.max(area.left, overlay.left);
        const top = Math.max(area.top, overlay.top);
        const right = Math.min(area.right, overlay.right);
        const bottom = Math.min(area.bottom, overlay.bottom);
        if (right > left && bottom > top) next = {
          x: (left - area.left) * viewport.width / area.width,
          y: (top - area.top) * viewport.height / area.height,
          width: (right - left) * viewport.width / area.width,
          height: (bottom - top) * viewport.height / area.height,
        };
      }
      setReservation((current) => current?.x === next?.x && current?.y === next?.y
        && current?.width === next?.width && current?.height === next?.height ? current : next);
    };
    // Cambia con la interfaz, no con cada frame de pan/zoom del dibujo.
    const resize = new ResizeObserver(measure);
    resize.observe(canvas);
    resize.observe(dock);
    const mutation = new MutationObserver(measure);
    mutation.observe(dock, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
    mutation.observe(shell, { attributes: true, attributeFilter: ['class', 'style', 'data-keyboard'] });
    window.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('scroll', measure);
    measure();
    return () => {
      resize.disconnect();
      mutation.disconnect();
      window.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('scroll', measure);
    };
  }, [canvasRef, enabled, viewport.width, viewport.height]);

  return enabled ? reservation : null;
};
