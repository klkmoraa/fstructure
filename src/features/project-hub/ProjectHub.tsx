import { useCallback, useEffect, useRef, useState } from 'react';
import { Copy, FolderOpen, MoreHorizontal, Pencil, RotateCcw, ShieldAlert, Trash2 } from 'lucide-react';
import { usePhase2I18n } from '../../i18n/usePhase2I18n';
import { useI18n } from '../../i18n/useI18n';
import { useWorkspaceUI } from '../../store/ProjectContext';
import type { ProjectModel } from '../../types';
import {
  getProjectRepository,
  PROJECT_LIBRARY_CHANGE_KEY,
  type ProjectRepository,
  type RecoveryRecord,
  type StoredProjectRecord,
} from '../../storage/projectRepository';
import { ThreeStructuralImage } from '../structural-assets';
import type { ThreeStructuralAssetId } from '../structural-assets/threeStructuralRender';
import { recordLocalMetric } from '../../analytics/localMetrics';
import { ProjectVersions } from './ProjectVersions';
import './projectHub.css';

/**
 * Última edición del registro. Sale de `StoredProjectRecord.updatedAt`, que el
 * repositorio ya escribe — no es un dato nuevo ni inventado. Ante una fecha
 * ilegible devuelve cadena vacía y la celda queda muda, que es preferible a
 * enseñar «Invalid Date» junto a un proyecto real.
 */
const formatUpdated = (iso: string, language: 'es' | 'en') => {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  return new Intl.DateTimeFormat(language === 'es' ? 'es' : 'en', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  }).format(at);
};

const projectAssetId = (project: ProjectModel): ThreeStructuralAssetId => {
  const members = project.members;
  if (members.length === 0) return 'portal:single-bay';
  const nodes = new Map(project.nodes.map((node) => [node.id, node] as const));
  if (members.some((member) => member.type === 'truss')) {
    const trusses = ['truss:pratt', 'truss:howe', 'truss:warren', 'truss:king-post'] as const;
    return trusses[members.length % trusses.length];
  }

  const coordinates = members.flatMap((member) => {
    const start = nodes.get(member.i);
    const end = nodes.get(member.j);
    return start && end ? [{ start, end }] : [];
  });
  const xs = project.nodes.map((node) => node.x);
  const ys = project.nodes.map((node) => node.y);
  const width = Math.max(...xs, 1) - Math.min(...xs, 0);
  const height = Math.max(...ys, 1) - Math.min(...ys, 0);
  const vertical = coordinates.filter(({ start, end }) => Math.abs(start.x - end.x) <= Math.max(width, 1) * 0.04).length;
  const horizontal = coordinates.filter(({ start, end }) => Math.abs(start.y - end.y) <= Math.max(height, 1) * 0.04).length;

  if (members.length === 1) {
    const member = members[0];
    const start = nodes.get(member.i);
    const end = nodes.get(member.j);
    const supports = [start?.support.type, end?.support.type].filter((support) => support && support !== 'none');
    if (supports.includes('fixed') && supports.length === 1) return 'cantilever:wall';
    if (supports.length >= 2) return 'beam:simply-supported';
    return 'cantilever:wall';
  }

  if (horizontal === members.length) {
    if (members.length === 2) return 'beam:two-span';
    if (members.length >= 3) return 'beam:three-span';
    return 'beam:overhang';
  }

  const levels = new Set(project.nodes.map((node) => Math.round(node.y * 10_000))).size;
  if (levels >= 3) return 'portal:two-story';
  if (vertical >= 3 || horizontal >= 2) return 'portal:two-bay';
  const elevatedNodes = project.nodes.filter((node) => node.y > Math.min(...ys));
  if (elevatedNodes.length > 1 && new Set(elevatedNodes.map((node) => Math.round(node.y * 10_000))).size > 1) return 'portal:industrial-pitched';
  return 'portal:single-bay';
};

const projectLoadCount = (project: ProjectModel) =>
  project.nodalLoads.length + project.memberLoads.length + (project.prescribedDisplacements?.length ?? 0) + (project.memberInitialEffects?.length ?? 0);

const projectEntityCount = (project: ProjectModel) => project.nodes.length + project.members.length + projectLoadCount(project);

const recoveryDifference = (saved: ProjectModel | undefined, recovered: ProjectModel) => ({
  members: recovered.members.length - (saved?.members.length ?? 0),
  nodes: recovered.nodes.length - (saved?.nodes.length ?? 0),
  loads: projectLoadCount(recovered) - (saved ? projectLoadCount(saved) : 0),
});

const recoveryAgeMinutes = (createdAt: string) => Math.max(0, Math.round((Date.now() - new Date(createdAt).getTime()) / 60_000));

export const ProjectHub = ({
  repository,
  onOpen,
  limit,
  filter = '',
  variant = 'full',
}: {
  repository?: ProjectRepository;
  onOpen: (record: StoredProjectRecord) => void;
  limit?: number;
  filter?: string;
  variant?: 'full' | 'recent';
}) => {
  const { language } = useI18n();
  const { t } = usePhase2I18n(language);
  const { theme } = useWorkspaceUI();
  const activeRepository = repository ?? (typeof indexedDB === 'undefined' ? null : getProjectRepository());
  const [projects, setProjects] = useState<StoredProjectRecord[]>([]);
  const [recoveries, setRecoveries] = useState<RecoveryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const observedRecoveries = useRef(new Set<string>());

  const refresh = useCallback(async () => {
    setLoading(true);
    if (!activeRepository) {
      setProjects([]);
      setRecoveries([]);
      setError(t('hub.unavailable'));
      setLoading(false);
      return;
    }
    try {
      const snapshot = await activeRepository.listLibrary();
      setProjects(snapshot.projects);
      setRecoveries(snapshot.recoveries.filter((recovery) => recovery.reason !== 'version'));
      setError(null);
    } catch {
      setError(t('hub.unavailable'));
    } finally {
      setLoading(false);
    }
  }, [activeRepository, t]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    const onLibraryChange = (event: StorageEvent) => {
      if (event.key === PROJECT_LIBRARY_CHANGE_KEY) void refresh();
    };
    window.addEventListener('storage', onLibraryChange);
    return () => window.removeEventListener('storage', onLibraryChange);
  }, [refresh]);

  useEffect(() => {
    for (const recovery of recoveries) {
      if (observedRecoveries.current.has(recovery.id)) continue;
      observedRecoveries.current.add(recovery.id);
      recordLocalMetric(window.localStorage, { name: 'recovery_opened', code: recovery.reason });
      if (recovery.reason === 'conflict') recordLocalMetric(window.localStorage, { name: 'conflict_detected', code: 'library' });
    }
  }, [recoveries]);

  const duplicate = async (record: StoredProjectRecord) => {
    if (!activeRepository) return;
    try {
      await activeRepository.duplicateProject(record.id, t('hub.copyName', { name: record.name }));
      await refresh();
    } catch {
      setError(t('hub.unavailable'));
    }
  };

  const commitRename = async () => {
    if (!editing?.name.trim() || !activeRepository) return;
    try {
      await activeRepository.renameProject(editing.id, editing.name.trim());
      setEditing(null);
      await refresh();
    } catch {
      setError(t('hub.unavailable'));
    }
  };

  const remove = async (record: StoredProjectRecord) => {
    if (!activeRepository || !window.confirm(t('hub.deleteConfirm', { name: record.name }))) return;
    try {
      await activeRepository.deleteProject(record.id);
      setOpenMenuId(null);
      await refresh();
    } catch {
      setError(t('hub.unavailable'));
    }
  };

  const restore = async (recovery: RecoveryRecord) => {
    if (!activeRepository) return;
    const current = projects.find((record) => record.id === recovery.projectId);
    const difference = recoveryDifference(current?.project, recovery.project);
    const summary = t('hub.recoveryDifference', difference);
    if (!window.confirm(`${t('hub.restoreConfirm', { name: recovery.project.name })}\n\n${summary}`)) return;
    try {
      const record = await activeRepository.restoreRecovery(recovery.id);
      recordLocalMetric(window.localStorage, { name: 'recovery_decision', code: 'restore', entityDelta: projectEntityCount(recovery.project) - (current ? projectEntityCount(current.project) : 0), recoveryAgeMinutes: recoveryAgeMinutes(recovery.createdAt) });
      await refresh();
      onOpen(record);
    } catch {
      setError(t('hub.unavailable'));
    }
  };

  const discardRecovery = async (recovery: RecoveryRecord, keepSaved = false) => {
    if (!activeRepository) return;
    const current = projects.find((record) => record.id === recovery.projectId);
    const difference = recoveryDifference(current?.project, recovery.project);
    const confirmation = keepSaved ? t('hub.keepSavedConfirm', { name: recovery.project.name, ...difference }) : t('hub.discardConfirm', { name: recovery.project.name });
    if (!window.confirm(confirmation)) return;
    try {
      await activeRepository.deleteRecovery(recovery.id);
      recordLocalMetric(window.localStorage, {
        name: keepSaved ? 'recovery_decision' : 'recovery_abandoned',
        code: keepSaved ? 'keep-saved' : 'discard',
        entityDelta: projectEntityCount(recovery.project) - (current ? projectEntityCount(current.project) : 0),
        recoveryAgeMinutes: recoveryAgeMinutes(recovery.createdAt),
      });
      await refresh();
    } catch {
      setError(t('hub.unavailable'));
    }
  };

  /* CRI-112 · el hub vacío casi desaparece.
     Sin proyectos y sin copias recuperables, la biblioteca no gasta un panel
     entero, un eyebrow y un titular para decir una frase: se queda en una
     línea discreta. En cuanto hay algo que enseñar —un proyecto, un error de
     la biblioteca o una copia pendiente— se despliega sola. La recuperación
     queda garantizada por construcción: su presencia es lo que fuerza el
     despliegue, así que nunca puede quedar menos alcanzable que hoy. */
  const collapsed = !loading && !error && projects.length === 0 && recoveries.length === 0;
  // CRI-140: una tarjeta 0/0 no puede presentarse como la revisión canónica
  // cuando la propia biblioteca tiene una recuperación de conflicto con más
  // entidades. La decisión segura vive en el resolvedor de abajo.
  const projectsForDisplay = projects.filter((record) => !recoveries.some((recovery) =>
    recovery.reason === 'conflict'
    && recovery.projectId === record.id
    && projectEntityCount(recovery.project) > projectEntityCount(record.project),
  ));
  const normalizedFilter = filter.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase(language);
  const matchesFilter = (name: string) => !normalizedFilter || name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase(language).includes(normalizedFilter);
  const filteredProjects = projectsForDisplay.filter((record) => matchesFilter(record.name));
  const filteredRecoveries = recoveries.filter((recovery) => matchesFilter(recovery.project.name));
  const visibleProjects = limit === undefined ? filteredProjects : filteredProjects.slice(0, Math.max(0, limit));
  const noMatches = Boolean(normalizedFilter) && filteredProjects.length === 0 && filteredRecoveries.length === 0 && (projects.length > 0 || recoveries.length > 0);

  return <section className={`project-hub project-hub--${variant}${collapsed ? ' project-hub--collapsed' : ''}`} data-project-hub-layout="visual-library" aria-label={t('hub.title')}>
    {loading ? <p role="status">{t('hub.loading')}</p> : null}
    {error ? <p className="project-hub__error" role="alert">{error}</p> : null}
    {!loading && projects.length === 0 ? <p className="project-hub__empty">{t('hub.empty')}</p> : null}
    {!loading && noMatches ? <p className="project-hub__empty" role="status">{t('hub.noMatches')}</p> : null}
    {visibleProjects.length ? <div className="project-hub__list">
      {visibleProjects.map((record) => <div className="project-hub__entry" key={record.id}><article className="project-hub__row">
        <div className="project-hub__preview" aria-hidden="true">
          <ThreeStructuralImage assetId={projectAssetId(record.project)} theme={theme} />
        </div>
        <div className="project-hub__identity">
          {editing?.id === record.id ? <form onSubmit={(event) => { event.preventDefault(); void commitRename(); }}>
            <label><span className="sr-only">{t('hub.renameLabel')}</span><input value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} autoFocus /></label>
            <button type="submit">{t('hub.saveName')}</button>
            <button type="button" onClick={() => setEditing(null)}>{t('hub.cancel')}</button>
          </form> : <><strong>{record.name}</strong><span>{t('hub.meta', { members: record.project.members.length, nodes: record.project.nodes.length })}</span></>}
          <div className="project-hub__record-meta">
            <time className="project-hub__updated" dateTime={record.updatedAt}>{formatUpdated(record.updatedAt, language)}</time>
            {variant === 'full' ? <small className="project-hub__revision">{t('hub.revision', { revision: record.revision })}</small> : null}
          </div>
        </div>
        <div className="project-hub__actions">
          <button className="project-hub__open" type="button" aria-label={t('hub.openLabel', { name: record.name })} onClick={() => onOpen(record)}><FolderOpen size={16} />{t('hub.open')}</button>
          <div className={`project-hub__menu${openMenuId === record.id ? ' is-open' : ''}`}>
            <button type="button" aria-expanded={openMenuId === record.id} aria-label={t('hub.moreActions', { name: record.name })} onClick={() => setOpenMenuId((current) => current === record.id ? null : record.id)}><MoreHorizontal size={18} /></button>
          </div>
        </div>
        {openMenuId === record.id ? <div className="project-hub__menu-panel">
          <button type="button" aria-label={t('hub.renameAction', { name: record.name })} onClick={() => { setOpenMenuId(null); setEditing({ id: record.id, name: record.name }); }}><Pencil size={15} />{t('hub.rename')}</button>
          <button type="button" aria-label={t('hub.duplicateAction', { name: record.name })} onClick={() => { setOpenMenuId(null); void duplicate(record); }}><Copy size={15} />{t('hub.duplicate')}</button>
          <button type="button" className="project-hub__delete" aria-label={t('hub.deleteAction', { name: record.name })} onClick={() => void remove(record)}><Trash2 size={15} />{t('hub.delete')}</button>
        </div> : null}
      </article>{activeRepository && variant === 'full' ? <ProjectVersions
        repository={activeRepository}
        record={record}
        formatDate={(iso) => formatUpdated(iso, language)}
        t={t}
        onRestored={onOpen}
        onChanged={() => { void refresh(); }}
      /> : null}</div>)}
    </div> : null}
    {filteredRecoveries.length ? <section className="project-hub__recoveries" aria-labelledby="recoveries-title">
      <h3 id="recoveries-title">{t('hub.recoveries', { count: filteredRecoveries.length })}</h3>
      {filteredRecoveries.map((recovery) => {
        const current = projects.find((record) => record.id === recovery.projectId);
        const conflict = recovery.reason === 'conflict' && current;
        const difference = recoveryDifference(current?.project, recovery.project);
        const signed = (value: number) => `${value > 0 ? '+' : ''}${value}`;
        return <article className={`project-hub__recovery${conflict ? ' is-conflict' : ''}`} key={recovery.id}>
          <header>
            {conflict ? <ShieldAlert size={18} aria-hidden="true" /> : <RotateCcw size={18} aria-hidden="true" />}
            <strong>{conflict ? t('hub.conflictTitle') : recovery.project.name}</strong>
          </header>
          <dl className="project-hub__recovery-delta" aria-label={t('hub.recoveryDifference', difference)}>
            <div><dt>N</dt><dd>{signed(difference.nodes)}</dd></div>
            <div><dt>B</dt><dd>{signed(difference.members)}</dd></div>
            <div><dt>C</dt><dd>{signed(difference.loads)}</dd></div>
          </dl>
          <div className="project-hub__recovery-actions">
            <button type="button" className="project-hub__recovery-primary" onClick={() => void restore(recovery)}><RotateCcw size={15} />{t('hub.restoreSafe')}</button>
            <button type="button" className="project-hub__recovery-discard" onClick={() => void discardRecovery(recovery, Boolean(conflict))}>{conflict ? t('hub.keepSaved') : t('hub.discardRecovery')}</button>
          </div>
        </article>;
      })}
    </section> : null}
  </section>;
};
