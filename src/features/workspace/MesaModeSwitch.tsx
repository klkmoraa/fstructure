import { Box, DraftingCompass, PenLine } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { MesaMode } from '../../shared/navigation/projectUrl';
import { preloadMesaMode } from './toolSurfaces';

const MODE_KEYS: Record<string, MesaMode> = { Digit1: 'model', Digit2: '3d', Digit3: 'design' };

/** Un campo de texto o un diálogo abierto se quedan con el teclado. */
const keyboardBelongsElsewhere = (target: EventTarget | null) => {
  const element = target instanceof HTMLElement ? target : null;
  return Boolean(element && (element.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName)))
    || Boolean(document.querySelector('[role="dialog"][aria-modal="true"]'));
};

/**
 * 2D, 3D o Diseño: los modos de la misma mesa de FStructure. Es la primera pieza
 * de la barra de acciones; el proyecto, el guardado, la marca y el tema no
 * cambian al pasar de uno a otro, sólo los controles del modo.
 */
export function MesaModeSwitch({ mode, onChange, language }: { mode: MesaMode; onChange: (mode: MesaMode) => void; language: 'es' | 'en' }) {
  const es = language === 'es';
  // Alt+Mayús+1/2/3 cambia de modo desde cualquier parte de la mesa (código de
  // tecla, no carácter: funciona igual con cualquier distribución de teclado).
  const latest = useRef({ mode, onChange });
  latest.current = { mode, onChange };
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey || !event.shiftKey || event.ctrlKey || event.metaKey || event.defaultPrevented) return;
      const next = MODE_KEYS[event.code];
      if (!next || keyboardBelongsElsewhere(event.target)) return;
      event.preventDefault();
      if (next !== latest.current.mode) latest.current.onChange(next);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
  const options = [
    { id: 'model' as const, short: '2D', label: es ? 'Modelo 2D' : '2D model', hint: es ? 'Dibujar, cargar y analizar en el plano' : 'Draw, load and analyse in the plane', Icon: PenLine },
    { id: '3d' as const, short: '3D', label: es ? 'Modelo 3D' : '3D model', hint: es ? 'Modelar y analizar en el espacio' : 'Model and analyse in space', Icon: Box },
    { id: 'design' as const, short: es ? 'Diseño' : 'Design', label: es ? 'Diseño' : 'Design', hint: es ? 'Diseñar en concreto el modelo y elementos sueltos' : 'Concrete design of the model and single elements', Icon: DraftingCompass },
  ];
  return <div className="workspace-topbar__mode-group" data-workspace-group="mode" role="group" aria-label={es ? 'Modo de la mesa' : 'Workspace mode'}>
    {options.map(({ id, short, label, hint, Icon }, index) => <button key={id} type="button"
      className={'workspace-topbar__action-button workspace-topbar__mode-button' + (mode === id ? ' is-active' : '')}
      aria-pressed={mode === id} aria-label={label} title={`${hint} (Alt+${es ? 'Mayús' : 'Shift'}+${index + 1})`} data-mesa-mode={id}
      aria-keyshortcuts={`Alt+Shift+${index + 1}`}
      onPointerEnter={() => { void preloadMesaMode(id); }} onFocus={() => { void preloadMesaMode(id); }}
      onClick={() => { if (mode !== id) onChange(id); }}>
      <Icon size={17} aria-hidden="true" /><span>{short}</span>
    </button>)}
  </div>;
}
