/**
 * «Definir → Masa y sismo»: diafragmas rígidos, fuente de masa, funciones de
 * espectro y casos de espectro de respuesta, como los menús «Diaphragms»,
 * «Mass Source», «Functions → Response Spectrum» y «Load Cases» de ETABS.
 *
 * Cada cambio es un comando del store: se deshace como cualquier edición.
 * El espectro de meseta es una forma genérica para empezar; el de la norma
 * se pega como tabla periodo–Sa.
 */
import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Dialog } from '../../../../design-system/components/overlays';
import type { TranslationKey } from '../../i18n/catalogs';
import type { Space3DCommand } from '../../space3d/data/commands';
import type { Space3DProjectV1, Space3DResponseSpectrumCase, Space3DSpectrumFunction } from '../../space3d/model/types';
import { SPACE3D_DEFAULT_MASS_SOURCE } from '../../space3d/engine/mass';
import { formatSpace3DSpectrumPoints, parseSpace3DSpectrumPoints, space3DPlateauSpectrum } from './space3dDefine';
import { space3DStoryDiaphragmsCommand } from './space3dAssign';
import { formatSpace3DNumber } from './space3dNumberFormat';

type Translate = (key: TranslationKey, variables?: Record<string, string | number>) => string;

interface Space3DDynamicsDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly t: Translate;
  readonly project: Space3DProjectV1;
  readonly onSubmit: (command: Space3DCommand) => boolean;
  /** Selecciona en el lienzo los nudos de un diafragma. */
  readonly onSelectNodes: (nodeIds: readonly string[]) => void;
}

const decimal = (value: string): number | null => {
  const parsed = Number(value.trim().replace(',', '.'));
  return value.trim() !== '' && Number.isFinite(parsed) ? parsed : null;
};

const freshId = (prefix: string, used: readonly string[]) => {
  let index = used.length + 1;
  while (used.includes(`${prefix}${index}`)) index += 1;
  return `${prefix}${index}`;
};

/** Curva del espectro en SVG: Sa (g) frente a T (s). */
const SpectrumPreview = ({ points, label }: { points: readonly (readonly [number, number])[]; label: string }) => {
  const width = 220;
  const height = 72;
  const tMax = Math.max(0.1, points[points.length - 1]?.[0] ?? 1);
  const aMax = Math.max(0.01, ...points.map((point) => point[1]));
  const path = points.map(([period, acceleration], index) =>
    `${index === 0 ? 'M' : 'L'}${(4 + (period / tMax) * (width - 8)).toFixed(1)},${(height - 4 - (acceleration / aMax) * (height - 12)).toFixed(1)}`).join(' ');
  return <svg className="space3d-spectrum-preview" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
    <line x1={4} x2={width - 4} y1={height - 4} y2={height - 4} className="space3d-diagram-axis" />
    <path d={path} className="space3d-spectrum-line" />
  </svg>;
};

export const Space3DDynamicsDialog = ({ open, onOpenChange, t, project, onSubmit, onSelectNodes }: Space3DDynamicsDialogProps) => {
  const [error, setError] = useState<string | null>(null);
  const [pointsDraft, setPointsDraft] = useState<Record<string, string>>({});
  const [plateau, setPlateau] = useState({ a0: '0.16', peak: '0.4', ta: '0.1', tb: '0.6', exponent: '1' });
  useEffect(() => { if (open) { setError(null); setPointsDraft({}); } }, [open]);

  const massSource = project.massSource ?? SPACE3D_DEFAULT_MASS_SOURCE;
  const diaphragms = project.diaphragms ?? [];
  const functions = project.spectrumFunctions ?? [];
  const spectrumCases = project.responseSpectrumCases ?? [];
  const submit = (command: Space3DCommand | null, failure = t('space3d.assign.invalid')) => {
    if (!command) return false;
    const ok = onSubmit(command);
    setError(ok ? null : failure);
    return ok;
  };

  const massFactor = (caseId: string) => massSource.loads.find((term) => term.caseId === caseId)?.factor ?? 0;
  const setMassFactor = (caseId: string, factor: number) => {
    const loads = massSource.loads.filter((term) => term.caseId !== caseId);
    submit({ kind: 'set-mass-source', massSource: { ...massSource, loads: factor > 0 ? [...loads, { caseId, factor }] : loads } });
  };

  const addSpectrum = () => {
    const values = Object.fromEntries(Object.entries(plateau).map(([key, value]) => [key, decimal(value)]));
    if (Object.values(values).some((value) => value === null)) { setError(t('space3d.assign.invalid')); return; }
    const points = space3DPlateauSpectrum(values as { a0: number; peak: number; ta: number; tb: number; exponent: number });
    if (!points) { setError(t('space3d.dynamics.plateauInvalid')); return; }
    const id = freshId('SP', functions.map((item) => item.id));
    submit({ kind: 'upsert-spectrum-function', spectrum: { id, name: `${t('space3d.dynamics.spectrumName')} ${id}`, points } });
  };

  const updateCase = (spectrumCase: Space3DResponseSpectrumCase, changes: Partial<Space3DResponseSpectrumCase>) =>
    submit({ kind: 'upsert-response-spectrum-case', spectrumCase: { ...spectrumCase, ...changes } });

  const numberCell = (label: string, value: number, apply: (value: number) => void, scale = 1) => <input
    type="text"
    inputMode="decimal"
    defaultValue={String(Number((value * scale).toPrecision(6)))}
    aria-label={label}
    onBlur={(event) => {
      const parsed = decimal(event.target.value);
      if (parsed === null) { setError(t('space3d.assign.invalid')); return; }
      if (parsed / scale !== value) apply(parsed / scale);
    }}
  />;

  return <Dialog
    open={open}
    onOpenChange={onOpenChange}
    title={t('space3d.define.dynamicsTitle')}
    description={t('space3d.dynamics.description')}
    closeLabel={t('space3d.assign.close')}
    className="space3d-define-dialog space3d-define-dialog--wide"
    footer={<button type="button" className="space3d-button space3d-button--primary" onClick={() => onOpenChange(false)}>{t('space3d.assign.close')}</button>}
  >
    <section className="space3d-define-block">
      <header>
        <h3>{t('space3d.dynamics.diaphragms')}</h3>
        <div className="space3d-define-actions">
          <button type="button" className="space3d-button" onClick={() => submit(space3DStoryDiaphragmsCommand(project), t('space3d.diaphragm.noStories'))}>
            <Plus size={15} aria-hidden="true" />{t('space3d.diaphragm.perStory')}
          </button>
          {diaphragms.length > 0 ? <button type="button" className="space3d-button space3d-button--ghost" onClick={() => submit({ kind: 'set-diaphragms', diaphragms: null })}>
            {t('space3d.diaphragm.removeAll')}
          </button> : null}
        </div>
      </header>
      {diaphragms.length === 0
        ? <p className="space3d-field-hint">{t('space3d.diaphragm.none')}</p>
        : <ul className="space3d-define-list">
          {diaphragms.map((diaphragm) => <li key={diaphragm.id}>
            <button type="button" className="space3d-link-button" onClick={() => onSelectNodes(diaphragm.nodeIds)} title={t('space3d.diaphragm.select')}>
              <b>{diaphragm.id}</b> {diaphragm.name}
            </button>
            <small>{t('space3d.diaphragm.nodes', { count: diaphragm.nodeIds.length })}</small>
          </li>)}
        </ul>}
      <p className="space3d-field-hint">{t('space3d.diaphragm.hint')}</p>
    </section>

    <section className="space3d-define-block">
      <header><h3>{t('space3d.dynamics.massSource')}</h3></header>
      <label className="space3d-assign-radio">
        <input type="checkbox" checked={massSource.selfMass}
          onChange={(event) => submit({ kind: 'set-mass-source', massSource: { ...massSource, selfMass: event.target.checked } })} />
        <span>{t('space3d.dynamics.selfMass')}</span>
      </label>
      <table className="space3d-define-table">
        <thead><tr>
          <th scope="col">{t('space3d.loads.caseName')}</th>
          <th scope="col">{t('space3d.dynamics.massFactor')}</th>
        </tr></thead>
        <tbody>
          {project.loadCases.map((loadCase) => <tr key={`${loadCase.id}-${massFactor(loadCase.id)}`}>
            <th scope="row">{loadCase.name} <code>{loadCase.id}</code></th>
            <td>{numberCell(`${t('space3d.dynamics.massFactor')} ${loadCase.id}`, massFactor(loadCase.id), (value) => {
              if (value < 0) { setError(t('space3d.assign.invalid')); return; }
              setMassFactor(loadCase.id, value);
            })}</td>
          </tr>)}
        </tbody>
      </table>
      <p className="space3d-field-hint">{t('space3d.dynamics.massHint')}</p>
    </section>

    <section className="space3d-define-block">
      <header><h3>{t('space3d.dynamics.spectra')}</h3></header>
      <div className="space3d-field-grid space3d-field-grid--5">
        {([
          ['a0', 'space3d.dynamics.a0'], ['peak', 'space3d.dynamics.peak'], ['ta', 'space3d.dynamics.ta'], ['tb', 'space3d.dynamics.tb'], ['exponent', 'space3d.dynamics.exponent'],
        ] as const).map(([key, label]) => <label key={key} className="space3d-field">
          <span className="space3d-field-label">{t(label)}</span>
          <input type="text" inputMode="decimal" value={plateau[key]} onChange={(event) => setPlateau((current) => ({ ...current, [key]: event.target.value }))} />
        </label>)}
      </div>
      <button type="button" className="space3d-button" onClick={addSpectrum}><Plus size={15} aria-hidden="true" />{t('space3d.dynamics.addPlateau')}</button>
      <p className="space3d-field-hint">{t('space3d.dynamics.plateauHint')}</p>
      {functions.map((spectrum: Space3DSpectrumFunction) => {
        const draft = pointsDraft[spectrum.id] ?? formatSpace3DSpectrumPoints(spectrum.points);
        const inUse = spectrumCases.some((item) => item.functionId === spectrum.id);
        return <article key={spectrum.id} className="space3d-spectrum-card">
          <header>
            <input type="text" defaultValue={spectrum.name} aria-label={`${t('space3d.loads.caseName')} ${spectrum.id}`}
              onBlur={(event) => { if (event.target.value.trim() && event.target.value !== spectrum.name) submit({ kind: 'upsert-spectrum-function', spectrum: { ...spectrum, name: event.target.value.trim() } }); }} />
            <button type="button" className="space3d-tool" disabled={inUse}
              aria-label={t('space3d.dynamics.deleteSpectrum', { id: spectrum.id })} title={inUse ? t('space3d.dynamics.spectrumInUse') : t('space3d.dynamics.deleteSpectrum', { id: spectrum.id })}
              onClick={() => submit({ kind: 'delete-spectrum-function', functionId: spectrum.id }, t('space3d.dynamics.spectrumInUse'))}><Trash2 size={15} aria-hidden="true" /></button>
          </header>
          <div className="space3d-spectrum-body">
            <label className="space3d-field">
              <span className="space3d-field-label">{t('space3d.dynamics.points')}</span>
              <textarea rows={6} value={draft} spellCheck={false}
                onChange={(event) => setPointsDraft((current) => ({ ...current, [spectrum.id]: event.target.value }))}
                onBlur={() => {
                  if (pointsDraft[spectrum.id] === undefined) return;
                  const points = parseSpace3DSpectrumPoints(draft);
                  if (!points) { setError(t('space3d.dynamics.pointsInvalid')); return; }
                  if (submit({ kind: 'upsert-spectrum-function', spectrum: { ...spectrum, points } })) {
                    setPointsDraft((current) => { const { [spectrum.id]: _drop, ...rest } = current; return rest; });
                  }
                }} />
            </label>
            <SpectrumPreview points={spectrum.points} label={t('space3d.dynamics.previewLabel', { name: spectrum.name })} />
          </div>
        </article>;
      })}
    </section>

    <section className="space3d-define-block">
      <header>
        <h3>{t('space3d.dynamics.cases')}</h3>
        <button type="button" className="space3d-button" disabled={functions.length === 0} onClick={() => {
          const id = freshId('E', spectrumCases.map((item) => item.id));
          const direction = spectrumCases.some((item) => item.direction === 'x') && !spectrumCases.some((item) => item.direction === 'z') ? 'z' : 'x';
          submit({
            kind: 'upsert-response-spectrum-case',
            spectrumCase: { id, name: `${t('space3d.dynamics.caseName')} ${direction.toUpperCase()}`, functionId: functions[0].id, direction, scale: 1, dampingRatio: 0.05, modes: 12, combination: 'cqc' },
          });
        }}><Plus size={15} aria-hidden="true" />{t('space3d.dynamics.addCase')}</button>
      </header>
      {spectrumCases.length === 0 ? <p className="space3d-field-hint">{functions.length === 0 ? t('space3d.dynamics.needsSpectrum') : t('space3d.dynamics.noCases')}</p> : <div className="space3d-story-table-wrap"><table className="space3d-define-table space3d-spectrum-cases">
        <thead><tr>
          <th scope="col">{t('space3d.loads.caseName')}</th>
          <th scope="col">{t('space3d.dynamics.function')}</th>
          <th scope="col">{t('space3d.dynamics.direction')}</th>
          <th scope="col" title={t('space3d.dynamics.scaleHint')}>{t('space3d.dynamics.scale')}</th>
          <th scope="col">ξ %</th>
          <th scope="col">{t('space3d.dynamics.modes')}</th>
          <th scope="col">{t('space3d.dynamics.combination')}</th>
          <th scope="col"><span className="space3d-visually-hidden">{t('space3d.deleteEntity')}</span></th>
        </tr></thead>
        <tbody>
          {spectrumCases.map((spectrumCase) => <tr key={`${spectrumCase.id}-${spectrumCase.scale}-${spectrumCase.dampingRatio}-${spectrumCase.modes}`}>
            <th scope="row"><input type="text" defaultValue={spectrumCase.name} aria-label={`${t('space3d.loads.caseName')} ${spectrumCase.id}`}
              onBlur={(event) => { if (event.target.value.trim() && event.target.value !== spectrumCase.name) updateCase(spectrumCase, { name: event.target.value.trim() }); }} /></th>
            <td><select value={spectrumCase.functionId} aria-label={`${t('space3d.dynamics.function')} ${spectrumCase.id}`} onChange={(event) => updateCase(spectrumCase, { functionId: event.target.value })}>
              {functions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select></td>
            <td><select value={spectrumCase.direction} aria-label={`${t('space3d.dynamics.direction')} ${spectrumCase.id}`} onChange={(event) => updateCase(spectrumCase, { direction: event.target.value as 'x' | 'z' })}>
              <option value="x">X</option>
              <option value="z">Z</option>
            </select></td>
            <td>{numberCell(`${t('space3d.dynamics.scale')} ${spectrumCase.id}`, spectrumCase.scale, (scale) => updateCase(spectrumCase, { scale }))}</td>
            <td>{numberCell(`ξ ${spectrumCase.id}`, spectrumCase.dampingRatio, (dampingRatio) => updateCase(spectrumCase, { dampingRatio }), 100)}</td>
            <td>{numberCell(`${t('space3d.dynamics.modes')} ${spectrumCase.id}`, spectrumCase.modes, (modes) => updateCase(spectrumCase, { modes: Math.round(modes) }))}</td>
            <td><select value={spectrumCase.combination} aria-label={`${t('space3d.dynamics.combination')} ${spectrumCase.id}`} onChange={(event) => updateCase(spectrumCase, { combination: event.target.value as 'cqc' | 'srss' })}>
              <option value="cqc">CQC</option>
              <option value="srss">SRSS</option>
            </select></td>
            <td><button type="button" className="space3d-tool" aria-label={t('space3d.dynamics.deleteCase', { id: spectrumCase.id })} title={t('space3d.dynamics.deleteCase', { id: spectrumCase.id })}
              onClick={() => submit({ kind: 'delete-response-spectrum-case', caseId: spectrumCase.id })}><Trash2 size={15} aria-hidden="true" /></button></td>
          </tr>)}
        </tbody>
      </table></div>}
      <p className="space3d-field-hint">{t('space3d.dynamics.scaleHint')}</p>
    </section>
    {error ? <p className="space3d-notice space3d-notice--error" role="alert">{error}</p> : null}
    <p className="space3d-field-hint">{t('space3d.dynamics.massSummary', {
      self: massSource.selfMass ? t('space3d.dynamics.yes') : t('space3d.dynamics.no'),
      loads: massSource.loads.length === 0 ? '—' : massSource.loads.map((term) => `${formatSpace3DNumber(term.factor, { significantDigits: 3 })}·${term.caseId}`).join(' + '),
    })}</p>
  </Dialog>;
};
