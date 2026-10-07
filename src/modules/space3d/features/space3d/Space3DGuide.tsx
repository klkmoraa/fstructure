/**
 * Ruta del cálculo: el orden físico del trabajo dibujado como una barra que se
 * va armando nudo a nudo, más una única acción recomendada. La ruta no decide
 * nada por la persona: cada botón abre la herramienta o el formulario
 * correspondiente, y el proyecto sólo cambia cuando ella confirma.
 */
import { useId } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import type { TranslationKey } from '../../i18n/catalogs';
import type { Space3DGuide as Space3DGuideModel, Space3DGuideAction, Space3DGuideStepId } from './space3dRoute';

type Translate = (key: TranslationKey, variables?: Record<string, string | number>) => string;

const STEP_KEYS: Record<Space3DGuideStepId, TranslationKey> = {
  geometry: 'space3d.guideStepGeometry',
  supports: 'space3d.guideStepSupports',
  loads: 'space3d.guideStepLoads',
  analysis: 'space3d.guideStepAnalysis',
};

const STATE_KEYS = {
  done: 'space3d.guideStateDone',
  current: 'space3d.guideStateCurrent',
  pending: 'space3d.guideStatePending',
} as const satisfies Record<string, TranslationKey>;

interface NextCopy { readonly title: TranslationKey; readonly action?: TranslationKey }

const NEXT_COPY: Record<Space3DGuideAction, NextCopy> = {
  start: { title: 'space3d.guideStartTitle', action: 'space3d.guideStartAction' },
  'add-node': { title: 'space3d.guideAddNodeTitle', action: 'space3d.guideAddNodeAction' },
  'add-member': { title: 'space3d.guideAddMemberTitle', action: 'space3d.guideAddMemberAction' },
  'add-support': { title: 'space3d.guideAddSupportTitle', action: 'space3d.guideAddSupportAction' },
  'add-load': { title: 'space3d.guideAddLoadTitle', action: 'space3d.guideAddLoadAction' },
  analyze: { title: 'space3d.guideAnalyzeTitle', action: 'space3d.analyze' },
  running: { title: 'space3d.guideRunningTitle' },
  reanalyze: { title: 'space3d.guideReanalyzeTitle', action: 'space3d.guideReanalyzeAction' },
  'review-failure': { title: 'space3d.guideFailureTitle', action: 'space3d.guideFailureAction' },
  'explore-results': { title: 'space3d.guideResultsTitle', action: 'space3d.guideResultsAction' },
};

interface Space3DGuideProps {
  readonly guide: Space3DGuideModel;
  readonly t: Translate;
  /** Estado del análisis ya traducido, para el subtítulo del último paso. */
  readonly analysisLabel: string;
  readonly onAction: (action: Space3DGuideAction) => void;
  readonly compact?: boolean;
  /** La acción ya está hecha (p. ej. la deformada ya se ve): se quita el botón. */
  readonly actionDone?: boolean;
}

export const Space3DGuide = ({ guide, t, analysisLabel, onAction, compact = false, actionDone = false }: Space3DGuideProps) => {
  const headingId = useId();
  const copy = NEXT_COPY[guide.next];
  const vars = { id: guide.nodeId ?? '' };
  const count = (value: number, one: TranslationKey, many: TranslationKey) => t(value === 1 ? one : many, { count: value });
  const caption: Record<Space3DGuideStepId, string> = {
    geometry: t('space3d.guideGeometryCaption', {
      nodes: count(guide.counts.nodes, 'space3d.countNode', 'space3d.countNodes'),
      members: count(guide.counts.members, 'space3d.countMember', 'space3d.countMembers'),
    }),
    supports: count(guide.counts.supports, 'space3d.guideSupportsCaptionOne', 'space3d.guideSupportsCaption'),
    loads: count(guide.counts.loads, 'space3d.guideLoadsCaptionOne', 'space3d.guideLoadsCaption'),
    analysis: analysisLabel,
  };

  // Con el lienzo vacío las tres formas de empezar ya están en el centro del
  // lienzo; repetir aquí una sola de ellas la haría parecer la única.
  const action = copy.action && !actionDone && !(guide.next === 'start' && !compact) ? <button
    type="button"
    className="space3d-button space3d-button--primary space3d-next-action"
    onClick={() => onAction(guide.next)}
  >
    {t(copy.action, vars)}
    <ArrowRight size={16} aria-hidden="true" />
  </button> : null;

  if (compact) {
    return <section className="space3d-guide space3d-guide--compact" aria-label={t('space3d.guideNextLabel')}>
      <ol className="space3d-route space3d-route--mini" aria-label={t('space3d.guideTitle')}>
        {guide.steps.map((step) => <li key={step.id} data-state={step.state}>
          <span className="space3d-route-node" aria-hidden="true" />
          <span className="space3d-visually-hidden">{t('space3d.guideStepStatus', { step: t(STEP_KEYS[step.id]), state: t(STATE_KEYS[step.state]) })}</span>
        </li>)}
      </ol>
      <p className="space3d-guide-compact-title" role="status">{t(copy.title)}</p>
      {action}
    </section>;
  }

  return <section className="space3d-guide" aria-labelledby={headingId}>
    <h2 id={headingId} className="space3d-panel-heading">{t('space3d.guideTitle')}</h2>
    <ol className="space3d-route">
      {guide.steps.map((step) => <li key={step.id} data-state={step.state} aria-current={step.state === 'current' ? 'step' : undefined}>
        <span className="space3d-route-node" aria-hidden="true" />
        <span className="space3d-route-name">{t(STEP_KEYS[step.id])}</span>
        <span className="space3d-route-caption">{caption[step.id]}</span>
        <span className="space3d-visually-hidden">{t(STATE_KEYS[step.state])}</span>
      </li>)}
    </ol>

    {guide.next === 'start' ? null : <div className="space3d-next" data-action={guide.next} role="status">
      <p className="space3d-next-title">
        {guide.next === 'running' ? <Loader2 size={16} aria-hidden="true" className="space3d-spin" /> : null}
        {t(copy.title)}
      </p>
    </div>}
    {action}
  </section>;
};
