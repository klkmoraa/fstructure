import { useEffect, useState } from 'react';
import { calculateParametricSection, createPersonalSection, readPersonalSections, writePersonalSections, type ParametricSectionDefinition } from '../../data/personalSections';
import { defaultParametricDefinition } from '../../data/parametricSectionDefaults';
import { sectionDefinitionOf, activeCustomSection } from '../../data/memberProfiles';
import { useProjectModel } from '../../store/ProjectModelContext';
import { useI18n } from '../../i18n/useI18n';
import type { CustomMemberSection, MemberModel } from '../../types';
import { PhysicalNumberField, InspectorDerivedList } from './InspectorPrimitives';
import { PersonalSectionSelector } from './PersonalSectionSelector';
import { formatInspectorValue } from './numericFormatting';
import { toDisplay } from '../../foundation/units';
import { unitLabel } from '../../engine/units';

const families: ParametricSectionDefinition['family'][] = ['rectangle','circle','symmetric-i','channel','angle','rectangular-box','circular-tube'];
const labels = { es:['Rectangular sólida','Circular sólida','I simétrica','Canal U','Ángulo L','Caja rectangular','Tubo circular'], en:['Solid rectangle','Solid circle','Symmetric I','Channel','Angle','Rectangular box','Circular tube'] };
const dimensionLabels: Record<string, [string,string]> = { width:['Ancho b','Width b'], depth:['Peralte h','Depth h'], diameter:['Diámetro d','Diameter d'], outerDiameter:['Diámetro exterior D','Outer diameter D'], webThickness:['Espesor del alma tw','Web thickness tw'], flangeThickness:['Espesor del patín tf','Flange thickness tf'], thickness:['Espesor t','Thickness t'] };

export const CustomSectionEditor = ({ member }: { member: MemberModel }) => {
  const { project, executeProjectCommand } = useProjectModel(); const { language } = useI18n(); const es = language === 'es';
  const units = project.settings.units;
  const [draft,setDraft] = useState<CustomMemberSection | undefined>(()=>sectionDefinitionOf(member));
  const [error,setError] = useState<string>(); const [saved,setSaved] = useState(false);
  useEffect(()=>{setDraft(sectionDefinitionOf(member));setError(undefined);setSaved(false);},[member.id,member.customSection,member.sectionId,member.sectionOrigin]);
  const apply = (section: CustomMemberSection) => {
    setDraft(section);setSaved(false);
    try { calculateParametricSection(section.definition);setError(undefined);
      void executeProjectCommand({kind:'member.section.custom',description:`Sección de ${member.id}`,memberId:member.id,section}).catch(e=>setError(String(e.message ?? e)));
    } catch(e) {setError(e instanceof Error?e.message:String(e));}
  };
  const direct = () => {
    setDraft(undefined);setError(undefined);
    void executeProjectCommand({kind:'member.update',description:`Propiedades de ${member.id}`,memberId:member.id,changes:{customSection:undefined}});
  };
  const positive = (value:number) => value>0?undefined:es?'Usa un valor mayor que cero.':'Use a positive value.';
  const own = (key:'A'|'I',value:number) => void executeProjectCommand({kind:'member.update',description:`${key} de ${member.id}`,memberId:member.id,changes:{[key]:value}});
  const save = () => {
    if(!draft)return;
    try { const sections=readPersonalSections(localStorage);const next=createPersonalSection(sections,draft);writePersonalSections(localStorage,next);setSaved(true);setError(undefined); }
    catch(e){setError(e instanceof Error?e.message:String(e));}
  };
  return <div className="profile-editor__section">
    <h3>{es?'Sección':'Section'}</h3>
    <label className="select-field"><span>{es?'Forma de la sección':'Section shape'}</span><select aria-label={es?'Forma de la sección':'Section shape'} value={draft?.definition.family??'direct'} onChange={e=>e.target.value==='direct'?direct():apply({name:draft?.name??(es?'Sección personalizada':'Custom section'),definition:defaultParametricDefinition(e.target.value as ParametricSectionDefinition['family'])})}>
      <option value="direct">{es?'Valores A e I':'A and I values'}</option>{families.map((family,i)=><option key={family} value={family}>{labels[language][i]}</option>)}
    </select></label>
    {draft?<>
      <label className="profile-editor__text"><span>{es?'Nombre de la sección':'Section name'}</span><input value={draft.name} maxLength={80} onChange={e=>setDraft({...draft,name:e.target.value})} onBlur={()=>{
        if(draft.name === sectionDefinitionOf(member)?.name)return;
        void executeProjectCommand({kind:'member.update',description:`Nombre de sección de ${member.id}`,memberId:member.id,changes:{customSection:draft}}).catch(e=>setError(String(e.message??e)));
      }} /></label>
      <div className="profile-editor__dimensions">{Object.entries(draft.definition).filter(([key])=>key!=='family').map(([key,value])=><PhysicalNumberField key={key} label={dimensionLabels[key]![es?0:1]} value={value as number} units={units} quantity="length" resetKey={`${member.id}:${draft.definition.family}:${key}`} validate={v=>v>=.001&&v<=10?undefined:es?'La medida debe estar entre 0.001 y 10 m.':'Dimension must be between 0.001 and 10 m.'} onCommit={v=>apply({...draft,definition:{...draft.definition,[key]:v} as ParametricSectionDefinition})} />)}</div>
      <InspectorDerivedList rows={[{label:'A',value:formatInspectorValue(toDisplay(member.A,units,'area'),unitLabel(units,'area'))},{label:'I',value:formatInspectorValue(toDisplay(member.I,units,'inertia'),unitLabel(units,'inertia'))}]} />
      {!activeCustomSection(member) && !error?<p className="profile-editor__hint">{es?'A/I propios o constantes sustituyen la geometría. Las medidas se conservan; puedes volver a aplicarlas.':'Own A/I or constants override this geometry. Dimensions are kept and can be reapplied.'}</p>:null}
      {!activeCustomSection(member)?<button className="profile-editor__action" type="button" onClick={()=>apply(draft)}>{es?'Aplicar estas medidas':'Apply these dimensions'}</button>:null}
      <button className="profile-editor__action" type="button" disabled={Boolean(error)} onClick={save}>{saved?(es?'Guardada en tu biblioteca':'Saved in your library'):(es?'Guardar sección en mi biblioteca':'Save section to my library')}</button>
    </>:<>
      <PhysicalNumberField label="A" value={member.A} units={units} quantity="area" resetKey={`${member.id}:A`} validate={positive} onCommit={v=>own('A',v)} />
      <PhysicalNumberField label="I" value={member.I} units={units} quantity="inertia" resetKey={`${member.id}:I`} validate={member.type==='truss'?v=>v>=0?undefined:'I ≥ 0':positive} onCommit={v=>own('I',v)} />
    </>}
    {error?<p className="profile-editor__error" role="alert">{error}</p>:null}
    <details className="inspector-disclosure"><summary>{es?'Usar una sección de mi biblioteca':'Use a section from my library'}</summary><div className="inspector-disclosure__body"><PersonalSectionSelector units={units} onSelect={s=>apply({name:s.name,definition:s.definition})} /></div></details>
  </div>;
};
