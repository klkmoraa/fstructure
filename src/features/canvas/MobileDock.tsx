import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
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
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../../i18n/useI18n';
import type { TranslationKey } from '../../i18n/catalogs';
import { useProject } from '../../store/ProjectContext';
import type { Selection, Tool } from '../../types';
import { CoordinateEntryGlyph } from '../../design-system/icons/structural';
import { readCanvasViewSettings, withCanvasViewSettings } from '../view/canvasViewSettings';
import { emitWorkspaceCommand, onWorkspaceCommand } from '../workspace/workspaceCommands';
import { StructuralToolIcon } from './StructuralToolIcon';
import { TOOL_REGISTRY } from './toolRegistry';
import { readLoadQuickValue, withLoadDirection, withLoadFlipped, withLoadMagnitude, type LoadQuickValue } from './loadQuickValue';
import { parseLocalizedDecimal } from './quickEntry';
import { fromDisplay, toDisplay } from '../../foundation/units';
import { unitLabel } from '../../engine/units';
import { formatFixed } from '../../utils/numberFormat';
import './mobileDock.css';

type LoadTool = Extract<Tool, 'pointLoad' | 'distributedLoad' | 'moment'>;
const LOAD_TOOLS: readonly LoadTool[] = ['pointLoad', 'distributedLoad', 'moment'];
const isLoadTool = (tool: Tool): tool is LoadTool => (LOAD_TOOLS as readonly Tool[]).includes(tool);

/** Las cuatro teclas de modelado del dock; Carga y Más se añaden aparte. */
const PRIMARY_TOOLS: readonly Tool[] = ['select', 'node', 'member', 'support'];
/** Lo que vive en la hoja «Más»: herramientas de uso ocasional. */
const SECONDARY_TOOLS: readonly Tool[] = ['pan', 'cut', 'split', 'delete'];

const SHORT_LABEL: Partial<Record<Tool, TranslationKey>> = {
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

const DockKey = ({ label, pressed, onClick, children, className = '', ...rest }: {
  label: string;
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
  title={label}
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
  const { t } = useI18n();
  const { project, activeTool, setActiveTool, selection, setSelection, executeProjectCommand, updateProject, updateProjectView } = useProject();
  const [lastLoad, setLastLoad] = useState<LoadTool>('pointLoad');
  const [moreOpen, setMoreOpen] = useState(false);
  const [placement, setPlacement] = useState<{ memberStart: string | null; coordinateEntryOpen: boolean }>({ memberStart: null, coordinateEntryOpen: false });
  const [valueEditor, setValueEditor] = useState<{ id: string; draft: string } | null>(null);
  const valueInputRef = useRef<HTMLInputElement>(null);
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
  // El editor pertenece a una carga: si la selección cambia, se cierra.
  useEffect(() => {
    setValueEditor((current) => current && current.id === loadValueId ? current : null);
  }, [loadValueId]);
  useEffect(() => onWorkspaceCommand('edit-load-value', ({ id }) => {
    focusProxyRef.current?.focus({ preventScroll: true });
    setValueEditor({ id, draft: '' });
  }), []);
  const editorVisible = Boolean(valueEditor && loadValue && valueEditor.id === loadValue.id);
  useLayoutEffect(() => {
    if (editorVisible) valueInputRef.current?.focus({ preventScroll: true });
  }, [editorVisible]);
  useEffect(() => { if (isLoadTool(activeTool)) setLastLoad(activeTool); }, [activeTool]);

  useEffect(() => {
    if (!moreOpen) return undefined;
    const frame = window.requestAnimationFrame(() => sheetRef.current?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true }));
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setMoreOpen(false);
      moreButtonRef.current?.focus({ preventScroll: true });
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [moreOpen]);

  const choose = (tool: Tool) => {
    setMoreOpen(false);
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
        onClick={() => setValueEditor({ id: loadValue.id, draft: '' })}>
        <LoadDirectionGlyph value={loadValue} />
        <span>{formatFixed(toDisplay(loadValue.magnitude, units, loadValue.quantity), 2)}</span>
        <small>{unitLabel(units, loadValue.quantity)}</small>
      </button> : <span className="mdock__chip" data-tone="selection">
        {chip.tool ? <ToolIcon tool={chip.tool} size={17} /> : <Layers3 size={17} strokeWidth={1.9} aria-hidden="true" />}
        <span>{chip.label}</span>
      </span>}
      <DockKey className="mdock__key--sm" label={t('dock.properties')} pressed={inspectorOpen} onClick={onOpenInspector}>
        <SlidersHorizontal size={18} strokeWidth={1.9} aria-hidden="true" />
      </DockKey>
      {structural ? <DockKey className="mdock__key--sm" label={t('contextualActions.structuralEdit')} onClick={() => emitWorkspaceCommand('open-structural-edit')}>
        <Move size={18} strokeWidth={1.9} aria-hidden="true" />
      </DockKey> : null}
      {selectedMember && (selectedMember.type === 'frame' || selectedMember.type === 'truss') ? <DockKey className="mdock__key--sm" label={t('contextualActions.designMember')} onClick={() => emitWorkspaceCommand('open-member-design', { memberId: selectedMember.id })}>
        <DraftingCompass size={18} strokeWidth={1.9} aria-hidden="true" />
      </DockKey> : null}
      <DockKey className="mdock__key--sm mdock__key--danger" label={t('inspector.deleteSelection')} onClick={deleteSelection}>
        <Trash2 size={18} strokeWidth={1.9} aria-hidden="true" />
      </DockKey>
      <span className="mdock__grow" />
      <DockKey className="mdock__key--sm" label={t('dock.deselect')} onClick={() => setSelection(null)}>
        <X size={18} strokeWidth={2} aria-hidden="true" />
      </DockKey>
    </>;
  }

  const applyLoadValue = (draft: string) => {
    const unit = loadValue ? unitLabel(project.settings.units, loadValue.quantity) : undefined;
    const typed = parseLocalizedDecimal(draft, unit);
    if (typed !== null && loadValue && selection) {
      const magnitude = fromDisplay(Math.abs(typed), project.settings.units, loadValue.quantity);
      updateProject((next) => withLoadMagnitude(next, selection, magnitude));
    }
    setValueEditor(null);
  };
  // El dock se convierte en el campo del valor, con el teclado del teléfono:
  // ↵ (o ✓) aplica, la flecha invierte el sentido y × lo deja como estaba.
  const editor = editorVisible && valueEditor && loadValue && selection ? <form
    className="mdock__editor"
    aria-label={t('dock.loadValue', { load: loadValue.id })}
    onSubmit={(event) => { event.preventDefault(); applyLoadValue(valueEditor.draft); }}
  >
    {loadValue.quantity === 'moment' ? <button type="button" className="mdock__key mdock__key--sm mdock__key--flip" aria-label={t('dock.flip')} title={t('dock.flip')}
      onPointerDown={(event) => event.preventDefault()}
      onClick={() => updateProject((next) => withLoadFlipped(next, selection))}>
      <LoadDirectionGlyph value={loadValue} size={20} />
    </button> : <div className="mdock__dirs" role="group" aria-label={t('dock.direction')}>
      {([['down', -90, ArrowDown], ['right', 0, ArrowRight], ['up', 90, ArrowUp], ['left', 180, ArrowLeft]] as const).map(([id, angle, Icon]) => {
        const active = Math.abs(((loadValue.direction - angle + 540) % 360) - 180) < 1;
        return <button key={id} type="button" className="mdock__key mdock__key--sm mdock__key--dir" aria-pressed={active}
          aria-label={t(`dock.dir.${id}`)} title={t(`dock.dir.${id}`)}
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => updateProject((next) => withLoadDirection(next, selection, angle))}>
          <Icon size={18} strokeWidth={2.2} aria-hidden="true" />
        </button>;
      })}
    </div>}
    <label className="mdock__editor-field">
      <input
        ref={valueInputRef}
        type="text"
        inputMode="text"
        enterKeyHint="done"
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        aria-label={t('dock.loadValue', { load: loadValue.id })}
        placeholder={formatFixed(toDisplay(loadValue.magnitude, project.settings.units, loadValue.quantity), 2)}
        value={valueEditor.draft}
        onChange={(event) => setValueEditor({ ...valueEditor, draft: event.target.value })}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return;
          event.preventDefault();
          event.stopPropagation();
          setValueEditor(null);
        }}
      />
      <small>{unitLabel(project.settings.units, loadValue.quantity)}</small>
    </label>
    <button type="submit" className="mdock__key mdock__key--sm mdock__key--apply" aria-label={t('dock.apply')} title={t('dock.apply')}>
      <Check size={19} strokeWidth={2.2} aria-hidden="true" />
    </button>
    <button type="button" className="mdock__key mdock__key--sm" aria-label={t('toolbar.close')} onClick={() => setValueEditor(null)}>
      <X size={18} strokeWidth={2} aria-hidden="true" />
    </button>
  </form> : null;

  const secondaryTools = SECONDARY_TOOLS.filter((tool) => {
    const definition = TOOL_REGISTRY.find((item) => item.id === tool);
    return definition && !(classroom && definition.classroomAdvanced);
  });
  const moreActive = SECONDARY_TOOLS.includes(activeTool);

  const sheet = moreOpen && typeof document !== 'undefined' ? createPortal(<>
    <button type="button" className="mdock-sheet__scrim" aria-hidden="true" tabIndex={-1} onPointerDown={() => setMoreOpen(false)} />
    <div ref={sheetRef} className="mdock-sheet" role="dialog" aria-modal="true" aria-label={t('toolbar.more')}>
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
        {PRIMARY_TOOLS.map((tool) => <DockKey key={tool} label={toolLabel(tool)} pressed={activeTool === tool} onClick={() => choose(tool)} data-tool-id={tool}>
          <ToolIcon tool={tool} />
        </DockKey>)}
        <DockKey label={t('toolbar.loads')} pressed={isLoadTool(activeTool)} onClick={() => choose(lastLoad)} data-tool-id="loads">
          <ToolIcon tool={isLoadTool(activeTool) ? activeTool : lastLoad} />
        </DockKey>
        <span className="mdock__rule" aria-hidden="true" />
        <button ref={moreButtonRef} type="button" className={`mdock__key${moreActive ? ' is-tinted' : ''}`}
          aria-label={t('toolbar.more')} title={t('toolbar.more')} aria-haspopup="dialog" aria-expanded={moreOpen}
          onClick={() => setMoreOpen((open) => !open)}>
          {moreActive ? <ToolIcon tool={activeTool} /> : <Ellipsis size={22} strokeWidth={1.9} aria-hidden="true" />}
        </button>
      </div>
    </nav>
    <input ref={focusProxyRef} className="mdock__focus-proxy" type="text" inputMode="text" tabIndex={-1} aria-hidden="true"
      onFocus={(event) => {
        // Si nadie toma el foco a tiempo, el teclado no se queda abierto solo.
        const proxy = event.currentTarget;
        window.setTimeout(() => { if (document.activeElement === proxy) proxy.blur(); }, 400);
      }} />
    {sheet}
  </>;
};
