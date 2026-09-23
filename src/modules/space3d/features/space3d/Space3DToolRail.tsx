/**
 * Carril de herramientas de Space 3D.
 *
 * Cada herramienta muestra su nombre y su atajo; cuando no se puede usar, el
 * `title` explica qué falta en lugar de dejar un icono apagado sin motivo.
 * Nudo, Barra, Apoyo y Carga son modos: el siguiente toque en el lienzo actúa.
 * En S3D-1 el apoyo es un atributo del nudo, no una entidad propia.
 */
import { useState, type ReactNode } from 'react';
import { Download, FolderOpen, MousePointer2, RotateCcw, Sparkles, Upload } from 'lucide-react';
import { MemberGlyph, NodeGlyph, PointLoadGlyph, SupportGlyph } from '../../../../design-system/icons/structural';
import { Popover } from '../../../../design-system/components/overlays';
import type { TranslationKey } from '../../i18n/catalogs';
import { getSpace3DMoreCommands } from './space3dWorkspaceModel';

export type Space3DActiveTool = 'select' | 'node' | 'member' | 'support' | 'load';

export interface Space3DFileActions {
  readonly onLoadExample: () => void;
  readonly onResetBlank: () => void;
  readonly onImport: () => void;
  readonly onExport: () => void;
}

export interface Space3DConsoleToolsProps {
  readonly t: (key: TranslationKey, variables?: Record<string, string | number>) => string;
  readonly activeTool: Space3DActiveTool;
  readonly onSelectTool: () => void;
  readonly onNewNode: () => void;
  readonly onNewMember: () => void;
  readonly onNewLoad: () => void;
  readonly onEditSupport: () => void;
  readonly onOpenGenerative?: () => void;
  readonly canNewMember: boolean;
  readonly canNewLoad: boolean;
  readonly canEditSupport: boolean;
  readonly file?: Space3DFileActions;
}

interface ToolProps {
  readonly icon: ReactNode;
  readonly label: string;
  readonly name?: string;
  readonly shortcut: string;
  readonly pressed?: boolean;
  readonly disabled?: boolean;
  readonly hint: string;
  readonly className?: string;
  readonly onClick: () => void;
  readonly t: Space3DConsoleToolsProps['t'];
}

const Tool = ({ icon, label, name, shortcut, pressed, disabled, hint, className, onClick, t }: ToolProps) => <button
  type="button"
  className={`space3d-rail-button${className ? ` ${className}` : ''}`}
  aria-pressed={pressed}
  aria-label={name}
  aria-keyshortcuts={shortcut}
  disabled={disabled}
  title={disabled ? hint : `${hint} (${t('space3d.shortcut', { key: shortcut })})`}
  onClick={onClick}
>
  {icon}
  <span>{label}</span>
  <kbd aria-hidden="true">{shortcut}</kbd>
</button>;

export const Space3DConsoleTools = ({
  t, activeTool, onSelectTool, onNewNode, onNewMember, onNewLoad, onEditSupport, onOpenGenerative,
  canNewMember, canNewLoad, canEditSupport, file,
}: Space3DConsoleToolsProps) => {
  const [fileOpen, setFileOpen] = useState(false);
  const run = (action: () => void) => () => { setFileOpen(false); action(); };

  return <nav className="space3d-console-tools space3d-rail-vertical" aria-label={t('space3d.toolRailLabel')}>
    <Tool t={t} icon={<MousePointer2 size={19} aria-hidden="true" />} label={t('space3d.toolSelect')} shortcut="V"
      pressed={activeTool === 'select'} hint={t('space3d.toolSelect')} onClick={onSelectTool} />

    <div className="space3d-rail-vertical-group" role="group" aria-label={t('space3d.railCreate')}>
      <Tool t={t} icon={<NodeGlyph size={20} />} label={t('space3d.node')} name={t('space3d.newNode')} shortcut="N"
        pressed={activeTool === 'node'} hint={t('space3d.newNode')} onClick={onNewNode} />
      <Tool t={t} icon={<MemberGlyph size={20} />} label={t('space3d.member')} name={t('space3d.newMember')} shortcut="B"
        pressed={activeTool === 'member'} disabled={!canNewMember}
        hint={canNewMember ? t('space3d.newMember') : t('space3d.newMemberHint')} onClick={onNewMember} />
      <Tool t={t} icon={<SupportGlyph size={20} />} label={t('space3d.toolSupport')} name={t('space3d.newSupport')} shortcut="A"
        pressed={activeTool === 'support'} disabled={!canEditSupport}
        hint={canEditSupport ? t('space3d.newSupport') : t('space3d.newSupportNeedsNode')} onClick={onEditSupport} />
      <Tool t={t} icon={<PointLoadGlyph size={20} />} label={t('space3d.load')} name={t('space3d.newLoad')} shortcut="C"
        pressed={activeTool === 'load'} disabled={!canNewLoad}
        hint={canNewLoad ? t('space3d.newLoad') : t('space3d.newLoadHint')} onClick={onNewLoad} />
    </div>

    {onOpenGenerative ? <button
      type="button"
      className="space3d-rail-button space3d-rail-button--generative"
      onClick={onOpenGenerative}
      // WCAG 2.5.3: el nombre accesible contiene el texto visible para el control
      // por voz; la descripción larga queda en `title`.
      aria-label={t('space3d.generatorShort')}
      aria-keyshortcuts="G"
      title={t('space3d.generatorTitle')}
    >
      <Sparkles size={19} aria-hidden="true" />
      <span>{t('space3d.generatorShort')}</span>
      <kbd aria-hidden="true">G</kbd>
    </button> : null}

    {file ? <Popover
      label={t('space3d.fileMenu')}
      open={fileOpen}
      onOpenChange={setFileOpen}
      className="space3d-file-menu"
      trigger={<><FolderOpen size={19} aria-hidden="true" /><span>{t('space3d.fileMenu')}</span></>}
    >
      <div className="space3d-menu-list">
        <button type="button" onClick={run(file.onLoadExample)}><Sparkles size={16} aria-hidden="true" />{t('space3d.loadExample')}</button>
        <button type="button" onClick={run(file.onResetBlank)}><RotateCcw size={16} aria-hidden="true" />{t('space3d.resetBlank')}</button>
        <button type="button" onClick={run(file.onImport)}><Upload size={16} aria-hidden="true" />{t('space3d.import')}</button>
        <button type="button" onClick={run(file.onExport)}><Download size={16} aria-hidden="true" />{t('space3d.export')}</button>
      </div>
      <p className="space3d-menu-heading">{t('space3d.fileMenuPlanned')}</p>
      <ul className="space3d-menu-planned">
        {getSpace3DMoreCommands().map((command) => <li key={command.id}>
          <span>{command.label}</span><small>{command.status}</small>
        </li>)}
      </ul>
    </Popover> : null}
  </nav>;
};
