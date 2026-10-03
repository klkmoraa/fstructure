import { DraftingCompass, PenLine } from 'lucide-react';
import type { MesaMode } from '../../shared/navigation/projectUrl';

/**
 * Modelar o diseñar: los dos modos de la misma mesa de FStructure. Es la
 * primera pieza de la barra de acciones; el proyecto, el guardado y el tema no
 * cambian al pasar de uno a otro.
 */
export function MesaModeSwitch({ mode, onChange, language }: { mode: MesaMode; onChange: (mode: MesaMode) => void; language: 'es' | 'en' }) {
  const es = language === 'es';
  const options = [
    { id: 'model' as const, label: es ? 'Modelo' : 'Model', hint: es ? 'Dibujar, cargar y analizar la estructura' : 'Draw, load and analyse the structure', Icon: PenLine },
    { id: 'design' as const, label: es ? 'Diseño' : 'Design', hint: es ? 'Diseñar en concreto el modelo y elementos sueltos' : 'Concrete design of the model and single elements', Icon: DraftingCompass },
  ];
  return <div className="workspace-topbar__mode-group" data-workspace-group="mode" role="group" aria-label={es ? 'Modo de la mesa' : 'Workspace mode'}>
    {options.map(({ id, label, hint, Icon }) => <button key={id} type="button"
      className={'workspace-topbar__action-button workspace-topbar__mode-button' + (mode === id ? ' is-active' : '')}
      aria-pressed={mode === id} aria-label={label} title={hint} onClick={() => { if (mode !== id) onChange(id); }}>
      <Icon size={17} aria-hidden="true" /><span>{label}</span>
    </button>)}
  </div>;
}
