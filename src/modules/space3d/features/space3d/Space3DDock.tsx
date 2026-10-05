/**
 * Dock de herramientas de la mesa 3D, con la forma del dock de FStructure 2D:
 * una pieza flotante centrada al pie del lienzo en escritorio y una barra fija
 * al pie de la pantalla en un teléfono. La herramienta activa se pinta con el
 * color de acción y, en escritorio, enseña su nombre.
 *
 * Los nombres accesibles son los mismos que tenía la cinta («Nuevo nudo»…):
 * el atajo de teclado vive en el `title`.
 */
import { Columns2, MousePointer2, PanelLeft, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import { MemberGlyph, NodeGlyph, PointLoadGlyph, SupportGlyph } from '../../../../design-system/icons/structural';
import type { TranslationKey } from '../../i18n/catalogs';
import type { Space3DModelingTool } from './Space3DModeBar';

type Translate = (key: TranslationKey, variables?: Record<string, string | number>) => string;

interface Space3DDockProps {
  readonly t: Translate;
  readonly tool: Space3DModelingTool;
  readonly onTool: (tool: Space3DModelingTool) => void;
  readonly hasNodes: boolean;
  readonly onGenerate: () => void;
  readonly explorer: boolean;
  readonly onExplorer: (value: boolean) => void;
  readonly split: boolean;
  readonly onSplit: (value: boolean) => void;
}

interface DockButtonProps {
  readonly icon: ReactNode;
  readonly label: string;
  readonly name?: string;
  readonly title: string;
  readonly active?: boolean;
  readonly pressed?: boolean;
  readonly disabled?: boolean;
  readonly onClick: () => void;
  readonly className?: string;
}

const DockButton = ({ icon, label, name, title, active, pressed, disabled, onClick, className }: DockButtonProps) => <button
  type="button"
  className={`space3d-dock-button${className ? ` ${className}` : ''}`}
  data-active={active || undefined}
  aria-pressed={active ?? pressed}
  aria-label={name ?? label}
  title={title}
  disabled={disabled}
  onClick={onClick}
>
  {icon}
  <span className="space3d-dock-label">{label}</span>
</button>;

export const Space3DDock = ({ t, tool, onTool, hasNodes, onGenerate, explorer, onExplorer, split, onSplit }: Space3DDockProps) => {
  const shortcut = (label: string, key: string) => `${label} (${t('space3d.shortcut', { key })})`;
  return <nav className="space3d-dock" aria-label={t('space3d.dock.label')}>
    <div className="space3d-dock-group">
      <DockButton icon={<MousePointer2 size={18} aria-hidden="true" />} label={t('space3d.toolSelect')} title={shortcut(t('space3d.toolSelect'), 'V')}
        active={tool === 'select'} onClick={() => onTool('select')} />
    </div>
    <div className="space3d-dock-group">
      <DockButton icon={<NodeGlyph size={19} />} label={t('space3d.node')} name={t('space3d.newNode')} title={shortcut(t('space3d.newNode'), 'N')}
        active={tool === 'node'} onClick={() => onTool('node')} />
      <DockButton icon={<MemberGlyph size={19} />} label={t('space3d.member')} name={t('space3d.newMember')} title={shortcut(t('space3d.newMember'), 'B')}
        active={tool === 'member'} onClick={() => onTool('member')} />
      <DockButton icon={<SupportGlyph size={19} />} label={t('space3d.toolSupport')} name={t('space3d.newSupport')}
        title={hasNodes ? shortcut(t('space3d.newSupport'), 'A') : t('space3d.newSupportNeedsNode')}
        active={tool === 'support'} disabled={!hasNodes} onClick={() => onTool('support')} />
      <DockButton icon={<PointLoadGlyph size={19} />} label={t('space3d.load')} name={t('space3d.newLoad')}
        title={hasNodes ? shortcut(t('space3d.newLoad'), 'C') : t('space3d.newLoadHint')}
        active={tool === 'load'} disabled={!hasNodes} onClick={() => onTool('load')} />
    </div>
    <div className="space3d-dock-group">
      <DockButton icon={<Sparkles size={18} aria-hidden="true" />} label={t('space3d.dock.generate')} title={shortcut(t('space3d.dock.generate'), 'G')} onClick={onGenerate} />
    </div>
    {/* Paneles de la vista: en un teléfono no hay sitio para ellos y se retiran. */}
    <div className="space3d-dock-group space3d-dock-group--view">
      <DockButton icon={<PanelLeft size={18} aria-hidden="true" />} label={t('space3d.view.explorer')} title={t('space3d.view.explorer')}
        pressed={explorer} onClick={() => onExplorer(!explorer)} className="space3d-dock-button--toggle" />
      <DockButton icon={<Columns2 size={18} aria-hidden="true" />} label={t('space3d.view.split')} title={t('space3d.view.split')}
        pressed={split} onClick={() => onSplit(!split)} className="space3d-dock-button--toggle" />
    </div>
  </nav>;
};
