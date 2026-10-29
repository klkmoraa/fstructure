import { useMemo } from 'react';
import { SegmentedControl } from '../../design-system/components/controls';
import { UnitField } from '../../design-system/components/editor';
import { unitLabel } from '../../engine/units';
import type { UnitSystemId } from '../../foundation/units';
import type { Language } from '../../i18n/catalogs';
import type { GeneratorKind } from '../../data/generators/generatorTypes';
import { generateStructure } from '../../data/generators/structureGenerators';
import { circularMemberGeometry, curvedMemberPath } from '../../graphics/memberCurve';
import { buildGeneratorParams, type GeneratorFormErrors, type GeneratorFormState } from './structureGeneratorForm';
import { createStructureGeneratorTranslator } from './structureGeneratorCopy';
import '../canvas/nativeCurves.css';
export const isCurvedGeneratorFamily = (family: GeneratorKind): boolean => family === 'circular-arch' || family === 'circular-ring' || family === 'pitched-portal';
interface Props { form: GeneratorFormState; errors: GeneratorFormErrors; units: UnitSystemId; language: Language; onChange: (changes: Partial<GeneratorFormState>) => void }
const GeometryPreview = ({ form, units, language }: Pick<Props, 'form' | 'units' | 'language'>) => {
  const t = createStructureGeneratorTranslator(language);
  const geometry = useMemo(() => {
    const parsed = buildGeneratorParams(form, units);
    if (!parsed.ok) return null;
    try { return generateStructure(parsed.params); } catch { return null; }
  }, [form, units]);
  if (!geometry) return null;
  const { minX, maxX, minY, maxY } = geometry.summary.bounds;
  const width = maxX - minX, height = maxY - minY;
  const scale = Math.min(280 / Math.max(width, 1e-12), 100 / Math.max(height, 1e-12));
  const toScreen = (x: number, y: number) => ({ x: 160 + (x - minX - width / 2) * scale, y: 68 - (y - minY - height / 2) * scale });
  const nodes = new Map(geometry.nodes.map(n => [n.id, n]));
  return <figure className="curved-generator__preview">
    <svg viewBox="0 0 320 136" role="img" aria-label={t('curve.preview')}>
      <title>{t('curve.preview')}</title>
      {geometry.members.map(member => {
        const i = nodes.get(member.i)!, j = nodes.get(member.j)!;
        const arc = circularMemberGeometry(member, i, j), a = toScreen(i.x, i.y), b = toScreen(j.x, j.y);
        return arc ? <path key={member.id} data-native-curve-preview d={curvedMemberPath(arc, toScreen)} />
          : <line key={member.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
      })}
      {geometry.nodes.map(node => { const p = toScreen(node.x, node.y); return <circle key={node.id} cx={p.x} cy={p.y} r={3.4} data-supported={node.support.type !== 'none'} />; })}
    </svg>
    <figcaption>{t(form.family === 'pitched-portal' ? 'portal.previewCount' : 'curve.previewCount', { count: geometry.members.length, nodes: geometry.nodes.length })}</figcaption>
  </figure>;
};
export const CurvedGeneratorFields = ({ form, errors, units, language, onChange }: Props) => {
  if (!isCurvedGeneratorFamily(form.family)) return null;
  const t = createStructureGeneratorTranslator(language), unit = unitLabel(units, 'length');
  return <section className="curved-generator__fields" data-curved-generator-fields={form.family}>
    <GeometryPreview form={form} units={units} language={language} />
    {form.family === 'circular-arch' ? <>
      <div className="structure-generator__pair">
        <UnitField label={t('curve.span')} value={form.curveSpan} unit={unit} error={errors.curveSpan} onValueChange={value => onChange({ curveSpan: value })} />
        <UnitField label={t('curve.rise')} value={form.curveRise} unit={unit} error={errors.curveRise} onValueChange={value => onChange({ curveRise: value })} />
      </div>
      <p className="structure-generator__hint">{t('curve.riseHint')}</p>
      <p className="structure-generator__hint">{t('curve.originHint')}</p>
    </> : null}
    {form.family === 'circular-ring' ? <>
      <UnitField label={t('curve.radius')} value={form.curveRadius} unit={unit} error={errors.curveRadius} onValueChange={value => onChange({ curveRadius: value })} />
      <p className="structure-generator__hint">{t('curve.ringHint')}</p>
    </> : null}
    {form.family !== 'pitched-portal' ? <p className="curved-generator__notice">{t('curve.approximation')}</p> : <>
      <SegmentedControl size="sm" label={t('portal.roofKind')} value={form.roofKind}
        options={[{ value: 'mono', label: t('portal.mono') }, { value: 'gable', label: t('portal.gable') }]}
        onValueChange={value => onChange({ roofKind: value === 'mono' ? 'mono' : 'gable' })} />
      <UnitField label={t('portal.span')} value={form.portalSpan} unit={unit} error={errors.portalSpan} onValueChange={value => onChange({ portalSpan: value })} />
      <div className="structure-generator__pair">
        <UnitField label={t('portal.leftHeight')} value={form.leftHeight} unit={unit} error={errors.leftHeight} onValueChange={value => onChange({ leftHeight: value })} />
        <UnitField label={t('portal.rightHeight')} value={form.rightHeight} unit={unit} error={errors.rightHeight} onValueChange={value => onChange({ rightHeight: value })} />
      </div>
      {form.roofKind === 'gable' ? <>
        <div className="structure-generator__pair">
          <UnitField label={t('portal.ridgeX')} value={form.ridgeX} unit={unit} error={errors.ridgeX} onValueChange={value => onChange({ ridgeX: value })} />
          <UnitField label={t('portal.ridgeY')} value={form.ridgeY} unit={unit} error={errors.ridgeY} onValueChange={value => onChange({ ridgeY: value })} />
        </div><p className="structure-generator__hint">{t('portal.ridgeHint')}</p>
      </> : null}
    </>}
    <p className="structure-generator__hint">{t('curve.independent')}</p>
  </section>;
};
