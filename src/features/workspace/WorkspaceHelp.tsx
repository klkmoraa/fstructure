import { useEffect, useRef, useState } from 'react';
import { CircleHelp } from 'lucide-react';
import { Dialog } from '../../design-system/components/overlays';
import type { ToolId } from '../../shared/contracts';
import { toolIdentity } from './toolCatalog';
import { workspaceHelpContent } from './workspaceHelpContent';
import './workspaceHelp.css';

/** Los menús de la barra abren la guía sin conocer este componente. */
export const OPEN_HELP_EVENT = 'fstructure:open-help';

export function WorkspaceHelp({ tool, language, topic }: { tool: ToolId; language: 'es' | 'en'; topic?: 'design' | 'space3d' }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(OPEN_HELP_EVENT, show);
    return () => window.removeEventListener(OPEN_HELP_EVENT, show);
  }, []);
  const name = toolIdentity(tool).name[language];
  const title = topic === 'design'
    ? (language === 'es' ? `Cómo diseñar en ${name}` : `How to design in ${name}`)
    : topic === 'space3d'
      ? (language === 'es' ? `Cómo modelar en 3D en ${name}` : `How to model in 3D in ${name}`)
      : (language === 'es' ? `Cómo usar ${name}` : `How to use ${name}`);
  const guide = workspaceHelpContent[language][topic ?? tool];
  return <>
    <button ref={trigger} type="button" className="workspace-topbar__icon-button workspace-help-trigger"
      aria-label={title} title={title} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
      <CircleHelp size={18} aria-hidden="true" />
    </button>
    <Dialog open={open} onOpenChange={setOpen} title={title} closeLabel={language === 'es' ? 'Cerrar guía' : 'Close guide'}
      description={language === 'es' ? 'Un recorrido por los controles de esta mesa.' : 'A walkthrough of this workspace’s controls.'}
      returnFocusTo={trigger.current} className="workspace-help">
      <ol className="workspace-help__steps">
        {guide.steps.map(([heading, body]) => <li key={heading}><h3>{heading}</h3><p>{body}</p></li>)}
      </ol>
      <details className="workspace-help__controls">
        <summary>{language === 'es' ? 'Controles y atajos' : 'Controls and shortcuts'}</summary>
        <dl>{guide.controls.map(([label, detail]) => <div key={label}><dt>{label}</dt><dd>{detail}</dd></div>)}</dl>
      </details>
    </Dialog>
  </>;
}
