import { useEffect, useState } from 'react';
import { Check, Save } from 'lucide-react';
import { useProjectModel } from '../../store/ProjectModelContext';
import { useSharedToolState } from '../../store/SharedToolState';
import { PROJECT_LIBRARY_CHANGE_KEY } from '../../storage/projectRepository';
import { useI18n } from '../../i18n/useI18n';

/** Explicitly keeps the current working draft in the saved library. */
export const ProjectSaveButton = () => {
  const { project } = useProjectModel();
  const session = useSharedToolState()?.session;
  const { language } = useI18n();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setSaved(false); setError(false);
    if (session) void session.repository.openBundle(project.id).then((record) => {
      if (!cancelled) setSaved(Boolean(record && record.libraryState !== 'draft'));
    }).catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [project.id, session]);
  if (!session) return null;
  const save = async () => {
    setBusy(true); setError(false);
    try {
      await session.save2D(project);
      await session.setLibraryState([project.id], 'saved');
      setSaved(true);
      localStorage.setItem(PROJECT_LIBRARY_CHANGE_KEY, JSON.stringify({ projectId: project.id, state: 'saved', at: Date.now() }));
      window.dispatchEvent(new Event(PROJECT_LIBRARY_CHANGE_KEY));
    } catch { setError(true); }
    finally { setBusy(false); }
  };
  return <>
    <button type="button" className="fh-button fh-current__save" disabled={saved || busy} onClick={() => void save()}>
      {saved ? <Check size={16} aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}
      {saved ? language === 'es' ? 'Guardado' : 'Saved' : language === 'es' ? 'Guardar proyecto' : 'Save project'}
    </button>
    {error ? <small className="fh-current__save-error" role="alert">{language === 'es' ? 'No se pudo guardar. Intenta de nuevo.' : 'Could not save. Try again.'}</small> : null}
  </>;
};
