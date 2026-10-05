/**
 * Formularios de «Asignar» sobre la selección múltiple.
 *
 * Cada formulario produce un solo comando (un lote), así que una asignación a
 * cuarenta vigas se deshace de una vez y el store la acepta o la rechaza
 * entera. Los números son borradores de texto hasta confirmar, como en el
 * editor de entidades.
 */
import { useMemo, useState } from 'react';
import { Check, X } from 'lucide-react';
import type { TranslationKey } from '../../i18n/catalogs';
import type { Space3DCommand } from '../../space3d/data/commands';
import type { Space3DProjectV1, Space3DRestraints } from '../../space3d/model/types';
import { SPACE3D_MATERIALS, SPACE3D_SECTION_CATALOG } from '../../space3d/model/sectionLibrary';
import {
  SPACE3D_RELEASE_PRESETS, space3DAssignDistributedLoadCommand, space3DAssignMemberTypeCommand, space3DAssignNodalLoadCommand,
  space3DAssignDiaphragmCommand, space3DAssignPointMemberLoadCommand, space3DAssignReleasesCommand, space3DAssignRestraintsCommand,
  space3DAssignSectionCommand, space3DStoryDiaphragmsCommand,
  type Space3DMemberLoadDirection, type Space3DReleasePreset, type Space3DSelectionSet,
} from './space3dAssign';
import { SPACE3D_SUPPORT_RESTRAINTS } from './space3dSupportKind';
import type { Space3DAssignKind } from './Space3DRibbon';

type Translate = (key: TranslationKey, variables?: Record<string, string | number>) => string;

interface Space3DAssignPanelProps {
  readonly t: Translate;
  readonly kind: Space3DAssignKind;
  readonly project: Space3DProjectV1;
  readonly selection: Space3DSelectionSet;
  /** Caso activo del análisis, propuesto como caso de la carga. */
  readonly defaultCaseId: string;
  readonly onSubmit: (command: Space3DCommand) => boolean;
  readonly onClose: () => void;
}

const TITLES: Record<Space3DAssignKind, TranslationKey> = {
  section: 'space3d.assign.titleSection',
  releases: 'space3d.assign.titleReleases',
  'member-load': 'space3d.assign.titleMemberLoad',
  'nodal-load': 'space3d.assign.titleNodalLoad',
  support: 'space3d.assign.titleSupport',
  type: 'space3d.assign.titleType',
  diaphragm: 'space3d.assign.titleDiaphragm',
};

const RELEASE_OPTIONS: readonly { id: Space3DReleasePreset; key: TranslationKey }[] = [
  { id: 'continuous', key: 'space3d.assign.releaseContinuous' },
  { id: 'pinned-i', key: 'space3d.assign.releasePinnedI' },
  { id: 'pinned-j', key: 'space3d.assign.releasePinnedJ' },
  { id: 'pinned-both', key: 'space3d.assign.releasePinnedBoth' },
];

const DIRECTIONS: readonly { id: Space3DMemberLoadDirection; key: TranslationKey }[] = [
  { id: 'gravity', key: 'space3d.assign.dirGravity' },
  { id: 'x', key: 'space3d.assign.dirX' },
  { id: 'y', key: 'space3d.assign.dirY' },
  { id: 'z', key: 'space3d.assign.dirZ' },
  { id: 'local-1', key: 'space3d.assign.dirLocal1' },
  { id: 'local-2', key: 'space3d.assign.dirLocal2' },
  { id: 'local-3', key: 'space3d.assign.dirLocal3' },
];

const SUPPORTS: readonly { id: 'fixed' | 'pinned' | 'free'; key: TranslationKey }[] = [
  { id: 'fixed', key: 'space3d.supportPresetFixed' },
  { id: 'pinned', key: 'space3d.supportPresetPinned' },
  { id: 'free', key: 'space3d.supportPresetFree' },
];

const numeric = (value: string): number | null => {
  const trimmed = value.trim().replace(',', '.');
  if (trimmed === '') return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

const MATERIAL_GROUPS = SPACE3D_MATERIALS
  .map((material) => ({ material, sections: SPACE3D_SECTION_CATALOG.filter((section) => section.materialId === material.id) }))
  .filter((group) => group.sections.length > 0);

export const Space3DAssignPanel = ({ t, kind, project, selection, defaultCaseId, onSubmit, onClose }: Space3DAssignPanelProps) => {
  const members = selection.members;
  const nodes = selection.nodes;
  const targetsMembers = kind !== 'nodal-load' && kind !== 'support' && kind !== 'diaphragm';
  const count = targetsMembers ? members.length : nodes.length;

  const firstMember = project.members.find((member) => member.id === members[0]);
  const [section, setSection] = useState(firstMember?.sectionOrigin === 'catalog' && firstMember.sectionId ? firstMember.sectionId : 'W18x50');
  const [release, setRelease] = useState<Space3DReleasePreset>('pinned-both');
  const [memberType, setMemberType] = useState<'frame' | 'truss'>(firstMember?.type === 'truss' ? 'frame' : 'truss');
  const [loadKind, setLoadKind] = useState<'distributed' | 'point'>('distributed');
  const caseOptions = project.loadCases;
  const [caseId, setCaseId] = useState(caseOptions.some((item) => item.id === defaultCaseId) ? defaultCaseId : caseOptions[0]?.id ?? '');
  const [direction, setDirection] = useState<Space3DMemberLoadDirection>('gravity');
  const [value, setValue] = useState('10');
  const [from, setFrom] = useState('0');
  const [to, setTo] = useState('1');
  const [position, setPosition] = useState('0.5');
  const [mode, setMode] = useState<'add' | 'replace'>('replace');
  const [nodal, setNodal] = useState({ fx: '0', fy: '-10', fz: '0', mx: '0', my: '0', mz: '0' });
  const [support, setSupport] = useState<'fixed' | 'pinned' | 'free'>('fixed');
  const [diaphragmMode, setDiaphragmMode] = useState<'new' | 'remove'>('new');
  const [notice, setNotice] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);

  const sectionPreset = useMemo(() => SPACE3D_SECTION_CATALOG.find((item) => item.name === section), [section]);

  const build = (): Space3DCommand | null | 'invalid' => {
    switch (kind) {
      case 'section': return space3DAssignSectionCommand(members, section);
      case 'releases': return space3DAssignReleasesCommand(project, members, SPACE3D_RELEASE_PRESETS[release]);
      case 'type': return space3DAssignMemberTypeCommand(project, members, memberType);
      case 'support': return space3DAssignRestraintsCommand(nodes, { ...SPACE3D_SUPPORT_RESTRAINTS[support] } as Space3DRestraints);
      case 'diaphragm': {
        const { command, excluded } = space3DAssignDiaphragmCommand(project, nodes, diaphragmMode, t('space3d.diaphragm.defaultName'));
        if (excluded.length > 0) setNotice({ text: t('space3d.diaphragm.excluded', { count: excluded.length }), tone: 'error' });
        return command;
      }
      case 'member-load': {
        const magnitude = numeric(value);
        if (magnitude === null) return 'invalid';
        if (loadKind === 'point') {
          const at = numeric(position);
          if (at === null || at < 0 || at > 1) return 'invalid';
          return space3DAssignPointMemberLoadCommand(project, members, { caseId, direction, value: magnitude, position: at });
        }
        const start = numeric(from);
        const end = numeric(to);
        if (start === null || end === null || start < 0 || end > 1 || !(end > start)) return 'invalid';
        return space3DAssignDistributedLoadCommand(project, members, { caseId, direction, value: magnitude, start, end, mode });
      }
      case 'nodal-load': {
        const parsed = Object.fromEntries(Object.entries(nodal).map(([key, raw]) => [key, numeric(raw)]));
        if (Object.values(parsed).some((item) => item === null)) return 'invalid';
        return space3DAssignNodalLoadCommand(project, nodes, caseId, parsed as Record<'fx' | 'fy' | 'fz' | 'mx' | 'my' | 'mz', number>, mode);
      }
    }
  };

  const apply = () => {
    const command = build();
    if (command === 'invalid') { setNotice({ text: t('space3d.assign.invalid'), tone: 'error' }); return; }
    if (!command) { setNotice({ text: t('space3d.assign.nothing'), tone: 'ok' }); return; }
    const ok = onSubmit(command);
    setNotice(ok ? { text: t('space3d.assign.done', { count }), tone: 'ok' } : null);
  };

  const unit = loadKind === 'point' ? t('space3d.unitForce') : `${t('space3d.unitForce')}/${t('space3d.unitLength')}`;
  const caseSelect = <label className="space3d-field">
    <span className="space3d-field-label">{t('space3d.assign.loadCase')}</span>
    <select value={caseId} onChange={(event) => setCaseId(event.target.value)}>
      {caseOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select>
  </label>;
  const modeRadios = <div className="space3d-assign-radios" role="radiogroup" aria-label={t('space3d.assign.modeReplace')}>
    {(['replace', 'add'] as const).map((option) => <label key={option} className="space3d-assign-radio">
      <input type="radio" name="space3d-assign-mode" checked={mode === option} onChange={() => setMode(option)} />
      <span>{t(option === 'add' ? 'space3d.assign.modeAdd' : 'space3d.assign.modeReplace')}</span>
    </label>)}
  </div>;

  return <form className="space3d-assign" onSubmit={(event) => { event.preventDefault(); apply(); }}>
    <header className="space3d-assign-head">
      <div>
        <h3>{t(TITLES[kind])}</h3>
        <p>{t('space3d.assign.target', { count, what: t(targetsMembers ? 'space3d.assign.targetMembers' : 'space3d.assign.targetNodes') })}</p>
      </div>
      <button type="button" className="space3d-tool" onClick={onClose} aria-label={t('space3d.assign.close')} title={t('space3d.assign.close')}><X size={16} aria-hidden="true" /></button>
    </header>

    {kind === 'section' ? <>
      <label className="space3d-field">
        <span className="space3d-field-label">{t('space3d.assign.sectionLabel')}</span>
        <select value={section} onChange={(event) => setSection(event.target.value)}>
          {MATERIAL_GROUPS.map(({ material, sections }) => <optgroup key={material.id} label={material.name}>
            {sections.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
          </optgroup>)}
        </select>
      </label>
      {sectionPreset ? <dl className="space3d-assign-props">
        <div><dt>A</dt><dd>{(sectionPreset.A * 1e4).toPrecision(4)} cm²</dd></div>
        <div><dt>I₃₃</dt><dd>{(sectionPreset.Iz * 1e8).toPrecision(4)} cm⁴</dd></div>
        <div><dt>I₂₂</dt><dd>{(sectionPreset.Iy * 1e8).toPrecision(4)} cm⁴</dd></div>
        <div><dt>J</dt><dd>{(sectionPreset.J * 1e8).toPrecision(4)} cm⁴</dd></div>
      </dl> : null}
    </> : null}

    {kind === 'releases' ? <>
      <div className="space3d-assign-radios" role="radiogroup" aria-label={t('space3d.assign.titleReleases')}>
        {RELEASE_OPTIONS.map((option) => <label key={option.id} className="space3d-assign-radio">
          <input type="radio" name="space3d-assign-release" checked={release === option.id} onChange={() => setRelease(option.id)} />
          <span>{t(option.key)}</span>
        </label>)}
      </div>
      <p className="space3d-field-hint">{t('space3d.assign.releasesHint')}</p>
    </> : null}

    {kind === 'type' ? <div className="space3d-assign-radios" role="radiogroup" aria-label={t('space3d.assign.titleType')}>
      {(['frame', 'truss'] as const).map((option) => <label key={option} className="space3d-assign-radio">
        <input type="radio" name="space3d-assign-type" checked={memberType === option} onChange={() => setMemberType(option)} />
        <span>{t(option === 'frame' ? 'space3d.assign.typeFrame' : 'space3d.assign.typeTruss')}</span>
      </label>)}
    </div> : null}

    {kind === 'support' ? <div className="space3d-assign-radios" role="radiogroup" aria-label={t('space3d.assign.titleSupport')}>
      {SUPPORTS.map((option) => <label key={option.id} className="space3d-assign-radio">
        <input type="radio" name="space3d-assign-support" checked={support === option.id} onChange={() => setSupport(option.id)} />
        <span>{t(option.key)}</span>
      </label>)}
    </div> : null}

    {kind === 'diaphragm' ? <>
      <div className="space3d-assign-radios" role="radiogroup" aria-label={t('space3d.assign.titleDiaphragm')}>
        {(['new', 'remove'] as const).map((option) => <label key={option} className="space3d-assign-radio">
          <input type="radio" name="space3d-assign-diaphragm" checked={diaphragmMode === option} onChange={() => setDiaphragmMode(option)} />
          <span>{t(option === 'new' ? 'space3d.diaphragm.assignNew' : 'space3d.diaphragm.assignRemove')}</span>
        </label>)}
      </div>
      <p className="space3d-field-hint">{t('space3d.diaphragm.hint')}</p>
      <button type="button" className="space3d-button" onClick={() => {
        const command = space3DStoryDiaphragmsCommand(project);
        if (!command) { setNotice({ text: t('space3d.diaphragm.noStories'), tone: 'error' }); return; }
        if (onSubmit(command)) setNotice({ text: t('space3d.diaphragm.perStoryDone'), tone: 'ok' });
      }}>{t('space3d.diaphragm.perStory')}</button>
    </> : null}

    {kind === 'member-load' ? <>
      <div className="space3d-assign-radios space3d-assign-radios--inline" role="radiogroup" aria-label={t('space3d.assign.loadKind')}>
        {(['distributed', 'point'] as const).map((option) => <label key={option} className="space3d-assign-radio">
          <input type="radio" name="space3d-assign-load-kind" checked={loadKind === option} onChange={() => setLoadKind(option)} />
          <span>{t(option === 'distributed' ? 'space3d.assign.loadUniform' : 'space3d.assign.loadPoint')}</span>
        </label>)}
      </div>
      {caseSelect}
      <div className="space3d-field-grid">
        <label className="space3d-field">
          <span className="space3d-field-label">{t('space3d.assign.direction')}</span>
          <select value={direction} onChange={(event) => setDirection(event.target.value as Space3DMemberLoadDirection)}>
            {DIRECTIONS.map((option) => <option key={option.id} value={option.id}>{t(option.key)}</option>)}
          </select>
        </label>
        <label className="space3d-field">
          <span className="space3d-field-label">{t('space3d.assign.value')} ({unit})</span>
          <input type="text" inputMode="decimal" value={value} onChange={(event) => setValue(event.target.value)} />
        </label>
      </div>
      {loadKind === 'distributed' ? <div className="space3d-field-grid">
        <label className="space3d-field">
          <span className="space3d-field-label">{t('space3d.assign.from')}</span>
          <input type="text" inputMode="decimal" value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label className="space3d-field">
          <span className="space3d-field-label">{t('space3d.assign.to')}</span>
          <input type="text" inputMode="decimal" value={to} onChange={(event) => setTo(event.target.value)} />
        </label>
      </div> : <label className="space3d-field">
        <span className="space3d-field-label">{t('space3d.assign.position')}</span>
        <input type="text" inputMode="decimal" value={position} onChange={(event) => setPosition(event.target.value)} />
      </label>}
      {loadKind === 'distributed' ? modeRadios : null}
    </> : null}

    {kind === 'nodal-load' ? <>
      {caseSelect}
      <fieldset className="space3d-fieldset">
        <legend>{t('space3d.assign.nodalComponents')}</legend>
        <div className="space3d-field-grid space3d-field-grid--3">
          {(['fx', 'fy', 'fz', 'mx', 'my', 'mz'] as const).map((key) => <label key={key} className="space3d-field">
            <span className="space3d-field-label">{key.toUpperCase()}</span>
            <input type="text" inputMode="decimal" value={nodal[key]} onChange={(event) => setNodal((current) => ({ ...current, [key]: event.target.value }))} />
          </label>)}
        </div>
      </fieldset>
      {modeRadios}
    </> : null}

    {notice ? <p className={`space3d-notice ${notice.tone === 'ok' ? 'space3d-notice--ok' : 'space3d-notice--error'}`} role="status">{notice.text}</p> : null}

    <footer className="space3d-editor-actions">
      <button type="submit" className="space3d-button space3d-button--primary" disabled={count === 0}><Check size={16} aria-hidden="true" />{t('space3d.assign.apply')}</button>
      <button type="button" className="space3d-button" onClick={onClose}>{t('space3d.assign.close')}</button>
    </footer>
  </form>;
};
