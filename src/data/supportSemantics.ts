import type { PrescribedDisplacement, SupportDefinition } from '../types';

type PrescribedComponent = PrescribedDisplacement['component'];

/** Components that a support constrains directly and can therefore prescribe. */
export const prescribedComponentsForSupport = (support: SupportDefinition): ReadonlySet<PrescribedComponent> => {
  switch (support.type) {
    case 'pin': return new Set<PrescribedComponent>(['ux', 'uy']);
    case 'fixed': return new Set<PrescribedComponent>(['ux', 'uy', 'rz']);
    case 'roller': return new Set<PrescribedComponent>(['normal']);
    case 'custom': return new Set([
      ...(support.restrainX ? ['ux'] : []),
      ...(support.restrainY ? ['uy'] : []),
      ...(support.restrainR ? ['rz'] : []),
    ] as PrescribedComponent[]);
    case 'none': return new Set<PrescribedComponent>();
  }
};

/** Removes only the project settlements invalidated by changing one support. */
export const discardIncompatiblePrescribedDisplacements = (
  prescribedDisplacements: readonly PrescribedDisplacement[],
  nodeId: string,
  support: SupportDefinition,
): PrescribedDisplacement[] => {
  const allowed = prescribedComponentsForSupport(support);
  return prescribedDisplacements.filter((item) => item.nodeId !== nodeId || allowed.has(item.component));
};

/** Removes legacy inline settlements that the resulting support cannot enforce. */
export const discardIncompatibleInlineSupportPrescribed = (support: SupportDefinition): SupportDefinition => {
  if (!support.prescribed) return support;
  const allowed = prescribedComponentsForSupport(support);
  const kept = Object.entries(support.prescribed)
    .filter(([component, value]) => allowed.has(component as PrescribedComponent) && value !== undefined);
  if (kept.length > 0) return { ...support, prescribed: Object.fromEntries(kept) as SupportDefinition['prescribed'] };
  const { prescribed: _prescribed, ...withoutPrescribed } = support;
  return withoutPrescribed;
};
