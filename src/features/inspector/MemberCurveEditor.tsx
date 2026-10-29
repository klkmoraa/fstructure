import { useState } from 'react';
import type { MemberModel } from '../../types';
import { useProjectModel } from '../../store/ProjectModelContext';
import { useI18n } from '../../i18n/useI18n';
import { Button } from '../../design-system/components/controls';
import { PhysicalNumberField } from './InspectorPrimitives';
import { circularMemberGeometry } from '../../graphics/memberCurve';
import { toDisplay } from '../../foundation/units';
import { unitLabel } from '../../engine/units';
import { formatFixed } from '../../utils/numberFormat';

/** Edits the selected member in place: IDs, endpoints, loads and undo are retained. */
export const MemberCurveEditor = ({ member }: { member: MemberModel }) => {
  const { project, executeProjectCommand } = useProjectModel();
  const { language } = useI18n();
  const [error, setError] = useState('');
  const es = language === 'es', units = project.settings.units;
  const i = project.nodes.find(n => n.id === member.i), j = project.nodes.find(n => n.id === member.j);
  if (!i || !j || member.type !== 'frame') return null;
  const chord = Math.hypot(j.x - i.x, j.y - i.y);
  if (chord <= 1e-10) return null;
  const arc = circularMemberGeometry(member, i, j);
  const apply = async (bulge: number | undefined) => {
    setError('');
    try {
      await executeProjectCommand({ kind: 'member.update', description: es ? `Geometría de ${member.id}` : `Geometry of ${member.id}`,
        memberId: member.id, changes: { curve: bulge === undefined ? undefined : { kind: 'circular-arc', bulge } } });
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  };
  return <section className="profile-editor" aria-label={es ? 'Geometría de la barra' : 'Member geometry'}>
    <strong>{es ? 'Geometría de la barra' : 'Member geometry'}</strong>
    <p className="profile-editor__hint">{member.i} → {member.j} · {es ? 'una barra, dos extremos' : 'one member, two ends'}</p>
    <div className="structure-generator__pair">
      <Button size="touch" variant={arc ? 'secondary' : 'primary'} aria-pressed={!arc} onClick={() => void apply(undefined)}>{es ? 'Recta' : 'Straight'}</Button>
      <Button size="touch" variant={arc ? 'primary' : 'secondary'} aria-pressed={Boolean(arc)} onClick={() => void apply(member.curve?.bulge ?? 0.5)}>{es ? 'Curva circular' : 'Circular curve'}</Button>
    </div>
    {arc ? <>
      <PhysicalNumberField label={es ? 'Flecha con signo' : 'Signed rise'} value={member.curve!.bulge * chord / 2}
        units={units} quantity="length" resetKey={`${member.id}:curve:${member.curve!.bulge}:${chord}`}
        validate={value => Number.isFinite(value) && Math.abs(value) >= chord * 5e-9 && Math.abs(value) <= chord / 2
          ? undefined : es ? 'Usa una flecha no nula de hasta la mitad de la distancia entre extremos.' : 'Use a nonzero rise up to half the endpoint distance.'}
        onCommit={value => void apply(2 * value / chord)} />
      <Button variant="secondary" size="touch" onClick={() => void apply(-member.curve!.bulge)}>{es ? 'Invertir curvatura' : 'Flip curvature'}</Button>
      <p className="profile-editor__hint">R = {formatFixed(toDisplay(arc.radius, units, 'length'), 3)} {unitLabel(units, 'length')} · L = {formatFixed(toDisplay(arc.length, units, 'length'), 3)} {unitLabel(units, 'length')}</p>
      <p className="profile-editor__hint">{es ? 'Los extremos y la identidad se conservan. Análisis lineal experimental con malla interna; no se crean nudos intermedios en el modelo.' : 'Endpoints and identity are preserved. Experimental linear analysis uses a private mesh, not intermediate model nodes.'}</p>
    </> : null}
    {error ? <p role="alert">{error}</p> : null}
  </section>;
};
