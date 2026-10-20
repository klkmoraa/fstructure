import {
  BoxSelect,
  CircleDot,
  Component,
  Crosshair,
  Delete,
  GitCommitHorizontal,
  Grid3x3,
  Hand,
  Move,
  MousePointer2,
  MoreHorizontal,
  MoveDiagonal2,
  RotateCcw,
  Ruler,
  Scissors,
  Sigma,
  type LucideIcon,
} from 'lucide-react';
import { useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../../i18n/useI18n';
import { useProject } from '../../store/ProjectContext';
import type { Tool } from '../../types';
import { ToolButton as EditorToolButton, type ToolTone } from '../../design-system/components/editor';
import { STRUCTURAL_TOOL_IDS, StructuralToolIcon } from './StructuralToolIcon';
import {
  TOOL_GROUPS,
  TOOL_REGISTRY,
  type ToolDefinition,
  toolsInGroup,
} from './toolRegistry';
import { emitWorkspaceCommand } from '../workspace/workspaceCommands';
import { useShellComposition } from '../workspace/useShellComposition';
import { SurfacePresentationContext } from '../workspace/SurfacePresentationContext';
import { ToolDockMenu } from './ToolDockMenu';

const toolIcons: Record<Tool, LucideIcon> = {
  select: MousePointer2,
  pan: Hand,
  node: CircleDot,
  member: GitCommitHorizontal,
  support: Component,
  pointLoad: MoveDiagonal2,
  distributedLoad: Sigma,
  moment: RotateCcw,
  dimension: Ruler,
  split: Scissors,
  cut: Crosshair,
  delete: Delete,
};

const ToolGlyph = ({ definition, size = 22 }: { definition: ToolDefinition; size?: number }) => {
  const Icon = toolIcons[definition.id];
  return STRUCTURAL_TOOL_IDS.has(definition.id)
    ? <StructuralToolIcon tool={definition.id} />
    : <Icon size={size} strokeWidth={1.8} />;
};

const toolTones: Record<Tool, ToolTone> = {
  select: 'navigation',
  pan: 'navigation',
  node: 'structure',
  member: 'structure',
  support: 'structure',
  pointLoad: 'load',
  distributedLoad: 'distributed',
  moment: 'moment',
  dimension: 'dimension',
  split: 'structure',
  cut: 'cut',
  delete: 'destructive',
};

const PRIMARY_DOCK_TOOLS: readonly Tool[] = ['select', 'node', 'member', 'support'];
const LOAD_DOCK_TOOLS: readonly Tool[] = ['pointLoad', 'distributedLoad', 'moment'];
const SECONDARY_DOCK_TOOLS: readonly Tool[] = ['pan', 'split', 'cut', 'delete'];
// Dimensions remain available through Layers.
const HIDDEN_RAIL_TOOL_IDS = new Set<Tool>(['dimension']);

/**
 * Tooltip local del riel, visible por foco y no sólo por hover (CRI-98 §4).
 * Se porta a `document.body` a propósito: `.toolbar` scrollea en Y
 * (`overflow-y:auto`), y eso recorta cualquier burbuja posicionada dentro de
 * su propia caja, sobre todo en `M1` donde el riel mide apenas 76px de ancho.
 */
const RailTooltip = ({ id, content, children, placement = 'right' }: { id: string; content: string; children: ReactNode; placement?: 'right' | 'top' }) => {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const rect = open ? anchorRef.current?.getBoundingClientRect() : undefined;

  return <span
    ref={anchorRef}
    className="tool-rail-tooltip-anchor"
    onMouseEnter={() => setOpen(true)}
    onMouseLeave={() => setOpen(false)}
    onFocus={() => setOpen(true)}
    onBlur={() => setOpen(false)}
  >
    {children}
    {rect && typeof document !== 'undefined' ? createPortal(
      <span
        role="tooltip"
        id={id}
        className="tool-rail-tooltip"
        data-placement={placement}
        style={placement === 'top'
          ? { top: rect.top - 8, left: rect.left + rect.width / 2, transform: 'translate(-50%, -100%)' }
          : { top: rect.top + rect.height / 2, left: rect.right + 8 }}
      >{content}</span>,
      document.body,
    ) : null}
  </span>;
};

const RegisteredToolButton = ({
  definition,
  label,
  active,
  compact = false,
  className = '',
  onSelect,
  menuItem = false,
  'aria-describedby': ariaDescribedBy,
}: {
  definition: ToolDefinition;
  label: string;
  active: boolean;
  compact?: boolean;
  className?: string;
  onSelect: (tool: Tool) => void;
  menuItem?: boolean;
  'aria-describedby'?: string;
}) => {
  const { id } = definition;
  return <EditorToolButton
    className={`tool-button tool-${id}${active ? ' active' : ''}${definition.destructive ? ' destructive' : ''}${className ? ` ${className}` : ''}`}
    label={label}
    icon={<ToolGlyph definition={definition} />}
    keyShortcut={definition.activationKey?.toUpperCase() ?? 'Delete Backspace'}
    tone={toolTones[id]}
    active={active}
    compact={compact}
    onClick={() => onSelect(id)}
    aria-describedby={ariaDescribedBy}
    role={menuItem ? 'menuitemradio' : undefined}
    aria-checked={menuItem ? active : undefined}
    data-tool-id={id}
    data-tool-group={definition.group}
    data-source-tool-group={definition.group}
  />;
};

/**
 * Único componente del riel de herramientas (CRI-98): su forma la decide la
 * clase de composición resuelta por el shell (`useShellComposition`), nunca
 * un `matchMedia` propio. `X2` lleva etiqueta, `M1` es icon-only, `K0` es la
 * paleta táctil — sin booleano de compatibilidad que un llamador pueda pasar
 * por su cuenta.
 */
export const ToolRail = () => {
  const { activeTool, setActiveTool, project, selection } = useProject();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [dockMenu, setDockMenu] = useState<'loads' | 'more' | null>(null);
  const [lastLoadTool, setLastLoadTool] = useState<Tool>('pointLoad');
  const { shellClass } = useShellComposition();
  const surfacePresentation = useContext(SurfacePresentationContext);
  const generatorOpen = surfacePresentation?.stateFor('generator').open ?? false;
  const generatorWasOpenRef = useRef(generatorOpen);
  /** Expanded (`X2`) lleva etiqueta; Medium (`M1`) y Compact (`K0`) son icon-only. */
  const compact = shellClass !== 'X2';
  const { t, language } = useI18n();
  const classroom = project.settings.calculationMode === 'classroom';
  const activeDefinition = TOOL_REGISTRY.find((tool) => tool.id === activeTool);
  const revealAdvanced = showAdvanced || Boolean(activeDefinition?.classroomAdvanced);
  const visibleTools = (classroom && !revealAdvanced
    ? TOOL_REGISTRY.filter((tool) => !tool.classroomAdvanced)
    : TOOL_REGISTRY
  ).filter((tool) => !HIDDEN_RAIL_TOOL_IDS.has(tool.id));
  const canEditSelection = selection?.kind === 'node'
    || selection?.kind === 'member'
    || (selection?.kind === 'multi' && (selection.nodeIds.length > 0 || selection.memberIds.length > 0));
  // El generador es una superficie, no una herramienta de modelado. Cancelar
  // y Generar cierran la misma superficie; ese cierre devuelve el lienzo al
  // modo de selección, incluso si Nodo estaba activo antes de abrirla.
  useEffect(() => {
    if (generatorOpen) {
      generatorWasOpenRef.current = true;
      return;
    }
    if (!generatorWasOpenRef.current) return;
    generatorWasOpenRef.current = false;
    setActiveTool('select');
  }, [generatorOpen, setActiveTool]);

  const selectTool = (tool: Tool) => setActiveTool(tool);

  useEffect(() => {
    if (LOAD_DOCK_TOOLS.includes(activeTool)) setLastLoadTool(activeTool);
  }, [activeTool]);

  const activeLoad = LOAD_DOCK_TOOLS.includes(activeTool);
  const activeSecondary = SECONDARY_DOCK_TOOLS.includes(activeTool);
  const loadDefinition = TOOL_REGISTRY.find((tool) => tool.id === (activeLoad ? activeTool : lastLoadTool))!;
  const menuTool = (definition: ToolDefinition) => <button key={definition.id} type="button"
    aria-pressed={activeTool === definition.id} data-tool-id={definition.id}
    onClick={() => selectTool(definition.id)}>
    <ToolGlyph definition={definition} size={20} /><span>{t(definition.labelKey)}</span><kbd>{definition.shortcut}</kbd>
  </button>;

  const primaryDock = <>
    <section className="tool-group dock-group dock-group-build" role="group" aria-label={t('toolbar.groupCreate')}>
      <div className="tool-group-actions">
        {PRIMARY_DOCK_TOOLS.map((id) => {
          const definition = TOOL_REGISTRY.find((tool) => tool.id === id)!;
          const tipId = `tool-rail-tip-${id}`;
          return <RailTooltip key={id} id={tipId} content={`${t(definition.labelKey)} (${definition.shortcut})`} placement="top">
            <RegisteredToolButton definition={definition} label={t(definition.labelKey)} active={activeTool === id}
              compact={shellClass !== 'X2' || activeTool !== id} onSelect={selectTool} aria-describedby={tipId} />
          </RailTooltip>;
        })}
      </div>
    </section>
    <section className="tool-group dock-group dock-group-loads" role="group" aria-label={t('toolbar.groupLoads')}>
      <ToolDockMenu label={t('toolbar.loads')} activeTool={activeLoad ? activeTool : undefined}
        open={dockMenu === 'loads'} onOpenChange={(open) => setDockMenu(open ? 'loads' : null)}
        trigger={<><ToolGlyph definition={loadDefinition} size={20} /><span>{activeLoad ? t(loadDefinition.labelKey) : t('toolbar.loadsShort')}</span></>}>
        {TOOL_REGISTRY.filter((tool) => LOAD_DOCK_TOOLS.includes(tool.id)).map(menuTool)}
      </ToolDockMenu>
    </section>
    <section className="tool-group dock-group dock-group-refine" role="group" aria-label={t('toolbar.groupEdit')}>
      <ToolDockMenu label={language === 'es' ? 'Más herramientas' : 'More tools'} activeTool={activeSecondary ? activeTool : undefined}
        open={dockMenu === 'more'} onOpenChange={(open) => setDockMenu(open ? 'more' : null)}
        trigger={<>{activeSecondary && activeDefinition ? <ToolGlyph definition={activeDefinition} size={20} /> : <MoreHorizontal size={20} aria-hidden="true" />}<span>{activeSecondary && activeDefinition ? t(activeDefinition.labelKey) : t('toolbar.moreShort')}</span></>}>
        {TOOL_REGISTRY.filter((tool) => SECONDARY_DOCK_TOOLS.includes(tool.id)).map(menuTool)}
        <div className="tool-dock-menu__divider" />
        <button type="button" data-structure-generator-command onClick={() => emitWorkspaceCommand('open-structure-generator')}>
          <Grid3x3 size={20} aria-hidden="true" /><span>{t('generator.launcher')}</span>
        </button>
        {canEditSelection ? <button type="button" data-structural-edit-command onClick={() => emitWorkspaceCommand('open-structural-edit')}>
          <Move size={20} aria-hidden="true" /><span>{t('canvas.structuralEditLauncher')}</span>
        </button> : null}
      </ToolDockMenu>
    </section>
  </>;

  const isFloatingDock = shellClass === 'X2' || shellClass === 'M1';
  const showActiveLabel = shellClass === 'X2';

  return (
    <>
      <aside
        className={`toolbar tool-rail${isFloatingDock ? ' is-floating-dock' : ' is-compact'}`}
        aria-label={t('toolbar.label')}
        data-tool-rail={isFloatingDock ? 'dock' : 'compact'}
        data-mesa-dock={isFloatingDock ? '' : undefined}
        /* La hoja expande una sola etiqueta: la herramienta activa. */
        data-tool-rail-labels={showActiveLabel ? 'active' : undefined}
      >
        <div className="desktop-tool-list" data-desktop-dock-tools={isFloatingDock ? 'true' : undefined}>
          {isFloatingDock ? primaryDock : TOOL_GROUPS.map((group) => {
            const groupTools = toolsInGroup(group.id, visibleTools);
            if (!groupTools.length && !(group.id === 'edit' && canEditSelection)) return null;
            const headingId = `tool-group-${group.id}`;
            return <section key={group.id} className={`tool-group tool-group-${group.id}`} role="group" aria-labelledby={headingId}>
              <h2 id={headingId} className="tool-group-heading">{t(group.labelKey)}</h2>
              <div className="tool-group-actions">
                {groupTools.map((definition) => {
                  const tipId = `tool-rail-tip-${definition.id}`;
                  return <RailTooltip key={definition.id} id={tipId} content={`${t(definition.labelKey)} (${definition.shortcut})`}>
                    <RegisteredToolButton
                      definition={definition}
                      label={t(definition.labelKey)}
                      active={activeTool === definition.id}
                      compact={compact}
                      onSelect={selectTool}
                      aria-describedby={tipId}
                    />
                  </RailTooltip>;
                })}
                {group.id === 'create' ? <RailTooltip id="tool-rail-tip-generator" content={t('generator.launcher')}>
                  <EditorToolButton
                    className={`tool-button tool-structure-generator${compact ? ' is-compact' : ''}`}
                    label={t('generator.launcher')}
                    icon={<Grid3x3 size={22} strokeWidth={1.8} />}
                    tone="structure"
                    compact={compact}
                    onClick={() => emitWorkspaceCommand('open-structure-generator')}
                    aria-describedby="tool-rail-tip-generator"
                    data-structure-generator-command
                  />
                </RailTooltip> : null}
                {group.id === 'edit' && canEditSelection ? <RailTooltip id="tool-rail-tip-structural-edit" content={t('canvas.structuralEditLauncher')}>
                  <EditorToolButton
                    className={`tool-button tool-structural-edit${compact ? ' is-compact' : ''}`}
                    label={t('canvas.structuralEditLauncher')}
                    icon={<Move size={22} strokeWidth={1.8} />}
                    tone="structure"
                    compact={compact}
                    onClick={() => emitWorkspaceCommand('open-structural-edit')}
                    aria-describedby="tool-rail-tip-structural-edit"
                    data-structural-edit-command
                  />
                </RailTooltip> : null}
              </div>
            </section>;
          })}
          {classroom && !isFloatingDock ? <button
            className="tool-button tool-more desktop-advanced-toggle"
            aria-label={showAdvanced ? t('toolbar.hideAdvanced') : t('toolbar.showAdvanced')}
            aria-expanded={showAdvanced}
            onClick={() => setShowAdvanced((current) => !current)}
          ><MoreHorizontal size={22} /><span>{showAdvanced ? t('toolbar.lessShort') : t('toolbar.moreShort')}</span></button> : null}
        </div>

        <div className="toolbar-spacer" />
        <div className="selection-tip"><BoxSelect size={18} /><span>{t('toolbar.tip')}</span></div>

      </aside>
    </>
  );
};
