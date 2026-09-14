import { describe, expect, it } from 'vitest';
import type { MemberDesignAssignment, ProjectModel } from '../types';
import { createBlankProject, createDefaultProject, CURRENT_SCHEMA_VERSION } from './defaultProject';
import { normalizeProject } from './migrate';

type DesignAssignmentsAreRequired = ProjectModel extends { designAssignments: MemberDesignAssignment[] } ? true : false;
const designAssignmentsAreRequired: DesignAssignmentsAreRequired = true;

const concreteBeamAssignment = (memberId = 'M2') => ({
  id: 'DESIGN-M2',
  memberId,
  kind: 'reinforced-concrete-beam' as const,
  standardId: 'ntc-cdmx-2023-concrete' as const,
  ultimateCombinationId: 'NTC-CDMX-2023-ORD',
  serviceCombinationId: 'COMB1',
  coverMm: 40,
  longitudinalSteelYieldMpa: 420,
  stirrupSteelYieldMpa: 420,
  preferredLongitudinalDiametersMm: [12, 16, 20, 25, 32],
  preferredStirrupDiametersMm: [8, 10, 12],
  stirrupLegs: 2 as const,
});

/**
 * Pruebas mínimas: `normalizeProject` es el único portal por el que entra
 * cualquier dato ajeno (un archivo abierto, un enlace compartido, la copia de
 * respaldo local). Estos cuatro casos son los que, si se rompen, o pierden un
 * proyecto real en silencio o dejan pasar uno que no debería aceptarse.
 */
describe('normalizeProject', () => {
  it('declara designAssignments como parte requerida del modelo', () => {
    expect(designAssignmentsAreRequired).toBe(true);
  });

  it('crea proyectos nuevos con la colección de diseño inicializada', () => {
    expect(createBlankProject().designAssignments).toEqual([]);
    expect(createDefaultProject().designAssignments).toEqual([]);
  });

  it('conserva un proyecto en el esquema actual sin pérdidas', () => {
    const source = createDefaultProject();
    const normalized = normalizeProject(JSON.parse(JSON.stringify(source)));
    expect(normalized).toEqual(source);
  });

  it('migra un esquema antiguo al actual', () => {
    const source = createDefaultProject();
    const { designAssignments: _designAssignments, ...legacyProject } = source;
    const legacy = { ...legacyProject, schemaVersion: 7 };
    const normalized = normalizeProject(legacy);
    expect(normalized.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(normalized.designAssignments).toEqual([]);
  });

  it('conserva una asignación de diseño v8 al exportar e importar el proyecto', () => {
    const source = createDefaultProject();
    source.designAssignments = [concreteBeamAssignment()];

    const normalized = normalizeProject(JSON.parse(JSON.stringify(source)));

    expect(CURRENT_SCHEMA_VERSION).toBe(8);
    expect(normalized.designAssignments).toEqual([concreteBeamAssignment()]);
  });

  it('completa los valores predeterminados de una asignación migrada', () => {
    const source = createDefaultProject() as unknown as Record<string, unknown>;
    source.designAssignments = [{
      id: 'DESIGN-M2',
      memberId: 'M2',
      kind: 'reinforced-concrete-beam',
      standardId: 'ntc-cdmx-2023-concrete',
      ultimateCombinationId: 'NTC-CDMX-2023-ORD',
      serviceCombinationId: 'COMB1',
    }];

    expect(normalizeProject(source).designAssignments).toEqual([concreteBeamAssignment()]);
  });

  it.each(['2', '4'])('rechaza stirrupLegs cuando llega como string "%s"', (stirrupLegs) => {
    const source = createDefaultProject();
    const assignment = concreteBeamAssignment();
    Reflect.set(assignment, 'stirrupLegs', stirrupLegs);
    source.designAssignments = [assignment];

    expect(() => normalizeProject(source)).toThrow(/designAssignments\[0\]\.stirrupLegs/);
  });

  it('rechaza asignaciones con referencias rotas o una segunda asignación del mismo miembro', () => {
    const brokenMember = createDefaultProject();
    brokenMember.designAssignments = [concreteBeamAssignment('DOES-NOT-EXIST')];
    expect(() => normalizeProject(brokenMember)).toThrow(/designAssignments\[0\]\.memberId/);

    const brokenCombination = createDefaultProject();
    brokenCombination.designAssignments = [{
      ...concreteBeamAssignment(),
      ultimateCombinationId: 'DOES-NOT-EXIST',
    }];
    expect(() => normalizeProject(brokenCombination)).toThrow(/designAssignments\[0\]\.ultimateCombinationId/);

    const duplicatedMember = createDefaultProject();
    duplicatedMember.designAssignments = [
      concreteBeamAssignment(),
      { ...concreteBeamAssignment(), id: 'DESIGN-M2-SECOND' },
    ];
    expect(() => normalizeProject(duplicatedMember)).toThrow(/designAssignments\[1\]\.memberId/);
  });

  it('preserva una identidad personalizada válida al migrar un proyecto persistido', () => {
    const source = createDefaultProject();
    const legacy = {
      ...source,
      schemaVersion: 2,
      settings: { ...source.settings, units: 'custom:T%20%2F%20M:t:m' },
    };

    expect(normalizeProject(legacy).settings.units).toBe('custom:T%20%2F%20M:t:m');
  });

  it('rechaza un esquema más nuevo que el que la aplicación conoce', () => {
    expect(() => normalizeProject({
      ...createDefaultProject(),
      schemaVersion: CURRENT_SCHEMA_VERSION + 1,
    })).toThrow(/más nueva/);
  });

  it('rechaza valores no finitos y referencias rotas señalando el campo', () => {
    const nonFinite = createDefaultProject();
    nonFinite.nodes[0].x = Number.NaN;
    expect(() => normalizeProject(nonFinite)).toThrow(/nodes\[0\]\.x/);

    const brokenRef = createDefaultProject();
    brokenRef.members[0].i = 'DOES-NOT-EXIST';
    expect(() => normalizeProject(brokenRef)).toThrow(/members\[0\]\.i/);
  });
});
