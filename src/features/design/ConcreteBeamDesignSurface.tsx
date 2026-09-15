import { AlertTriangle, CheckCircle2, CircleSlash, DraftingCompass, LoaderCircle, Play, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { DEFAULT_REINFORCED_CONCRETE_BEAM_DESIGN } from '../../data/defaultProject';
import { useConcreteBeamDesign } from '../../design/useConcreteBeamDesign';
import { useI18n } from '../../i18n/useI18n';
import { useProject } from '../../store/ProjectContext';
import type { ReinforcedConcreteBeamAssignment } from '../../types';
import type { SurfacePresentation, SurfaceStatus } from '../workspace/surfacePresentation';
import { createId } from '../../utils/id';
import './concreteBeamDesignSurface.css';

export interface ConcreteBeamDesignSurfaceProps {
  open: boolean;
  presentation: Extract<SurfacePresentation, 'dock' | 'drawer' | 'fullscreen'>;
  status: SurfaceStatus;
  onOpenChange: (open: boolean) => void;
}

const copy = {
  es: {
    title: 'Diseño', subtitle: 'Viga de concreto reforzado · Experimental', close: 'Cerrar Diseño',
    empty: 'Selecciona una viga de marco para iniciar un diseño.', noAssignment: 'Esta viga aún no tiene una asignación de diseño.',
    noCombinations: 'Define una combinación NTC de servicio y otra última, con procedencia, antes de crear la asignación.',
    create: 'Crear asignación', calculate: 'Calcular diseño', calculating: 'Calculando diseño…',
    configuration: 'Configuración', demands: 'Demandas', reinforcement: 'Refuerzo', detail: 'Detalle y evidencia',
    cover: 'Recubrimiento', ultimate: 'Combinación última', service: 'Combinación de servicio',
    blocked: 'Diseño bloqueado', unavailable: 'Aún no hay un resultado de diseño.',
    positive: 'Momento positivo', negative: 'Momento negativo', shear: 'Cortante absoluto',
    bottom: 'Acero inferior', top: 'Acero superior', stirrups: 'Estribos', spacing: 'Separación',
    shortDeflection: 'Deflexión inmediata', checks: 'Comprobaciones', evidence: 'Evidencia NTC CDMX 2023',
    transverse: 'Sección transversal', longitudinal: 'Elevación longitudinal',
    notDrawing: 'Esquema informativo; no es un plano de fabricación.',
    pending: 'Los efectos de fisuración refinada, fluencia, contracción y largo plazo se declaran no evaluados.',
  },
  en: {
    title: 'Design', subtitle: 'Reinforced concrete beam · Experimental', close: 'Close Design',
    empty: 'Select a frame beam to begin a design.', noAssignment: 'This beam has no design assignment yet.',
    noCombinations: 'Define one traceable NTC service combination and one ultimate combination before creating the assignment.',
    create: 'Create assignment', calculate: 'Calculate design', calculating: 'Calculating design…',
    configuration: 'Configuration', demands: 'Demands', reinforcement: 'Reinforcement', detail: 'Detail and evidence',
    cover: 'Cover', ultimate: 'Ultimate combination', service: 'Service combination',
    blocked: 'Design blocked', unavailable: 'No derived design result yet.',
    positive: 'Positive moment', negative: 'Negative moment', shear: 'Absolute shear',
    bottom: 'Bottom reinforcement', top: 'Top reinforcement', stirrups: 'Stirrups', spacing: 'Spacing',
    shortDeflection: 'Immediate deflection', checks: 'Checks', evidence: 'NTC CDMX 2023 evidence',
    transverse: 'Transverse section', longitudinal: 'Longitudinal elevation',
    notDrawing: 'Informational sketch; not a fabrication drawing.',
    pending: 'Refined cracking, creep, shrinkage, and long-term effects are explicitly not evaluated.',
  },
} as const;

const arrangement = (count: number, diameter: number) => `${count} Ø${diameter} mm`;

export const ConcreteBeamDesignSurface = ({ open, presentation, status, onOpenChange }: ConcreteBeamDesignSurfaceProps) => {
  const { project, selection, updateProjectDesign } = useProject();
  const { language } = useI18n();
  const text = copy[language];
  const memberId = selection?.kind === 'member' ? selection.id : project.designAssignments[0]?.memberId;
  const member = project.members.find((item) => item.id === memberId);
  const assignment = project.designAssignments.find((item): item is ReinforcedConcreteBeamAssignment => item.memberId === memberId && item.kind === 'reinforced-concrete-beam');
  const ultimateCombinations = useMemo(() => project.combinations.filter((item) => item.stateLimit === 'ultimate'), [project.combinations]);
  const serviceCombinations = useMemo(() => project.combinations.filter((item) => item.stateLimit === 'service'), [project.combinations]);
  const { outcome, busy, error, run, clear } = useConcreteBeamDesign(project, assignment);
  const canCreate = Boolean(member && ultimateCombinations[0] && serviceCombinations[0]);
  const [coverDraft, setCoverDraft] = useState(assignment?.coverMm.toString() ?? '');

  useEffect(() => {
    setCoverDraft(assignment?.coverMm.toString() ?? '');
  }, [assignment?.coverMm, assignment?.id]);

  const update = (change: Partial<ReinforcedConcreteBeamAssignment>) => {
    if (!assignment) return;
    clear();
    updateProjectDesign((draft) => ({
      ...draft,
      designAssignments: draft.designAssignments.map((item) => item.id === assignment.id ? { ...item, ...change } : item),
    }));
  };

  const createAssignment = () => {
    if (!member || !ultimateCombinations[0] || !serviceCombinations[0]) return;
    updateProjectDesign((draft) => ({
      ...draft,
      designAssignments: [...draft.designAssignments, {
        id: createId(), memberId: member.id, kind: 'reinforced-concrete-beam', standardId: 'ntc-cdmx-2023-concrete',
        ultimateCombinationId: ultimateCombinations[0].id, serviceCombinationId: serviceCombinations[0].id,
        ...DEFAULT_REINFORCED_CONCRETE_BEAM_DESIGN,
        preferredLongitudinalDiametersMm: [...DEFAULT_REINFORCED_CONCRETE_BEAM_DESIGN.preferredLongitudinalDiametersMm],
        preferredStirrupDiametersMm: [...DEFAULT_REINFORCED_CONCRETE_BEAM_DESIGN.preferredStirrupDiametersMm],
      }],
    }));
  };

  const commitCover = () => {
    if (!assignment) return;
    const coverMm = Number(coverDraft);
    if (!Number.isFinite(coverMm) || coverMm <= 0) {
      setCoverDraft(assignment.coverMm.toString());
      return;
    }
    if (coverMm !== assignment.coverMm) update({ coverMm });
  };

  const shearDemand = outcome?.status === 'available'
    ? outcome.checks.find((check) => check.id === 'shear-strength')?.demand?.value
    : undefined;
  const longitudinalStirrupMarkers = outcome?.status === 'available'
    ? Math.max(3, Math.min(12, Math.round(600 / outcome.reinforcement.stirrups.spacingMm)))
    : 0;

  return <aside
    className="concrete-design-surface"
    data-testid="concrete-beam-design-surface"
    data-presentation={presentation}
    data-surface-status={status}
    hidden={!open || status !== 'active'}
    aria-label={text.title}
  >
    <header className="concrete-design-surface__header">
      <div><DraftingCompass size={20} aria-hidden="true" /><span><strong>{text.title}</strong><small>{text.subtitle}</small></span></div>
      <button type="button" onClick={() => onOpenChange(false)} aria-label={text.close}><X size={18} aria-hidden="true" /></button>
    </header>

    {!member ? <section className="concrete-design-surface__empty"><CircleSlash size={22} aria-hidden="true" /><p>{text.empty}</p></section> : !assignment ? <section className="concrete-design-surface__empty">
      <DraftingCompass size={22} aria-hidden="true" /><p>{text.noAssignment}</p>
      {!canCreate ? <small>{text.noCombinations}</small> : <button type="button" className="concrete-design-surface__primary" onClick={createAssignment}>{text.create}</button>}
    </section> : <>
      <section className="concrete-design-surface__section" aria-labelledby="design-configuration-title">
        <h2 id="design-configuration-title">{text.configuration}</h2>
        <div className="concrete-design-surface__config-grid">
          <label>{text.cover}<input type="number" min="1" value={coverDraft} onChange={(event) => setCoverDraft(event.currentTarget.value)} onBlur={commitCover} /><small>mm</small></label>
          <label>{text.ultimate}<select value={assignment.ultimateCombinationId} onChange={(event) => update({ ultimateCombinationId: event.currentTarget.value })}>{ultimateCombinations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>{text.service}<select value={assignment.serviceCombinationId} onChange={(event) => update({ serviceCombinationId: event.currentTarget.value })}>{serviceCombinations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        </div>
        <button type="button" className="concrete-design-surface__primary" onClick={run} disabled={busy}>{busy ? <LoaderCircle size={16} className="is-spinning" aria-hidden="true" /> : <Play size={16} fill="currentColor" aria-hidden="true" />}{busy ? text.calculating : text.calculate}</button>
        {error ? <p className="concrete-design-surface__error" role="alert">{error}</p> : null}
      </section>

      {outcome?.status === 'blocked' ? <section className="concrete-design-surface__blocked" role="status"><AlertTriangle size={18} aria-hidden="true" /><div><strong>{text.blocked}</strong><p>{outcome.blockers.join(', ')}</p></div></section> : null}
      {outcome?.status === 'available' ? <>
        <section className="concrete-design-surface__section"><h2>{text.demands}</h2><dl className="concrete-design-surface__metrics"><div><dt>{text.positive}</dt><dd>{outcome.flexure.positive.demandKnm.toFixed(2)} kN·m</dd></div><div><dt>{text.negative}</dt><dd>{outcome.flexure.negative.demandKnm.toFixed(2)} kN·m</dd></div><div><dt>{text.shear}</dt><dd>{shearDemand?.toFixed(2) ?? '—'} kN</dd></div></dl></section>
        <section className="concrete-design-surface__section"><h2>{text.reinforcement}</h2><div className="concrete-design-surface__detail-grid"><div className="concrete-design-surface__sketches"><figure><svg viewBox="0 0 220 150" role="img" aria-label={text.transverse}><rect x="24" y="12" width="172" height="126" rx="3" /><rect x="38" y="26" width="144" height="98" rx="2" className="stirrup" />{Array.from({ length: outcome.reinforcement.top.count }, (_, index) => <circle key={`top-${index}`} cx={58 + index * (110 / Math.max(1, outcome.reinforcement.top.count - 1))} cy="42" r="5" />)}{Array.from({ length: outcome.reinforcement.bottom.count }, (_, index) => <circle key={`bottom-${index}`} cx={58 + index * (110 / Math.max(1, outcome.reinforcement.bottom.count - 1))} cy="108" r="5" />)}</svg><figcaption>{text.transverse}</figcaption></figure><figure><svg viewBox="0 0 300 90" role="img" aria-label={text.longitudinal}><rect x="12" y="22" width="276" height="46" rx="2" className="beam-outline" /><line x1="22" y1="57" x2="278" y2="57" className="longitudinal-bar" />{Array.from({ length: longitudinalStirrupMarkers }, (_, index) => <line key={`stirrup-${index}`} x1={28 + index * (244 / Math.max(1, longitudinalStirrupMarkers - 1))} y1="28" x2={28 + index * (244 / Math.max(1, longitudinalStirrupMarkers - 1))} y2="63" className="longitudinal-stirrup" />)}</svg><figcaption>{text.longitudinal}</figcaption></figure></div><dl><div><dt>{text.top}</dt><dd>{arrangement(outcome.reinforcement.top.count, outcome.reinforcement.top.diameterMm)}</dd></div><div><dt>{text.bottom}</dt><dd>{arrangement(outcome.reinforcement.bottom.count, outcome.reinforcement.bottom.diameterMm)}</dd></div><div><dt>{text.stirrups}</dt><dd>Ø{outcome.reinforcement.stirrups.diameterMm} mm · {text.spacing} {outcome.reinforcement.stirrups.spacingMm} mm</dd></div><div><dt>{text.shortDeflection}</dt><dd>{outcome.service.immediateDeflectionMm.toFixed(2)} mm</dd></div></dl></div><small>{text.notDrawing}</small></section>
        <section className="concrete-design-surface__section"><h2>{text.detail}</h2><div className="concrete-design-surface__checks"><strong>{text.checks}</strong>{outcome.checks.map((check) => <div key={check.id} data-check-status={check.status}><CheckCircle2 size={15} aria-hidden="true" /><span>{check.message}</span></div>)}</div><div className="concrete-design-surface__evidence"><strong>{text.evidence}</strong><a href={outcome.provenance.sourceUrl} target="_blank" rel="noreferrer">{outcome.provenance.sourceSha256.slice(0, 16)}…</a><p>{text.pending}</p></div></section>
      </> : outcome === null && !busy ? <p className="concrete-design-surface__hint">{text.unavailable}</p> : null}
    </>}
  </aside>;
};
