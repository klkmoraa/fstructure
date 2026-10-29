import { useMemo } from 'react';
import { Field, SegmentedControl } from '../../design-system/components/controls';
import { UnitField } from '../../design-system/components/editor';
import { unitLabel } from '../../engine/units';
import type { UnitSystemId } from '../../foundation/units';
import type { Language } from '../../i18n/catalogs';
import type { GeneratorKind } from '../../data/generators/generatorTypes';
import { generateStructure } from '../../data/generators/structureGenerators';
import { buildGeneratorParams, type GeneratorFormErrors, type GeneratorFormState } from './structureGeneratorForm';
import { createStructureGeneratorTranslator } from './structureGeneratorCopy';

export const isCurvedGeneratorFamily = (family: GeneratorKind): boolean =>
  family === 'circular-arch' || family === 'circular-ring' || family === 'pitched-portal';

interface Props {
  form: GeneratorFormState;
  errors: GeneratorFormErrors;
  units: UnitSystemId;
  language: Language;
  onChange: (changes: Partial<GeneratorFormState>) => void;
}

/** Same parser and geometry as the canvas ghost, not an illustrative drawing. */
const GeometryPreview = ({ form, units, language }: Pick<Props, 'form' | 'units' | 'language'>) => {
  const t = createStructureGeneratorTranslator(language);
  const geometry = useMemo(() => {
    const parsed = buildGeneratorParams(form, units);
    if (!parsed.ok) return null;
    try { return generateStructure(parsed.params); }
    catch { return null; } // The connected surface presents the authoritative error.
  }, [form, units]);
  if (!geometry) return null;
  const { minX, maxX, minY, maxY } = geometry.summary.bounds;
  const width = maxX - minX;
  const height = maxY - minY;
  const scale = Math.min(280 / Math.max(width, 1e-12), 100 / Math.max(height, 1e-12));
  const x = (value: number) => 160 + (value - minX - width / 2) * scale;
  const y = (value: number) => 68 - (value - minY - height / 2) * scale;
  const nodeById = new Map(geometry.nodes.map((node) => [node.id, node]));
  return <figure className="curved-generator__preview">
    <svg viewBox="0 0 320 136" role="img" aria-label={t('curve.preview')}>
      <title>{t('curve.preview')}</title>
      {geometry.members.map((member) => {
        const a = nodeById.get(member.i)!;
        const b = nodeById.get(member.j)!;
        return <line key={member.id} x1={x(a.x)} y1={y(a.y)} x2={x(b.x)} y2={y(b.y)} />;
      })}
      {geometry.nodes.map((node) => <circle
        key={node.id} cx={x(node.x)} cy={y(node.y)} r={node.support.type === 'none' ? 1.8 : 3.4}
        data-supported={node.support.type !== 'none'}
      />)}
    </svg>
    <figcaption>{t(form.family === 'pitched-portal' ? 'portal.previewCount' : 'curve.previewCount', {
      count: geometry.members.length, nodes: geometry.nodes.length,
    })}</figcaption>
  </figure>;
};

export const CurvedGeneratorFields = ({ form, errors, units, language, onChange }: Props) => {
  if (!isCurvedGeneratorFamily(form.family)) return null;
  const t = createStructureGeneratorTranslator(language);
  const lengthUnit = unitLabel(units, 'length');
  return <section className="curved-generator__fields" data-curved-generator-fields={form.family}>
    <GeometryPreview form={form} units={units} language={language} />
    {form.family === 'circular-arch' ? <>
      <div className="structure-generator__pair">
        <UnitField label={t('curve.span')} value={form.curveSpan} unit={lengthUnit} error={errors.curveSpan}
          onValueChange={(value) => onChange({ curveSpan: value })} />
        <UnitField label={t('curve.rise')} value={form.curveRise} unit={lengthUnit} error={errors.curveRise}
          onValueChange={(value) => onChange({ curveRise: value })} />
      </div>
      <p className="structure-generator__hint">{t('curve.riseHint')}</p>
      <p className="structure-generator__hint">{t('curve.originHint')}</p>
    </> : null}
    {form.family === 'circular-ring' ? <>
      <UnitField label={t('curve.radius')} value={form.curveRadius} unit={lengthUnit} error={errors.curveRadius}
        onValueChange={(value) => onChange({ curveRadius: value })} />
      <p className="structure-generator__hint">{t('curve.ringHint')}</p>
    </> : null}
    {form.family !== 'pitched-portal' ? <>
      <Field label={t('curve.segments')} value={form.curveSegments} type="number" inputMode="numeric"
        min={form.family === 'circular-ring' ? 3 : 2} max={200} step={1} error={errors.curveSegments}
        onChange={(event) => onChange({ curveSegments: event.target.value })} />
      <p className="curved-generator__notice">{t('curve.approximation')}</p>
    </> : <>
      <SegmentedControl size="sm" label={t('portal.roofKind')} value={form.roofKind}
        options={[{ value: 'mono', label: t('portal.mono') }, { value: 'gable', label: t('portal.gable') }]}
        onValueChange={(value) => onChange({ roofKind: value === 'mono' ? 'mono' : 'gable' })} />
      <UnitField label={t('portal.span')} value={form.portalSpan} unit={lengthUnit} error={errors.portalSpan}
        onValueChange={(value) => onChange({ portalSpan: value })} />
      <div className="structure-generator__pair">
        <UnitField label={t('portal.leftHeight')} value={form.leftHeight} unit={lengthUnit} error={errors.leftHeight}
          onValueChange={(value) => onChange({ leftHeight: value })} />
        <UnitField label={t('portal.rightHeight')} value={form.rightHeight} unit={lengthUnit} error={errors.rightHeight}
          onValueChange={(value) => onChange({ rightHeight: value })} />
      </div>
      {form.roofKind === 'gable' ? <>
        <div className="structure-generator__pair">
          <UnitField label={t('portal.ridgeX')} value={form.ridgeX} unit={lengthUnit} error={errors.ridgeX}
            onValueChange={(value) => onChange({ ridgeX: value })} />
          <UnitField label={t('portal.ridgeY')} value={form.ridgeY} unit={lengthUnit} error={errors.ridgeY}
            onValueChange={(value) => onChange({ ridgeY: value })} />
        </div>
        <p className="structure-generator__hint">{t('portal.ridgeHint')}</p>
      </> : null}
    </>}
    <p className="structure-generator__hint">{t('curve.independent')}</p>
  </section>;
};
