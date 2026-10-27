import {
  ArrowDown,
  Check,
  DraftingCompass,
  Ellipsis,
  Grid3x3,
  Hand,
  Layers3,
  Magnet,
  MousePointer2,
  Move,
  PanelRight,
  RotateCcw,
  RotateCw,
  SlidersHorizontal,
  Trash2,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../../i18n/useI18n';
import type { TranslationKey } from '../../i18n/catalogs';
import { useProject } from '../../store/ProjectContext';
import { singleWorkTool } from '../../shared/project/workScope';
import type { Selection, Tool } from '../../types';
import { CoordinateEntryGlyph } from '../../design-system/icons/structural';
import { useModalFocus } from '../../design-system/components/modalFocus';
import { readCanvasViewSettings, withCanvasViewSettings } from '../view/canvasViewSettings';
import { emitWorkspaceCommand, onWorkspaceCommand } from '../workspace/workspaceCommands';
import { StructuralToolIcon } from './StructuralToolIcon';
import { TOOL_REGISTRY } from './toolRegistry';
import { readLoadQuickValue, type LoadQuickValue } from './loadQuickValue';
import { MobileLoadEditor } from './MobileLoadEditor';
import { toDisplay } from '../../foundation/units';
import { unitLabel } from '../../engine/units';
import { formatFixed } from '../../utils/numberFormat';
import './mobileDock.css';
import './mobileSelection.css';
import { mobileSelectionLabels } from './mobileSelectionLabels';
import { MobileHistoryActions } from './MobileHistoryActions';

type LoadTool = Extract<Tool, 'pointLoad' | 'distributedLoad' | 'moment'>;
const LOAD_TOOLS: readonly LoadTool[] = ['pointLoad', 'distributedLoad', 'moment'];
const isLoadTool = (tool: Tool): tool is LoadTool => (LOAD_TOOLS as readonly Tool[]).includes(tool);

/** Las cuatro teclas de modelado del dock; Carga y Más se añaden aparte. */
const PRIMARY_TOOLS: readonly Tool[] = ['select', 'node', 'member', 'support'];
/** Lo que vive en la hoja «Más»: herramientas de uso ocasional. */
const SECONDARY_TOOLS: readonly Tool[] = ['pan', 'cut', 'split', 'delete'];

const SHORT_LABEL: Partial<Record<Tool, TranslationKey>> = {
  select: 'dock.select',
  member: 'dock.member',
  pointLoad: 'dock.load',
  distributedLoad: 'dock.load',
  moment: 'dock.load',
};

const lucideFor: Partial<Record<Tool, LucideIcon>> = {
  select: MousePointer2,
  pan: Hand,
  delete: Trash2,
};

const ToolIcon = ({ tool, size = 22 }: { tool: Tool; size?: number }) => {
  const Icon = lucideFor[tool];
  return Icon ? <Icon size={size} strokeWidth={1.9} aria-hidden="true" /> : <StructuralToolIcon tool={tool} size={size} />;
};

const DockKey = ({ label, title = label, pressed, onClick, children, className = '', ...rest }: {
  label: string;
  title?: string;
  pressed?: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
  'data-tool-id'?: string;
  'aria-haspopup'?: 'dialog';
  'aria-expanded'?: boolean;
}) => <button
  type="button"
  className={`mdock__key${className ? ` ${className}` : ''}`}
  aria-label={label}
  title={title}
  aria-pressed={pressed}
  onClick={onClick}
  {...rest}
>{children}</button>;

/** El sentido de la carga, dibujado: una flecha girada o un giro. */
const LoadDirectionGlyph = ({ value, size = 17 }: { value: LoadQuickValue; size?: number }) => {
  if (value.quantity === 'moment') {
    const Icon = value.direction < 0 ? RotateCw : RotateCcw;
    return <Icon size={size} strokeWidth={2} aria-hidden="true" />;
  }
  // `ArrowDown` apunta a −90°; el ángulo matemático gira al revés que CSS.
  return <ArrowDown size={size} strokeWidth={2} aria-hidden="true" style={{ transform: `rotate(${-(value.direction + 90)}deg)` }} />;
};

const selectionChip = (selection: NonNullable<Selection>): { tool: Tool | null; label: string } => {
  if (selection.kind === 'multi') return { tool: null, label: String(selection.nodeIds.length + selection.memberIds.length) };
  if (selection.kind === 'node') return { tool: 'node', label: selection.id };
  if (selection.kind === 'member') return { tool: 'member', label: selection.id };
  if (selection.kind === 'nodalLoad') return { tool: 'pointLoad', label: selection.id };
  return { tool: 'distributedLoad', label: selection.id };
};

/**
 * Dock dinámico del teléfono (K0).
 *
 * Una sola pieza flotante al pie: la fila de herramientas y, encima, una
 * cápsula que cambia según lo que se esté haciendo —las opciones de la
 * herramienta activa, el tipo de carga o las acciones de la selección— y se
 * retira cuando no hay nada que ofrecer. Sustituye a la banda de la consola,
 * que en el teléfono era un carril desplazable con teclas que se cortaban.
 */
export const MobileDock = ({ onOpenInspector, inspectorOpen }: {
  onOpenInspector: () => void;
  inspectorOpen: boolean;
}) => {
  const { t, language } = useI18n();
  const { project, activeTool, setActiveTool, selection, setSelection, executeProjectCommand, updateProject, updateProjectView, canUndo, canRedo } = useProject();
  const [lastLoad, setLastLoad] = useState<LoadTool>('pointLoad');
  const [moreOpen, setMoreOpen] = useState(false);
  const [placement, setPlacement] = useState<{ memberStart: string | null; coordinateEntryOpen: boolean }>({ memberStart: null, coordinateEntryOpen: false });
  const [valueEditor, setValueEditor] = useState<{ id: string; projectId: string; unitsKey: string } | null>(null);
  // El teclado del teléfono sólo sube si el foco llega dentro del toque. Al
  // colocar una carga el editor aún no existe: este campo invisible recibe el
  // foco en el mismo toque y lo cede al del valor en cuanto aparece.
  const focusProxyRef = useRef<HTMLInputElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const classroom = project.settings.calculationMode === 'classroom';
  const view = readCanvasViewSettings(project);

  useEffect(() => onWorkspaceCommand('canvas-placement-state', setPlacement), []);
  const loadValue = readLoadQuickValue(project, selection);
  const loadValueId = loadValue?.id ?? null;
  const unitsKey = JSON.stringify(project.settings.units);
  // An editor belongs to this project, unit system, selection and tool.
  useEffect(() => {
    setValueEditor(current => current && (current.id !== loadValueId || current.projectId !== project.id || current.unitsKey !== unitsKey || activeTool !== 'select') ? null : current);
  }, [loadValueId, project.id, unitsKey, activeTool]);
  useEffect(() => onWorkspaceCommand('edit-load-value', ({ id }) => {
    focusProxyRef.current?.focus({ preventScroll: true });
    setValueEditor({ id, projectId: project.id, unitsKey });
  }), [project.id, unitsKey]);
  const editorVisible = Boolean(valueEditor && loadValue && valueEditor.id === loadValue.id && valueEditor.projectId === project.id && valueEditor.unitsKey === unitsKey && activeTool === 'select');
  useEffect(() => { if (isLoadTool(activeTool)) setLastLoad(activeTool); }, [activeTool]);

  const closeSheet = () => {
    setMoreOpen(false);
    moreButtonRef.current?.focus({ preventScroll: true });
  };
  useModalFocus({
    open: moreOpen,
    containerRef: sheetRef,
    onEscape: closeSheet,
    // Las acciones que abren otra hoja le ceden el foco. Cerrar/escapar sí lo
    // devuelve a Más, sin que una restauración tardía se lo robe a esa hoja.
    restoreFocus: false,
  });

  const choose = (tool: Tool) => {
    if (moreOpen) closeSheet();
    setActiveTool(tool);
  };

  const deleteSelection = () => {
    if (!selection) return;
    if (selection.kind === 'member') void executeProjectCommand({ kind: 'member.delete', description: `Eliminar miembro ${selection.id}`, memberId: selection.id });
    else if (selection.kind === 'node') void executeProjectCommand({ kind: 'node.delete', description: 'Eliminar nodo', nodeId: selection.id });
    else if (selection.kind === 'multi') void executeProjectCommand({ kind: 'selection.delete', description: 'Eliminar selección', selection });
    else if (selection.kind === 'nodalLoad') updateProject((draft) => ({ ...draft, nodalLoads: draft.nodalLoads.filter((load) => load.id !== selection.id) }));
    else updateProject((draft) => ({ ...draft, memberLoads: draft.memberLoads.filter((load) => load.id !== selection.id) }));
    setSelection(null);
  };

  const toolLabel = (tool: Tool) => {
    const definition = TOOL_REGISTRY.find((item) => item.id === tool);
    return definition ? t(definition.labelKey) : tool;
  };
  const shortLabel = (tool: Tool) => {
    const key = SHORT_LABEL[tool];
    return key ? t(key) : toolLabel(tool);
  };

  const selectedMember = selection?.kind === 'member' ? project.members.find((member) => member.id === selection.id) : undefined;
  const selectionCopy = mobileSelectionLabels(selection, language);
  const structural = selection?.kind === 'node' || selection?.kind === 'member' || selection?.kind === 'multi';
  const placing = activeTool === 'node' || activeTool === 'member';

  // Qué ofrece la cápsula ahora. La herramienta activa manda sobre la
  // selección: al colocar nudos, el nudo recién puesto queda seleccionado y lo
  // que se quiere es seguir colocando.
  let context: ReactNode = null;
  let contextKind = '';
  let contextLabel = '';
  if (activeTool !== 'select') {
    contextKind = isLoadTool(activeTool) ? 'loads' : activeTool;
    contextLabel = t('dock.context', { tool: toolLabel(activeTool) });
    const chainFrom = activeTool === 'member' ? placement.memberStart : null;
    context = <>
      {chainFrom ? <button type="button" className="mdock__chip mdock__chip--chain" data-tone="structure"
        aria-label={t('dock.endChain', { node: chainFrom })} title={t('dock.endChain', { node: chainFrom })}
        onClick={() => emitWorkspaceCommand('end-member-chain')}>
        <ToolIcon tool={activeTool} size={17} />
        <span>{chainFrom} →</span>
        <X size={14} strokeWidth={2.2} aria-hidden="true" />
      </button> : <span className="mdock__chip" data-tone={isLoadTool(activeTool) ? 'load' : 'structure'}>
        <ToolIcon tool={activeTool} size={17} />
        <span>{shortLabel(activeTool)}</span>
      </span>}
      {isLoadTool(activeTool) ? <div className="mdock__segment" role="group" aria-label={t('dock.loadKind')}>
        {LOAD_TOOLS.map((tool) => <DockKey key={tool} className="mdock__key--sm" label={toolLabel(tool)} pressed={activeTool === tool} onClick={() => setActiveTool(tool)} data-tool-id={tool}>
          <ToolIcon tool={tool} size={19} />
        </DockKey>)}
      </div> : null}
      {placing ? <>
        <DockKey className="mdock__key--sm" label={t('dock.keypad')} pressed={placement.coordinateEntryOpen} onClick={() => {
          // Al abrir, el teclado del teléfono sube en este mismo toque.
          if (!placement.coordinateEntryOpen) focusProxyRef.current?.focus({ preventScroll: true });
          emitWorkspaceCommand('toggle-coordinate-entry');
        }}>
          <CoordinateEntryGlyph size={19} />
        </DockKey>
        <DockKey className="mdock__key--sm" label={t('dock.snap')} pressed={view.snap} onClick={() => updateProjectView((draft) => withCanvasViewSettings(draft, { snap: !view.snap }))}>
          <Magnet size={18} strokeWidth={1.9} aria-hidden="true" />
        </DockKey>
      </> : null}
      <span className="mdock__grow" />
      <DockKey className="mdock__key--sm mdock__key--done" label={t('dock.done')} onClick={() => setActiveTool('select')}>
        <Check size={19} strokeWidth={2.2} aria-hidden="true" />
      </DockKey>
    </>;
  } else if (selection) {
    const chip = selectionChip(selection);
    contextKind = 'selection';
    contextLabel = t('dock.selectionContext');
    const units = project.settings.units;
    context = <>
      {loadValue ? <button type="button" className="mdock__chip mdock__chip--value" data-tone="load"
        aria-label={t('dock.loadValue', { load: chip.label })} aria-expanded={editorVisible}
        onClick={() => setValueEditor({ id: loadValue.id, projectId: project.id, unitsKey })}>
        <LoadDirectionGlyph value={loadValue} />
        <span>{formatFixed(toDisplay(loadValue.magnitude, units, loadValue.quantity), 2)}</span>
        <small>{unitLabel(units, loadValue.quantity)}</small>
      </button> : <span className="mdock__chip" data-tone="selection">
        {chip.tool ? <ToolIcon tool={chip.tool} size={17} /> : <Layers3 size={17} strokeWidth={1.9} aria-hidden="true" />}
        <span className="mdock__selection-name"><small>{selectionCopy.kind}</small>{chip.label}</span>
      </span>}
      <DockKey className="mdock__key--sm" label={selectionCopy.editLabel} pressed={inspectorOpen} onClick={onOpenInspector}>
        <SlidersHorizontal size={18} strokeWidth={1.9} aria-hidden="true" />
        <span className="mdock__action-label">{selectionCopy.edit}</span>
      </DockKey>
      {structural ? <DockKey className="mdock__key--sm" label={t('contextualActions.structuralEdit')} onClick={() => emitWorkspaceCommand('open-structural-edit')}>
        <Move size={18} strokeWidth={1.9} aria-hidden="true" />
        <span className="mdock__action-label">{selectionCopy.move}</span>
      </DockKey> : null}
      {selectedMember && !singleWorkTool(project) && (selectedMember.type === 'frame' || selectedMember.type === 'truss') ? <DockKey className="mdock__key--sm" label={t('contextualActions.designMember')} onClick={() => emitWorkspaceCommand('open-member-design', { memberId: selectedMember.id })}>
        <DraftingCompass size={18} strokeWidth={1.9} aria-hidden="true" />
        <span className="mdock__action-label">{selectionCopy.design}</span>
      </DockKey> : null}
      <DockKey className="mdock__key--sm mdock__key--danger" label={t('inspector.deleteSelection')} onClick={deleteSelection}>
        <Trash2 size={18} strokeWidth={1.9} aria-hidden="true" />
        <span className="mdock__action-label">{selectionCopy.remove}</span>
      </DockKey>
      <span className="mdock__grow" />
      <DockKey className="mdock__key--sm" label={t('dock.deselect')} onClick={() => setSelection(null)}>
        <X size={18} strokeWidth={2} aria-hidden="true" />
        <span className="mdock__action-label">{selectionCopy.deselect}</span>
      </DockKey>
    </>;
  }

  if (!context && activeTool === 'select' && (canUndo || canRedo)) {
    contextKind = 'history';
    contextLabel = selectionCopy.history;
    context = <MobileHistoryActions />;
  }

  const editor = editorVisible && selection ? <MobileLoadEditor selection={selection} onClose={() => setValueEditor(null)} /> : null;

  const secondaryTools = SECONDARY_TOOLS.filter((tool) => {
    const definition = TOOL_REGISTRY.find((item) => item.id === tool);
    return definition && !(classroom && definition.classroomAdvanced);
  });
  const moreActive = SECONDARY_TOOLS.includes(activeTool);

  const sheet = moreOpen && typeof document !== 'undefined' ? createPortal(<>
    <button type="button" className="mdock-sheet__scrim" aria-hidden="true" tabIndex={-1} onClick={closeSheet} />
    <div ref={sheetRef} className="mdock-sheet" role="dialog" aria-modal="true" aria-label={t('toolbar.more')} tabIndex={-1}>
      <header className="mdock-sheet__header">
        <strong>{t('toolbar.more')}</strong>
        <button type="button" className="mdock-sheet__close" aria-label={t('toolbar.close')} onClick={closeSheet}><X size={20} aria-hidden="true" /></button>
      </header>
      <div className="mdock-sheet__grid" role="menu" aria-label={t('toolbar.more')}>
        {secondaryTools.map((tool) => <button key={tool} type="button" role="menuitemradio" aria-checked={activeTool === tool}
          className={`mdock-tile${activeTool === tool ? ' is-active' : ''}${tool === 'delete' ? ' is-danger' : ''}`}
          data-tool-id={tool} onClick={() => choose(tool)}>
          <span className="mdock-tile__icon"><ToolIcon tool={tool} size={22} /></span>
          <span>{toolLabel(tool)}</span>
        </button>)}
        <button type="button" role="menuitem" className="mdock-tile" data-structure-generator-command
          onClick={() => { setMoreOpen(false); window.requestAnimationFrame(() => emitWorkspaceCommand('open-structure-generator')); }}>
          <span className="mdock-tile__icon"><Grid3x3 size={22} strokeWidth={1.8} aria-hidden="true" /></span>
          <span>{t('generator.launcher')}</span>
        </button>
        <button type="button" role="menuitem" className={`mdock-tile${inspectorOpen ? ' is-active' : ''}`}
          onClick={() => { setMoreOpen(false); onOpenInspector(); }}>
          <span className="mdock-tile__icon"><PanelRight size={22} strokeWidth={1.8} aria-hidden="true" /></span>
          <span>{t('dock.panel')}</span>
        </button>
        <button type="button" role="menuitem" className="mdock-tile"
          onClick={() => { setMoreOpen(false); emitWorkspaceCommand('open-view-settings'); }}>
          <span className="mdock-tile__icon"><SlidersHorizontal size={22} strokeWidth={1.8} aria-hidden="true" /></span>
          <span>{t('dock.layers')}</span>
        </button>
      </div>
    </div>
  </>, document.body) : null;

  return <>
    <nav className="mdock" aria-label={t('dock.label')} data-context={contextKind || undefined} data-editor={editor ? '' : undefined}>
      {editor ?? (context ? <div key={contextKind} className="mdock__context" role="toolbar" aria-label={contextLabel}>{context}</div> : null)}
      <div className="mdock__bar" role="toolbar" aria-label={t('toolbar.primary')}>
        {PRIMARY_TOOLS.map((tool) => <DockKey key={tool} label={shortLabel(tool)} title={toolLabel(tool)} pressed={activeTool === tool} onClick={() => choose(tool)} data-tool-id={tool}>
          <ToolIcon tool={tool} />
          <span className="mdock__key-label" aria-hidden="true">{shortLabel(tool)}</span>
        </DockKey>)}
        <DockKey label={t('toolbar.loadsShort')} title={t('toolbar.loads')} pressed={isLoadTool(activeTool)} onClick={() => choose(lastLoad)} data-tool-id="loads">
          <ToolIcon tool={isLoadTool(activeTool) ? activeTool : lastLoad} />
          <span className="mdock__key-label" aria-hidden="true">{t('toolbar.loadsShort')}</span>
        </DockKey>
        <span className="mdock__rule" aria-hidden="true" />
        <button ref={moreButtonRef} type="button" className={`mdock__key${moreActive ? ' is-tinted' : ''}`}
          aria-label={t('toolbar.more')} title={t('toolbar.more')} aria-haspopup="dialog" aria-expanded={moreOpen}
          onClick={() => setMoreOpen((open) => !open)}>
          {moreActive ? <ToolIcon tool={activeTool} /> : <Ellipsis size={22} strokeWidth={1.9} aria-hidden="true" />}
          <span className="mdock__key-label" aria-hidden="true">{t('toolbar.moreShort')}</span>
        </button>
      </div>
    </nav>
    <input ref={focusProxyRef} className="mdock__focus-proxy" type="text" inputMode="text" tabIndex={-1} aria-hidden="true"
      onFocus={(event) => {
        // Si nadie toma el foco a tiempo, el teclado no se queda abierto solo.
        const proxy = event.currentTarget; window.setTimeout(() => { if (document.activeElement === proxy) proxy.blur(); }, 400);
      }} />
    {sheet}
  </>;
};
