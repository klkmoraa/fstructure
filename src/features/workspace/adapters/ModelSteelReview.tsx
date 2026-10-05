import { useEffect, useMemo, useState } from 'react';
import { findStandardMaterial } from '../../../data/standardMaterials';
import { afterTransition } from '../../../design-system/afterTransition';
import { useI18n } from '../../../i18n/useI18n';
import type { AnalysisResult, MemberModel, ProjectModel } from '../../../types';
import { NtcSteelDesignReview } from '../../results/NtcSteelDesignCard';
import { analyzeSteelModel } from './modelSteelAnalysis';
import './modelSteelReview.css';
import { summarizeNtcSteelTensionDesign } from '../../../design/ntcSteel2023';
import { isSteelMemory, MAX_STEEL_REVIEWS, type SteelMemoryItem } from '../../../design/steelMemory';
import { useWorkbenchStorage } from '../../design/workbench/workbenchStorage';

// Sólo descubre candidatos para explicar su alcance. El motor exige identidades de catálogo.
export const isSteelReviewCandidate = (member: MemberModel) =>
  findStandardMaterial(member.materialId ?? '')?.category === 'STEEL' || (!member.materialId && member.E >= 100e6);

export function ModelSteelReview({ project, focusMember, onShowMembers }: {
  project: ProjectModel; focusMember?: string; onShowMembers?: (ids: readonly string[]) => void;
}) {
  const { language } = useI18n();
  const en = language === 'en';
  const storage = useWorkbenchStorage();
  const [saved, setSaved] = useState<SteelMemoryItem[]>(() => { const value = storage.read('steel-memory'); return isSteelMemory(value) ? value : []; });
  const [feedback, setFeedback] = useState('');
  const [exporting, setExporting] = useState(false);
  const members = useMemo(() => project.members.filter(isSteelReviewCandidate), [project]);
  const [chosen, setChosen] = useState('');
  const combinationId = project.combinations.some((c) => c.id === chosen) ? chosen
    : (project.combinations.find((c) => c.stateLimit === 'ultimate') ?? project.combinations[0])?.id ?? '';
  const combination = project.combinations.find((c) => c.id === combinationId);
  const [picked, setPicked] = useState(members.some((m) => m.id === focusMember) ? focusMember! : '');
  const memberId = picked;
  const missingMember = Boolean(memberId && !members.some((m) => m.id === memberId));
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
  const summary = useMemo(() => current?.analysis && !missingMember ? summarizeNtcSteelTensionDesign({ project: reviewProject, analysis: current.analysis, combinationId }) : null, [current, missingMember, reviewProject, combinationId]);
  const saveReview = () => {
    if (!combination || summary?.status !== 'available') return;
    const existing = saved.findIndex((s) => s.memberId === memberId && s.combinationId === combinationId);
    if (existing < 0 && saved.length >= MAX_STEEL_REVIEWS) { setFeedback(en ? 'The steel memory is full.' : 'La memoria de acero está llena.'); return; }
    const item = { memberId, combinationId, savedAt: new Date().toISOString() };
    const next = existing < 0 ? [...saved, item] : saved.map((s, i) => i === existing ? item : s);
    storage.write('steel-memory', next.map((s) => ({ ...s })));
    setSaved(next);
    setFeedback(en ? 'Selection saved; it will be recalculated with the current model.' : 'Selección guardada; se recalculará con el modelo vigente.');
  };
  const exportPdf = async () => {
    if (!combination || summary?.status !== 'available' || exporting) return;
    setExporting(true); setFeedback('');
    try {
      const [{ buildSteelReviewPdf }, { downloadPortableBytes }] = await Promise.all([import('./steelReviewPdf'), import('../../../utils/portableDownload')]);
      const bytes = await buildSteelReviewPdf({ projectName: project.name, combination, summary, model: project });
      downloadPortableBytes(bytes, 'revision-acero.pdf', 'application/pdf');
      setFeedback(en ? 'Steel report exported.' : 'Informe de acero exportado.');
    } catch { setFeedback(en ? 'The steel PDF could not be exported.' : 'No se pudo exportar el PDF de acero.'); }
    finally { setExporting(false); }
  };
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
        {missingMember ? <option value={memberId}>{memberId} · {en ? 'missing from current model' : 'ausente del modelo vigente'}</option> : null}
        {members.map((m) => <option key={m.id} value={m.id}>{m.id}</option>)}
      </select></label>
    </div>
    {combination ? <details className="ntc-design-card__trace"><summary>{en ? 'Combination provenance' : 'Procedencia de la combinación'}</summary>
      <p>{Object.entries(combination.factors).map(([id, factor]) => `${factor} × ${project.loadCases.find((c) => c.id === id)?.name ?? id}`).join(' + ')}</p>
      <p>{[combination.jurisdiction, combination.edition, combination.stateLimit, combination.source].filter(Boolean).join(' · ')}</p>
      {combination.sourceUrl ? <a href={combination.sourceUrl} target="_blank" rel="noreferrer">{en ? 'Combination source' : 'Fuente de la combinación'}</a> : null}
    </details> : null}
    {missingMember ? <p role="alert">{en ? 'The saved member is no longer a steel member in this model.' : 'La barra guardada ya no es una barra de acero de este modelo.'}</p> : !current ? <p role="status">{en ? 'Analyzing the model combination…' : 'Analizando la combinación del modelo…'}</p>
      : current.error ? <p role="alert">{current.error}</p>
      : <NtcSteelDesignReview project={reviewProject} analysis={current.analysis} combinationId={combinationId} />}
    {onShowMembers ? <button type="button" className="dw-inline-action" onClick={() => onShowMembers(reviewProject.members.map((m) => m.id))}>
      {en ? 'View in Model' : 'Ver en el Modelo'}</button> : null}
    <div className="model-steel-review__controls">
      <button type="button" className="dw-inline-action" disabled={summary?.status !== 'available'} onClick={saveReview}>{en ? 'Save steel review' : 'Guardar revisión de acero'}</button>
      <button type="button" className="dw-inline-action" disabled={summary?.status !== 'available' || exporting} onClick={() => void exportPdf()}>{exporting ? (en ? 'Preparing PDF…' : 'Preparando PDF…') : (en ? 'Steel PDF' : 'PDF de acero')}</button>
    </div>
    {feedback ? <p role="status">{feedback}</p> : null}
    <details className="ntc-design-card__trace"><summary>{en ? 'Steel memory' : 'Memoria de acero'} · {saved.length}</summary>
      <p>{en ? 'Saved selections are recalculated with the current model. Results are not stored.' : 'Las selecciones guardadas se recalculan con el modelo vigente. No se guardan resultados.'}</p>
      {saved.map((s) => {
        const exists = project.combinations.some((c) => c.id === s.combinationId);
        return <button key={JSON.stringify([s.memberId, s.combinationId])} type="button" className="dw-inline-action" disabled={!exists} onClick={() => { setChosen(s.combinationId); setPicked(s.memberId); setFeedback(''); }}>
          {s.memberId || (en ? 'All steel members' : 'Todas las barras de acero')} · {project.combinations.find((c) => c.id === s.combinationId)?.name ?? `${s.combinationId} · ${en ? 'missing combination' : 'combinación ausente'}`}
        </button>;
      })}
    </details>
    <p className="dw-input-note">{en ? 'The steel memory and PDF describe this incomplete component separately from the concrete report.' : 'La memoria y el PDF de acero documentan este componente incompleto por separado del informe de concreto.'}</p>
  </section>;
}
