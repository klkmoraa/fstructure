import type { MemberModel } from '../../types';
import { MemberProfileEditor as SectionProfile } from './MemberSectionProfileEditor';
import { MemberCurveEditor } from './MemberCurveEditor';
export { memberProfileOf } from './MemberSectionProfileEditor';
export const MemberProfileEditor = ({ member }: { member: MemberModel }) => <>
  <MemberCurveEditor member={member} />
  <SectionProfile member={member} />
</>;
