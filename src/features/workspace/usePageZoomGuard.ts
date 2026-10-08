import { useEffect } from 'react';

/**
 * La mesa tiene su propio zoom (el del lienzo). En un teléfono, un pellizco que
 * empezaba sobre la barra, el dock o una hoja ampliaba la PÁGINA entera y la
 * dejaba así: en la app instalada no hay barra del navegador para volver.
 *
 * Mientras la mesa está montada, el pellizco de página se anula —los gestos de
 * Safari (`gesture*`) y el `touchmove` de dos dedos—; el lienzo sigue
 * recibiendo sus eventos de puntero y hace su propio zoom. El doble toque lo
 * anula `touch-action: manipulation` en `.app-shell`.
 */
export const usePageZoomGuard = () => {
  useEffect(() => {
    const block = (event: Event) => event.preventDefault();
    const blockPinch = (event: TouchEvent) => {
      if (event.touches.length > 1 && event.cancelable) event.preventDefault();
    };
    const options = { passive: false } as const;
    document.addEventListener('gesturestart', block, options);
    document.addEventListener('gesturechange', block, options);
    document.addEventListener('touchmove', blockPinch, options);
    return () => {
      document.removeEventListener('gesturestart', block);
      document.removeEventListener('gesturechange', block);
      document.removeEventListener('touchmove', blockPinch);
    };
  }, []);
};
