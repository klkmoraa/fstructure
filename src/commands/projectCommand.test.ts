import { describe, expect, it } from 'vitest';
import { createDefaultProject } from '../data/defaultProject';
import { applyProjectPatch, compileProjectCommand } from './projectCommand';

/**
 * Pruebas mínimas del contrato del que dependen deshacer/rehacer y el
 * historial entero: todo comando compila a un patch de ida y uno de vuelta, y
 * aplicar los dos en secuencia tiene que devolver exactamente el proyecto de
 * partida. Si ese contrato se rompe, el historial no falla con un error — el
 * usuario deshace y el modelo queda distinto al que tenía antes de rehacer.
 */
describe('compileProjectCommand / applyProjectPatch', () => {
  it('aplicar el patch de ida y luego el de vuelta reproduce el proyecto original', () => {
    const project = createDefaultProject();
    const memberId = project.members[0].id;
    const compiled = compileProjectCommand(project, {
      kind: 'member.update',
      description: 'prueba',
      memberId,
      changes: { E: 999 },
    });

    const forwarded = applyProjectPatch(project, compiled.forward);
    expect(forwarded.members.find((m) => m.id === memberId)?.E).toBe(999);

    const reverted = applyProjectPatch(forwarded, compiled.inverse);
    expect(reverted).toEqual(project);
  });

  it('rechaza un comando que referencia un miembro inexistente', () => {
    const project = createDefaultProject();
    expect(() => compileProjectCommand(project, {
      kind: 'member.update',
      description: 'prueba',
      memberId: 'DOES-NOT-EXIST',
      changes: { E: 1 },
    })).toThrow(/No existe el miembro/);
  });

  it('elimina y restaura la asignación de diseño junto con su miembro', () => {
    const project = createDefaultProject();
    project.designAssignments = [{
      id: 'DESIGN-M2', memberId: 'M2', kind: 'reinforced-concrete-beam', standardId: 'ntc-cdmx-2023-concrete',
      ultimateCombinationId: 'NTC-CDMX-2023-ORD', serviceCombinationId: 'COMB1', coverMm: 40,
      longitudinalSteelYieldMpa: 420, stirrupSteelYieldMpa: 420,
      preferredLongitudinalDiametersMm: [12, 16, 20, 25, 32], preferredStirrupDiametersMm: [8, 10, 12], stirrupLegs: 2,
    }];
    const compiled = compileProjectCommand(project, {
      kind: 'member.delete',
      description: 'Eliminar M2',
      memberId: 'M2',
    });

    const deleted = applyProjectPatch(project, compiled.forward);
    expect(deleted.designAssignments).toEqual([]);

    const restored = applyProjectPatch(deleted, compiled.inverse);
    expect(restored).toEqual(project);
  });
});
