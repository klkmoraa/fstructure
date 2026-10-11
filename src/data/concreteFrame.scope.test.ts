import { expect, it } from 'vitest';
import { createConcreteFrameProject } from './defaultProject';
import { concreteFrameGroups, withConcreteSections } from './concreteFrame';

it('limita la propuesta aplicada a los miembros del conjunto seleccionado', () => {
  const original = createConcreteFrameProject();
  const groups = concreteFrameGroups(original);
  const selected = groups.find((group) => group.kind === 'column')!;
  const untouched = groups.find((group) => group.kind === 'beam')!;
  const scope = selected.memberIds;
  const changed = withConcreteSections(original, { beam: { widthMm: 400, heightMm: 600 }, column: { widthMm: 400, heightMm: 400 } }, [], scope);
  for (const id of scope) expect(changed.members.find((member) => member.id === id)?.A).toBeCloseTo(.16, 12);
  for (const id of untouched.memberIds) expect(changed.members.find((member) => member.id === id)).toEqual(original.members.find((member) => member.id === id));
});
