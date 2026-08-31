import { describe, expect, it } from 'vitest';
import { createDefaultProject } from '../data/defaultProject';
import { unavailableAnalysis } from '../engine/analysisFailure';
import {
  createPortablePayload,
  parsePortablePayload,
  serializePortablePayload,
  verifyPortablePayload,
} from './portablePayload';

/**
 * Pruebas mínimas: el checksum es lo único que distingue un expediente
 * genuino de uno modificado a mano o dañado en el camino. Sin esta prueba,
 * un cambio que rompiera el cálculo del checksum pasaría inadvertido — todo
 * expediente seguiría "verificando" porque el emisor y el verificador estarían
 * de acuerdo en el error.
 */
describe('createPortablePayload / verifyPortablePayload / parsePortablePayload', () => {
  it('un expediente recién creado verifica su propio checksum', async () => {
    const payload = await createPortablePayload(createDefaultProject(), unavailableAnalysis('sin análisis'));
    expect(await verifyPortablePayload(payload)).toBe(true);
  });

  it('serializar y volver a analizar produce un expediente que sigue verificando', async () => {
    const payload = await createPortablePayload(createDefaultProject(), unavailableAnalysis('sin análisis'));
    const parsed = await parsePortablePayload(serializePortablePayload(payload));
    expect(parsed).toEqual(payload);
  });

  it('detecta un expediente manipulado tras la creación', async () => {
    const payload = await createPortablePayload(createDefaultProject(), unavailableAnalysis('sin análisis'));
    const tampered = { ...payload, metadata: { ...payload.metadata, projectName: 'Nombre alterado' } };
    expect(await verifyPortablePayload(tampered)).toBe(false);
    await expect(parsePortablePayload(serializePortablePayload(tampered))).rejects.toThrow(/checksum/);
  });

  it('rechaza un adjunto que no tiene la forma de un expediente FusionStructure', async () => {
    await expect(parsePortablePayload(JSON.stringify({ hola: 'mundo' }))).rejects.toThrow(/no es un expediente/);
    await expect(parsePortablePayload('esto no es JSON')).rejects.toThrow(/JSON válido/);
  });
});
