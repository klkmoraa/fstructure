import { useState } from 'react';
import { readPersonalSections, type PersonalParametricSection } from '../../data/personalSections';
import { unitLabel } from '../../engine/units';
import { toDisplay } from '../../foundation/units';
import { useI18n } from '../../i18n/useI18n';
import type { UnitSystemId } from '../../foundation/units';
import { formatInspectorValue } from './numericFormatting';

/** The editor lives inline under Custom; the library only recalls saved geometry. */
export const PersonalSectionSelector = ({units,onSelect}:{units:UnitSystemId;onSelect:(section:PersonalParametricSection)=>void})=>{
  const {t}=useI18n();const [sections,setSections]=useState(()=>readPersonalSections(localStorage));
  return <label className="select-field"><span>{t('inspector.personalSection')}</span><select aria-label={t('inspector.personalSection')} value="" onFocus={()=>setSections(readPersonalSections(localStorage))} onChange={e=>{const section=sections.find(s=>s.id===e.target.value);if(section)onSelect(section);}}>
    <option value="">{sections.length?t('inspector.personalSectionPlaceholder'):t('inspector.personalSectionEmpty')}</option>
    {sections.map(s=><option key={s.id} value={s.id}>{s.name} · A {formatInspectorValue(toDisplay(s.properties.area,units,'area'),unitLabel(units,'area'))}</option>)}
  </select></label>;
};
