import { useEffect, useMemo, useState } from 'react';
import { findStandardMaterial } from '../../../data/standardMaterials';
import { afterTransition } from '../../../design-system/afterTransition';
import { useI18n } from '../../../i18n/useI18n';
import type { AnalysisResult, MemberModel, ProjectModel } from '../../../types';
import { NtcSteelDesignReview } from '../../results/NtcSteelDesignCard';
import { analyzeSteelModel } from './modelSteelAnalysis';
import './modelSteelReview.css';

// Sólo descubre candidatos para explicar su alcance. El motor exige identidades de catálogo.
export const isSteelReviewCandidate = (member: MemberModel) =>
  findStandardMaterial(member.materialId ?? '')?.category === 'STEEL' || (!member.materialId && member.E >= 100e6);

export function ModelSteelReview({ project, focusMember, onShowMembers }: {
  project: ProjectModel; focusMember?: string; onShowMembers?: (ids: readonly string[]) => void;
}) {
  const { language } = useI18n();
  const en = language === 'en';
  const members = useMemo(() => project.members.filter(isSteelReviewCandidate), [project]);
  const [chosen, setChosen] = useState('');
  const combinationId = project.combinations.some((c) => c.id === chosen) ? chosen
    : (project.combinations.find((c) => c.stateLimit === 'ultimate') ?? project.combinations[0])?.id ?? '';
  const combination = project.combinations.find((c) => c.id === combinationId);
  const [picked, setPicked] = useState(focusMember ?? '');
  const memberId = members.some((m) => m.id === picked) ? picked : '';
  const [state, setState] = useState<{ project: ProjectModel; combinationId: string; analysis: AnalysisResult | null; error?: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const cancel = afterTransition(() => {
      void analyzeSteelModel(project, combinationId, controller.signal).then((analysis) => {
        if (!controller.signal.aborted) setState({ project, combinationId, analysis });
      }).catch((error: unknown) => {
        if (!controller.signal.aborted) setState({ project, combinationId, analysis: null, error: error instanceof Error ? error.message : 'Error de análisis.' });
      });
    });
    return () => { cancel(); controller.abort(); };
  }, [project, combinationId]);
  const current = state?.project === project && state.combinationId === combinationId ? state : null;
  const reviewProject = useMemo(() => ({ ...project, members: memberId ? members.filter((m) => m.id === memberId) : members }), [project, members, memberId]);
  return <section className="model-steel-review" aria-label={en ? 'Steel review' : 'Revisión de acero'}>
    <header><h2>{en ? 'Steel · axial tension' : 'Acero · tensión axial'}</h2><p>{en
      ? 'Experimental · NTC CDMX 2023. This component uses the model combination selected below; the concrete code selector applies to concrete.'
      : 'Experimental · NTC CDMX 2023. Este componente usa la combinación del modelo elegida abajo; el selector de norma de concreto se aplica al concreto.'}</p></header>
    <div className="model-steel-review__controls">
      <label>{en ? 'Model combination' : 'Combinación del modelo'}<select value={combinationId} onChange={(event) => setChosen(event.currentTarget.value)}>
        {!project.combinations.length ? <option value="">{en ? 'Add a traceable ultimate combination in 2D' : 'Agrega una combinación última con procedencia en 2D'}</option> : null}
        {project.combinations.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select></label>
      <label>{en ? 'Steel member' : 'Barra de acero'}<select value={memberId} onChange={(event) => setPicked(event.currentTarget.value)}>
        <option value="">{en ? 'All steel members' : 'Todas las barras de acero'}</option>
        {members.map((m) => <option key={m.id} value={m.id}>{m.id}</option>)}
      </select></label>
    </div>
    {combination ? <details className="ntc-design-card__trace"><summary>{en ? 'Combination provenance' : 'Procedencia de la combinación'}</summary>
      <p>{Object.entries(combination.factors).map(([id, factor]) => `${factor} × ${project.loadCases.find((c) => c.id === id)?.name ?? id}`).join(' + ')}</p>
      <p>{[combination.jurisdiction, combination.edition, combination.stateLimit, combination.source].filter(Boolean).join(' · ')}</p>
      {combination.sourceUrl ? <a href={combination.sourceUrl} target="_blank" rel="noreferrer">{en ? 'Combination source' : 'Fuente de la combinación'}</a> : null}
    </details> : null}
    {!current ? <p role="status">{en ? 'Analyzing the model combination…' : 'Analizando la combinación del modelo…'}</p>
      : current.error ? <p role="alert">{current.error}</p>
      : <NtcSteelDesignReview project={reviewProject} analysis={current.analysis} combinationId={combinationId} />}
    {onShowMembers ? <button type="button" className="dw-inline-action" onClick={() => onShowMembers(reviewProject.members.map((m) => m.id))}>
      {en ? 'View in Model' : 'Ver en el Modelo'}</button> : null}
    <p className="dw-input-note">{en ? 'This initial steel review is not included in the concrete memory or PDF.' : 'Esta revisión inicial de acero no se incluye en la memoria ni en el PDF de concreto.'}</p>
  </section>;
}
