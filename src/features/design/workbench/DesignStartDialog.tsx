import { Box, Building2, ChevronRight, Layers3, Ruler, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Tabs } from '../../../design-system/components/disclosure';
import { Dialog } from '../../../design-system/components/overlays';
import { designCode, type DesignCodeId } from '../../../design/elements/codes';
import { DESIGN_STARTS, type DesignStart, type DesignStartCategory } from './designStarts';
import './designStart.css';

interface DesignStartDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasModel2d: boolean;
  hasModel3d: boolean;
  code: DesignCodeId;
  projectName?: string;
  onStart: (start: DesignStart) => 'started' | 'full';
  onOpenModel?: () => void;
  onOpenSpace3D?: () => void;
  onCreateBuilding?: () => void;
  onOpenMemory?: () => void;
  initialCategory?: DesignStartCategory;
}

const CATEGORIES: readonly { id: DesignStartCategory; label: string; description: string; icon: typeof Layers3 }[] = [
  { id: 'project', label: 'Proyecto', description: 'Diseña el modelo completo o empieza con un pórtico editable.', icon: Building2 },
  { id: 'piece', label: 'Pieza', description: 'Abre un elemento independiente y ajusta sus datos.', icon: Ruler },
  { id: 'exercise', label: 'Ejercicio', description: 'Parte de un problema visible con sus supuestos y referencias.', icon: Sparkles },
];

export function DesignStartDialog({ open, onOpenChange, hasModel2d, hasModel3d, code, projectName, onStart, onOpenModel, onOpenSpace3D, onCreateBuilding, onOpenMemory, initialCategory = 'project' }: DesignStartDialogProps) {
  const [category, setCategory] = useState<DesignStartCategory>(initialCategory);
  const [full, setFull] = useState(false);
  const entries = useMemo(() => DESIGN_STARTS.filter((item) => item.category === category), [category]);
  const codeName = designCode(code).name;

  const start = (item: DesignStart) => {
    setFull(false);
    if (onStart(item) === 'full') setFull(true);
  };
  const changeOpen = (next: boolean) => {
    if (!next) setFull(false);
    onOpenChange(next);
  };

  const tabs = CATEGORIES.map(({ id, label, description, icon: Icon }) => ({
    id,
    label,
    content: <div className="dw-start__tab-content">
      <p className="dw-start__category-note">{description}</p>
      <div className="dw-start__cards">
        {entries.map((item) => {
          const unavailable = item.id === 'project-2d' && !hasModel2d ? '2d' : item.id === 'project-3d' && !hasModel3d ? '3d' : null;
          return <article className="dw-start-card" key={item.id}>
            <div className="dw-start-card__top">
              <span className="dw-start-card__icon" aria-hidden="true"><Icon size={17} /></span>
              <span className="dw-start-card__element">{item.element === 'frame' ? 'Estructura' : item.element === 'beam' ? 'Viga' : item.element === 'column' ? 'Columna' : item.element === 'footing' ? 'Cimentación' : 'Sección'}</span>
            </div>
            <h3>{item.title}</h3>
            <p>{item.description}</p>
            {item.reference ? <p className="dw-start-card__reference">{item.reference}</p> : null}
            {unavailable ? <div className="dw-start-card__unavailable">
              <p>{unavailable === '2d'
                ? 'El proyecto no tiene vigas o columnas de concreto disponibles para diseñar.'
                : 'El modelo 3D aún no tiene ejes con vigas o columnas de concreto.'}</p>
              <button className="dw-start-card__disabled" type="button" disabled>{`Modelo ${unavailable === '2d' ? '2D' : '3D'} no disponible`}</button>
              <div className="dw-start-card__actions">
                {unavailable === '2d' && onOpenModel ? <button type="button" onClick={onOpenModel}><Layers3 size={15} aria-hidden="true" />Modelar en 2D</button> : null}
                {unavailable === '3d' && onCreateBuilding ? <button type="button" onClick={onCreateBuilding}><Building2 size={15} aria-hidden="true" />Crear edificio</button> : null}
                {unavailable === '3d' && onOpenSpace3D ? <button type="button" onClick={onOpenSpace3D}><Box size={15} aria-hidden="true" />Modelar en 3D</button> : null}
              </div>
            </div> : <button className="dw-start-card__choose" type="button" aria-label={`Iniciar diseño: ${item.title}`} onClick={() => start(item)}>
              <span>Iniciar diseño</span><ChevronRight size={17} aria-hidden="true" />
            </button>}
          </article>;
        })}
      </div>
    </div>,
  }));

  return <Dialog open={open} onOpenChange={changeOpen} title="Nuevo diseño"
    description={projectName?.trim() ? `Proyecto: ${projectName.trim()} · Norma vigente: ${codeName}` : `Elige un punto de partida · Norma vigente: ${codeName}`}
    closeLabel="Cerrar nuevo diseño" className="dw-start-dialog">
    <Tabs label="Tipo de inicio" items={tabs} value={category} onValueChange={(value) => { setCategory(value as DesignStartCategory); setFull(false); }} />
    {full ? <div className="dw-start__full" role="alert">
      <p>No hay espacio suficiente para conservar el trabajo actual. Libera espacio en la memoria del proyecto y vuelve a intentarlo.</p>
      {onOpenMemory ? <button type="button" onClick={() => { changeOpen(false); onOpenMemory(); }}>Abrir memoria del proyecto</button> : null}
    </div> : null}
  </Dialog>;
}
