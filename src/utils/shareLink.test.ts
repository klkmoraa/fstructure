import { describe, expect, it } from 'vitest';
import { createDefaultProject } from '../data/defaultProject';
import { buildShareLink, decodeProjectFragment, encodeProjectFragment } from './shareLink';

/**
 * Pruebas mínimas: un enlace compartido reemplaza al proyecto activo del que
 * lo recibe, así que `decodeProjectFragment` es una frontera de importación
 * igual de sensible que un archivo — sólo que llega por la URL.
 */
describe('encodeProjectFragment / decodeProjectFragment', () => {
  it('codifica y decodifica el mismo proyecto', () => {
    const project = createDefaultProject();
    const encoded = encodeProjectFragment(project);
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) return;

    const decoded = decodeProjectFragment(encoded.fragment);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.project.nodes).toEqual(project.nodes);
    expect(decoded.project.members).toEqual(project.members);
  });

  it('un fragmento sin el prefijo propio se ignora como ausente, no como error', () => {
    expect(decodeProjectFragment('#otracosa')).toEqual({ ok: false, reason: 'absent' });
  });

  it('un fragmento con el prefijo pero contenido corrupto se rechaza como malformado', () => {
    expect(decodeProjectFragment('m1:esto-no-es-base64-válido')).toEqual({ ok: false, reason: 'malformed' });
  });

  it('buildShareLink coloca el fragmento en el hash de la URL', () => {
    const result = buildShareLink(createDefaultProject(), 'https://ejemplo.test/app');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.url.startsWith('https://ejemplo.test/app#m1:')).toBe(true);
  });
});
