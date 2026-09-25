/**
 * Diálogos de «Definir»: rejilla de ejes y pisos, casos de carga y
 * combinaciones, catálogo de secciones, y la plantilla de edificio.
 *
 * Todo lo que guardan son comandos del store: se deshacen como cualquier
 * edición y el validador los rechaza si rompen el modelo.
 */
import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Dialog } from '../../../../design-system/components/overlays';
import type { TranslationKey } from '../../i18n/catalogs';
import type { Space3DCommand } from '../../space3d/data/commands';
import type { Space3DGridSystem, Space3DLoadCase, Space3DProjectV1 } from '../../space3d/model/types';
import { createSpace3DGrid, space3DSpacings, type Space3DResolvedGrid } from '../../space3d/model/grid';
import { SPACE3D_MATERIALS, SPACE3D_SECTION_CATALOG, type Space3DSectionShape } from '../../space3d/model/sectionLibrary';
import { generateSpace3DBuilding } from '../../space3d/engine/buildingTemplate';
import {
  formatSpace3DCombinationTerms, formatSpace3DSpacings, parseSpace3DCombinationTerms, parseSpace3DSpacings,
} from './space3dDefine';
import { formatSpace3DNumber } from './space3dNumberFormat';

type Translate = (key: TranslationKey, variables?: Record<string, string | number>) => string;

// ───────────────────────────── Rejilla ─────────────────────────────

interface GridDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly t: Translate;
  readonly grid: Space3DResolvedGrid;
  readonly onSubmit: (command: Space3DCommand) => boolean;
}

export const Space3DGridDialog = ({ open, onOpenChange, t, grid, onSubmit }: GridDialogProps) => {
  const initial = useMemo(() => ({
    x: formatSpace3DSpacings(space3DSpacings(grid.xLines.map((line) => line.coordinate))),
    z: formatSpace3DSpacings(space3DSpacings(grid.zLines.map((line) => line.coordinate))),
    stories: formatSpace3DSpacings(space3DSpacings(grid.stories.map((story) => story.elevation))),
    origin: [grid.xLines[0]?.coordinate ?? 0, grid.stories[0]?.elevation ?? 0, grid.zLines[0]?.coordinate ?? 0] as const,
  }), [grid]);
  const [x, setX] = useState(initial.x);
  const [z, setZ] = useState(initial.z);
  const [stories, setStories] = useState(initial.stories);
  useEffect(() => {
    if (!open) return;
    setX(initial.x); setZ(initial.z); setStories(initial.stories);
  }, [initial, open]);

  const parsed = { x: parseSpace3DSpacings(x), z: parseSpace3DSpacings(z), stories: parseSpace3DSpacings(stories) };
  const valid = parsed.x !== null && parsed.z !== null && parsed.stories !== null;
  const next: Space3DGridSystem | null = valid
    ? createSpace3DGrid({ xSpacings: parsed.x!, zSpacings: parsed.z!, storyHeights: parsed.stories!, origin: initial.origin })
    : null;

  return <Dialog
    open={open}
    onOpenChange={onOpenChange}
    title={t('space3d.define.gridTitle')}
    description={t('space3d.grid.spacingsHint')}
    closeLabel={t('space3d.assign.close')}
    className="space3d-define-dialog"
    footer={<>
      {!grid.automatic ? <button type="button" className="space3d-button space3d-button--ghost" onClick={() => { if (onSubmit({ kind: 'set-grid', grid: null })) onOpenChange(false); }}>{t('space3d.grid.remove')}</button> : null}
      <button type="button" className="space3d-button" onClick={() => onOpenChange(false)}>{t('space3d.importCancel')}</button>
      <button type="button" className="space3d-button space3d-button--primary" disabled={!next}
        onClick={() => { if (next && onSubmit({ kind: 'set-grid', grid: next })) onOpenChange(false); }}>{t('space3d.grid.save')}</button>
    </>}
  >
    {grid.automatic ? <p className="space3d-notice">{t('space3d.grid.automaticNote')}</p> : null}
    <div className="space3d-define-fields">
      <label className="space3d-field">
        <span className="space3d-field-label">{t('space3d.grid.xSpacings')}</span>
        <input type="text" value={x} onChange={(event) => setX(event.target.value)} aria-invalid={parsed.x === null || undefined} />
      </label>
      <label className="space3d-field">
        <span className="space3d-field-label">{t('space3d.grid.zSpacings')}</span>
        <input type="text" value={z} onChange={(event) => setZ(event.target.value)} aria-invalid={parsed.z === null || undefined} />
      </label>
      <label className="space3d-field">
        <span className="space3d-field-label">{t('space3d.grid.storyHeights')}</span>
        <input type="text" value={stories} onChange={(event) => setStories(event.target.value)} aria-invalid={parsed.stories === null || undefined} />
      </label>
    </div>
    <p className="space3d-field-hint" role="status">
      {next ? t('space3d.grid.preview', { x: next.xLines.length, z: next.zLines.length, stories: next.stories.length }) : t('space3d.grid.invalid')}
    </p>
  </Dialog>;
};

// ───────────────────────── Casos y combinaciones ─────────────────────────

interface LoadsDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly t: Translate;
  readonly project: Space3DProjectV1;
  readonly onSubmit: (command: Space3DCommand) => boolean;
}

const CATEGORY_KEYS: Record<NonNullable<Space3DLoadCase['category']>, TranslationKey> = {
  permanent: 'inspector.loadCaseCategoryPermanent',
  variable: 'inspector.loadCaseCategoryVariable',
  accidental: 'inspector.loadCaseCategoryAccidental',
  other: 'inspector.loadCaseCategoryOther',
};

const freshId = (prefix: string, used: readonly string[]) => {
  let index = used.length + 1;
  while (used.includes(`${prefix}${index}`)) index += 1;
  return `${prefix}${index}`;
};

export const Space3DLoadsDialog = ({ open, onOpenChange, t, project, onSubmit }: LoadsDialogProps) => {
  const [error, setError] = useState<string | null>(null);
  const [termsDraft, setTermsDraft] = useState<Record<string, string>>({});
  useEffect(() => { if (open) { setError(null); setTermsDraft({}); } }, [open]);
  const allIds = [...project.loadCases.map((item) => item.id), ...project.loadCombinations.map((item) => item.id)];

  const updateCase = (loadCase: Space3DLoadCase) => {
    setError(null);
    onSubmit({ kind: 'upsert-load-case', loadCase });
  };

  return <Dialog
    open={open}
    onOpenChange={onOpenChange}
    title={t('space3d.define.loadsTitle')}
    description={t('space3d.loads.generic')}
    closeLabel={t('space3d.assign.close')}
    className="space3d-define-dialog space3d-define-dialog--wide"
    footer={<button type="button" className="space3d-button space3d-button--primary" onClick={() => onOpenChange(false)}>{t('space3d.assign.close')}</button>}
  >
    <section className="space3d-define-block">
      <header>
        <h3>{t('space3d.loads.cases')}</h3>
        <button type="button" className="space3d-button" onClick={() => {
          const id = freshId('LC', allIds);
          onSubmit({ kind: 'upsert-load-case', loadCase: { id, name: `${t('space3d.loads.newCaseName')} ${id}`, category: 'other' } });
        }}><Plus size={15} aria-hidden="true" />{t('space3d.loads.addCase')}</button>
      </header>
      <table className="space3d-define-table">
        <thead><tr>
          <th scope="col">{t('space3d.loads.caseId')}</th>
          <th scope="col">{t('space3d.loads.caseName')}</th>
          <th scope="col">{t('space3d.loads.caseCategory')}</th>
          <th scope="col">{t('space3d.loads.selfWeight')}</th>
          <th scope="col"><span className="space3d-visually-hidden">{t('space3d.deleteEntity')}</span></th>
        </tr></thead>
        <tbody>
          {project.loadCases.map((loadCase) => <tr key={loadCase.id}>
            <th scope="row"><code>{loadCase.id}</code></th>
            <td><input type="text" defaultValue={loadCase.name} aria-label={`${t('space3d.loads.caseName')} ${loadCase.id}`}
              onBlur={(event) => { if (event.target.value.trim() && event.target.value !== loadCase.name) updateCase({ ...loadCase, name: event.target.value.trim() }); }} /></td>
            <td>
              <select value={loadCase.category ?? 'other'} aria-label={`${t('space3d.loads.caseCategory')} ${loadCase.id}`}
                onChange={(event) => updateCase({ ...loadCase, category: event.target.value as Space3DLoadCase['category'] })}>
                {(Object.keys(CATEGORY_KEYS) as (keyof typeof CATEGORY_KEYS)[]).map((category) => <option key={category} value={category}>{t(CATEGORY_KEYS[category])}</option>)}
              </select>
            </td>
            <td><input type="text" inputMode="decimal" defaultValue={String(loadCase.selfWeightFactor ?? 0)} aria-label={`${t('space3d.loads.selfWeight')} ${loadCase.id}`}
              onBlur={(event) => {
                const value = Number(event.target.value.replace(',', '.'));
                if (!Number.isFinite(value)) { setError(t('space3d.assign.invalid')); return; }
                if (value === (loadCase.selfWeightFactor ?? 0)) return;
                const { selfWeightFactor: _previous, ...rest } = loadCase;
                updateCase(value === 0 ? rest : { ...rest, selfWeightFactor: value });
              }} /></td>
            <td><button type="button" className="space3d-tool" aria-label={t('space3d.loads.deleteCase', { id: loadCase.id })} title={t('space3d.loads.deleteCase', { id: loadCase.id })}
              disabled={project.loadCases.length <= 1}
              onClick={() => { if (!onSubmit({ kind: 'delete-load-case', caseId: loadCase.id })) setError(t('space3d.loads.caseInUse')); }}><Trash2 size={15} aria-hidden="true" /></button></td>
          </tr>)}
        </tbody>
      </table>
    </section>

    <section className="space3d-define-block">
      <header>
        <h3>{t('space3d.loads.combinations')}</h3>
        <button type="button" className="space3d-button" disabled={project.loadCases.length === 0} onClick={() => {
          const id = freshId('CO', allIds);
          onSubmit({ kind: 'upsert-combination', combination: { id, name: id, terms: project.loadCases.map((loadCase) => ({ caseId: loadCase.id, factor: 1 })) } });
        }}><Plus size={15} aria-hidden="true" />{t('space3d.loads.addCombination')}</button>
      </header>
      <table className="space3d-define-table">
        <thead><tr>
          <th scope="col">{t('space3d.loads.caseId')}</th>
          <th scope="col">{t('space3d.loads.caseName')}</th>
          <th scope="col">{t('space3d.loads.terms')}</th>
          <th scope="col"><span className="space3d-visually-hidden">{t('space3d.deleteEntity')}</span></th>
        </tr></thead>
        <tbody>
          {project.loadCombinations.map((combination) => {
            const draft = termsDraft[combination.id] ?? formatSpace3DCombinationTerms(combination.terms);
            return <tr key={combination.id}>
              <th scope="row"><code>{combination.id}</code></th>
              <td><input type="text" defaultValue={combination.name} aria-label={`${t('space3d.loads.caseName')} ${combination.id}`}
                onBlur={(event) => { if (event.target.value.trim() && event.target.value !== combination.name) onSubmit({ kind: 'upsert-combination', combination: { ...combination, name: event.target.value.trim() } }); }} /></td>
              <td><input type="text" value={draft} placeholder={t('space3d.loads.termsHint')} aria-label={`${t('space3d.loads.terms')} ${combination.id}`}
                onChange={(event) => setTermsDraft((current) => ({ ...current, [combination.id]: event.target.value }))}
                onBlur={() => {
                  if (termsDraft[combination.id] === undefined) return;
                  const terms = parseSpace3DCombinationTerms(draft, project.loadCases);
                  if (!terms) { setError(t('space3d.loads.combinationInvalid')); return; }
                  setError(null);
                  if (onSubmit({ kind: 'upsert-combination', combination: { ...combination, terms } })) {
                    setTermsDraft((current) => { const { [combination.id]: _drop, ...rest } = current; return rest; });
                  }
                }} /></td>
              <td><button type="button" className="space3d-tool" aria-label={t('space3d.loads.deleteCombination', { id: combination.id })} title={t('space3d.loads.deleteCombination', { id: combination.id })}
                onClick={() => onSubmit({ kind: 'delete-combination', combinationId: combination.id })}><Trash2 size={15} aria-hidden="true" /></button></td>
            </tr>;
          })}
        </tbody>
      </table>
    </section>
    {error ? <p className="space3d-notice space3d-notice--error" role="alert">{error}</p> : null}
  </Dialog>;
};

// ───────────────────────────── Secciones ─────────────────────────────

interface SectionsDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly t: Translate;
  readonly selectedMembers: number;
  readonly onAssign: (sectionName: string) => void;
}

const SHAPE_KEYS: Record<Space3DSectionShape, TranslationKey> = {
  I: 'space3d.sections.shapeI',
  box: 'space3d.sections.shapeBox',
  pipe: 'space3d.sections.shapePipe',
  rect: 'space3d.sections.shapeRect',
  circle: 'space3d.sections.shapeCircle',
};

export const Space3DSectionsDialog = ({ open, onOpenChange, t, selectedMembers, onAssign }: SectionsDialogProps) => {
  const [chosen, setChosen] = useState<string | null>(null);
  useEffect(() => { if (open) setChosen(null); }, [open]);
  const materialName = (id: string) => SPACE3D_MATERIALS.find((material) => material.id === id)?.name ?? id;
  const precision = (value: number) => Number(value.toPrecision(4)).toLocaleString();

  return <Dialog
    open={open}
    onOpenChange={onOpenChange}
    title={t('space3d.define.sectionsTitle')}
    description={selectedMembers > 0 ? t('space3d.sections.selectHint') : undefined}
    closeLabel={t('space3d.assign.close')}
    className="space3d-define-dialog space3d-define-dialog--wide"
    footer={<>
      <button type="button" className="space3d-button" onClick={() => onOpenChange(false)}>{t('space3d.assign.close')}</button>
      {selectedMembers > 0 ? <button type="button" className="space3d-button space3d-button--primary" disabled={!chosen}
        onClick={() => { if (chosen) { onAssign(chosen); onOpenChange(false); } }}>{t('space3d.sections.assignToSelection', { count: selectedMembers })}</button> : null}
    </>}
  >
    <section className="space3d-define-block">
      <h3>{t('space3d.sections.materials')}</h3>
      <table className="space3d-define-table">
        <thead><tr>
          <th scope="col">{t('space3d.sections.material')}</th>
          <th scope="col">{t('space3d.sections.modulus')}</th>
          <th scope="col">{t('space3d.sections.density')}</th>
        </tr></thead>
        <tbody>
          {SPACE3D_MATERIALS.map((material) => <tr key={material.id}>
            <th scope="row">{material.name}</th>
            <td>{precision(material.E / 1e6)}</td>
            <td>{material.massDensityKgPerM3}</td>
          </tr>)}
        </tbody>
      </table>
    </section>
    <section className="space3d-define-block">
      <h3>{t('space3d.define.sections')}</h3>
      <table className="space3d-define-table space3d-define-table--pick">
        <thead><tr>
          <th scope="col">{t('space3d.sections.name')}</th>
          <th scope="col">{t('space3d.sections.shape')}</th>
          <th scope="col">{t('space3d.sections.area')}</th>
          <th scope="col">{t('space3d.sections.inertiaMajor')}</th>
          <th scope="col">{t('space3d.sections.inertiaMinor')}</th>
          <th scope="col">{t('space3d.sections.material')}</th>
        </tr></thead>
        <tbody>
          {SPACE3D_SECTION_CATALOG.map((section) => <tr key={section.name} aria-selected={chosen === section.name}
            onClick={() => selectedMembers > 0 && setChosen(section.name)}>
            <th scope="row">{selectedMembers > 0
              ? <label><input type="radio" name="space3d-section-pick" checked={chosen === section.name} onChange={() => setChosen(section.name)} /> {section.name}</label>
              : section.name}</th>
            <td>{t(SHAPE_KEYS[section.shape])}</td>
            <td>{precision(section.A * 1e4)}</td>
            <td>{precision(section.Iz * 1e8)}</td>
            <td>{precision(section.Iy * 1e8)}</td>
            <td>{materialName(section.materialId)}</td>
          </tr>)}
        </tbody>
      </table>
    </section>
  </Dialog>;
};

// ───────────────────────── Plantilla de edificio ─────────────────────────

interface BuildingDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly t: Translate;
  readonly onCreate: (project: Space3DProjectV1) => void;
}

const COLUMN_SECTIONS = SPACE3D_SECTION_CATALOG.filter((section) => section.shape !== 'pipe').map((section) => section.name);

export const Space3DBuildingDialog = ({ open, onOpenChange, t, onCreate }: BuildingDialogProps) => {
  const [x, setX] = useState('3*6');
  const [z, setZ] = useState('2*5');
  const [stories, setStories] = useState('4 3*3.2');
  const [column, setColumn] = useState('W14x90');
  const [beam, setBeam] = useState('W18x50');
  const [dead, setDead] = useState('2.5');
  const [live, setLive] = useState('2');
  const [lateral, setLateral] = useState('0.1');
  const [base, setBase] = useState<'fixed' | 'pinned'>('fixed');
  const [error, setError] = useState<string | null>(null);

  const parsed = { x: parseSpace3DSpacings(x), z: parseSpace3DSpacings(z), stories: parseSpace3DSpacings(stories) };
  const numbers = { dead: Number(dead.replace(',', '.')), live: Number(live.replace(',', '.')), lateral: Number(lateral.replace(',', '.')) };
  const valid = parsed.x?.length && parsed.z?.length && parsed.stories?.length
    && [numbers.dead, numbers.live, numbers.lateral].every((value) => Number.isFinite(value) && value >= 0);
  const counts = valid ? {
    nodes: (parsed.x!.length + 1) * (parsed.z!.length + 1) * (parsed.stories!.length + 1),
    members: parsed.stories!.length * ((parsed.x!.length + 1) * (parsed.z!.length + 1) + parsed.x!.length * (parsed.z!.length + 1) + (parsed.x!.length + 1) * parsed.z!.length),
  } : null;

  const create = () => {
    if (!valid) { setError(t('space3d.building.invalid')); return; }
    try {
      onCreate(generateSpace3DBuilding({
        xSpacings: parsed.x!, zSpacings: parsed.z!, storyHeights: parsed.stories!,
        columnSection: column, beamSection: beam, superDeadLoad: numbers.dead, liveLoad: numbers.live,
        lateralCoefficient: numbers.lateral, baseSupport: base,
      }));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const sectionSelect = (label: string, value: string, onChange: (value: string) => void) => <label className="space3d-field">
    <span className="space3d-field-label">{label}</span>
    <select value={value} onChange={(event) => onChange(event.target.value)}>
      {COLUMN_SECTIONS.map((name) => <option key={name} value={name}>{name}</option>)}
    </select>
  </label>;
  const textField = (label: string, value: string, onChange: (value: string) => void, invalid = false) => <label className="space3d-field">
    <span className="space3d-field-label">{label}</span>
    <input type="text" value={value} onChange={(event) => onChange(event.target.value)} aria-invalid={invalid || undefined} />
  </label>;

  return <Dialog
    open={open}
    onOpenChange={onOpenChange}
    title={t('space3d.building.title')}
    description={t('space3d.building.description')}
    closeLabel={t('space3d.assign.close')}
    className="space3d-define-dialog"
    footer={<>
      <button type="button" className="space3d-button" onClick={() => onOpenChange(false)}>{t('space3d.importCancel')}</button>
      <button type="button" className="space3d-button space3d-button--primary" disabled={!valid} onClick={create}>{t('space3d.building.create')}</button>
    </>}
  >
    <div className="space3d-define-fields">
      {textField(t('space3d.grid.xSpacings'), x, setX, parsed.x === null)}
      {textField(t('space3d.grid.zSpacings'), z, setZ, parsed.z === null)}
      {textField(t('space3d.grid.storyHeights'), stories, setStories, parsed.stories === null)}
      <p className="space3d-field-hint">{t('space3d.grid.spacingsHint')}</p>
      <div className="space3d-field-grid">
        {sectionSelect(t('space3d.building.columns'), column, setColumn)}
        {sectionSelect(t('space3d.building.beams'), beam, setBeam)}
      </div>
      <div className="space3d-field-grid space3d-field-grid--3">
        {textField(t('space3d.building.superDead'), dead, setDead)}
        {textField(t('space3d.building.live'), live, setLive)}
        {textField(t('space3d.building.lateral'), lateral, setLateral)}
      </div>
      <div className="space3d-assign-radios space3d-assign-radios--inline" role="radiogroup" aria-label={t('space3d.building.base')}>
        {(['fixed', 'pinned'] as const).map((option) => <label key={option} className="space3d-assign-radio">
          <input type="radio" name="space3d-building-base" checked={base === option} onChange={() => setBase(option)} />
          <span>{t(option === 'fixed' ? 'space3d.building.baseFixed' : 'space3d.building.basePinned')}</span>
        </label>)}
      </div>
    </div>
    <p className="space3d-field-hint" role="status">{counts
      ? t('space3d.building.summary', { nodes: formatSpace3DNumber(counts.nodes), members: formatSpace3DNumber(counts.members), stories: parsed.stories!.length })
      : t('space3d.building.invalid')}</p>
    <p className="space3d-field-hint">{t('space3d.building.note')}</p>
    {error ? <p className="space3d-notice space3d-notice--error" role="alert">{error}</p> : null}
  </Dialog>;
};
