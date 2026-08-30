import { describe, expect, it } from 'vitest';
import { createDefaultProject } from '../../data/defaultProject';
import { applyProjectPatch, compileProjectCommand } from '../../commands/projectCommand';
import { buildDxfImportCommand, parseAsciiDxf } from './dxfParser';

/** Ensambla pares código/valor DXF en el texto ASCII plano que consume el parser. */
const ascii = (...pairs: Array<[number, string | number]>) =>
  pairs.flatMap(([code, value]) => [String(code), String(value)]).join('\n');

/**
 * Pruebas mínimas: la importación DXF es la única frontera que acepta
 * geometría de fuera del propio producto. Lo crítico no es cubrir cada tipo de
 * entidad — es que lo inaceptable se rechace con diagnóstico, y que lo
 * aceptado produzca un comando reversible como cualquier otro del historial.
 */
describe('parseAsciiDxf', () => {
  it('reconoce entidades planas soportadas (LINE, LWPOLYLINE recta)', () => {
    const inspection = parseAsciiDxf(ascii(
      [0, 'SECTION'], [2, 'ENTITIES'],
      [0, 'LINE'], [8, 'AXIS'], [10, 0], [20, 0], [11, 1000], [21, 0],
      [0, 'ENDSEC'], [0, 'EOF'],
    ));
    expect(inspection.segments).toHaveLength(1);
    expect(inspection.counts).toEqual({ accepted: 1, rejected: 0 });
    expect(inspection.canImport).toBe(true);
  });

  it('bloquea entidades no soportadas y curvas con diagnóstico explícito', () => {
    const inspection = parseAsciiDxf(ascii(
      [0, 'SECTION'], [2, 'ENTITIES'],
      [0, 'CIRCLE'], [10, 0], [20, 0], [40, 2],
      [0, 'ENDSEC'], [0, 'EOF'],
    ));
    expect(inspection.canImport).toBe(false);
    expect(inspection.diagnostics.map((item) => item.code)).toContain('unsupported-entity');
  });

  it('exige que el usuario elija unidad cuando el archivo no la declara', () => {
    const inspection = parseAsciiDxf(ascii(
      [0, 'SECTION'], [2, 'ENTITIES'], [0, 'LINE'], [10, 0], [20, 0], [11, 1], [21, 0], [0, 'ENDSEC'], [0, 'EOF'],
    ));
    expect(inspection.requiresUnitSelection).toBe(true);
  });
});

describe('buildDxfImportCommand', () => {
  it('produce un comando reversible: aplicar y deshacer devuelve el proyecto original', () => {
    const project = createDefaultProject();
    const inspection = parseAsciiDxf(ascii(
      [0, 'SECTION'], [2, 'HEADER'], [9, '$INSUNITS'], [70, 4], [0, 'ENDSEC'],
      [0, 'SECTION'], [2, 'ENTITIES'], [0, 'LINE'], [8, 'STEEL'], [10, 0], [20, 0], [11, 1000], [21, 0],
      [0, 'ENDSEC'], [0, 'EOF'],
    ));
    const command = buildDxfImportCommand(project, inspection, {
      sourceName: 'frame.dxf', sourceUnit: 'mm', templateMemberId: project.members[0].id,
    });
    const compiled = compileProjectCommand(project, command);
    const imported = applyProjectPatch(project, compiled.forward);

    expect(imported.members.length).toBe(project.members.length + 1);
    expect(applyProjectPatch(imported, compiled.inverse)).toEqual(project);
  });
});
