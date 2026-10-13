import { useEffect, useState } from 'react';
import { materialDefinitionOf } from '../../data/memberProfiles';
import { standardMaterials } from '../../data/standardMaterials';
import { useProjectModel } from '../../store/ProjectModelContext';
import { useI18n } from '../../i18n/useI18n';
import type { CustomMemberMaterial, MemberModel } from '../../types';
import { PhysicalNumberField } from './InspectorPrimitives';
import { InspectorNumericField } from './InspectorNumericField';
import { toDisplay } from '../../foundation/units';
import { unitLabel } from '../../engine/units';

const categories: CustomMemberMaterial['category'][] = ['CONCRETE','STEEL','TIMBER','ALUMINUM','OTHER'];
const names={es:['Concreto','Acero','Madera','Aluminio','Otro material'],en:['Concrete','Steel','Timber','Aluminum','Other material']};
const fallback = ():CustomMemberMaterial=>({name:'Material personalizado',category:'OTHER',poissonRatio:.3,thermalExpansion:1.2e-5});
export const CustomMaterialEditor = ({member}:{member:MemberModel}) => {
  const {project,executeProjectCommand}=useProjectModel(); const {language}=useI18n(); const es=language==='es';const units=project.settings.units;
  const material=materialDefinitionOf(member)??fallback();
  const [name,setName]=useState(material.name);const [error,setError]=useState<string>();
  useEffect(()=>{setName(materialDefinitionOf(member)?.name??fallback().name);setError(undefined);},[member.id,member.customMaterial,member.materialId]);
  const write=(definition:CustomMemberMaterial,properties:Pick<MemberModel,'E'> & Pick<Partial<MemberModel>,'G'|'density'>={E:member.E,G:member.G,density:member.density})=>{
    setError(undefined);void executeProjectCommand({kind:'member.material.custom',description:`Material de ${member.id}`,memberId:member.id,material:definition,properties}).catch(e=>setError(String(e.message??e)));
  };
  const update=(patch:Partial<CustomMemberMaterial>)=>write({...material,...patch});
  const positive=(v:number)=>v>0?undefined:es?'Usa un valor mayor que cero.':'Use a positive value.';
  const nonNegative=(v:number)=>v>=0?undefined:es?'Usa un valor mayor o igual a cero.':'Use a non-negative value.';
  const selectCategory=(category:CustomMemberMaterial['category'])=>{
    const preset=standardMaterials.find(m=>m.category===category);
    const definition:CustomMemberMaterial={name:names[language][categories.indexOf(category)]!,category,poissonRatio:preset?.poissonRatio??.3,thermalExpansion:preset?.thermalExpansion??1.2e-5,
      ...(category==='CONCRETE'?{compressiveStrength:28000}:category!=='OTHER'?{yieldStrength:preset?.yieldStrength??250000}:{}),...(category==='STEEL'?{ultimateStrength:400000}:{})};
    // Only selecting a new family seeds it. Every seeded parameter remains editable.
    write(definition,{E:preset?.elasticModulus??member.E,G:preset?.shearModulus??member.G,density:preset?.density??member.density});
  };
  const weightFactor=toDisplay(1,units,'force')/toDisplay(1,units,'length')**3;
  return <div className="profile-editor__section">
    <h3>{es?'Material':'Material'}</h3>
    <label className="select-field"><span>{es?'Tipo de material':'Material type'}</span><select aria-label={es?'Tipo de material':'Material type'} value={material.category} onChange={e=>selectCategory(e.target.value as CustomMemberMaterial['category'])}>{categories.map((c,i)=><option key={c} value={c}>{names[language][i]}</option>)}</select></label>
    <label className="profile-editor__text"><span>{es?'Nombre del material':'Material name'}</span><input maxLength={80} value={name} onChange={e=>setName(e.target.value)} onBlur={()=>{if(name!==material.name)update({name});}} /></label>
    {material.category==='CONCRETE'?<>
      <PhysicalNumberField label={es?'Resistencia f′c':'Strength f′c'} value={material.compressiveStrength??28000} units={units} quantity="elasticModulus" resetKey={`${member.id}:fc`} hint={material.compressiveStrength===undefined?(es?'Valor sugerido; edítalo para guardarlo.':'Suggested value; edit to save.'):undefined} validate={positive} onCommit={v=>update({compressiveStrength:v})} />
      <button className="profile-editor__action" type="button" onClick={()=>{const E=4700*Math.sqrt((material.compressiveStrength??28000)/1000)*1000;write(material,{E,G:E/(2*(1+material.poissonRatio))});}}>{es?'Estimar E y G desde f′c':'Estimate E and G from f′c'}</button>
      <p className="profile-editor__hint">{es?'Concreto de peso normal: E = 4700√f′c (MPa). Puedes escribir otro E.':'Normal-weight concrete: E = 4700√f′c (MPa). You can enter a different E.'}</p>
    </>:<>
      <PhysicalNumberField label={material.category==='STEEL'?(es?'Fluencia Fy':'Yield strength Fy'):es?'Resistencia característica':'Characteristic strength'} value={material.yieldStrength??250000} units={units} quantity="elasticModulus" resetKey={`${member.id}:fy`} hint={material.yieldStrength===undefined?(es?'Valor sugerido; edítalo para guardarlo.':'Suggested value; edit to save.'):undefined} validate={positive} onCommit={v=>update({yieldStrength:v})} />
      <PhysicalNumberField label={es?'Resistencia última Fu':'Ultimate strength Fu'} value={material.ultimateStrength??400000} units={units} quantity="elasticModulus" resetKey={`${member.id}:fu`} validate={positive} hint={material.ultimateStrength===undefined?(es?'Se guarda cuando la editas.':'Saved when edited.'):undefined} onCommit={v=>update({ultimateStrength:v})} />
    </>}
    <PhysicalNumberField label="E" value={member.E} units={units} quantity="elasticModulus" resetKey={`${member.id}:E`} validate={positive} onCommit={v=>write(material,{E:v})} />
    <PhysicalNumberField label="G" value={member.G??member.E/(2*(1+material.poissonRatio))} units={units} quantity="elasticModulus" resetKey={`${member.id}:G`} validate={positive} onCommit={v=>write(material,{E:member.E,G:v})} />
    <details className="inspector-disclosure"><summary>{es?'Otros parámetros del material':'Other material parameters'}</summary><div className="inspector-disclosure__body">
      <InspectorNumericField label="Poisson ν" value={material.poissonRatio} language={language} resetKey={`${member.id}:nu`} validate={v=>v>-1&&v<.5?undefined:'−1 < ν < 0.5'} onCommit={v=>update({poissonRatio:v})} />
      <button className="profile-editor__action" type="button" onClick={()=>write(material,{E:member.E,G:member.E/(2*(1+material.poissonRatio))})}>{es?'Calcular G = E / [2(1 + ν)]':'Calculate G = E / [2(1 + ν)]'}</button>
      <PhysicalNumberField label={es?'Densidad ρ':'Density ρ'} value={member.density??0} units={units} quantity="density" resetKey={`${member.id}:rho`} validate={nonNegative} onCommit={v=>write(material,{E:member.E,density:v})} />
      <InspectorNumericField label={es?'Peso específico γ':'Unit weight γ'} value={(member.density??0)*.00980665*weightFactor} unit={`${unitLabel(units,'force')}/${unitLabel(units,'length')}³`} language={language} resetKey={`${member.id}:gamma:${units}`} validate={nonNegative} onCommit={v=>write(material,{E:member.E,density:v/weightFactor/.00980665})} />
      <InspectorNumericField label={es?'Dilatación térmica α':'Thermal expansion α'} value={material.thermalExpansion} unit="1/°C" language={language} resetKey={`${member.id}:alpha`} validate={nonNegative} onCommit={v=>update({thermalExpansion:v})} />
      <p className="profile-editor__hint">{es?'ρ y γ están vinculados por g = 9.80665 m/s². El efecto térmico puede usar otro α explícito.':'ρ and γ are linked by g = 9.80665 m/s². A thermal effect may specify a different α.'}</p>
    </div></details>
    {error?<p className="profile-editor__error" role="alert">{error}</p>:null}
  </div>;
};
