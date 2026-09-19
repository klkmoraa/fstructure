import { useCallback, useEffect, useRef, useState } from 'react';
import { readProjectUrl, writeProjectUrl, type ProjectUrlState } from './projectUrl';

/** History is the durable route; popstate and project opens update the same state. */
export function useProjectNavigation(activeProjectId: string) {
  const [route, setRoute] = useState(() => readProjectUrl(window.location.href, activeProjectId));
  const previousProjectId = useRef(activeProjectId);
  const navigate = useCallback((next: ProjectUrlState, mode: 'push' | 'replace' = 'push') => {
    writeProjectUrl(window, next, mode);
    setRoute((current) => current.surface === next.surface && current.projectId === next.projectId && current.tool === next.tool ? current : next);
  }, []);

  useEffect(() => {
    const restore = () => {
      const next = readProjectUrl(window.location.href, activeProjectId);
      navigate(next, 'replace');
    };
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, [activeProjectId, navigate]);

  useEffect(() => {
    if (previousProjectId.current !== activeProjectId) {
      previousProjectId.current = activeProjectId;
      navigate({ ...readProjectUrl(window.location.href, activeProjectId), projectId: activeProjectId }, 'replace');
    }
  }, [activeProjectId, navigate]);

  useEffect(() => {
    writeProjectUrl(window, route, 'replace');
  }, [route]);

  return { route, navigate };
}
