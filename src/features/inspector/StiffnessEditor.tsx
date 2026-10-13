import { ChevronRight } from 'lucide-react';
import { STIFFNESS_REFERENCE, supportsStiffness } from '../../data/memberStiffness';
import { toDisplay, fromDisplay } from '../../foundation/units';
import { unitLabel } from '../../engine/units';
import { useI18n } from '../../i18n/useI18n';
import { useProjectModel } from '../../store/ProjectModelContext';
import type { MemberModel, StiffnessDefaults } from '../../types';
import { InspectorNumericField } from './InspectorNumericField';
import './stiffnessEditor.css';

export const StiffnessEditor = ({ member }: { member?: MemberModel }) => {
  const { project, executeProjectCommand } = useProjectModel();
  const { language } = useI18n();
  const es = language === 'es';
  const base = project.settings.stiffnessDefaults;
  const units = project.settings.units;
  const mode = base?.mode ?? 'EI';
  const symbol = (factor: number) => `${factor === 1 ? '' : new Intl.NumberFormat(es ? 'es-MX' : 'en-US', { maximumFractionDigits: 4 }).format(factor)}${mode}`;
  const positive = (value: number) => value > 0 ? undefined : es ? 'Usa un valor mayor que cero.' : 'Use a value greater than zero.';
  const compatible = member && base && supportsStiffness(member, base);
  const linked = member?.stiffnessFactor !== undefined;
  const writeBase = (defaults: StiffnessDefaults | undefined, applyToAll = false) => {
    void executeProjectCommand({ kind: 'stiffness.defaults.update', description: es ? 'Cambiar constante de rigidez' : 'Change stiffness constant', defaults, applyToAll });
  };
  const writeFactor = (factor?: number) => {
    if (member) void executeProjectCommand({ kind: 'member.stiffness.set', description: `${es ? 'Rigidez de' : 'Stiffness of'} ${member.id}`, memberId: member.id, factor });
  };
  // EI has force·length² units, independent of the historical E/I display profiles.
  const eiFactor = toDisplay(1, units, 'force') * toDisplay(1, units, 'length') ** 2;
  const displayed = (value: number) => mode === 'EI' ? value * eiFactor : toDisplay(value, units, mode === 'E' ? 'elasticModulus' : 'inertia');
  const canonical = (value: number) => mode === 'EI' ? value / eiFactor : fromDisplay(value, units, mode === 'E' ? 'elasticModulus' : 'inertia');
  const unit = mode === 'EI' ? `${unitLabel(units, 'force')}·${unitLabel(units, 'length')}²` : unitLabel(units, mode === 'E' ? 'elasticModulus' : 'inertia');
  const config = <div className="stiffness-editor__settings">
    <label className="stiffness-editor__select"><span>{es ? 'Constante del proyecto' : 'Project constant'}</span>
      <select value={base?.mode ?? 'own'} onChange={(event) => {
        const next = event.target.value;
        writeBase(next === 'own' ? undefined : { mode: next as StiffnessDefaults['mode'], factor: base?.factor ?? 1 });
      }}>
        <option value="own">{es ? 'Valores por barra' : 'Values per member'}</option>
        <option value="EI">EI {es ? 'constante' : 'constant'}</option>
        <option value="E">E {es ? 'constante' : 'constant'}</option>
        <option value="I">I {es ? 'constante' : 'constant'}</option>
      </select>
    </label>
    {base ? <>
      <div className="stiffness-editor__segmented" role="group" aria-label={es ? 'Valor de la constante' : 'Constant value'}>
        <button type="button" aria-pressed={base.value === undefined} onClick={() => writeBase({ mode, factor: base.factor })}>{es ? 'Sin valor' : 'No value'}</button>
        <button type="button" aria-pressed={base.value !== undefined} onClick={() => writeBase({ ...base, value: base.value ?? STIFFNESS_REFERENCE[mode] })}>{es ? 'Con valor' : 'With value'}</button>
      </div>
      {base.value !== undefined ? <InspectorNumericField label={es ? `Valor base de ${mode}` : `${mode} base value`} value={displayed(base.value)} unit={unit} language={language}
        resetKey={`base:${mode}:${units}`} validate={positive} onCommit={(value) => writeBase({ ...base, value: canonical(value) })} /> : null}
      <InspectorNumericField label={es ? 'Factor predeterminado' : 'Default factor'} value={base.factor} unit="×" language={language}
        resetKey={`default:${mode}`} validate={positive} onCommit={(factor) => writeBase({ ...base, factor })} />
      <p className="stiffness-editor__hint">{es ? `Las barras nuevas usan ${symbol(base.factor)}. Cada barra puede tener su propio factor.` : `New members use ${symbol(base.factor)}. Each member can have its own factor.`}</p>
      {base.value === undefined ? <p className="stiffness-editor__relative">{es ? 'Rigidez relativa: los desplazamientos usan una referencia, no un valor físico.' : 'Relative stiffness: displacements use a reference, not a physical value.'}</p> : null}
      {project.members.some((item) => supportsStiffness(item, base)) ? <button type="button" className="stiffness-editor__apply" onClick={() => writeBase(base, true)}>{es ? `Aplicar ${symbol(base.factor)} a todas las barras compatibles` : `Apply ${symbol(base.factor)} to all compatible members`}</button> : null}
    </> : null}
  </div>;

  return <section className="stiffness-editor" aria-label={es ? 'Rigidez' : 'Stiffness'}>
    <header><h3>{es ? 'Rigidez' : 'Stiffness'}</h3><span>{linked ? symbol(member!.stiffnessFactor!) : base ? `${symbol(base.factor)} · base` : 'E · I'}</span></header>
    {member ? <>
      {compatible ? <div className="stiffness-editor__segmented" role="group" aria-label={es ? `Rigidez de ${member.id}` : `${member.id} stiffness`}>
        <button type="button" aria-pressed={linked} onClick={() => writeFactor(member.stiffnessFactor ?? base.factor)}>{es ? 'Usar constante' : 'Use constant'}</button>
        <button type="button" aria-pressed={!linked} onClick={() => writeFactor()}>{es ? 'Valores propios' : 'Own values'}</button>
      </div> : <p className="stiffness-editor__hint">{es ? 'Define una base compatible abajo para usar una constante en esta barra.' : 'Set a compatible base below to use a constant on this member.'}</p>}
      {linked && compatible ? <InspectorNumericField label={`${es ? 'Factor de' : 'Factor for'} ${member.id}`} value={member.stiffnessFactor!} unit="×" language={language}
        resetKey={`${member.id}:${mode}`} validate={positive} onCommit={writeFactor} /> : null}
      <details className="stiffness-editor__disclosure"><summary>{es ? 'Base y predeterminados del proyecto' : 'Project base and defaults'}<ChevronRight size={15} aria-hidden="true" /></summary>{config}</details>
    </> : config}
  </section>;
};
