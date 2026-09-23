/**
 * Barra de la herramienta activa, sobre el lienzo.
 *
 * Dice en una frase qué hace el siguiente toque y reúne sólo las opciones que
 * lo cambian: el plano y la cuadrícula para dibujar, la sección para las
 * barras, el tipo de apoyo, o la dirección y la magnitud de la carga. Todo lo
 * que se aplica desde aquí pasa por comandos y se deshace como cualquier edición.
 */
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, MoveDownLeft, MoveUpRight, X } from 'lucide-react';
import type { ReactNode } from 'react';
import type { TranslationKey } from '../../i18n/catalogs';
import { SPACE3D_MATERIALS, SPACE3D_SECTION_CATALOG } from '../../space3d/model/sectionLibrary';
import type { Space3DLoadCase } from '../../space3d/model/types';
import {
  SPACE3D_LOAD_DIRECTIONS, SPACE3D_SNAP_STEPS, type Space3DLoadDirection, type Space3DMemberTemplate, type Space3DPlaneAxis,
} from './space3dModeling';

type Translate = (key: TranslationKey, variables?: Record<string, string | number>) => string;

export type Space3DModelingTool = 'select' | 'node' | 'member' | 'support' | 'load';
export type Space3DSupportChoice = 'fixed' | 'pinned' | 'free';

const PLANE_KEYS: Record<Space3DPlaneAxis, TranslationKey> = {
  y: 'space3d.modePlaneY',
  z: 'space3d.modePlaneZ',
  x: 'space3d.modePlaneX',
};

const SUPPORT_CHOICES: readonly { id: Space3DSupportChoice; key: TranslationKey }[] = [
  { id: 'fixed', key: 'space3d.supportPresetFixed' },
  { id: 'pinned', key: 'space3d.supportPresetPinned' },
  { id: 'free', key: 'space3d.supportPresetFree' },
];

const DIRECTION_META: Record<Space3DLoadDirection, { key: TranslationKey; icon: ReactNode }> = {
  down: { key: 'space3d.loadDirDown', icon: <ArrowDown size={16} aria-hidden="true" /> },
  'x+': { key: 'space3d.loadDirXPos', icon: <ArrowRight size={16} aria-hidden="true" /> },
  'x-': { key: 'space3d.loadDirXNeg', icon: <ArrowLeft size={16} aria-hidden="true" /> },
  'z+': { key: 'space3d.loadDirZPos', icon: <MoveDownLeft size={16} aria-hidden="true" /> },
  'z-': { key: 'space3d.loadDirZNeg', icon: <MoveUpRight size={16} aria-hidden="true" /> },
  up: { key: 'space3d.loadDirUp', icon: <ArrowUp size={16} aria-hidden="true" /> },
};

const MATERIAL_GROUPS = SPACE3D_MATERIALS
  .map((material) => ({ material, sections: SPACE3D_SECTION_CATALOG.filter((section) => section.materialId === material.id) }))
  .filter((group) => group.sections.length > 0);

export interface Space3DModeBarProps {
  readonly t: Translate;
  readonly tool: Exclude<Space3DModelingTool, 'select'>;
  readonly onExit: () => void;
  readonly notice: string | null;
  readonly noticeTone?: 'ok' | 'error';
  // Dibujo
  readonly planeAxis: Space3DPlaneAxis;
  readonly planeOffset: string;
  readonly onPlaneOffsetChange: (value: string) => void;
  readonly planeStep: number;
  readonly onPlaneStepChange: (value: number) => void;
  // Barras
  readonly memberFromId: string | null;
  readonly onFinishMember: () => void;
  readonly memberTemplate: Space3DMemberTemplate;
  readonly onMemberTemplateChange: (template: Space3DMemberTemplate) => void;
  readonly referenceMemberId: string | null;
  // Apoyos
  readonly supportChoice: Space3DSupportChoice;
  readonly onSupportChoiceChange: (choice: Space3DSupportChoice) => void;
  readonly baseCount: number;
  readonly onSupportBase: () => void;
  // Cargas
  readonly loadDirection: Space3DLoadDirection;
  readonly onLoadDirectionChange: (direction: Space3DLoadDirection) => void;
  readonly loadMagnitude: string;
  readonly onLoadMagnitudeChange: (value: string) => void;
  readonly loadMagnitudeInvalid: boolean;
  readonly loadCases: readonly Space3DLoadCase[];
  readonly loadCaseId: string;
  readonly onLoadCaseChange: (id: string) => void;
  readonly topCount: number;
  readonly onLoadTop: () => void;
}

export const Space3DModeBar = (props: Space3DModeBarProps) => {
  const { t, tool } = props;
  const drawing = tool === 'node' || tool === 'member';
  const hint = tool === 'node'
    ? t('space3d.modeNodeHint')
    : tool === 'member'
      ? props.memberFromId ? t('space3d.modeMemberNextHint', { id: props.memberFromId }) : t('space3d.modeMemberStartHint')
      : tool === 'support' ? t('space3d.modeSupportHint') : t('space3d.modeLoadHint');

  const templateValue = props.memberTemplate.kind === 'reference' ? '__reference' : props.memberTemplate.sectionName;

  return <section className="space3d-modebar" aria-label={t('space3d.modeBarLabel')} data-tool={tool}>
    <div className="space3d-modebar-head">
      <p className="space3d-modebar-hint">{hint}</p>
      <button type="button" className="space3d-modebar-exit" onClick={props.onExit} aria-keyshortcuts="Escape">
        <X size={15} aria-hidden="true" />{t('space3d.modeExit')}
      </button>
    </div>

    <div className="space3d-modebar-options">
      {drawing ? <>
        <label className="space3d-modebar-field">
          <span>{t(PLANE_KEYS[props.planeAxis])}</span>
          <input
            type="text"
            inputMode="decimal"
            value={props.planeOffset}
            onChange={(event) => props.onPlaneOffsetChange(event.target.value)}
            size={5}
          />
          <small>{t('space3d.unitLength')}</small>
        </label>
        <label className="space3d-modebar-field">
          <span>{t('space3d.modeStep')}</span>
          <select value={props.planeStep} onChange={(event) => props.onPlaneStepChange(Number(event.target.value))}>
            {SPACE3D_SNAP_STEPS.map((step) => <option key={step} value={step}>{step} m</option>)}
          </select>
        </label>
      </> : null}

      {tool === 'member' ? <>
        <label className="space3d-modebar-field">
          <span>{t('space3d.modeSection')}</span>
          <select
            value={templateValue}
            onChange={(event) => props.onMemberTemplateChange(event.target.value === '__reference'
              ? { kind: 'reference' }
              : { kind: 'catalog', sectionName: event.target.value })}
          >
            {props.referenceMemberId ? <option value="__reference">{t('space3d.modeSectionReference', { id: props.referenceMemberId })}</option> : null}
            {MATERIAL_GROUPS.map(({ material, sections }) => <optgroup key={material.id} label={material.name}>
              {sections.map((section) => <option key={section.name} value={section.name}>{section.name}</option>)}
            </optgroup>)}
          </select>
        </label>
        {props.memberFromId ? <button type="button" className="space3d-button" onClick={props.onFinishMember}>{t('space3d.modeFinishMember')}</button> : null}
      </> : null}

      {tool === 'support' ? <>
        <div className="space3d-modebar-segmented" role="radiogroup" aria-label={t('space3d.modeSupportType')}>
          {SUPPORT_CHOICES.map((choice) => <label key={choice.id} data-checked={props.supportChoice === choice.id || undefined}>
            <input type="radio" name="space3d-support-choice" checked={props.supportChoice === choice.id} onChange={() => props.onSupportChoiceChange(choice.id)} />
            <span>{t(choice.key)}</span>
          </label>)}
        </div>
        <button type="button" className="space3d-button" onClick={props.onSupportBase} disabled={props.baseCount === 0}>
          {t('space3d.modeSupportBase', { count: props.baseCount })}
        </button>
      </> : null}

      {tool === 'load' ? props.loadCases.length === 0 ? <p className="space3d-modebar-hint">{t('space3d.modeNoCases')}</p> : <>
        <div className="space3d-modebar-segmented space3d-modebar-segmented--icons" role="radiogroup" aria-label={t('space3d.modeLoadDirection')}>
          {SPACE3D_LOAD_DIRECTIONS.map((direction) => <label key={direction} title={t(DIRECTION_META[direction].key)} data-checked={props.loadDirection === direction || undefined}>
            <input
              type="radio"
              name="space3d-load-direction"
              aria-label={t(DIRECTION_META[direction].key)}
              checked={props.loadDirection === direction}
              onChange={() => props.onLoadDirectionChange(direction)}
            />
            {DIRECTION_META[direction].icon}
          </label>)}
        </div>
        <label className="space3d-modebar-field" data-invalid={props.loadMagnitudeInvalid || undefined}>
          <span>{t('space3d.modeLoadMagnitude')}</span>
          <input
            type="text"
            inputMode="decimal"
            value={props.loadMagnitude}
            aria-invalid={props.loadMagnitudeInvalid || undefined}
            onChange={(event) => props.onLoadMagnitudeChange(event.target.value)}
            size={5}
          />
          <small>{t('space3d.unitForce')}</small>
        </label>
        {props.loadCases.length > 1 ? <label className="space3d-modebar-field">
          <span>{t('space3d.modeLoadCase')}</span>
          <select value={props.loadCaseId} onChange={(event) => props.onLoadCaseChange(event.target.value)}>
            {props.loadCases.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label> : null}
        <button type="button" className="space3d-button" onClick={props.onLoadTop} disabled={props.topCount === 0 || props.loadMagnitudeInvalid}>
          {t('space3d.modeLoadTop', { count: props.topCount })}
        </button>
      </> : null}
    </div>

    {drawing && props.planeAxis === 'y' ? <p className="space3d-modebar-foot">{t('space3d.modePlaneViewHint')}</p> : null}
    <p className="space3d-modebar-notice" role="status" data-tone={props.noticeTone}>{props.notice ?? ''}</p>
  </section>;
};
