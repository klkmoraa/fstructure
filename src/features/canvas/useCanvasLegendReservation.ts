import { useLayoutEffect, useState, type RefObject } from 'react';
import type { CanvasSafeRect } from './canvasChromeGeometry';
import type { ViewportSize } from './canvasInteraction';

/**
 * La leyenda del diagrama (N, V o M) flota sobre el lienzo: sin reservar su
 * caja, la cifra de un extremo podía quedar debajo de ella. `key` cambia con
 * lo que hace aparecer, cambiar o desaparecer la leyenda.
 */
export const useCanvasLegendReservation = (
  canvasRef: RefObject<SVGSVGElement | null>,
  viewport: ViewportSize,
  key: string,
): CanvasSafeRect | null => {
  const [reservation, setReservation] = useState<CanvasSafeRect | null>(null);
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.closest('.canvas-host');
    const legend = host?.querySelector<HTMLElement>('[data-canvas-chrome="result-legend"]');
    let next: CanvasSafeRect | null = null;
    if (canvas && legend) {
      const area = canvas.getBoundingClientRect();
      const box = legend.getBoundingClientRect();
      if (area.width > 0 && area.height > 0 && box.width > 0 && box.height > 0) next = {
        x: (box.left - area.left) * viewport.width / area.width,
        y: (box.top - area.top) * viewport.height / area.height,
        width: box.width * viewport.width / area.width,
        height: box.height * viewport.height / area.height,
      };
    }
    setReservation((current) => current?.x === next?.x && current?.y === next?.y
      && current?.width === next?.width && current?.height === next?.height ? current : next);
  }, [canvasRef, viewport.width, viewport.height, key]);
  return reservation;
};
