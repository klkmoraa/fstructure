import { useState } from 'react';
import { Layers } from 'lucide-react';
import { useI18n } from '../../i18n/useI18n';
import { useProjectModel } from '../../store/ProjectContext';
import { useSharedToolState } from '../../store/SharedToolState';
import { singleWorkTool } from '../../shared/project/workScope';
import { promotedProjectName } from '../../storage/promoteProject';

/**
 * «Convertir en proyecto completo» del menú «⋯» de la mesa, sólo en un archivo
 * individual. Crea una copia (el original no se toca) y la abre aquí mismo: la
 * URL sigue en el modo de la herramienta y aparece el interruptor 2D | 3D | Diseño.
 */
export function PromoteToProjectItem({ onDone }: { onDone: () => void }) {
  const { project, replaceProject } = useProjectModel();
  const session = useSharedToolState()?.session;
  const { language } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!singleWorkTool(project) || !session) return null;
  const es = language !== 'en';
  const promote = async () => {
    setBusy(true);
    setError(null);
    try {
      const record = await session.promoteToProject(project.id, promotedProjectName(project.name, es ? 'es' : 'en'), project);
      // La biblioteca compatible lee este espejo (como el autoguardado); si falla, el bundle ya está guardado.
      try {
        const { getProjectRepository } = await import('../../storage/projectRepository');
        await getProjectRepository().saveProject(record.bundle.model2d);
      } catch { /* espejo opcional */ }
      replaceProject(record.bundle.model2d, undefined, record.revision);
      onDone();
    } catch (failure) {
      const reason = failure instanceof Error ? failure.message : String(failure);
      setError(es ? `No se pudo crear la copia: ${reason}` : `Could not create the copy: ${reason}`);
    } finally { setBusy(false); }
  };
  return <>
    <button type="button" role="menuitem" className="workspace-utilities__item" disabled={busy}
      title={es ? 'Crea una copia con 2D, 3D y Diseño enlazados; este archivo no cambia' : 'Creates a copy with 2D, 3D and Design linked; this file stays as it is'}
      onClick={() => void promote()}>
      <Layers size={17} aria-hidden="true" /><span>{es ? 'Convertir en proyecto completo' : 'Convert to full project'}</span>
    </button>
    {error ? <p className="workspace-utilities__error" role="alert">{error}</p> : null}
  </>;
}
