import { Suspense, lazy, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, Box, Check, CheckCircle2, ChevronDown,
  Circle, CircleDashed, Columns3, Download, Expand, FilePlus2, Folder, FolderOpen,
  Grid2X2, Layers, Maximize2, Moon, MousePointer2, Move, PanelLeftClose, Plus,
  Ruler, Search, Settings2, SlidersHorizontal, Sun, Triangle, X, XCircle,
} from 'lucide-react';
import { FStructureMark } from '../design-system/brand';
import { Button, Field, IconButton, SegmentedControl } from '../design-system/components/controls';
import { PROPOSALS, readPreviewLocation, type ProposalId, type Theme } from './catalog';
import { BeamDiagram, ColumnSection, FootingDiagram, PrattDiagram } from './diagrams';

type Navigate = (id: ProposalId) => void;
const ScenePreview = lazy(() => import('./ScenePreview'));
const asset = (id: string, theme: Theme) => `${import.meta.env.BASE_URL}assets/suite/${id}-${theme === 'dark' ? 'night' : 'day'}.png`;

function Brand() {
  return <span className="proposal-brand"><FStructureMark size={28} /><strong>FStructure</strong></span>;
}

function MesaHeader({ name, mode, onNavigate, action }: { name: string; mode: '2D' | '3D' | 'Diseño'; onNavigate: Navigate; action?: ReactNode }) {
  return <header className="proposal-mesa-header">
    <Brand /><div className="proposal-mesa-name"><span>{name}</span><small>Datos de muestra</small></div>
    <SegmentedControl label="Modo de la mesa" size="sm" value={mode} options={['2D', '3D', 'Diseño'].map((label) => ({ value: label, label }))} onValueChange={(value) => onNavigate(value === '2D' ? 'start' : value === '3D' ? 'mobile' : 'column')} />
    <div className="proposal-mesa-action">{action ?? <IconButton label="Volver al inicio" onClick={() => onNavigate('home')}><FolderOpen size={19} /></IconButton>}</div>
  </header>;
}

const tools = [
  { name: 'Seleccionar', icon: MousePointer2 }, { name: 'Nodo', icon: Circle },
  { name: 'Barra', icon: Move }, { name: 'Apoyo', icon: Triangle }, { name: 'Carga', icon: ArrowDown },
];
function Dock({ active, onChange, compact = false }: { active: string; onChange: (value: string) => void; compact?: boolean }) {
  return <nav className={`proposal-dock${compact ? ' is-compact' : ''}`} aria-label="Herramientas del modelo">
    {tools.map(({ name, icon: Icon }) => <button key={name} type="button" title={name} aria-label={name} aria-pressed={active === name} onClick={() => onChange(name)}><Icon size={20} /><span>{name}</span></button>)}
  </nav>;
}

const entries: { title: string; description: string; view: ProposalId | null; icon: typeof Box }[] = [
  { title: 'Modelo 2D', description: 'Vigas, marcos y armaduras', view: 'start', icon: Grid2X2 },
  { title: 'Modelo 3D', description: 'Marcos espaciales', view: 'mobile', icon: Box },
  { title: 'Viga', description: 'Claros, cargas y armado', view: 'beam', icon: Move },
  { title: 'Columna', description: 'Flexocompresión y estribos', view: 'column', icon: Columns3 },
  { title: 'Zapata', description: 'Geometría, suelo y acciones', view: 'footing', icon: Layers },
  { title: 'Sección a flexión', description: 'Acero y dimensiones', view: null, icon: Ruler },
  { title: 'Estudio de sección', description: 'Geometría y ejes principales', view: null, icon: SlidersHorizontal },
  { title: 'Pórtico', description: 'Vigas y columnas juntas', view: null, icon: Grid2X2 },
];

function HomeProposal({ theme, navigate }: { theme: Theme; navigate: Navigate }) {
  const [toolNotice, setToolNotice] = useState<string | null>(null);
  return <div className="proposal-home">
    <header className="proposal-home-header"><Brand /><Button size="sm" variant="ghost" leadingIcon={<Folder size={16} />} onClick={() => navigate('projects')}>Proyectos</Button></header>
    <div className="proposal-home-intro"><div><h1>Modela, analiza y diseña estructuras.</h1><p>Un cálculo por separado o un proyecto completo. La misma mesa, con el alcance que necesitas.</p><Button variant="primary" trailingIcon={<ArrowRight size={17} />} onClick={() => navigate('start')}>Empezar un modelo</Button></div><img src={asset('portal', theme)} width="640" height="400" alt="Pórtico de concreto de la Home oficial" /></div>
    <div className="proposal-home-paths">
      <section className="proposal-individual"><div className="proposal-section-head"><h2>Calcular por separado</h2><span>Un archivo, una herramienta</span></div>
        <div className="proposal-entry-list">{entries.map(({ title, description, view, icon: Icon }) => <button type="button" key={title} onClick={() => view ? navigate(view) : setToolNotice(title)}><Icon size={22} /><span><strong>{title}</strong><small>{description}</small></span><ArrowUpRight size={15} /></button>)}</div>
        {toolNotice && <p className="proposal-inline-note" role="status">{toolNotice} forma parte de la app oficial. <a href="https://klkmoraa.github.io/fstructure/?tool=model2d&mode=design" target="_blank" rel="noreferrer">Abrir el taller de Diseño</a></p>}
      </section>
      <section className="proposal-project-path"><div className="proposal-section-head"><h2>Proyecto completo</h2><span>2D · 3D · Diseño enlazados</span></div>
        <div className="proposal-project-scene"><img src={asset('space3d', theme)} alt="Modelo espacial de la app oficial" width="600" height="360" /></div>
        <div className="proposal-path-steps">{(['2D', '3D', 'Diseño'] as const).map((name, index) => <button type="button" key={name} onClick={() => navigate(index === 0 ? 'start' : index === 1 ? 'mobile' : 'column')}><span>{name}</span>{index < 2 && <ArrowRight size={15} />}</button>)}</div>
        <p>El 3D trae tu modelo. Diseño toma sus acciones.</p><Button trailingIcon={<Plus size={16} />} onClick={() => navigate('start')}>Nuevo proyecto</Button>
      </section>
    </div>
    <section className="proposal-recents"><div className="proposal-section-head"><h2>Proyectos recientes</h2><Button variant="ghost" size="sm" onClick={() => navigate('projects')}>Ver todos</Button></div>
      <button className="proposal-recent-row" type="button" onClick={() => navigate('beam')}><img src={asset('model2d', theme)} alt="" width="70" height="50" /><span><strong>Viga continua</strong><small>Cálculo individual · muestra</small></span><ArrowUpRight size={18} /></button>
    </section>
  </div>;
}

const starts = ['Viga apoyada', 'Voladizo', 'Viga continua', 'Pórtico', 'Armadura Pratt'];
function StartGlyph({ index }: { index: number }) {
  return <svg viewBox="0 0 96 56" aria-hidden="true" className="proposal-start-glyph"><g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {index === 4 ? <><path d="M8 42h80M24 14h48M8 42l16-28M88 42L72 14M24 14v28M48 14v28M72 14v28M24 14l24 28M72 14L48 42" /><path d="M8 42l-5 8h10zM88 42l-5 8h10z" /></> : index === 3 ? <><path d="M20 45V15h56v30M14 47h12M70 47h12" /><path d="M30 4v9m-4-4 4 4 4-4M66 4v9m-4-4 4 4 4-4" className="proposal-load" /></> : <><path d="M12 32h72" />{index === 1 ? <path d="M12 15v32M4 20l8-5M4 29l8-5M4 38l8-5M4 47l8-5" /> : <><path d="M12 32l-5 9h10zM84 32l-5 9h10z" />{index === 2 && <path d="M48 32l-5 9h10z" />}</>}<path d="M30 6v18m-4-4 4 4 4-4M48 6v18m-4-4 4 4 4-4M66 6v18m-4-4 4 4 4-4" className="proposal-load" /></>}
  </g></svg>;
}
function StartProposal({ navigate }: { navigate: Navigate }) {
  const [tool, setTool] = useState('Seleccionar');
  const [selected, setSelected] = useState<number | null>(null);
  const [generate, setGenerate] = useState(false);
  const [span, setSpan] = useState('6');
  const [draw, setDraw] = useState(false);
  return <div className="proposal-mesa proposal-start-mesa"><MesaHeader name="Nuevo modelo" mode="2D" onNavigate={navigate} />
    <div className="proposal-model-canvas proposal-grid">
      <div className="proposal-canvas-label"><span>Modelo 2D</span><small>m · kN</small></div>
      {selected === null && !draw ? <section className="proposal-start-card"><h2>Empieza tu modelo 2D</h2><p>Elige una estructura para verla en la mesa.</p>
        <div className="proposal-start-options">{starts.map((name, index) => <button type="button" key={name} onClick={() => setSelected(index)}><StartGlyph index={index} /><span><strong>{name}</strong><small>{index === 0 ? '6 m · CM 15 y CV 8 kN/m' : index === 4 ? 'Montantes y diagonales simétricas' : 'Geometría editable'}</small></span><ArrowUpRight size={16} /></button>)}</div>
        <div className="proposal-start-actions"><Button size="sm" leadingIcon={<Ruler size={15} />} onClick={() => setGenerate(!generate)} aria-expanded={generate}>Generar con medidas propias</Button><Button size="sm" variant="ghost" onClick={() => { setDraw(true); setTool('Nodo'); }}>Dibujar nudos y barras</Button></div>
        {generate && <form className="proposal-generator" onSubmit={(event) => { event.preventDefault(); setSelected(0); }}><Field label="Claro" suffix="m" type="number" min="1" max="30" step="0.1" value={span} onChange={(event) => setSpan(event.target.value)} required /><Button type="submit" variant="primary">Generar viga</Button></form>}
      </section> : <div className="proposal-selected-model"><div className="proposal-model-caption"><h2>{draw ? 'Dibujar nudos y barras' : starts[selected ?? 0]}</h2><Button size="sm" variant="ghost" onClick={() => { setSelected(null); setDraw(false); }}>Cambiar inicio</Button></div>{draw ? <p className="proposal-draw-message">Herramienta {tool.toLowerCase()} activa. Esta propuesta muestra el flujo; el dibujo y el análisis se realizan en la app oficial.</p> : selected === 4 ? <PrattDiagram /> : <><StartGlyph index={selected ?? 0} /><p>{generate ? `Claro de muestra: ${span} m` : 'Geometría de muestra editable en la app oficial.'}</p><Button variant="primary" onClick={() => navigate('beam')}>Ver propuesta de resultados</Button></>}</div>}
      <Dock active={tool} onChange={setTool} />
    </div>
  </div>;
}

function BeamProposal({ navigate }: { navigate: Navigate }) {
  const [cursor, setCursor] = useState(50);
  return <div className="proposal-mesa"><MesaHeader name="Viga continua" mode="2D" onNavigate={navigate} />
    <div className="proposal-analysis-body"><div className="proposal-analysis-heading"><h2>Diagramas</h2><span>Viga continua · caso de muestra</span><Button variant="ghost" size="sm" leadingIcon={<MousePointer2 size={15} />} onClick={() => setCursor(50)}>Centrar lectura</Button></div>
      <section className="proposal-diagram-band"><div className="proposal-band-head"><h3>Diagrama de cuerpo libre</h3><span>Cargas y reacciones</span></div><BeamDiagram kind="freebody" cursor={cursor / 100} /></section>
      <section className="proposal-diagram-band"><div className="proposal-band-head"><h3>Momento flector</h3><span className="proposal-moment">M · kN·m</span></div><BeamDiagram kind="moment" cursor={cursor / 100} /></section>
      <div className="proposal-cursor-control"><label htmlFor="beam-cursor">Posición de lectura</label><input id="beam-cursor" type="range" min="0" max="100" value={cursor} onChange={(event) => setCursor(Number(event.target.value))} /><output htmlFor="beam-cursor">{cursor} %</output></div>
      <p className="proposal-data-note">Valores de la propuesta original. La curva es esquemática; no representa un cálculo nuevo.</p>
    </div>
  </div>;
}

function PrattProposal({ navigate }: { navigate: Navigate }) {
  const [layers, setLayers] = useState(true);
  return <div className="proposal-mesa"><MesaHeader name="Armadura Pratt" mode="2D" onNavigate={navigate} />
    <div className="proposal-pratt-body proposal-grid"><div className="proposal-analysis-heading"><h2>Fuerza axial</h2><span>N · kN</span><Button variant="ghost" size="sm" leadingIcon={<Layers size={16} />} onClick={() => setLayers(!layers)} aria-expanded={layers}>Leyenda</Button></div>
      {layers && <div className="proposal-legend"><span><i className="proposal-tension-dot" />Tensión</span><span><i className="proposal-compression-dot" />Compresión</span><span><i />Geometría</span></div>}
      <PrattDiagram /><p className="proposal-data-note">Distribución de señales ilustrativa. Geometría Pratt simétrica; sin cálculo asociado.</p>
    </div>
  </div>;
}

const reviewStates = [
  { name: 'Cumple', value: '100 %', note: 'Comprobaciones completas', type: 'pass', icon: CheckCircle2 },
  { name: 'No cumple', value: '105 %', note: 'La demanda supera la capacidad', type: 'fail', icon: XCircle },
  { name: 'Faltan datos', value: '—', note: 'Faltan: sección de la barra, carga viva', type: 'missing', icon: CircleDashed },
] as const;
function ReviewProposal({ navigate }: { navigate: Navigate }) {
  const [selected, setSelected] = useState(2);
  const [all, setAll] = useState(true);
  const state = reviewStates[selected];
  const StateIcon = state.icon;
  return <div className="proposal-mesa"><MesaHeader name="Revisión de elementos" mode="Diseño" onNavigate={navigate} />
    <div className="proposal-review-body"><div className="proposal-analysis-heading"><h2>Estado de revisión</h2><span>Demanda / capacidad</span></div>
      <div className="proposal-review-states">{reviewStates.map(({ name, value, note, type, icon: Icon }, index) => <button className="proposal-review-state" type="button" key={type} data-status={type} aria-pressed={index === selected} onClick={() => setSelected(index)}><div><Icon size={22} /><strong>{name}</strong></div><span className="proposal-review-value">{value}</span><small>{note}</small></button>)}</div>
      <section className="proposal-review-detail" data-status={state.type}><div className="proposal-detail-head"><StateIcon size={21} /><h3>{state.name}</h3><span>{state.value}</span></div><p>{state.note}</p>
        <div className="proposal-section-head"><h3>Comprobaciones</h3><button type="button" className="proposal-text-button" onClick={() => setAll(!all)} aria-expanded={all}>{all ? 'Sólo pendientes' : 'Ver todas'}<ChevronDown size={14} /></button></div>
        <ul className="proposal-check-list">{all && <li><Check size={17} /><span>Geometría y unidades</span><small>Verificadas en la muestra</small></li>}<li><CircleDashed size={17} /><span>Sección de la barra</span><small>{selected === 2 ? 'Falta definir' : 'Definida'}</small></li><li><CircleDashed size={17} /><span>Carga viva</span><small>{selected === 2 ? 'Falta definir' : 'Definida'}</small></li></ul>
      </section><p className="proposal-data-note">Estados demostrativos. Un porcentaje no reemplaza el alcance de la revisión.</p>
    </div>
  </div>;
}

function ProjectsProposal({ navigate }: { navigate: Navigate }) {
  const [filter, setFilter] = useState(true);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const list = [
    { name: 'Viga continua', kind: 'Individual', view: 'beam' as const },
    { name: 'Edificio de concreto', kind: 'Proyecto', view: 'mobile' as const },
    { name: 'Columna biaxial', kind: 'Individual', view: 'column' as const },
  ].filter((item) => !filter && item.name.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es')) && (type === 'all' || (type === 'single') === (item.kind === 'Individual')));
  const active = filter || search !== '' || type !== 'all';
  const clear = () => { setFilter(false); setSearch(''); setType('all'); };
  return <div className="proposal-projects"><header className="proposal-home-header"><Brand /><IconButton label="Volver al inicio" onClick={() => navigate('home')}><ArrowLeft size={19} /></IconButton></header>
    <div className="proposal-projects-body"><div className="proposal-section-head"><h1>Proyectos</h1><Button variant="primary" size="sm" leadingIcon={<Plus size={16} />} onClick={() => navigate('start')}>Nuevo</Button></div>
      <Field label="Buscar proyectos" prefix={<Search size={17} />} placeholder="Nombre del proyecto" value={search} onChange={(event) => setSearch(event.target.value)} />
      <SegmentedControl label="Tipo de proyecto" value={type} options={[{ value: 'all', label: 'Todo' }, { value: 'project', label: 'Proyectos' }, { value: 'single', label: 'Individuales' }]} onValueChange={setType} />
      <div className="proposal-filters"><span>{list.length} {list.length === 1 ? 'resultado' : 'resultados'}</span><button className="proposal-filter-toggle" type="button" aria-pressed={filter} onClick={() => setFilter(!filter)}><SlidersHorizontal size={15} />{filter ? 'Guardados recientemente' : 'Sin filtro de fecha'}{filter && <X size={13} />}</button></div>
      <div className="proposal-project-list" data-testid="proposal-project-list">{list.length === 0 ? <div className="proposal-project-empty"><FolderOpen size={35} strokeWidth={1.3} /><h2>{active ? 'Ningún proyecto coincide con el filtro.' : 'Todavía no tienes proyectos.'}</h2><p>{active ? 'Tus proyectos siguen aquí. Prueba con una selección más amplia.' : 'Crea un modelo para comenzar.'}</p>{active ? <Button onClick={clear}>Limpiar filtros</Button> : <Button onClick={() => navigate('start')}>Crear proyecto</Button>}</div> : list.map((item) => <button type="button" className="proposal-project-row" key={item.name} onClick={() => navigate(item.view)}><FilePlus2 size={23} /><span><strong>{item.name}</strong><small>{item.kind} · muestra</small></span><ArrowUpRight size={17} /></button>)}</div>
    </div>
  </div>;
}

function FootingProposal({ navigate }: { navigate: Navigate }) {
  const [notes, setNotes] = useState(false);
  return <div className="proposal-mesa"><MesaHeader name="Zapata aislada" mode="Diseño" onNavigate={navigate} />
    <div className="proposal-footing-body"><div className="proposal-analysis-heading"><h2>Corte de zapata</h2><span>Secciones críticas</span><Button variant="ghost" size="sm" leadingIcon={<Ruler size={15} />} onClick={() => setNotes(!notes)} aria-expanded={notes}>Referencias</Button></div>
      <FootingDiagram /><div className="proposal-footing-legend"><span><strong className="proposal-moment">M</strong>Cara del pedestal</span><span><strong className="proposal-tension">d/2</strong>Punzonamiento</span><span><strong className="proposal-shear">d</strong>Cortante</span></div>
      {notes && <p className="proposal-inline-note">Las marcas se miden desde la cara del pedestal. El corte es una muestra visual; el perímetro de punzonamiento se interpreta en planta.</p>}
      <p className="proposal-data-note">Esquema de muestra. El cálculo y la revisión normativa pertenecen a la app oficial.</p>
    </div>
  </div>;
}

function MobileProposal({ navigate, theme }: { navigate: Navigate; theme: Theme }) {
  const [mode, setMode] = useState('3D');
  const [active, setActive] = useState('Seleccionar');
  const [orientation, setOrientation] = useState('isometric');
  const [selected, setSelected] = useState(false);
  const [options, setOptions] = useState(false);
  const [geometry, setGeometry] = useState(true);
  const [grid, setGrid] = useState(true);
  const icons = [{ name: 'Seleccionar', icon: MousePointer2 }, { name: 'Vista', icon: Box }, { name: 'Capas', icon: Layers }, { name: 'Ajustes', icon: Settings2 }];
  return <div className="proposal-mobile-mesa">
    <header className="proposal-mobile-header"><FStructureMark size={26} /><div><strong>{mode === '3D' ? 'Modelo 3D' : 'Diseño'}</strong><small>Edificio de concreto</small></div><IconButton label="Abrir acciones de la mesa" aria-expanded={options} onClick={() => setOptions(!options)}><FolderOpen size={21} /></IconButton></header>
    {options && <div className="proposal-mobile-options"><Button size="sm" onClick={() => navigate('home')}>Inicio</Button><Button size="sm" onClick={() => navigate('projects')}>Proyectos</Button></div>}
    <div className="proposal-mobile-mode"><SegmentedControl label="Modo de la mesa móvil" value={mode} options={[{ value: '3D', label: '3D' }, { value: 'Diseño', label: 'Diseño' }]} onValueChange={setMode} /></div>
    <div className={`proposal-mobile-drawing${orientation === 'front' ? ' is-front' : ''}`}>
      <div className="proposal-scene-frame"><Suspense fallback={<img src={asset(mode === '3D' ? 'space3d' : 'design', theme)} alt="Escena oficial mientras carga la vista interactiva" />}><ScenePreview mode={mode} theme={theme} orientation={orientation} geometry={geometry} grid={grid} selected={selected} onSelect={() => setSelected((value) => !value)} /></Suspense></div>
      <IconButton className="proposal-orientation" label="Cambiar vista del modelo" onClick={() => setOrientation(orientation === 'front' ? 'isometric' : 'front')}><Box size={19} /></IconButton>
      <span className="proposal-view-name">{orientation === 'front' ? 'Frontal' : 'Isométrica'}</span>
      {selected && <div className="proposal-selection"><strong>Modelo seleccionado</strong><span>Geometría de muestra</span><button type="button" onClick={() => navigate('column')}>Ver propuesta de sección<ArrowRight size={14} /></button></div>}
      {active === 'Capas' && <div className="proposal-mobile-overlay"><strong>Capas visibles</strong><label><input type="checkbox" checked={geometry} onChange={(event) => setGeometry(event.target.checked)} /> Geometría</label><label><input type="checkbox" checked={grid} onChange={(event) => setGrid(event.target.checked)} /> Retícula</label></div>}
      {active === 'Ajustes' && <div className="proposal-mobile-overlay"><strong>Ajustes de vista</strong><Button size="sm" onClick={() => { setOrientation('isometric'); setSelected(false); }}>Restablecer vista</Button></div>}
    </div>
    <nav className="proposal-mobile-dock" aria-label="Herramientas de la mesa móvil">{icons.map(({ name, icon: Icon }) => <button type="button" key={name} title={name} aria-label={name} aria-pressed={active === name} onClick={() => { setActive(name); if (name === 'Vista') setOrientation(orientation === 'front' ? 'isometric' : 'front'); }}><Icon size={22} /></button>)}</nav>
    <span className="proposal-mobile-status" aria-live="polite">{selected ? 'Modelo seleccionado' : active} · muestra</span>
  </div>;
}

function ColumnProposal({ navigate }: { navigate: Navigate }) {
  const [values, setValues] = useState({ base: '30', depth: '40', fc: '250', fy: '4200', pu: '1230', mux: '85', muy: '60' });
  const [proposed, setProposed] = useState(false);
  const fields = [
    { key: 'base', label: 'Base', unit: 'cm' }, { key: 'depth', label: 'Peralte', unit: 'cm' },
    { key: 'fc', label: 'f′c', unit: 'kg/cm²' }, { key: 'fy', label: 'fy', unit: 'kg/cm²' },
    { key: 'pu', label: 'Pu', unit: 'kN' }, { key: 'mux', label: 'Mux', unit: 'kN·m' }, { key: 'muy', label: 'Muy', unit: 'kN·m' },
  ] as const;
  const validSection = Number(values.base) >= 15 && Number(values.base) <= 120 && Number(values.depth) >= 15 && Number(values.depth) <= 120;
  return <div className="proposal-mesa"><MesaHeader name="Columna biaxial" mode="Diseño" onNavigate={navigate} />
    <div className="proposal-column-body"><div className="proposal-column-drawing"><div className="proposal-section-head"><h2>Sección de columna</h2><span>cm</span></div><ColumnSection base={validSection ? Number(values.base) : 30} depth={validSection ? Number(values.depth) : 40} /><p>La forma responde a base y peralte.</p><span className="proposal-data-note">Valores de muestra editables · sin cálculo</span></div>
      <section className="proposal-column-fields"><div className="proposal-column-heading"><h2>Sección, materiales y acciones</h2><Button variant="primary" size="sm" leadingIcon={<Maximize2 size={16} />} disabled={!validSection} onClick={() => { setValues((previous) => ({ ...previous, base: '40', depth: '45' })); setProposed(true); }}>Proponer sección</Button></div>
        <div className="proposal-field-group"><h3>Geometría y materiales</h3><div className="proposal-fields-grid">{fields.slice(0, 4).map(({ key, label, unit }) => <Field key={key} label={label} suffix={unit} type="number" value={values[key]} min={key === 'base' || key === 'depth' ? '15' : '1'} max={key === 'base' || key === 'depth' ? '120' : undefined} step="any" onChange={(event) => { setProposed(false); setValues({ ...values, [key]: event.target.value }); }} error={!validSection && (key === 'base' || key === 'depth') ? 'Entre 15 y 120 cm para esta vista.' : undefined} />)}</div></div>
        <div className="proposal-field-group"><h3>Acciones de diseño</h3><div className="proposal-fields-grid proposal-actions-grid">{fields.slice(4).map(({ key, label, unit }) => <Field key={key} label={label} suffix={unit} type="number" value={values[key]} step="any" onChange={(event) => setValues({ ...values, [key]: event.target.value })} />)}</div></div>
        <p className="proposal-inline-note" role="status">{proposed ? 'Alternativa visual de muestra: 40 × 45 cm. No es una sección calculada.' : 'Edita la sección para comprobar el formulario y el dibujo. La revisión estructural se realiza en la app oficial.'}</p>
      </section>
    </div>
  </div>;
}

export function ProposalGallery() {
  const initial = useRef(readPreviewLocation()).current;
  const [id, setId] = useState<ProposalId>(initial.id);
  const [theme, setTheme] = useState<Theme>(initial.theme);
  const [phone, setPhone] = useState(false);
  const [focus, setFocus] = useState(new URLSearchParams(window.location.hash.slice(1)).get('focus') === '1');
  const [showIntent, setShowIntent] = useState(false);
  const [copied, setCopied] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const item = PROPOSALS.find((proposal) => proposal.id === id)!;
  const index = PROPOSALS.indexOf(item);
  const navigate = (next: ProposalId) => {
    setId(next);
    setCopied(false);
    const params = new URLSearchParams({ view: next, theme, ...(focus ? { focus: '1' } : {}) });
    window.history.pushState(null, '', `#${params}`);
    window.requestAnimationFrame(() => heading.current?.focus({ preventScroll: true }));
  };
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    const params = new URLSearchParams({ view: id, theme, ...(focus ? { focus: '1' } : {}) });
    window.history.replaceState(null, '', `#${params}`);
    document.title = `FStructure · ${item.name} · Propuesta`;
  }, [id, theme, focus, item.name]);
  useEffect(() => {
    const restore = () => { const current = readPreviewLocation(); setId(current.id); setTheme(current.theme); setFocus(new URLSearchParams(window.location.hash.slice(1)).get('focus') === '1'); };
    window.addEventListener('popstate', restore);
    window.addEventListener('hashchange', restore);
    return () => { window.removeEventListener('popstate', restore); window.removeEventListener('hashchange', restore); };
  }, []);
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true); }
    catch { setCopied(false); }
  };
  return <div className={`proposal-gallery${focus ? ' is-focused' : ''}`}>
    <a className="proposal-skip" href="#proposal-preview" onClick={(event) => { event.preventDefault(); document.getElementById('proposal-preview')?.focus(); }}>Ir a la pantalla</a>
    {!focus && <><header className="proposal-studio-header"><Brand /><span>Propuestas de interfaz</span><a href="https://klkmoraa.github.io/fstructure/" target="_blank" rel="noreferrer">App oficial<ArrowUpRight size={15} /></a><IconButton label={theme === 'light' ? 'Activar tema Noche' : 'Activar tema Día'} onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>{theme === 'light' ? <Moon size={19} /> : <Sun size={19} />}</IconButton></header>
      <nav className="proposal-catalog" aria-label="Nueve propuestas">{PROPOSALS.map((proposal, position) => <button type="button" aria-current={proposal.id === id ? 'page' : undefined} key={proposal.id} onClick={() => navigate(proposal.id)}><span>{String(position + 1).padStart(2, '0')}</span><strong>{proposal.name}</strong>{proposal.id === id && <ArrowRight size={15} />}</button>)}<p>Una exploración en código sobre la app actual y su brandbook.</p></nav></>}
    <main className="proposal-studio-main"><div className="proposal-studio-toolbar"><div><h1 ref={heading} tabIndex={-1}>{focus ? item.name : item.title}</h1>{!focus && <button type="button" className="proposal-text-button" aria-expanded={showIntent} onClick={() => setShowIntent(!showIntent)}>Qué propone<ChevronDown size={14} /></button>}</div>
      <div className="proposal-preview-actions">{focus ? <><IconButton label="Mostrar galería" onClick={() => setFocus(false)}><PanelLeftClose size={19} /></IconButton><IconButton label={theme === 'light' ? 'Activar tema Noche' : 'Activar tema Día'} onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>{theme === 'light' ? <Moon size={19} /> : <Sun size={19} />}</IconButton></> : <><SegmentedControl label="Formato de vista" size="sm" value={phone ? 'phone' : 'auto'} options={[{ value: 'auto', label: 'Adaptable' }, { value: 'phone', label: 'Teléfono' }]} onValueChange={(value) => setPhone(value === 'phone')} /><IconButton label="Ver sólo pantalla" onClick={() => setFocus(true)}><Expand size={19} /></IconButton></>}</div>
    </div>{showIntent && !focus && <div className="proposal-intent"><p>{item.intent}</p><small>Base: {item.source}</small></div>}
      <div className="proposal-preview-holder"><div id="proposal-preview" tabIndex={-1} className={`proposal-preview${phone ? ' is-phone' : ''}`} data-proposal={id} key={id}>
        {id === 'home' && <HomeProposal theme={theme} navigate={navigate} />}{id === 'start' && <StartProposal navigate={navigate} />}{id === 'beam' && <BeamProposal navigate={navigate} />}{id === 'pratt' && <PrattProposal navigate={navigate} />}{id === 'review' && <ReviewProposal navigate={navigate} />}{id === 'projects' && <ProjectsProposal navigate={navigate} />}{id === 'footing' && <FootingProposal navigate={navigate} />}{id === 'mobile' && <MobileProposal navigate={navigate} theme={theme} />}{id === 'column' && <ColumnProposal navigate={navigate} />}
      </div></div>
      <footer className="proposal-studio-footer"><Button size="sm" variant="ghost" leadingIcon={<ArrowLeft size={15} />} disabled={index === 0} onClick={() => navigate(PROPOSALS[index - 1].id)}>Anterior</Button><span>{index + 1} de {PROPOSALS.length}</span><Button size="sm" variant="ghost" trailingIcon={<ArrowRight size={15} />} disabled={index === PROPOSALS.length - 1} onClick={() => navigate(PROPOSALS[index + 1].id)}>Siguiente</Button><Button size="sm" variant="ghost" leadingIcon={copied ? <Check size={15} /> : <Download size={15} />} onClick={() => void copyLink()}>{copied ? 'Enlace copiado' : 'Copiar enlace'}</Button></footer>
    </main>
  </div>;
}
