/**
 * Formularios autoritativos de Space 3D.
 *
 * Todo campo numérico es un borrador de texto: se escribe libre y sólo se
 * convierte al confirmar. Convertir en cada pulsación impide escribir «-», «0.»
 * o «1e-» y obliga a inventar un valor mientras el usuario todavía teclea.
 *
 * No se crean coordenadas con un clic en la escena: en tres dimensiones un
 * punto de pantalla es una recta, no un punto, y adivinar la profundidad
 * produciría geometría que el usuario no ha decidido.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, Trash2 } from 'lucide-react';
import { fixedSpace3DRestraints, freeSpace3DRestraints, type Space3DFrameMember, type Space3DNodalLoad, type Space3DNode, type Space3DProjectV1, type Space3DRestraints } from '../../space3d/model/types';
import {
  SPACE3D_MATERIALS,
  SPACE3D_SECTION_CATALOG,
  calculateCircularSection,
  calculateRectangularSection,
  getSectionsByCategory,
} from '../../space3d/model/sectionLibrary';
import type { Space3DCommand } from '../../space3d/data/commands';
import type { TranslationKey } from '../../i18n/catalogs';
import { SPACE3D_SUPPORT_RESTRAINTS, space3DSupportKind, type Space3DSupportKind } from './space3dSupportKind';

export type Space3DEditorTarget =
  | { readonly kind: 'node'; readonly id: string | null }
  | { readonly kind: 'member'; readonly id: string | null }
  | { readonly kind: 'load'; readonly id: string | null; readonly initialNodeId?: string };

interface Space3DEntityEditorProps {
  readonly project: Space3DProjectV1;
  readonly target: Space3DEditorTarget;
  readonly t: (key: TranslationKey, variables?: Record<string, string | number>) => string;
  readonly onSubmit: (command: Space3DCommand) => boolean;
  readonly onCancel: () => void;
  readonly onDelete?: (target: Space3DEditorTarget) => void;
  /** Lleva el foco al botón de volver: sólo cuando el editor se abrió desde una lista. */
  readonly focusOnOpen?: boolean;
}

type Draft = Record<string, string>;

const TRANSLATION_DOFS = ['ux', 'uy', 'uz'] as const;
const ROTATION_DOFS = ['rx', 'ry', 'rz'] as const;
const DOF_AXIS = { ux: 'X', uy: 'Y', uz: 'Z', rx: 'X', ry: 'Y', rz: 'Z' } as const;
const SUPPORT_PRESETS: readonly { readonly id: Space3DSupportKind; readonly label: TranslationKey; readonly hint: TranslationKey }[] = [
  { id: 'free', label: 'space3d.supportPresetFree', hint: 'space3d.supportPresetFreeHint' },
  { id: 'pinned', label: 'space3d.supportPresetPinned', hint: 'space3d.supportPresetPinnedHint' },
  { id: 'fixed', label: 'space3d.supportPresetFixed', hint: 'space3d.supportPresetFixedHint' },
  { id: 'custom', label: 'space3d.supportPresetCustom', hint: 'space3d.supportPresetCustomHint' },
];
const LOAD_KEYS = ['fx', 'fy', 'fz', 'mx', 'my', 'mz'] as const;
const PROPERTY_KEYS = ['E', 'G', 'A', 'Iy', 'Iz', 'J'] as const;

const nextId = (prefix: string, used: readonly string[]): string => {
  let index = used.length + 1;
  while (used.includes(`${prefix}${index}`)) index += 1;
  return `${prefix}${index}`;
};

const numeric = (value: string): number | null => {
  const trimmed = value.trim().replace(',', '.');
  if (trimmed === '') return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

const nodeDraft = (node: Space3DNode | undefined): Draft => ({
  x: String(node?.x ?? 0),
  y: String(node?.y ?? 0),
  z: String(node?.z ?? 0),
});

const memberDraft = (member: Space3DFrameMember | undefined, fallback: Space3DFrameMember | undefined): Draft => {
  const source = member ?? fallback;
  return {
    E: String(source?.E ?? 200_000_000),
    G: String(source?.G ?? 77_000_000),
    A: String(source?.A ?? 0.0076),
    Iy: String(source?.Iy ?? 4.5e-5),
    Iz: String(source?.Iz ?? 1.36e-4),
    J: String(source?.J ?? 4e-7),
    refX: String(source?.orientation.localYReferenceGlobal[0] ?? 0),
    refY: String(source?.orientation.localYReferenceGlobal[1] ?? 1),
    refZ: String(source?.orientation.localYReferenceGlobal[2] ?? 0),
    roll: String(source?.orientation.rollRadians ?? 0),
  };
};

const loadDraft = (load: Space3DNodalLoad | undefined): Draft => ({
  fx: String(load?.fx ?? 0),
  fy: String(load?.fy ?? 0),
  fz: String(load?.fz ?? 0),
  mx: String(load?.mx ?? 0),
  my: String(load?.my ?? 0),
  mz: String(load?.mz ?? 0),
});

export const Space3DEntityEditor = ({ project, target, t, onSubmit, onCancel, onDelete, focusOnOpen = false }: Space3DEntityEditorProps) => {
  const node = target.kind === 'node' ? project.nodes.find((item) => item.id === target.id) : undefined;
  const member = target.kind === 'member' ? project.members.find((item) => item.id === target.id) : undefined;
  const load = target.kind === 'load' ? project.nodalLoads.find((item) => item.id === target.id) : undefined;

  const initialDraft = useMemo(() => {
    if (target.kind === 'node') return nodeDraft(node);
    if (target.kind === 'member') return memberDraft(member, project.members[0]);
    return loadDraft(load);
  }, [load, member, node, project.members, target.kind]);

  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [restraints, setRestraints] = useState<Space3DRestraints>(node?.restraints ?? freeSpace3DRestraints());
  const [endI, setEndI] = useState(member?.i ?? project.nodes[0]?.id ?? '');
  const [endJ, setEndJ] = useState(member?.j ?? project.nodes[1]?.id ?? '');
  const initialLoadNodeId = load?.nodeId ?? (target.kind === 'load' ? target.initialNodeId : undefined) ?? project.nodes[0]?.id ?? '';
  const [loadNodeId, setLoadNodeId] = useState(initialLoadNodeId);
  const [loadCaseId, setLoadCaseId] = useState(load?.caseId ?? project.loadCases[0]?.id ?? '');
  const [catalogCategory, setCatalogCategory] = useState<'all' | 'steel' | 'concrete' | 'timber' | 'aluminum'>('all');
  const [selectedSectionId, setSelectedSectionId] = useState(
    member?.sectionOrigin === 'catalog' && SPACE3D_SECTION_CATALOG.some((section) => section.name === member.sectionId)
      ? member.sectionId ?? ''
      : '',
  );
  const [selectedMaterialId, setSelectedMaterialId] = useState(
    member?.materialOrigin === 'catalog' && SPACE3D_MATERIALS.some((material) => material.id === member.materialId)
      ? member.materialId ?? ''
      : '',
  );
  const [calcB, setCalcB] = useState('0.30');
  const [calcH, setCalcH] = useState('0.40');
  const [calcDia, setCalcDia] = useState('0.25');
  const [memberMetadata, setMemberMetadata] = useState<{
    materialId?: string;
    materialOrigin?: Space3DFrameMember['materialOrigin'];
    sectionId?: string;
    sectionOrigin?: Space3DFrameMember['sectionOrigin'];
    density?: number;
  }>({
    materialId: member?.materialId,
    materialOrigin: member?.materialOrigin,
    sectionId: member?.sectionId,
    sectionOrigin: member?.sectionOrigin,
    density: member?.density,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [customSupport, setCustomSupport] = useState(false);
  const backRef = useRef<HTMLButtonElement>(null);

  const availableSections = useMemo(() => getSectionsByCategory(catalogCategory), [catalogCategory]);
  const selectedSectionPreset = SPACE3D_SECTION_CATALOG.find((section) => section.name === selectedSectionId);
  const sectionOptions = selectedSectionPreset && !availableSections.some((section) => section.name === selectedSectionPreset.name)
    ? [selectedSectionPreset, ...availableSections]
    : availableSections;

  const key = `${target.kind}:${target.id ?? 'new'}:${target.kind === 'load' ? target.initialNodeId ?? '' : ''}`;
  useEffect(() => {
    setDraft(initialDraft);
    setRestraints(node?.restraints ?? freeSpace3DRestraints());
    setEndI(member?.i ?? project.nodes[0]?.id ?? '');
    setEndJ(member?.j ?? project.nodes[1]?.id ?? '');
    setLoadNodeId(initialLoadNodeId);
    setLoadCaseId(load?.caseId ?? project.loadCases[0]?.id ?? '');
    setSelectedSectionId(
      member?.sectionOrigin === 'catalog' && SPACE3D_SECTION_CATALOG.some((section) => section.name === member.sectionId)
        ? member.sectionId ?? ''
        : '',
    );
    setSelectedMaterialId(
      member?.materialOrigin === 'catalog' && SPACE3D_MATERIALS.some((material) => material.id === member.materialId)
        ? member.materialId ?? ''
        : '',
    );
    setMemberMetadata({
      materialId: member?.materialId,
      materialOrigin: member?.materialOrigin,
      sectionId: member?.sectionId,
      sectionOrigin: member?.sectionOrigin,
      density: member?.density,
    });
    setErrors({});
    setCustomSupport(false);
    // Un cambio de entidad recarga el borrador entero; el resto de dependencias
    // son el propio proyecto, que no debe pisar lo que el usuario está tecleando.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (focusOnOpen) backRef.current?.focus({ preventScroll: true });
  }, [focusOnOpen, key]);

  const header = (kindKey: TranslationKey, id: string) => <header className="space3d-editor-head">
    <button type="button" ref={backRef} className="space3d-editor-back" onClick={onCancel}>
      <ArrowLeft size={16} aria-hidden="true" />{t('space3d.backToModel')}
    </button>
    <h3>
      <span>{target.id ? t(kindKey) : t(kindKey === 'space3d.node' ? 'space3d.newNode' : kindKey === 'space3d.member' ? 'space3d.newMember' : 'space3d.newLoad')}</span>
      <code>{id}</code>
    </h3>
  </header>;

  const footer = (saveKey: TranslationKey) => <footer className="space3d-editor-actions">
    <button type="submit" className="space3d-button space3d-button--primary"><Check size={16} aria-hidden="true" />{t(saveKey)}</button>
    <button type="button" className="space3d-button" onClick={onCancel}>{t('space3d.cancelEdit')}</button>
    {target.id && onDelete
      ? <button type="button" className="space3d-button space3d-button--danger" onClick={() => onDelete(target)}>
        <Trash2 size={16} aria-hidden="true" />{t('space3d.deleteEntity')}
      </button>
      : null}
  </footer>;

  /**
   * La unidad va fuera del `<label>` y se enlaza con `aria-describedby`: si
   * viviera dentro, el nombre accesible del campo sería «X m» en vez de «X», y
   * el usuario de lector de pantalla oiría la unidad como parte del rótulo.
   */
  const field = (name: string, label: string, unit?: string, positive = false) => {
    const invalid = errors[name];
    const inputId = `space3d-${target.kind}-${name}`;
    const unitId = unit ? `${inputId}-unit` : undefined;
    return <div className={`space3d-field${invalid ? ' is-invalid' : ''}`} key={name}>
      <label className="space3d-field-label" htmlFor={inputId}>{label}</label>
      {unit ? <span className="space3d-field-unit" id={unitId}>{unit}</span> : null}
      <input
        id={inputId}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        aria-describedby={unitId}
        value={draft[name] ?? ''}
        aria-invalid={invalid ? true : undefined}
        onChange={(event) => {
          setDraft((current) => ({ ...current, [name]: event.target.value }));
          if (target.kind === 'member' && PROPERTY_KEYS.includes(name as typeof PROPERTY_KEYS[number])) {
            if (name === 'E' || name === 'G') {
              // Cambiar la rigidez rompe la identidad de catálogo —el modelo ya no
              // puede afirmar que es acero A36—, pero no dice nada de la masa. La
              // densidad se conserva: borrarla dejaba la barra fuera del ensamblaje
              // modal, y este editor no tiene campo para volver a escribirla.
              setSelectedMaterialId('');
              setMemberMetadata((current) => ({
                ...current,
                materialId: undefined,
                materialOrigin: 'custom',
              }));
            } else {
              setSelectedSectionId('');
              setMemberMetadata((current) => ({
                ...current,
                sectionId: undefined,
                sectionOrigin: 'custom',
              }));
            }
          }
        }}
      />
      {invalid ? <small role="alert">{t(positive ? 'space3d.requiredPositive' : 'space3d.requiredNumber')}</small> : null}
    </div>;
  };

  const readNumbers = (names: readonly string[], positive: readonly string[] = []): Record<string, number> | null => {
    const next: Record<string, string> = {};
    const values: Record<string, number> = {};
    for (const name of names) {
      const value = numeric(draft[name] ?? '');
      if (value === null || (positive.includes(name) && value <= 0)) next[name] = 'invalid';
      else values[name] = value;
    }
    setErrors(next);
    return Object.keys(next).length > 0 ? null : values;
  };

  if (target.kind === 'node') {
    const id = target.id ?? nextId('N', project.nodes.map((item) => item.id));
    const submit = () => {
      const values = readNumbers(['x', 'y', 'z']);
      if (!values) return;
      const payload: Space3DNode = { id, x: values.x, y: values.y, z: values.z, restraints };
      const ok = target.id
        ? onSubmit({ kind: 'update-node', nodeId: id, changes: { x: values.x, y: values.y, z: values.z, restraints } })
        : onSubmit({ kind: 'add-node', node: payload });
      if (ok) onCancel();
    };

    const supportKind = customSupport ? 'custom' : space3DSupportKind(restraints);
    const dofChip = (dof: keyof Space3DRestraints) => <label key={dof} className="space3d-check">
      <input
        type="checkbox"
        aria-label={t(`space3d.dofName.${dof}` as TranslationKey)}
        checked={restraints[dof]}
        onChange={(event) => {
          setCustomSupport(true);
          setRestraints((current) => ({ ...current, [dof]: event.target.checked }));
        }}
      />
      <span aria-hidden="true">{DOF_AXIS[dof]}</span>
    </label>;

    return <form className="space3d-editor" onSubmit={(event) => { event.preventDefault(); submit(); }}>
      {header('space3d.node', id)}
      <fieldset className="space3d-fieldset">
        <legend>{t('space3d.coordinatesLegend')}</legend>
        <div className="space3d-field-grid space3d-field-grid--3">
          {field('x', t('space3d.fieldX'), t('space3d.unitLength'))}
          {field('y', t('space3d.fieldY'), t('space3d.unitLength'))}
          {field('z', t('space3d.fieldZ'), t('space3d.unitLength'))}
        </div>
      </fieldset>

      <fieldset className="space3d-fieldset">
        <legend>{t('space3d.restraints')}</legend>
        <div className="space3d-support-presets" role="radiogroup" aria-label={t('space3d.supportPresetLabel')}>
          {SUPPORT_PRESETS.map((preset) => <label key={preset.id} className="space3d-support-preset" data-checked={supportKind === preset.id || undefined}>
            <input
              type="radio"
              name={`space3d-support-${id}`}
              checked={supportKind === preset.id}
              onChange={() => {
                if (preset.id === 'custom') { setCustomSupport(true); return; }
                setCustomSupport(false);
                setRestraints(preset.id === 'fixed' ? fixedSpace3DRestraints() : preset.id === 'free' ? freeSpace3DRestraints() : SPACE3D_SUPPORT_RESTRAINTS.pinned);
              }}
            />
            <span>{t(preset.label)}</span>
          </label>)}
        </div>
        <p className="space3d-field-hint">{t(SUPPORT_PRESETS.find((preset) => preset.id === supportKind)!.hint)}</p>
        <div className="space3d-dof-rows">
          <div className="space3d-dof-row"><span>{t('space3d.blockTranslation')}</span><div>{TRANSLATION_DOFS.map(dofChip)}</div></div>
          <div className="space3d-dof-row"><span>{t('space3d.blockRotation')}</span><div>{ROTATION_DOFS.map(dofChip)}</div></div>
        </div>
      </fieldset>

      {footer('space3d.saveNode')}
    </form>;
  }

  if (target.kind === 'member') {
    const id = target.id ?? nextId('M', project.members.map((item) => item.id));
    const submit = () => {
      const values = readNumbers([...PROPERTY_KEYS, 'refX', 'refY', 'refZ', 'roll'], [...PROPERTY_KEYS]);
      if (!values) return;
      const orientation = {
        localYReferenceGlobal: [values.refX, values.refY, values.refZ] as const,
        rollRadians: values.roll,
      };
      const changes = {
        i: endI, j: endJ,
        E: values.E, G: values.G, A: values.A, Iy: values.Iy, Iz: values.Iz, J: values.J,
        ...memberMetadata,
        orientation,
      };
      const ok = target.id
        ? onSubmit({ kind: 'update-member', memberId: id, changes })
        : onSubmit({ kind: 'add-member', member: { id, ...changes } });
      if (ok) onCancel();
    };

    return <form className="space3d-editor" onSubmit={(event) => { event.preventDefault(); submit(); }}>
      {header('space3d.member', id)}
      <fieldset className="space3d-fieldset">
      <legend>{t('space3d.memberEnds')}</legend>
      <div className="space3d-field-grid">
        <label className="space3d-field">
          <span className="space3d-field-label">{t('space3d.endI')}</span>
          <select value={endI} onChange={(event) => setEndI(event.target.value)}>
            {project.nodes.map((item) => <option key={item.id} value={item.id}>{item.id}</option>)}
          </select>
        </label>
        <label className="space3d-field">
          <span className="space3d-field-label">{t('space3d.endJ')}</span>
          <select value={endJ} onChange={(event) => setEndJ(event.target.value)}>
            {project.nodes.map((item) => <option key={item.id} value={item.id}>{item.id}</option>)}
          </select>
        </label>
      </div>
      </fieldset>

      <fieldset className="space3d-fieldset">
      <legend>{t('space3d.memberSection')}</legend>
      <div className="space3d-section-picker">
        <div className="space3d-section-categories" role="group" aria-label={t('space3d.sectionFilterMaterial')}>
          {(['all', 'steel', 'concrete', 'timber', 'aluminum'] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              className={`space3d-cat-chip ${catalogCategory === cat ? 'is-active' : ''}`}
              // El filtro es excluyente: sin estado expuesto, un lector de pantalla
              // oía cinco botones iguales y no sabía cuál gobierna la lista.
              aria-pressed={catalogCategory === cat}
              onClick={() => setCatalogCategory(cat)}
            >
              {t(cat === 'all'
                ? 'space3d.sectionCategoryAll'
                : cat === 'steel'
                  ? 'space3d.sectionCategorySteel'
                  : cat === 'concrete'
                    ? 'space3d.sectionCategoryConcrete'
                    : cat === 'timber'
                      ? 'space3d.sectionCategoryTimber'
                      : 'space3d.sectionCategoryAluminum')}
            </button>
          ))}
        </div>

        <div className="space3d-field-grid">
          <label className="space3d-field">
            <span className="space3d-field-label">{t('space3d.sectionStandard')} ({availableSections.length})</span>
            <select
              value={selectedSectionId}
              onChange={(e) => {
                const sec = SPACE3D_SECTION_CATALOG.find((s) => s.name === e.target.value);
                if (!sec) return;
                const mat = SPACE3D_MATERIALS.find((m) => m.id === sec.materialId);
                setSelectedSectionId(sec.name);
                setSelectedMaterialId(sec.materialId);
                setDraft((current) => ({
                  ...current,
                  A: String(sec.A),
                  Iy: String(sec.Iy),
                  Iz: String(sec.Iz),
                  J: String(sec.J),
                  ...(mat ? { E: String(mat.E), G: String(mat.G) } : {}),
                }));
                setMemberMetadata({
                  sectionId: sec.name,
                  sectionOrigin: 'catalog',
                  materialId: sec.materialId,
                  materialOrigin: 'catalog',
                  density: mat?.massDensityKgPerM3,
                });
              }}
            >
              <option value="" disabled>{t('space3d.sectionSelect')}</option>
              {sectionOptions.map((sec) => (
                <option key={sec.name} value={sec.name}>{sec.name}</option>
              ))}
            </select>
          </label>
          <label className="space3d-field">
            <span className="space3d-field-label">{t('space3d.materialReference')}</span>
            <select
              value={selectedMaterialId}
              onChange={(e) => {
                const mat = SPACE3D_MATERIALS.find((m) => m.id === e.target.value);
                if (!mat) return;
                setSelectedMaterialId(mat.id);
                setSelectedSectionId('');
                setDraft((current) => ({
                  ...current,
                  E: String(mat.E),
                  G: String(mat.G),
                }));
                setMemberMetadata((current) => ({
                  ...current,
                  materialId: mat.id,
                  materialOrigin: 'catalog',
                  density: mat.massDensityKgPerM3,
                  sectionId: undefined,
                  sectionOrigin: 'custom',
                }));
              }}
            >
              <option value="" disabled>{t('space3d.materialChange')}</option>
              {SPACE3D_MATERIALS.map((mat) => (
                <option key={mat.id} value={mat.id}>{mat.name}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      </fieldset>

      <fieldset className="space3d-fieldset">
      <legend>{t('space3d.memberStiffness')}</legend>
      <div className="space3d-field-grid">
        {field('E', t('space3d.propertyE'), t('space3d.unitStress'), true)}
        {field('G', t('space3d.propertyG'), t('space3d.unitStress'), true)}
        {field('A', t('space3d.propertyA'), t('space3d.unitArea'), true)}
        {field('Iy', t('space3d.propertyIy'), t('space3d.unitInertia'), true)}
        {field('Iz', t('space3d.propertyIz'), t('space3d.unitInertia'), true)}
        {field('J', t('space3d.propertyJ'), t('space3d.unitInertia'), true)}
      </div>
      </fieldset>

      <details className="space3d-disclosure">
        <summary>{t('space3d.sectionCalculatorTitle')}</summary>
        <div className="space3d-disclosure-body">
          <div className="space3d-calc-row space3d-calc-row--rect">
            <div className="space3d-field">
              <label className="space3d-field-label" htmlFor="calc-b">{t('space3d.sectionRectB')}</label>
              <input id="calc-b" type="number" step="0.05" value={calcB} onChange={(e) => setCalcB(e.target.value)} />
            </div>
            <div className="space3d-field">
              <label className="space3d-field-label" htmlFor="calc-h">{t('space3d.sectionRectH')}</label>
              <input id="calc-h" type="number" step="0.05" value={calcH} onChange={(e) => setCalcH(e.target.value)} />
            </div>
            <button
              type="button"
              className="space3d-button"
              onClick={() => {
                const b = numeric(calcB);
                const h = numeric(calcH);
                if (b === null || h === null || b <= 0 || h <= 0) {
                  setErrors((current) => ({ ...current, sectionCalculator: t('space3d.sectionCalculatorRectError') }));
                  return;
                }
                setErrors((current) => {
                  const { sectionCalculator: _ignored, ...rest } = current;
                  return rest;
                });
                const res = calculateRectangularSection(b, h);
                setSelectedSectionId('');
                setMemberMetadata((current) => ({ ...current, sectionId: undefined, sectionOrigin: 'custom' }));
                setDraft((curr) => ({
                  ...curr,
                  A: String(res.A),
                  Iy: String(res.Iy),
                  Iz: String(res.Iz),
                  J: String(res.J),
                }));
              }}
            >
              {t('space3d.sectionApplyRect')}
            </button>
          </div>

          <div className="space3d-calc-row">
            <div className="space3d-field">
              <label className="space3d-field-label" htmlFor="calc-dia">{t('space3d.sectionCircularDiameter')}</label>
              <input id="calc-dia" type="number" step="0.05" value={calcDia} onChange={(e) => setCalcDia(e.target.value)} />
            </div>
            <button
              type="button"
              className="space3d-button"
              onClick={() => {
                const d = numeric(calcDia);
                if (d === null || d <= 0) {
                  setErrors((current) => ({ ...current, sectionCalculator: t('space3d.sectionCalculatorCircleError') }));
                  return;
                }
                setErrors((current) => {
                  const { sectionCalculator: _ignored, ...rest } = current;
                  return rest;
                });
                const res = calculateCircularSection(d);
                setSelectedSectionId('');
                setMemberMetadata((current) => ({ ...current, sectionId: undefined, sectionOrigin: 'custom' }));
                setDraft((curr) => ({
                  ...curr,
                  A: String(res.A),
                  Iy: String(res.Iy),
                  Iz: String(res.Iz),
                  J: String(res.J),
                }));
              }}
            >
              {t('space3d.sectionApplyCircular')}
            </button>
          </div>
        </div>
        {errors.sectionCalculator ? (
          <p className="space3d-field-error" role="alert">{errors.sectionCalculator}</p>
        ) : null}
      </details>

      <details className="space3d-disclosure" open={Object.keys(errors).some((name) => ['refX', 'refY', 'refZ', 'roll'].includes(name)) || undefined}>
        <summary>{t('space3d.memberOrientation')}</summary>
        <div className="space3d-disclosure-body">
          <p className="space3d-field-hint">{t('space3d.memberOrientationHint')}</p>
          <div className="space3d-field-grid">
            {field('refX', t('space3d.fieldX'))}
            {field('refY', t('space3d.fieldY'))}
            {field('refZ', t('space3d.fieldZ'))}
            {field('roll', t('space3d.roll'), t('space3d.unitAngle'))}
          </div>
        </div>
      </details>

      {footer('space3d.saveMember')}
    </form>;
  }

  const id = target.id ?? nextId('L', project.nodalLoads.map((item) => item.id));
  const submit = () => {
    const values = readNumbers([...LOAD_KEYS]);
    if (!values) return;
    const changes = {
      nodeId: loadNodeId, caseId: loadCaseId,
      fx: values.fx, fy: values.fy, fz: values.fz, mx: values.mx, my: values.my, mz: values.mz,
    };
    const ok = target.id
      ? onSubmit({ kind: 'update-nodal-load', loadId: id, changes })
      : onSubmit({ kind: 'add-nodal-load', load: { id, ...changes } });
    if (ok) onCancel();
  };

  return <form className="space3d-editor" onSubmit={(event) => { event.preventDefault(); submit(); }}>
    {header('space3d.load', id)}
    <fieldset className="space3d-fieldset">
    <legend>{t('space3d.loadPlacement')}</legend>
    <div className="space3d-field-grid">
      <label className="space3d-field">
        <span className="space3d-field-label">{t('space3d.node')}</span>
        <select value={loadNodeId} onChange={(event) => setLoadNodeId(event.target.value)}>
          {project.nodes.map((item) => <option key={item.id} value={item.id}>{item.id}</option>)}
        </select>
      </label>
      <label className="space3d-field">
        <span className="space3d-field-label">{t('space3d.loadCase')}</span>
        <select value={loadCaseId} onChange={(event) => setLoadCaseId(event.target.value)}>
          {project.loadCases.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
    </div>
    </fieldset>
    <fieldset className="space3d-fieldset">
      <legend>{t('space3d.loadForces')}</legend>
      <div className="space3d-field-grid space3d-field-grid--3">
        {field('fx', t('space3d.fieldFx'), t('space3d.unitForce'))}
        {field('fy', t('space3d.fieldFy'), t('space3d.unitForce'))}
        {field('fz', t('space3d.fieldFz'), t('space3d.unitForce'))}
      </div>
      <p className="space3d-field-hint">{t('space3d.loadSignHint')}</p>
    </fieldset>
    <fieldset className="space3d-fieldset">
      <legend>{t('space3d.loadMoments')}</legend>
      <div className="space3d-field-grid space3d-field-grid--3">
        {field('mx', t('space3d.fieldMx'), t('space3d.unitMoment'))}
        {field('my', t('space3d.fieldMy'), t('space3d.unitMoment'))}
        {field('mz', t('space3d.fieldMz'), t('space3d.unitMoment'))}
      </div>
    </fieldset>
    {footer('space3d.saveLoad')}
  </form>;
};
