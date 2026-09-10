import { describe, expect, it } from 'vitest';

import { discardIncompatiblePrescribedDisplacements, prescribedComponentsForSupport } from './supportSemantics';

describe('support prescribed-displacement semantics', () => {
  it('exposes only the degrees of freedom actually restrained by each support', () => {
    expect([...prescribedComponentsForSupport({ type: 'fixed' })]).toEqual(['ux', 'uy', 'rz']);
    expect([...prescribedComponentsForSupport({ type: 'pin' })]).toEqual(['ux', 'uy']);
    expect([...prescribedComponentsForSupport({ type: 'roller' })]).toEqual(['normal']);
    expect([...prescribedComponentsForSupport({ type: 'custom', restrainY: true, restrainR: true })]).toEqual(['uy', 'rz']);
    expect([...prescribedComponentsForSupport({ type: 'none', spring: { ky: 1000 } })]).toEqual([]);
  });

  it('removes project settlements that become incompatible after choosing an elastic support', () => {
    const kept = discardIncompatiblePrescribedDisplacements([
      { id: 'normal-on-roller', nodeId: 'N1', caseId: 'LC1', component: 'normal', value: 0.01 },
      { id: 'other-node', nodeId: 'N2', caseId: 'LC1', component: 'ux', value: 0.02 },
    ], 'N1', { type: 'none', spring: { ky: 1000 } });

    expect(kept).toEqual([{ id: 'other-node', nodeId: 'N2', caseId: 'LC1', component: 'ux', value: 0.02 }]);
  });
});
