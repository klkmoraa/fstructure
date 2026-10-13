import { useState } from 'react';
import { supportsStiffness } from '../../data/memberStiffness';
import { useProjectModel } from '../../store/ProjectModelContext';
import { useI18n } from '../../i18n/useI18n';
import type { MemberModel } from '../../types';
import { InspectorNumericField } from './InspectorNumericField';
import { StiffnessEditor } from './StiffnessEditor';
export const MultiStiffnessEditor = ({members}:{members:readonly MemberModel[]}) => {
  const {project,executeProjectCommand}=useProjectModel();const {language}=useI18n();const es=language==='es';const base=project.settings.stiffnessDefaults;
  const [factor,setFactor]=useState(1);
  const compatible=base?members.filter(m=>supportsStiffness(m,base)):[];
  const write=(factor?:number)=>void executeProjectCommand({kind:'members.stiffness.set',description:es?'Rigidez de la selección':'Selection stiffness',memberIds:(factor===undefined?members:compatible).map(m=>m.id),factor});
  return <div className="stiffness-editor">
    <header><h3>{es?'Rigidez de la selección':'Selection stiffness'}</h3><span>{members.length} {es?'barras':'members'}</span></header>
    {base?<>
      <InspectorNumericField label={es?'Factor de las barras seleccionadas':'Selected members factor'} value={factor} unit={`× ${base.mode}`} language={language} resetKey="multi:factor" validate={v=>v>0?undefined:'Factor > 0'} onCommit={setFactor}/>
      <button className="stiffness-editor__apply" type="button" disabled={!compatible.length} onClick={()=>write(factor)}>{es?`Aplicar ${factor===1?'':factor}${base.mode} a ${compatible.length} barras compatibles`:`Apply ${factor===1?'':factor}${base.mode} to ${compatible.length} compatible members`}</button>
      <button className="stiffness-editor__apply" type="button" onClick={()=>write()}>{es?'Usar valores propios en la selección':'Use own values for selection'}</button>
    </>:null}
    <details className="stiffness-editor__disclosure"><summary>{es?'Base y predeterminados del proyecto':'Project base and defaults'}</summary><StiffnessEditor/></details>
  </div>;
};
