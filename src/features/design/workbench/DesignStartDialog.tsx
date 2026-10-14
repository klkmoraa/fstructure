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
  /** Inicios que ofrece el apartado; por omisión, los tres. */
  categories?: readonly DesignStartCategory[];
  /** Elementos disponibles en el apartado; los inicios de otros elementos no se muestran. */
  elements?: readonly string[];
}

const CATEGORIES: readonly { id: DesignStartCategory; label: string; description: string; icon: typeof Layers3 }[] = [
  { id: 'project', label: 'Proyecto', description: 'Diseña el modelo completo o empieza con un pórtico editable.', icon: Building2 },
  { id: 'piece', label: 'Pieza', description: 'Abre un elemento independiente y ajusta sus datos.', icon: Ruler },
  { id: 'exercise', label: 'Ejercicio', description: 'Captura datos propios desde formularios incompletos.', icon: Sparkles },
];

export function DesignStartDialog({ open, onOpenChange, hasModel2d, hasModel3d, code, projectName, onStart, onOpenModel, onOpenSpace3D, onCreateBuilding, onOpenMemory, initialCategory = 'project', categories, elements }: DesignStartDialogProps) {
  const offered = CATEGORIES.filter((item) => !categories || categories.includes(item.id));
  const [category, setCategory] = useState<DesignStartCategory>(() => offered.some((item) => item.id === initialCategory) ? initialCategory : offered[0]!.id);
  const [full, setFull] = useState(false);
  const entries = useMemo(() => DESIGN_STARTS.filter((item) => item.category === category && (!elements || elements.includes(item.element))), [category, elements]);
  const codeName = designCode(code).name;

  const start = (item: DesignStart) => {
    setFull(false);
    if (onStart(item) === 'full') setFull(true);
  };
  const changeOpen = (next: boolean) => {
    if (!next) setFull(false);
    onOpenChange(next);
  };

  const tabs = offered.map(({ id, label, description, icon: Icon }) => ({
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
              <span className="dw-start-card__element">{item.element === 'frame' ? 'Estructura' : item.element === 'beam' ? 'Viga' : item.element === 'column' ? 'Columna' : item.element === 'footing' ? 'Cimentación' : item.element === 'flexure' ? 'Flexión' : 'Sección'}</span>
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
    {categories && !categories.includes('exercise') ? <p className="dw-start__elsewhere">¿Una pieza con tus propios datos, sin enlazarla al proyecto? Ábrela en <strong>Calcular por separado</strong>, desde el Inicio.</p> : null}
    {full ? <div className="dw-start__full" role="alert">
      <p>No hay espacio suficiente para conservar el trabajo actual. Libera espacio en la memoria del proyecto y vuelve a intentarlo.</p>
      {onOpenMemory ? <button type="button" onClick={() => { changeOpen(false); onOpenMemory(); }}>Abrir memoria del proyecto</button> : null}
    </div> : null}
  </Dialog>;
}
