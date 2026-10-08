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
  PanelsTopLeft,
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

type DesktopDockGroup = 'navigate' | 'build' | 'loads' | 'refine';

// Las cotas visibles se controlan desde Capas; una segunda herramienta de
// colocación duplicaba ese estado sin añadir una acción distinta al flujo.
const HIDDEN_RAIL_TOOL_IDS = new Set<Tool>(['dimension']);

const DESKTOP_DOCK_GROUPS: readonly {
  id: DesktopDockGroup;
  sourceGroups: readonly (typeof TOOL_GROUPS)[number]['id'][];
}[] = [
  { id: 'navigate', sourceGroups: ['navigate'] },
  { id: 'build', sourceGroups: ['create'] },
  { id: 'loads', sourceGroups: ['loads'] },
  { id: 'refine', sourceGroups: ['inspect', 'edit'] },
] as const;

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
  const [desktopDockCollapsed, setDesktopDockCollapsed] = useState(false);
  const { shellClass } = useShellComposition();
  const surfacePresentation = useContext(SurfacePresentationContext);
  const generatorOpen = surfacePresentation?.stateFor('generator').open ?? false;
  const generatorWasOpenRef = useRef(generatorOpen);
  /** Expanded (`X2`) lleva etiqueta; Medium (`M1`) y Compact (`K0`) son icon-only. */
  const compact = shellClass !== 'X2';
  const { t } = useI18n();
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

  const renderDockGroup = (dockGroup: (typeof DESKTOP_DOCK_GROUPS)[number]) => {
    const groupTools = visibleTools.filter((tool) => dockGroup.sourceGroups.includes(tool.group));
    const headingId = `dock-group-${dockGroup.id}`;
    const label = dockGroup.id === 'navigate'
      ? t('toolbar.groupNavigate')
      : dockGroup.id === 'build'
        ? t('toolbar.groupCreate')
        : dockGroup.id === 'loads'
          ? t('toolbar.groupLoads')
          : `${t('toolbar.groupInspect')} · ${t('toolbar.groupEdit')}`;

    return <section
      key={dockGroup.id}
      className={`tool-group dock-group dock-group-${dockGroup.id}`}
      role="group"
      aria-labelledby={headingId}
      data-dock-group={dockGroup.id}
    >
      <h2 id={headingId} className="tool-group-heading">{label}</h2>
      <div className="tool-group-actions">
        {groupTools.map((definition) => {
          const tipId = `tool-rail-tip-${definition.id}`;
          // El dock permanece silencioso: sólo la herramienta activa se nombra en X2.
          const active = activeTool === definition.id;
          const isButtonCompact = shellClass === 'X2' ? !active : true;
          return <RailTooltip key={definition.id} id={tipId} content={`${t(definition.labelKey)} (${definition.shortcut})`} placement="top">
            <RegisteredToolButton
              definition={definition}
              label={t(definition.labelKey)}
              active={active}
              compact={isButtonCompact}
              onSelect={selectTool}
              aria-describedby={tipId}
            />
          </RailTooltip>;
        })}
        {dockGroup.id === 'build' ? <RailTooltip id="tool-rail-tip-generator" content={t('generator.launcher')} placement="top">
          <EditorToolButton
            className="tool-button tool-structure-generator is-compact"
            label={t('generator.launcher')}
            icon={<Grid3x3 size={22} strokeWidth={1.8} />}
            tone="structure"
            compact
            onClick={() => emitWorkspaceCommand('open-structure-generator')}
            aria-describedby="tool-rail-tip-generator"
            data-structure-generator-command
          />
        </RailTooltip> : null}
        {dockGroup.id === 'refine' && canEditSelection ? <RailTooltip id="tool-rail-tip-structural-edit" content={t('canvas.structuralEditLauncher')} placement="top">
          <EditorToolButton
            className="tool-button tool-structural-edit is-compact"
            label={t('canvas.structuralEditLauncher')}
            icon={<Move size={22} strokeWidth={1.8} />}
            tone="structure"
            compact
            onClick={() => emitWorkspaceCommand('open-structural-edit')}
            aria-describedby="tool-rail-tip-structural-edit"
            data-structural-edit-command
          />
        </RailTooltip> : null}
      </div>
    </section>;
  };

  const isFloatingDock = shellClass === 'X2' || shellClass === 'M1';
  const showActiveLabel = shellClass === 'X2';

  return (
    <>
      <aside
        className={`toolbar tool-rail${isFloatingDock ? ' is-floating-dock' : ' is-compact'}${desktopDockCollapsed ? ' is-dock-collapsed' : ''}`}
        aria-label={t('toolbar.label')}
        data-tool-rail={isFloatingDock ? 'dock' : 'compact'}
        data-mesa-dock={isFloatingDock ? '' : undefined}
        /* La hoja expande una sola etiqueta: la herramienta activa. */
        data-tool-rail-labels={showActiveLabel && !desktopDockCollapsed ? 'active' : undefined}
      >
        <div className="desktop-tool-list" data-desktop-dock-tools={isFloatingDock ? 'true' : undefined}>
          {isFloatingDock ? desktopDockCollapsed && activeDefinition
            ? <RailTooltip id="tool-rail-tip-active-tool" content={`${t(activeDefinition.labelKey)} (${activeDefinition.shortcut})`} placement="top">
              <RegisteredToolButton
                definition={activeDefinition}
                label={t(activeDefinition.labelKey)}
                active
                compact={compact}
                onSelect={selectTool}
                aria-describedby="tool-rail-tip-active-tool"
              />
            </RailTooltip>
            : DESKTOP_DOCK_GROUPS.map(renderDockGroup) : TOOL_GROUPS.map((group) => {
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
          {shellClass === 'X2' ? <button
            type="button"
            className="dock-collapse-toggle"
            aria-label={t(desktopDockCollapsed ? 'toolbar.expandDock' : 'toolbar.collapseDock')}
            aria-expanded={!desktopDockCollapsed}
            onClick={() => setDesktopDockCollapsed((collapsed) => !collapsed)}
          ><PanelsTopLeft size={18} aria-hidden="true" /></button> : null}
          {classroom ? <button
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
