import { useProjectModel } from '../../store/ProjectModelContext';
import { useI18n } from '../../i18n/useI18n';
import type { MemberModel } from '../../types';
import { materialDefinitionOf } from '../../data/memberProfiles';
import { MaterialPresetSelector } from './MaterialPresetSelector';
import { SectionPresetSelector } from './SectionPresetSelector';
import { StiffnessEditor } from './StiffnessEditor';
import { CustomSectionEditor } from './CustomSectionEditor';
import { CustomMaterialEditor } from './CustomMaterialEditor';
import { PhysicalNumberField } from './InspectorPrimitives';
import { InspectorNumericField } from './InspectorNumericField';
import { MemberFavoritesPanel } from '../library/MemberFavoritesPanel';
import { toDisplay } from '../../foundation/units';
import { unitLabel } from '../../engine/units';
import './memberProfileEditor.css';

export const memberProfileOf = (member: MemberModel) => member.propertyProfile ?? (member.materialId || member.sectionId ? 'catalog' : member.customSection || member.customMaterial ? 'custom' : 'exercise');
export const MemberProfileEditor = ({member}:{member:MemberModel}) => {
  const {project,executeProjectCommand}=useProjectModel();const {language}=useI18n();const es=language==='es';const units=project.settings.units;
  const profile=memberProfileOf(member);
  const update=(changes:Partial<MemberModel>)=>void executeProjectCommand({kind:'member.update',description:`Propiedades de ${member.id}`,memberId:member.id,changes});
  const linked=member.stiffnessFactor!==undefined;const mode=project.settings.stiffnessDefaults?.mode;
  const positive=(v:number)=>v>0?undefined:es?'Usa un valor mayor que cero.':'Use a positive value.';
  const eiFactor=toDisplay(1,units,'force')*toDisplay(1,units,'length')**2;
  return <section className="profile-editor" aria-label={es?'Perfil de la barra':'Member profile'}>
    <label className="select-field profile-editor__selector"><span>{es?'Perfil':'Profile'}</span><select aria-label={es?'Perfil':'Profile'} value={profile} onChange={e=>{
      const propertyProfile=e.target.value as NonNullable<MemberModel['propertyProfile']>;
      const customMaterial=propertyProfile==='custom' && !member.customMaterial?materialDefinitionOf(member):undefined;
      if (propertyProfile === 'custom' && customMaterial) {
        void executeProjectCommand({kind:'member.material.custom',description:`Personalizar ${member.id}`,memberId:member.id,material:customMaterial,properties:{E:member.E,G:member.G,density:member.density}});
      } else update({propertyProfile});
    }}><option value="exercise">{es?'Ejercicios · sin sección definida':'Exercises · unspecified section'}</option><option value="catalog">{es?'Catálogo':'Catalog'}</option><option value="custom">{es?'Personalizado':'Custom'}</option></select></label>
    <StiffnessEditor member={member}/>
    {profile==='exercise'?<>
      <p className="profile-editor__hint">{es?'Trabaja con EI, E o I sin asignar una forma ni un material al ejercicio.':'Work with EI, E or I without assigning a shape or material to the exercise.'}</p>
      <details className="inspector-disclosure" open={!linked}><summary>{es?'Valores propios y referencias numéricas':'Own values and numerical references'}</summary><div className="inspector-disclosure__body">
        <InspectorNumericField label="EI" value={member.E*member.I*eiFactor} unit={`${unitLabel(units,'force')}·${unitLabel(units,'length')}²`} language={language} resetKey={`${member.id}:EI:${units}`} validate={positive} disabled={linked} onCommit={v=>update({I:v/eiFactor/member.E})}/>
        <PhysicalNumberField label="E" value={member.E} units={units} quantity="elasticModulus" resetKey={`${member.id}:E`} validate={positive} disabled={linked&&mode!=='I'} onCommit={v=>update({E:v})}/>
        <PhysicalNumberField label="I" value={member.I} units={units} quantity="inertia" resetKey={`${member.id}:I`} validate={member.type==='truss'?v=>v>=0?undefined:'I ≥ 0':positive} disabled={linked&&mode!=='E'} onCommit={v=>update({I:v})}/>
        <PhysicalNumberField label="A" value={member.A} units={units} quantity="area" resetKey={`${member.id}:A`} validate={positive} onCommit={v=>update({A:v})}/>
        <p className="profile-editor__hint">{es?'Para editar una propiedad controlada, elige Valores propios en Rigidez.':'To edit a controlled property, choose Own values under Stiffness.'}</p>
      </div></details>
    </>:profile==='custom'?<>
      {linked?<p className="profile-editor__hint">{es?'Cambiar E o I sustituye la constante de esta barra por el valor que escribas.':'Editing E or I replaces this member’s constant with the value you enter.'}</p>:null}
      <CustomSectionEditor member={member}/>
      <CustomMaterialEditor member={member}/>
    </>:<div className="profile-editor__section">
      <MaterialPresetSelector units={units} selectedId={member.materialId} origin={member.materialOrigin} onSelect={m=>void executeProjectCommand({kind:'member.material.apply',description:`Material de ${member.id}`,memberId:member.id,materialId:m.id,properties:{E:m.elasticModulus,G:m.shearModulus,density:m.density}})}/>
      <SectionPresetSelector units={units} selectedId={member.sectionId} origin={member.sectionOrigin} onSelect={s=>void executeProjectCommand({kind:'member.section.apply',description:`Sección de ${member.id}`,memberId:member.id,sectionId:s.id,properties:{A:s.area,I:s.inertiaX}})}/>
      <p className="profile-editor__hint">{es?'Elige Personalizado para editar medidas y todos los parámetros del material.':'Choose Custom to edit dimensions and all material parameters.'}</p>
      <details className="inspector-disclosure"><summary>{es?'Favoritos':'Favorites'}</summary><div className="inspector-disclosure__body"><MemberFavoritesPanel project={project} member={member} language={language} units={units} executeProjectCommand={executeProjectCommand}/></div></details>
    </div>}
  </section>;
};
