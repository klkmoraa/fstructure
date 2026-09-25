/**
 * Cinta de comandos de la mesa 3D, con la gramática de ETABS/SAP2000:
 * Definir → Dibujar → Asignar → Analizar → Mostrar, más las vistas.
 *
 * Cada botón enseña su nombre (la voz dice lo que ve, WCAG 2.5.3) y el atajo
 * vive en el `title`. Lo que necesita una selección o un resultado se
 * deshabilita y dice por qué.
 */
import { useState, type ReactNode } from 'react';
import {
  Activity, Anchor, Blocks, Box, Building2, ChevronDown, Columns2, Download, FolderOpen, Grid3x3, Layers, Link2Off, ListTree,
  MousePointer2, PanelLeft, Play, RotateCcw, Sigma, Sparkles, Tag, Upload, Waves,
} from 'lucide-react';
import { DistributedLoadGlyph, MemberGlyph, NodeGlyph, PointLoadGlyph, SupportGlyph } from '../../../../design-system/icons/structural';
import { Popover } from '../../../../design-system/components/overlays';
import type { TranslationKey } from '../../i18n/catalogs';
import type { Space3DResultMode } from '../../space3d/view/sceneModel';
import type { Space3DModelingTool } from './Space3DModeBar';

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
  readonly tool: Space3DModelingTool;
  readonly onTool: (tool: Space3DModelingTool) => void;
  readonly hasNodes: boolean;
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

const Group = ({ label, children }: { label: string; children: ReactNode }) => <div className="space3d-ribbon-group" role="group" aria-label={label}>
  <div className="space3d-ribbon-items">{children}</div>
  <span className="space3d-ribbon-caption" aria-hidden="true">{label}</span>
</div>;

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

export const Space3DRibbon = (props: Space3DRibbonProps) => {
  const { t } = props;
  const [fileOpen, setFileOpen] = useState(false);
  const run = (action: () => void) => () => { setFileOpen(false); action(); };
  const shortcut = (label: string, key: string) => `${label} (${t('space3d.shortcut', { key })})`;
  const needsMembers = props.selectedMembers === 0;
  const needsNodes = props.selectedNodes === 0;

  return <nav className="space3d-ribbon" aria-label={t('space3d.ribbon.label')}>
    <Group label={t('space3d.ribbon.file')}>
      <Popover
        label={t('space3d.fileMenu')}
        open={fileOpen}
        onOpenChange={setFileOpen}
        className="space3d-ribbon-menu"
        trigger={<><FolderOpen size={18} aria-hidden="true" /><span>{t('space3d.fileMenu')}</span><ChevronDown size={12} aria-hidden="true" /></>}
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
    </Group>

    <Group label={t('space3d.ribbon.define')}>
      <RibbonButton icon={<Grid3x3 size={18} aria-hidden="true" />} label={t('space3d.define.grid')} title={t('space3d.define.gridTitle')} onClick={() => props.onDefine('grid')} />
      <RibbonButton icon={<Box size={18} aria-hidden="true" />} label={t('space3d.define.sections')} title={t('space3d.define.sectionsTitle')} onClick={() => props.onDefine('sections')} />
      <RibbonButton icon={<Sigma size={18} aria-hidden="true" />} label={t('space3d.define.loads')} title={t('space3d.define.loadsTitle')} onClick={() => props.onDefine('loads')} />
      <RibbonButton icon={<Activity size={18} aria-hidden="true" />} label={t('space3d.define.dynamics')} title={t('space3d.define.dynamicsTitle')} onClick={() => props.onDefine('dynamics')} />
    </Group>

    <Group label={t('space3d.ribbon.draw')}>
      <RibbonButton icon={<MousePointer2 size={18} aria-hidden="true" />} label={t('space3d.toolSelect')} title={shortcut(t('space3d.toolSelect'), 'V')}
        pressed={props.tool === 'select'} onClick={() => props.onTool('select')} />
      <RibbonButton icon={<NodeGlyph size={19} />} label={t('space3d.node')} name={t('space3d.newNode')} title={shortcut(t('space3d.newNode'), 'N')}
        pressed={props.tool === 'node'} onClick={() => props.onTool('node')} />
      <RibbonButton icon={<MemberGlyph size={19} />} label={t('space3d.member')} name={t('space3d.newMember')} title={shortcut(t('space3d.newMember'), 'B')}
        pressed={props.tool === 'member'} onClick={() => props.onTool('member')} />
      <RibbonButton icon={<SupportGlyph size={19} />} label={t('space3d.toolSupport')} name={t('space3d.newSupport')}
        title={props.hasNodes ? shortcut(t('space3d.newSupport'), 'A') : t('space3d.newSupportNeedsNode')}
        pressed={props.tool === 'support'} disabled={!props.hasNodes} onClick={() => props.onTool('support')} />
      <RibbonButton icon={<PointLoadGlyph size={19} />} label={t('space3d.load')} name={t('space3d.newLoad')}
        title={props.hasNodes ? shortcut(t('space3d.newLoad'), 'C') : t('space3d.newLoadHint')}
        pressed={props.tool === 'load'} disabled={!props.hasNodes} onClick={() => props.onTool('load')} />
    </Group>

    <Group label={t('space3d.ribbon.assign')}>
      <RibbonButton icon={<Box size={18} aria-hidden="true" />} label={t('space3d.assign.section')} title={needsMembers ? t('space3d.assign.needsMembers') : t('space3d.assign.titleSection')}
        disabled={needsMembers} onClick={() => props.onAssign('section')} />
      <RibbonButton icon={<Link2Off size={18} aria-hidden="true" />} label={t('space3d.assign.releases')} title={needsMembers ? t('space3d.assign.needsMembers') : t('space3d.assign.titleReleases')}
        disabled={needsMembers} onClick={() => props.onAssign('releases')} />
      <RibbonButton icon={<DistributedLoadGlyph size={19} />} label={t('space3d.assign.memberLoad')} title={needsMembers ? t('space3d.assign.needsMembers') : t('space3d.assign.titleMemberLoad')}
        disabled={needsMembers} onClick={() => props.onAssign('member-load')} />
      <RibbonButton icon={<PointLoadGlyph size={19} />} label={t('space3d.assign.nodalLoad')} title={needsNodes ? t('space3d.assign.needsNodes') : t('space3d.assign.titleNodalLoad')}
        disabled={needsNodes} onClick={() => props.onAssign('nodal-load')} />
      <RibbonButton icon={<Anchor size={18} aria-hidden="true" />} label={t('space3d.assign.support')} title={needsNodes ? t('space3d.assign.needsNodes') : t('space3d.assign.titleSupport')}
        disabled={needsNodes} onClick={() => props.onAssign('support')} />
      <RibbonButton icon={<ListTree size={18} aria-hidden="true" />} label={t('space3d.assign.type')} title={needsMembers ? t('space3d.assign.needsMembers') : t('space3d.assign.titleType')}
        disabled={needsMembers} onClick={() => props.onAssign('type')} />
      <RibbonButton icon={<Layers size={18} aria-hidden="true" />} label={t('space3d.assign.diaphragm')} title={needsNodes ? t('space3d.assign.needsNodes') : t('space3d.assign.titleDiaphragm')}
        disabled={needsNodes} onClick={() => props.onAssign('diaphragm')} />
    </Group>

    <Group label={t('space3d.ribbon.display')}>
      <RibbonButton icon={<Play size={17} aria-hidden="true" />} label={t('space3d.display.animate')} pressed={props.animate}
        disabled={!props.resultsReady} title={props.resultsReady ? t('space3d.display.animate') : t('space3d.display.needsAnalysis')}
        onClick={() => props.onAnimate(!props.animate)} />
      <RibbonButton icon={<Waves size={17} aria-hidden="true" />} label={t('space3d.display.extruded')} pressed={props.extruded} onClick={() => props.onExtruded(!props.extruded)} />
      <RibbonButton icon={<Tag size={17} aria-hidden="true" />} label={t('space3d.display.labels')} pressed={props.labels} onClick={() => props.onLabels(!props.labels)} />
      {props.displayExtras}
    </Group>

    <Group label={t('space3d.ribbon.view')}>
      <RibbonButton icon={<Columns2 size={17} aria-hidden="true" />} label={t('space3d.view.split')} pressed={props.split} onClick={() => props.onSplit(!props.split)} />
      <RibbonButton icon={<PanelLeft size={17} aria-hidden="true" />} label={t('space3d.view.explorer')} pressed={props.explorer} onClick={() => props.onExplorer(!props.explorer)} />
    </Group>
  </nav>;
};
