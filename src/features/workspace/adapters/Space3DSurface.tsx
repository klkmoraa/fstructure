import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine } from 'lucide-react';
import { useProjectModel } from '../../../store/ProjectModelContext';
import Space3DWorkspace, { type Space3DCameraState, type Space3DIncomingProject } from '../../../modules/space3d/features/space3d/Space3DWorkspace';
import { useSharedToolState } from '../../../store/SharedToolState';
import { parseSpace3DDraft } from '../../../modules/space3d/space3d/data/codec';
import type { Space3DProjectV1 } from '../../../modules/space3d/space3d/model/types';
import { createBlankSpace3DProject } from '../../../modules/space3d/space3d/model/defaultProject';
import { Dialog } from '../../../design-system/components/overlays';
import { LayerToggle, UnitField } from '../../../design-system/components/editor';
import { withSpace3dSections } from '../../../integrations/space3dSections';
import { MAX_EXTRUDED_FRAMES, space3dFromModel2d } from '../../../integrations/model2dSpace3d';
import { ShellContribution, ShellStatusChip } from '../ShellToolSlots';
import { linkSpace3DToShell } from './space3dShellBridge';
import './space3dBring.css';
import '../mesaJourney.css';
import type { Space3DHistory } from '../../../modules/space3d/space3d/store/Space3DProjectContext';
import { peekToolIntent, takeToolIntent } from '../toolIntent';
import { rememberSpace3DSelection } from './mesaSelection';
import type { ProjectModel } from '../../../types';
import type { UnifiedProjectSession } from '../../../storage/unifiedProjectSession';

// Embedded legacy provider receives a non-persistent storage boundary. The session owns writes.
const embeddedStorage = { getItem: () => null, setItem: () => undefined, removeItem: () => undefined };

/** Vista del 3D de cada proyecto mientras dura la sesión: al volver al modo 3D se abre la misma. */
const HISTORY_MEMORY = new WeakMap<UnifiedProjectSession, Map<string, Space3DHistory>>();

const VIEW_MEMORY = new Map<string, string>();
/** Y la cámara que tenía esa vista al salir (órbita, desplazamiento y zoom). */
const CAMERA_MEMORY = new Map<string, { viewId: string; camera: Space3DCameraState }>();

/**
 * Modo 3D de la mesa de FStructure.
 *
 * El modelo espacial es su propio documento dentro del proyecto: se guarda en
 * la rama `space3d` y, si no existe, el modo abre vacío con su arranque. No se
 * deriva solo del Modelo 2D; traerlo es una acción explícita («Traer del 2D»,
 * por el puente `src/integrations/model2dSpace3d`) que reemplaza el modelo 3D
 * con confirmación y se deshace con Deshacer.
 */
export default function Space3DSurface({ onOpenDesign }: { onOpenDesign?: () => void }) {
  const { project } = useProjectModel();
  const session = useSharedToolState()?.session;
  return <ProjectSpace3D key={project.id} project={project} session={session} onOpenDesign={onOpenDesign} />;
}

function ProjectSpace3D({ project, session, onOpenDesign }: { project: ProjectModel; session?: UnifiedProjectSession | null; onOpenDesign?: () => void }) {
  const retainedHistory = session ? HISTORY_MEMORY.get(session)?.get(project.id) : undefined;
  const rememberHistory = useCallback((history: Space3DHistory) => {
    if (!session) return;
    let projects = HISTORY_MEMORY.get(session);
    if (!projects) { projects = new Map(); HISTORY_MEMORY.set(session, projects); }
    projects.set(project.id, history);
  }, [session, project.id]);
  const [failure, setFailure] = useState<string | null>(null);
  const [sectionFailure, setSectionFailure] = useState<string | null>(null);
  // Se lee sin consumir durante el render (StrictMode lo repite) y se consume al montar.
  const [intent] = useState(() => peekToolIntent('space3d'));
  const startIntent = intent && intent.kind !== 'view' && intent.kind !== 'bring-2d' ? intent.kind : undefined;
  const [startView] = useState(() => intent?.kind === 'view' ? intent.view : VIEW_MEMORY.get(project.id));
  const rememberView = useCallback((viewId: string) => { VIEW_MEMORY.set(project.id, viewId); }, [project.id]);
  const [startCamera] = useState(() => {
    const saved = CAMERA_MEMORY.get(project.id);
    return saved && saved.viewId === startView ? saved.camera : null;
  });
  const rememberCamera = useCallback((viewId: string, camera: Space3DCameraState) => { CAMERA_MEMORY.set(project.id, { viewId, camera }); }, [project.id]);
  const [startSelection] = useState(() => intent?.kind === 'view' ? intent.members : undefined);
  const rememberSelection = useCallback((memberIds: readonly string[]) => rememberSpace3DSelection(project.id, memberIds), [project.id]);
  useEffect(() => { takeToolIntent('space3d'); }, []);
  const [branch] = useState(() => session?.currentBundle(project.id)?.space3d ?? null);
  const [sourceVersion] = useState(() => branch?.sourceVersion ?? crypto.randomUUID());
  const canonicalProject = useMemo(() => branch ? parseSpace3DDraft(JSON.stringify(branch.model)) : createBlankSpace3DProject(), [branch]);
  const save = useCallback((model: Space3DProjectV1) => {
    if (!session) { setFailure('Almacenamiento no disponible; los cambios 3D viven sólo en memoria.'); return; }
    // The session publishes failures to the persistent shell, even after this adapter unmounts.
    void session.saveSpace3D(project, linkSpace3DToShell(project.id, sourceVersion, model)).catch(() => undefined);
  }, [session, project, sourceVersion]);
  const [bringOpen, setBringOpen] = useState(() => intent?.kind === 'bring-2d');
  const [incoming, setIncoming] = useState<Space3DIncomingProject | null>(null);
  useEffect(() => {
    if (intent?.kind !== 'view' || !intent.sections) return;
    const sections = intent.sections;
    if (JSON.stringify(canonicalProject) !== sections.sourceModel) {
      setSectionFailure('El modelo 3D cambió después de calcular la propuesta. Vuelve a Diseño para recalcularla.'); return;
    }
    const mm = (section: { width: number; height: number }) => ({ widthMm: section.width * 10, heightMm: section.height * 10 });
    setIncoming({ project: withSpace3dSections(canonicalProject, { beam: mm(sections.beam), column: mm(sections.column) }, sections.groups),
      nonce: 0, operation: 'sections', title: '', description: '' });
  }, [intent, canonicalProject]);
  const es = project.settings.language !== 'en';
  return <>
    {sectionFailure ? <ShellContribution slot="status"><ShellStatusChip tone="warn" label="Propuesta caducada" detail={sectionFailure} /></ShellContribution> : null}
    {failure ? <ShellContribution slot="status"><ShellStatusChip tone="warn" label="Sólo en memoria" detail={failure} /></ShellContribution> : null}
    <ShellContribution slot="controls">
      <button type="button" className="workspace-topbar__action-button" onClick={() => setBringOpen(true)}
        aria-label={es ? 'Traer el Modelo 2D al 3D' : 'Bring the 2D model into 3D'} title={es ? 'Extruir el pórtico del Modelo 2D en pórticos paralelos' : 'Extrude the 2D frame into parallel frames'}>
        <ArrowDownToLine size={17} aria-hidden="true" /><span>{es ? 'Traer del 2D' : 'From 2D'}</span>
      </button>
    </ShellContribution>
    {bringOpen ? <BringFrom2D project={project} es={es} onClose={() => setBringOpen(false)} onBring={(model) => {
      setBringOpen(false);
      setIncoming({
        project: model,
        nonce: Date.now(),
        title: es ? '¿Reemplazar por el pórtico del 2D?' : 'Replace with the 2D frame?',
        description: es
          ? 'El modelo 3D actual se reemplaza por el Modelo 2D extruido. Podrás deshacerlo con Deshacer; el Modelo 2D no cambia.'
          : 'The current 3D model is replaced by the extruded 2D model. You can undo it; the 2D model does not change.',
      });
    }} /> : null}
    <Space3DWorkspace language={project.settings.language} embedded storage={embeddedStorage}
      canonicalProject={canonicalProject} retainedHistory={retainedHistory} onHistoryChange={rememberHistory} onOpenDesign={onOpenDesign} onProjectChange={save} startIntent={startIntent} incomingProject={incoming}
      {...(startView ? { startView } : {})} onViewChange={rememberView} startCamera={startCamera} onCameraRelease={rememberCamera}
      {...(startSelection ? { startSelection } : {})} onSelectionChange={rememberSelection} />
  </>;
}

/** Cuántos pórticos y a qué separación: la vista previa dice qué se trae y qué no. */
function BringFrom2D({ project, es, onClose, onBring }: { project: ProjectModel; es: boolean; onClose: () => void; onBring: (model: Space3DProjectV1) => void }) {
  const [frames, setFrames] = useState('3');
  const [spacing, setSpacing] = useState('5');
  const [diaphragms, setDiaphragms] = useState(true);
  const count = Number(frames);
  const spacingM = Number(spacing.replace(',', '.'));
  const preview = useMemo(() => space3dFromModel2d(project, { frames: count, spacingM, diaphragms }), [project, count, spacingM, diaphragms]);
  const model = preview.model;
  const transverse = model ? model.members.length - project.members.length * Math.max(1, Math.round(count)) : 0;
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}
    title={es ? 'Traer del 2D' : 'Bring from 2D'}
    description={es
      ? `El pórtico de «${project.name}» se repite en pórticos paralelos unidos por vigas transversales. Copia secciones, apoyos, casos y cargas.`
      : `The frame of “${project.name}” is repeated in parallel frames joined by transverse beams. Sections, supports, cases and loads are copied.`}
    footer={<>
      <button type="button" className="space3d-button" onClick={onClose}>{es ? 'Cancelar' : 'Cancel'}</button>
      <button type="button" className="space3d-button space3d-button--primary" disabled={!model} onClick={() => { if (model) onBring(model); }}>
        {es ? 'Traer al 3D' : 'Bring to 3D'}
      </button>
    </>}>
    <div className="space3d-bring">
      <div className="space3d-bring__fields">
        <UnitField label={es ? 'Pórticos' : 'Frames'} unit="" value={frames} onValueChange={setFrames} inputMode="numeric"
          hint={`1–${MAX_EXTRUDED_FRAMES}`} />
        <UnitField label={es ? 'Separación' : 'Spacing'} unit="m" value={spacing} onValueChange={setSpacing} disabled={count === 1}
          hint={es ? 'Entre pórticos, a lo largo de z' : 'Between frames, along z'} />
      </div>
      <LayerToggle label={es ? 'Diafragma rígido en cada nivel' : 'Rigid diaphragm at each level'} disabled={count === 1} checked={diaphragms && count !== 1}
        description={es ? 'La losa une los pórticos en su plano (ux, uz y giro vertical)' : 'The slab ties the frames in its plane'} onCheckedChange={setDiaphragms} />
      {model
        ? <p className="space3d-bring__summary" role="status">{es
          ? `${model.nodes.length} nudos · ${model.members.length} barras${transverse > 0 ? ` (${transverse} transversales)` : ''} · ${model.loadCases.length} casos`
          : `${model.nodes.length} nodes · ${model.members.length} members${transverse > 0 ? ` (${transverse} transverse)` : ''} · ${model.loadCases.length} cases`}</p>
        : <p className="space3d-notice space3d-notice--error" role="alert">{preview.errors.join(' ')}</p>}
      {model && preview.notes.length ? <ul className="space3d-bring__notes">{preview.notes.map((note) => <li key={note}>{note}</li>)}</ul> : null}
    </div>
  </Dialog>;
}
