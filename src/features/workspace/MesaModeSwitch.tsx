import { Box, DraftingCompass, PenLine } from 'lucide-react';
import type { MesaMode } from '../../shared/navigation/projectUrl';
import { preloadMesaMode } from './toolSurfaces';

/**
 * 2D, 3D o Diseño: los modos de la misma mesa de FStructure. Es la primera pieza
 * de la barra de acciones; el proyecto, el guardado, la marca y el tema no
 * cambian al pasar de uno a otro, sólo los controles del modo.
 */
export function MesaModeSwitch({ mode, onChange, language }: { mode: MesaMode; onChange: (mode: MesaMode) => void; language: 'es' | 'en' }) {
  const es = language === 'es';
  const options = [
    { id: 'model' as const, short: '2D', label: es ? 'Modelo 2D' : '2D model', hint: es ? 'Dibujar, cargar y analizar en el plano' : 'Draw, load and analyse in the plane', Icon: PenLine },
    { id: '3d' as const, short: '3D', label: es ? 'Modelo 3D' : '3D model', hint: es ? 'Modelar y analizar en el espacio' : 'Model and analyse in space', Icon: Box },
    { id: 'design' as const, short: es ? 'Diseño' : 'Design', label: es ? 'Diseño' : 'Design', hint: es ? 'Diseñar en concreto el modelo y elementos sueltos' : 'Concrete design of the model and single elements', Icon: DraftingCompass },
  ];
  return <div className="workspace-topbar__mode-group" data-workspace-group="mode" role="group" aria-label={es ? 'Modo de la mesa' : 'Workspace mode'}>
    {options.map(({ id, short, label, hint, Icon }) => <button key={id} type="button"
      className={'workspace-topbar__action-button workspace-topbar__mode-button' + (mode === id ? ' is-active' : '')}
      aria-pressed={mode === id} aria-label={label} title={hint} data-mesa-mode={id}
      onPointerEnter={() => { void preloadMesaMode(id); }} onFocus={() => { void preloadMesaMode(id); }}
      onClick={() => { if (mode !== id) onChange(id); }}>
      <Icon size={17} aria-hidden="true" /><span>{short}</span>
    </button>)}
  </div>;
}
