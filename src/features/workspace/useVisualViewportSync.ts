import { useEffect, type RefObject } from 'react';

const hasKeyboardFocus = () => {
  const active = document.activeElement;
  if (active instanceof HTMLInputElement) {
    return !active.disabled && !active.readOnly && active.inputMode !== 'none'
      && ['text', 'search', 'email', 'url', 'tel', 'password', 'number'].includes(active.type);
  }
  if (active instanceof HTMLTextAreaElement) return !active.disabled && !active.readOnly && active.inputMode !== 'none';
  if (!(active instanceof HTMLElement) || active.inputMode === 'none') return false;
  const editable = active.closest('[contenteditable]');
  return editable !== null && ['', 'true', 'plaintext-only'].includes(editable.getAttribute('contenteditable')?.toLowerCase() ?? '');
};

/** Desplaza sólo los paneles del campo: nunca el documento ni el lienzo. */
const revealKeyboardField = (shell: HTMLElement, viewport: VisualViewport) => {
  const field = document.activeElement;
  if (!(field instanceof HTMLElement) || !shell.contains(field)) return;
  for (let panel = field.parentElement; panel && panel !== shell; panel = panel.parentElement) {
    if (!/(auto|scroll)/.test(getComputedStyle(panel).overflowY) || panel.scrollHeight <= panel.clientHeight) continue;
    const box = panel.getBoundingClientRect();
    const input = field.getBoundingClientRect();
    const top = Math.max(box.top, viewport.offsetTop) + 12;
    const bottom = Math.min(box.bottom, viewport.offsetTop + viewport.height) - 12;
    if (bottom <= top) continue;
    if (input.bottom > bottom) panel.scrollTop += input.bottom - bottom;
    else if (input.top < top) panel.scrollTop -= top - input.top;
  }
};

/** Publica la oclusión del teclado sin confundirla con el zoom de página. */
export function useVisualViewportSync(shellRef: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const viewport = window.visualViewport;
    const shell = shellRef.current;
    if (!viewport || !shell) return undefined;
    let revealFrame = 0;
    const syncViewport = () => {
      // La altura multiplicada por la escala elimina sólo el efecto del zoom:
      // un teclado abierto después del pellizco sigue restando espacio visible.
      const keyboardOcclusion = window.innerHeight - viewport.height * viewport.scale;
      const keyboardOpen = hasKeyboardFocus() && keyboardOcclusion > 120;
      const bottom = keyboardOpen ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0;
      shell.style.setProperty('--sc-visual-viewport-height', `${keyboardOpen ? viewport.height : window.innerHeight}px`);
      shell.style.setProperty('--sc-visual-viewport-top', `${keyboardOpen ? viewport.offsetTop : 0}px`);
      shell.style.setProperty('--sc-visual-viewport-bottom', `${bottom}px`);
      // Sólo al escribir con el teclado abierto movemos las hojas y apartamos
      // el dock; durante un pellizco sin teclado se conserva la geometría de mesa.
      shell.toggleAttribute('data-keyboard', keyboardOpen);
      window.cancelAnimationFrame(revealFrame);
      if (keyboardOpen) {
        // Espera a que CSS ajuste la hoja antes de comprobar el campo enfocado.
        revealFrame = window.requestAnimationFrame(() => revealKeyboardField(shell, viewport));
      }
    };
    syncViewport();
    viewport.addEventListener('resize', syncViewport);
    viewport.addEventListener('scroll', syncViewport);
    window.addEventListener('resize', syncViewport);
    document.addEventListener('focusin', syncViewport);
    document.addEventListener('focusout', syncViewport);
    return () => {
      window.cancelAnimationFrame(revealFrame);
      viewport.removeEventListener('resize', syncViewport);
      viewport.removeEventListener('scroll', syncViewport);
      window.removeEventListener('resize', syncViewport);
      document.removeEventListener('focusin', syncViewport);
      document.removeEventListener('focusout', syncViewport);
      shell.removeAttribute('data-keyboard');
      shell.style.removeProperty('--sc-visual-viewport-height');
      shell.style.removeProperty('--sc-visual-viewport-top');
      shell.style.removeProperty('--sc-visual-viewport-bottom');
    };
  }, [shellRef]);
}

