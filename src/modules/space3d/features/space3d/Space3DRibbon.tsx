/**
 * Menús de la mesa 3D, con la gramática de ETABS/SAP2000: Archivo, Definir,
 * Asignar, Mostrar y Vista. Viven en una píldora flotante sobre el lienzo,
 * como los controles del lienzo 2D; cada menú despliega su fila de comandos
 * debajo y se vuelve a plegar. Dibujar no es un menú: sus herramientas están
 * en el dock inferior, igual que en FStructure 2D.
 *
 * Cada botón enseña su nombre (la voz dice lo que ve, WCAG 2.5.3) y el atajo
 * vive en el `title`. Lo que necesita una selección o un resultado se
 * deshabilita y dice por qué.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import {
  Activity, Anchor, Blocks, Box, Building2, ChevronDown, Columns2, Download, FolderOpen, Grid3x3, Layers, Link2Off, ListTree,
  PanelLeft, Play, RotateCcw, Sigma, Sparkles, Tag, Upload, Waves,
} from 'lucide-react';
import { DistributedLoadGlyph, PointLoadGlyph } from '../../../../design-system/icons/structural';
import { Popover } from '../../../../design-system/components/overlays';
import type { TranslationKey } from '../../i18n/catalogs';
import type { Space3DResultMode } from '../../space3d/view/sceneModel';

export type Space3DAssignKind = 'section' | 'releases' | 'member-load' | 'nodal-load' | 'support' | 'type' | 'diaphragm';

type Translate = (key: TranslationKey, variables?: Record<string, string | number>) => string;

interface Space3DRibbonProps {
  readonly t: Translate;
  readonly file: {
    readonly onNewBuilding: () => void;
    readonly onGenerator: () => void;
    readonly onLoadExample: () => void;
    readonly onResetBlank: () => void;
    readonly onImport: () => void;
    readonly onExport: () => void;
  };
  readonly onDefine: (what: 'grid' | 'sections' | 'loads' | 'dynamics') => void;
  readonly selectedMembers: number;
  readonly selectedNodes: number;
  readonly onAssign: (kind: Space3DAssignKind) => void;
  readonly resultsReady: boolean;
  readonly animate: boolean;
  readonly onAnimate: (value: boolean) => void;
  readonly extruded: boolean;
  readonly onExtruded: (value: boolean) => void;
  readonly labels: boolean;
  readonly onLabels: (value: boolean) => void;
  readonly split: boolean;
  readonly onSplit: (value: boolean) => void;
  readonly explorer: boolean;
  readonly onExplorer: (value: boolean) => void;
  /** Controles extra al final de «Mostrar» (capas). */
  readonly displayExtras?: ReactNode;
}

interface RibbonButtonProps {
  readonly icon: ReactNode;
  readonly label: string;
  /** Nombre accesible si difiere del visible; debe contenerlo. */
  readonly name?: string;
  readonly title?: string;
  readonly pressed?: boolean;
  readonly disabled?: boolean;
  readonly onClick: () => void;
  readonly tone?: 'accent';
}

const RibbonButton = ({ icon, label, name, title, pressed, disabled, onClick, tone }: RibbonButtonProps) => <button
  type="button"
  className="space3d-ribbon-button"
  data-tone={tone}
  aria-pressed={pressed}
  aria-label={name}
  title={title ?? name ?? label}
  disabled={disabled}
  onClick={onClick}
>
  {icon}
  <span>{label}</span>
</button>;

export const SPACE3D_DISPLAY_MODES: readonly { mode: Space3DResultMode; short: string; key: TranslationKey }[] = [
  { mode: 'deformed', short: 'Δ', key: 'space3d.display.deformed' },
  { mode: 'axial', short: 'P', key: 'space3d.display.axial' },
  { mode: 'shear', short: 'V2', key: 'space3d.display.shear2' },
  { mode: 'shear3', short: 'V3', key: 'space3d.display.shear3' },
  { mode: 'torsion', short: 'T', key: 'space3d.display.torsion' },
  { mode: 'moment2', short: 'M2', key: 'space3d.display.moment2' },
  { mode: 'moment', short: 'M3', key: 'space3d.display.moment3' },
  { mode: 'reactions', short: 'R', key: 'space3d.display.reactions' },
];

type RibbonTab = 'define' | 'assign' | 'display' | 'view';

const TABS: readonly { id: RibbonTab; key: TranslationKey }[] = [
  { id: 'define', key: 'space3d.ribbon.define' },
  { id: 'assign', key: 'space3d.ribbon.assign' },
  { id: 'display', key: 'space3d.ribbon.display' },
  { id: 'view', key: 'space3d.ribbon.view' },
];

export const Space3DRibbon = (props: Space3DRibbonProps) => {
  const { t } = props;
  const [fileOpen, setFileOpen] = useState(false);
  // Plegada por defecto: el lienzo es el protagonista, como en 2D.
  const [tab, setTab] = useState<RibbonTab | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const baseId = useId();
  const run = (action: () => void) => () => { setFileOpen(false); action(); };
  /** Un comando que abre un diálogo o un panel pliega el menú. */
  const then = (action: () => void) => () => { setTab(null); action(); };
  const needsMembers = props.selectedMembers === 0;
  const needsNodes = props.selectedNodes === 0;
  const selected = props.selectedMembers + props.selectedNodes;

  const focusTab = (index: number) => tabsRef.current?.querySelectorAll<HTMLButtonElement>('[data-ribbon-tab]')[index]?.focus();

  /** Flechas, Inicio y Fin recorren los menús; Escape pliega y devuelve el foco. */
  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = event.key === 'ArrowRight' ? (index + 1) % TABS.length
      : event.key === 'ArrowLeft' ? (index - 1 + TABS.length) % TABS.length
        : event.key === 'Home' ? 0 : event.key === 'End' ? TABS.length - 1 : -1;
    if (next < 0) return;
    event.preventDefault();
    if (tab !== null) setTab(TABS[next].id);
    focusTab(next);
  };

  useEffect(() => {
    if (tab === null) return undefined;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const index = TABS.findIndex((item) => item.id === tab);
      setTab(null);
      focusTab(index);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tab]);

  const panels: Record<RibbonTab, ReactNode> = {
    define: <>
      <RibbonButton icon={<Grid3x3 size={18} aria-hidden="true" />} label={t('space3d.define.grid')} title={t('space3d.define.gridTitle')} onClick={then(() => props.onDefine('grid'))} />
      <RibbonButton icon={<Box size={18} aria-hidden="true" />} label={t('space3d.define.sections')} title={t('space3d.define.sectionsTitle')} onClick={then(() => props.onDefine('sections'))} />
      <RibbonButton icon={<Sigma size={18} aria-hidden="true" />} label={t('space3d.define.loads')} title={t('space3d.define.loadsTitle')} onClick={then(() => props.onDefine('loads'))} />
      <RibbonButton icon={<Activity size={18} aria-hidden="true" />} label={t('space3d.define.dynamics')} title={t('space3d.define.dynamicsTitle')} onClick={then(() => props.onDefine('dynamics'))} />
    </>,
    assign: <>
      {/* Sin selección, lo primero que se lee es cómo seleccionar (también en un teléfono). */}
      {selected === 0 ? <p className="space3d-ribbon-hint">{t('space3d.ribbon.assignHint')}</p> : null}
      <RibbonButton icon={<Box size={18} aria-hidden="true" />} label={t('space3d.assign.section')} title={needsMembers ? t('space3d.assign.needsMembers') : t('space3d.assign.titleSection')}
        disabled={needsMembers} onClick={then(() => props.onAssign('section'))} />
      <RibbonButton icon={<Link2Off size={18} aria-hidden="true" />} label={t('space3d.assign.releases')} title={needsMembers ? t('space3d.assign.needsMembers') : t('space3d.assign.titleReleases')}
        disabled={needsMembers} onClick={then(() => props.onAssign('releases'))} />
      <RibbonButton icon={<DistributedLoadGlyph size={19} />} label={t('space3d.assign.memberLoad')} title={needsMembers ? t('space3d.assign.needsMembers') : t('space3d.assign.titleMemberLoad')}
        disabled={needsMembers} onClick={then(() => props.onAssign('member-load'))} />
      <RibbonButton icon={<ListTree size={18} aria-hidden="true" />} label={t('space3d.assign.type')} title={needsMembers ? t('space3d.assign.needsMembers') : t('space3d.assign.titleType')}
        disabled={needsMembers} onClick={then(() => props.onAssign('type'))} />
      <span className="space3d-ribbon-separator" aria-hidden="true" />
      <RibbonButton icon={<PointLoadGlyph size={19} />} label={t('space3d.assign.nodalLoad')} title={needsNodes ? t('space3d.assign.needsNodes') : t('space3d.assign.titleNodalLoad')}
        disabled={needsNodes} onClick={then(() => props.onAssign('nodal-load'))} />
      <RibbonButton icon={<Anchor size={18} aria-hidden="true" />} label={t('space3d.assign.support')} title={needsNodes ? t('space3d.assign.needsNodes') : t('space3d.assign.titleSupport')}
        disabled={needsNodes} onClick={then(() => props.onAssign('support'))} />
      <RibbonButton icon={<Layers size={18} aria-hidden="true" />} label={t('space3d.assign.diaphragm')} title={needsNodes ? t('space3d.assign.needsNodes') : t('space3d.assign.titleDiaphragm')}
        disabled={needsNodes} onClick={then(() => props.onAssign('diaphragm'))} />
    </>,
    display: <>
      <RibbonButton icon={<Play size={17} aria-hidden="true" />} label={t('space3d.display.animate')} pressed={props.animate}
        disabled={!props.resultsReady} title={props.resultsReady ? t('space3d.display.animate') : t('space3d.display.needsAnalysis')}
        onClick={() => props.onAnimate(!props.animate)} />
      <RibbonButton icon={<Waves size={17} aria-hidden="true" />} label={t('space3d.display.extruded')} pressed={props.extruded} onClick={() => props.onExtruded(!props.extruded)} />
      <RibbonButton icon={<Tag size={17} aria-hidden="true" />} label={t('space3d.display.labels')} pressed={props.labels} onClick={() => props.onLabels(!props.labels)} />
      {props.displayExtras}
    </>,
    view: <>
      <RibbonButton icon={<Columns2 size={17} aria-hidden="true" />} label={t('space3d.view.split')} pressed={props.split} onClick={() => props.onSplit(!props.split)} />
      <RibbonButton icon={<PanelLeft size={17} aria-hidden="true" />} label={t('space3d.view.explorer')} pressed={props.explorer} onClick={() => props.onExplorer(!props.explorer)} />
    </>,
  };

  return <nav className="space3d-ribbon" aria-label={t('space3d.ribbon.label')} data-open={tab ?? undefined}>
    <div className="space3d-ribbon-bar">
      <Popover
        label={t('space3d.fileMenu')}
        open={fileOpen}
        onOpenChange={(open) => { setFileOpen(open); if (open) setTab(null); }}
        className="space3d-ribbon-menu"
        trigger={<><FolderOpen size={16} aria-hidden="true" /><span>{t('space3d.fileMenu')}</span><ChevronDown size={12} aria-hidden="true" /></>}
      >
        <div className="space3d-menu-list">
          <button type="button" onClick={run(props.file.onNewBuilding)}><Building2 size={16} aria-hidden="true" />{t('space3d.file.newBuilding')}</button>
          <button type="button" onClick={run(props.file.onGenerator)}><Sparkles size={16} aria-hidden="true" />{t('space3d.file.generator')}</button>
          <button type="button" onClick={run(props.file.onLoadExample)}><Blocks size={16} aria-hidden="true" />{t('space3d.loadExample')}</button>
          <button type="button" onClick={run(props.file.onResetBlank)}><RotateCcw size={16} aria-hidden="true" />{t('space3d.resetBlank')}</button>
          <button type="button" onClick={run(props.file.onImport)}><Upload size={16} aria-hidden="true" />{t('space3d.import')}</button>
          <button type="button" onClick={run(props.file.onExport)}><Download size={16} aria-hidden="true" />{t('space3d.export')}</button>
        </div>
      </Popover>
      <div className="space3d-ribbon-tabs" ref={tabsRef}>
        {TABS.map((item, index) => {
          const active = item.id === tab;
          const badge = item.id === 'assign' && selected > 0 ? selected : null;
          return <button
            key={item.id}
            type="button"
            data-ribbon-tab={item.id}
            id={`${baseId}-${item.id}`}
            aria-expanded={active}
            aria-controls={active ? `${baseId}-panel` : undefined}
            className="space3d-ribbon-tab"
            onClick={() => { setFileOpen(false); setTab(active ? null : item.id); }}
            onKeyDown={(event) => onTabKey(event, index)}
          >
            {t(item.key)}
            {badge !== null ? <span className="space3d-ribbon-badge" aria-label={t('space3d.status.selection', { count: badge })}>{badge}</span> : null}
          </button>;
        })}
      </div>
    </div>
    {tab ? <div className="space3d-ribbon-panel" role="group" id={`${baseId}-panel`} aria-labelledby={`${baseId}-${tab}`} data-tab={tab}>
      {panels[tab]}
    </div> : null}
  </nav>;
};
