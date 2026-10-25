import { useEffect } from 'react';

/**
 * Sólo los lienzos tienen zoom propio. `touch-action: none` mantiene allí los
 * eventos de puntero; estos gestos de Safari necesitan además cancelar el zoom
 * nativo. Fuera del lienzo, ampliar textos, formularios y resultados sigue siendo
 * una acción del navegador. No se interceptan los movimientos táctiles globales.
 */
export const usePageZoomGuard = () => {
  useEffect(() => {
    const blockCanvasGesture = (event: Event) => {
      if (event.cancelable && event.target instanceof Element
        && event.target.closest('.structural-canvas, .space3d-canvas-surface')) event.preventDefault();
    };
    const options = { passive: false } as const;
    document.addEventListener('gesturestart', blockCanvasGesture, options);
    document.addEventListener('gesturechange', blockCanvasGesture, options);
    return () => {
      document.removeEventListener('gesturestart', blockCanvasGesture);
      document.removeEventListener('gesturechange', blockCanvasGesture);
    };
  }, []);
};
