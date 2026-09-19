import { describe, expect, it } from 'vitest';
import { createDefaultProject } from '../data/defaultProject';
import type { MemberDesignAssignment } from '../types';
import { applyProjectPatch, compileProjectCommand, type ProjectPatch } from './projectCommand';

const concreteBeamAssignment = (id = 'DESIGN-M2'): MemberDesignAssignment => ({
  id,
  memberId: 'M2',
  kind: 'reinforced-concrete-beam',
  standardId: 'ntc-cdmx-2023-concrete',
  ultimateCombinationId: 'NTC-CDMX-2023-ORD',
  serviceCombinationId: 'COMB1',
  coverMm: 40,
  longitudinalSteelYieldMpa: 420,
  stirrupSteelYieldMpa: 420,
  preferredLongitudinalDiametersMm: [12, 16, 20, 25, 32],
  preferredStirrupDiametersMm: [8, 10, 12],
  stirrupLegs: 2,
});

const assignmentPatch = (...assignments: MemberDesignAssignment[]): ProjectPatch => ({
  description: 'Agregar asignaciones de prueba',
  operations: assignments.map((assignment, index) => ({
    collection: 'designAssignments',
    id: assignment.id,
    index,
    before: null,
    after: assignment,
  })),
});

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
    project.designAssignments = [concreteBeamAssignment()];
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

  it('rechaza dos asignaciones para el mismo miembro al aplicar un patch', () => {
    const project = createDefaultProject();

    expect(() => applyProjectPatch(project, assignmentPatch(
      concreteBeamAssignment('DESIGN-M2-A'),
      concreteBeamAssignment('DESIGN-M2-B'),
    ))).toThrow(/ya tiene una asignación/);
  });

  it.each<{
    name: string;
    mutate: (assignment: MemberDesignAssignment) => void;
    error: RegExp;
  }>([
    { name: 'miembro inexistente', mutate: (value) => { value.memberId = 'DOES-NOT-EXIST'; }, error: /miembro inexistente/ },
    { name: 'combinación última inexistente', mutate: (value) => { value.ultimateCombinationId = 'DOES-NOT-EXIST'; }, error: /combinación última inexistente/ },
    { name: 'combinación de servicio inexistente', mutate: (value) => { value.serviceCombinationId = 'DOES-NOT-EXIST'; }, error: /combinación de servicio inexistente/ },
    { name: 'kind no soportado', mutate: (value) => { Reflect.set(value, 'kind', 'steel-beam'); }, error: /kind no soportado/ },
    { name: 'standardId no soportado', mutate: (value) => { Reflect.set(value, 'standardId', 'aci-318'); }, error: /standardId no soportado/ },
    { name: 'recubrimiento no positivo', mutate: (value) => { value.coverMm = 0; }, error: /coverMm debe ser positivo/ },
    { name: 'fluencia longitudinal no positiva', mutate: (value) => { value.longitudinalSteelYieldMpa = -1; }, error: /longitudinalSteelYieldMpa debe ser positivo/ },
    { name: 'fluencia de estribo no finita', mutate: (value) => { value.stirrupSteelYieldMpa = Number.NaN; }, error: /stirrupSteelYieldMpa debe ser positivo/ },
    { name: 'diámetros longitudinales vacíos', mutate: (value) => { value.preferredLongitudinalDiametersMm = []; }, error: /preferredLongitudinalDiametersMm no puede estar vacío/ },
    { name: 'diámetro longitudinal no positivo', mutate: (value) => { value.preferredLongitudinalDiametersMm = [12, 0]; }, error: /preferredLongitudinalDiametersMm debe contener diámetros positivos/ },
    { name: 'diámetros longitudinales repetidos', mutate: (value) => { value.preferredLongitudinalDiametersMm = [12, 12]; }, error: /preferredLongitudinalDiametersMm no puede repetir diámetros/ },
    { name: 'diámetros de estribo vacíos', mutate: (value) => { value.preferredStirrupDiametersMm = []; }, error: /preferredStirrupDiametersMm no puede estar vacío/ },
    { name: 'diámetro de estribo no finito', mutate: (value) => { value.preferredStirrupDiametersMm = [8, Number.NaN]; }, error: /preferredStirrupDiametersMm debe contener diámetros positivos/ },
    { name: 'diámetros de estribo repetidos', mutate: (value) => { value.preferredStirrupDiametersMm = [8, 8]; }, error: /preferredStirrupDiametersMm no puede repetir diámetros/ },
    { name: 'stirrupLegs distinto de 2 o 4', mutate: (value) => { Reflect.set(value, 'stirrupLegs', 3); }, error: /stirrupLegs debe ser 2 o 4/ },
  ])('rechaza una asignación con $name al aplicar un patch', ({ mutate, error }) => {
    const project = createDefaultProject();
    const assignment = concreteBeamAssignment();
    mutate(assignment);

    expect(() => applyProjectPatch(project, assignmentPatch(assignment))).toThrow(error);
  });
});
