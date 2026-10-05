import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { concreteFrameGroups, concreteFrameMembers, withConcreteFrame, withConcreteSections, type ConcreteFrameSpec } from '../../../data/concreteFrame';
import type { ModelSection, ModelSectionsBridge } from '../../design/workbench/WorkbenchLayout';
import { startProposalWorker } from '../../design/workbench/proposalWorker';
import { model2dDesignSourceWithWorker } from './model2dDesignWorker';
import { model2dDesignSource } from '../../../design/elements/model2dSource';
import { parseSpace3DDraft } from '../../../modules/space3d/space3d/data/codec';
import { space3dSectionGroups, withSpace3dSections, designSpace3dSectionCandidate } from '../../../integrations/space3dSections';
import { space3dDesignAxes } from '../../../integrations/space3dDesign';
import { structureOptions } from '../../design/workbench/frameModel';
import { space3dDesignAxesWithWorker } from './space3dDesignAll';
import { peekToolIntent, setToolIntent, takeToolIntent } from '../toolIntent';
import { DesignWorkbench } from '../../design/workbench/DesignWorkbench';
import { browserWorkbenchStorage, createProjectWorkbenchStorage, WorkbenchStorageContext } from '../../design/workbench/workbenchStorage';
import { ProjectModelContext } from '../../../store/ProjectModelContext';
import { WorkspaceUIContext } from '../../../store/WorkspaceUIContext';
import { space3dSelection } from './mesaSelection';
import { useSharedToolState } from '../../../store/SharedToolState';

/**
 * Modo Diseño de FStructure: los borradores del taller se guardan en la rama
 * `design` del bundle del proyecto abierto (la misma de siempre, así nada
 * guardado se pierde); sin sesión de proyecto, en el navegador.
 *
 * El taller recibe los modelos del proyecto ya traducidos a su contrato: el
 * Modelo 2D (`model2dDesignSource`) y los ejes del Modelo 3D guardado en la
 * rama `space3d` (puente `src/integrations/space3dDesign`). Al llegar desde el
 * modo 2D o 3D, Estructura diseña con ese modelo. «Editar» vuelve al modo.
 */
export default function DesignSurface({ onOpenModel, onOpenSpace3D }: { onOpenModel?: () => void; onOpenSpace3D?: () => void }) {
  const projectModel = useContext(ProjectModelContext);
  const project = projectModel?.project ?? null;
  const updateProject = projectModel?.updateProject;
  // Un solo cambio del historial: «Deshacer» en Modelo devuelve el modelo anterior.
  const createModel = useCallback((spec: ConcreteFrameSpec) => updateProject?.((current) => withConcreteFrame(current, spec)), [updateProject]);
  const session = useSharedToolState()?.session ?? null;
  const latestProject = useRef(project);
  useEffect(() => { latestProject.current = project; }, [project]);
  const projectId = project?.id ?? null;
  const modelSource = useMemo(() => project ? model2dDesignSourceWithWorker(project) : null, [project]);
  // «Proponer» en Estructura con el Modelo 2D: cada candidato diseña el modelo con
  // esas secciones sin tocarlo; aplicarlas es un solo cambio deshacible del 2D.
  const modelSections = useMemo<ModelSectionsBridge | null>(() => {
    if (!project || !updateProject) return null;
    const { beams, columns } = concreteFrameMembers(project);
    if (!beams.length || !columns.length) return null;
    const mm = (beam: ModelSection, column: ModelSection) => ({
      beam: { widthMm: beam.width * 10, heightMm: beam.height * 10 }, column: { widthMm: column.width * 10, heightMm: column.height * 10 },
    });
    const sum = (items: readonly { lengthM: number }[]) => items.reduce((total, item) => total + item.lengthM, 0);
    return {
      groups: concreteFrameGroups(project),
      propose: (code, draft, onStep) => startProposalWorker(new URL('./modelSectionProposal.worker.ts', import.meta.url), { kind: 'model2d', model: project, code, draft }, onStep),
      beams: beams.length,
      columns: columns.length,
      beamLengthM: sum(beams),
      columnLengthM: sum(columns),
      volumeM3: [...beams, ...columns].reduce((total, item) => total + item.lengthM * item.areaM2, 0),
      variant: (beam, column, groups) => model2dDesignSource(withConcreteSections(project, mm(beam, column), groups)),
      apply: (beam, column, groups) => updateProject((current) => withConcreteSections(current, mm(beam, column), groups)),
    };
  }, [project, updateProject]);
  // El modelo 3D se lee al entrar al modo (se edita en el modo 3D, que guarda en la sesión).
  const space3d = useMemo(() => {
    const branch = session && projectId ? session.currentBundle(projectId)?.space3d : null;
    if (!branch) return null;
    try { return parseSpace3DDraft(JSON.stringify(branch.model)); } catch { return null; }
  }, [session, projectId]);
  // «Revisar todos los ejes» diseña en un worker; la mesa sigue fluida.
  const modelAxes = useMemo(() => space3d && space3d.members.length ? space3dDesignAxesWithWorker(space3d) : null, [space3d]);
  const space3dSections = useMemo<ModelSectionsBridge | null>(() => {
    if (!space3d || !onOpenSpace3D) return null;
    const groups = space3dSectionGroups(space3d);
    const beamGroups = groups.filter((g) => g.kind === 'beam'), columnGroups = groups.filter((g) => g.kind === 'column');
    if (!beamGroups.length || !columnGroups.length) return null;
    const eligible = new Set(groups.flatMap((g) => g.memberIds));
    const nodes = new Map(space3d.nodes.map((n) => [n.id, n]));
    const mm = (s: ModelSection) => ({ widthMm: s.width * 10, heightMm: s.height * 10 });
    const candidate = (beam: ModelSection, column: ModelSection, assigned?: Parameters<typeof withSpace3dSections>[2]) => withSpace3dSections(space3d, { beam: mm(beam), column: mm(column) }, assigned);
    return {
      propose: (code, draft, onStep) => startProposalWorker(new URL('./modelSectionProposal.worker.ts', import.meta.url), { kind: 'model3d', model: space3d, code, draft }, onStep),
      groups, beams: beamGroups.reduce((s, g) => s + g.memberIds.length, 0), columns: columnGroups.reduce((s, g) => s + g.memberIds.length, 0),
      beamLengthM: beamGroups.reduce((s, g) => s + g.lengthM, 0), columnLengthM: columnGroups.reduce((s, g) => s + g.lengthM, 0),
      volumeM3: space3d.members.reduce((s, m) => { const a = nodes.get(m.i)!, b = nodes.get(m.j)!; return s + (eligible.has(m.id) ? m.A * Math.hypot(a.x-b.x, a.y-b.y, a.z-b.z) : 0); }, 0),
      variant: (beam, column, assigned) => { const axes = space3dDesignAxes(candidate(beam, column, assigned)); return axes.source(axes.axes[0]!.id)!; },
      evaluate: (code, draft, beam, column, assigned) => {
        const result = designSpace3dSectionCandidate(candidate(beam, column, assigned), structureOptions(code, draft), draft.braced === 'yes');
        return result.ok ? { ok: true, result, frame: null } : result;
      },
      apply: (beam, column, assigned) => {
        setToolIntent({ tool: 'space3d', kind: 'view', view: '3d', sections: { beam, column, ...(assigned ? { groups: assigned } : {}), sourceModel: JSON.stringify(space3d) } });
        onOpenSpace3D();
      },
    };
  }, [space3d, onOpenSpace3D]);
  const [intent] = useState(() => peekToolIntent('design'));
  const startSource = intent?.kind;
  const ui = useContext(WorkspaceUIContext);
  // La barra que se abre: la pedida desde el Inspector («Diseñar en concreto»)
  // o la que estaba seleccionada en el modo del que se llega.
  const [focus] = useState(() => {
    if (intent?.member) return { memberId: intent.member, explicit: true };
    const selection = ui?.selection;
    const memberId = intent?.kind === 'model'
      ? selection?.kind === 'member' ? selection.id : selection?.kind === 'multi' ? selection.memberIds[0] : undefined
      : intent?.kind === 'model3d' && projectId ? space3dSelection(projectId)[0] : undefined;
    return memberId ? { memberId, explicit: false } : null;
  });
  // «Editar en 3D» desde un eje abre el modo 3D en el alzado de ese eje.
  const openSpace3D = useMemo(() => onOpenSpace3D ? (axisId?: string) => {
    const axis = axisId ? modelAxes?.axes.find((item) => item.id === axisId) : undefined;
    if (axis?.short) setToolIntent({ tool: 'space3d', kind: 'view', view: `elev-${axis.direction}:${axis.short}` });
    onOpenSpace3D();
  } : undefined, [onOpenSpace3D, modelAxes]);
  useEffect(() => { takeToolIntent('design'); }, []);
  // «Ver en el Modelo» / «Ver en 3D»: las barras de un elemento quedan seleccionadas al volver.
  const setSelection = ui?.setSelection;
  const showMembers = useMemo(() => (memberIds: readonly string[], axisId?: string) => {
    if (!memberIds.length) return;
    if (axisId !== undefined) {
      if (!onOpenSpace3D) return;
      const axis = modelAxes?.axes.find((item) => item.id === axisId);
      setToolIntent({ tool: 'space3d', kind: 'view', view: axis?.short ? `elev-${axis.direction}:${axis.short}` : '3d', members: memberIds });
      onOpenSpace3D();
      return;
    }
    if (!onOpenModel || !setSelection) return;
    setSelection(memberIds.length === 1 ? { kind: 'member', id: memberIds[0]! } : { kind: 'multi', nodeIds: [], memberIds: [...memberIds] });
    onOpenModel();
  }, [modelAxes, onOpenModel, onOpenSpace3D, setSelection]);
  const storage = useMemo(() => {
    if (!session || !projectId) return null;
    return createProjectWorkbenchStorage(session.currentBundle(projectId)?.design, (document) => {
      const current = latestProject.current;
      // El estado de guardado del proyecto (barra de estado) informa cualquier fallo.
      if (current) void session.saveDesign(current, document).catch(() => undefined);
    });
  }, [session, projectId]);
  useEffect(() => () => storage?.dispose(), [storage]);
  return <WorkbenchStorageContext.Provider value={storage ?? browserWorkbenchStorage}>
    <DesignWorkbench key={projectId ?? 'local'} projectName={project?.name} modelSource={modelSource} modelAxes={modelAxes}
      {...(startSource ? { startSource } : {})} {...(onOpenModel ? { onOpenModel } : {})} {...(openSpace3D ? { onOpenSpace3D: openSpace3D } : {})}
      {...(focus ? { focusMember: focus.memberId, ...(focus.explicit ? { startElement: 'frame' as const } : {}) } : {})} onShowMembers={showMembers} modelSections={modelSections} space3dSections={space3dSections}
      {...(updateProject ? { onCreateModel: createModel } : {})} />
  </WorkbenchStorageContext.Provider>;
}
