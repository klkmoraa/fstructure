import { describe, expect, it } from 'vitest';

import {
  createFavorite,
  PERSONAL_LIBRARY_STORAGE_KEY,
  readPersonalLibrary,
  writePersonalLibrary,
} from './personalLibrary';

const memoryStorage = (): Storage => {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => { values.clear(); },
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => [...values.keys()][index] ?? null,
    removeItem: (key: string) => { values.delete(key); },
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
};

describe('personal library unit persistence', () => {
  it('round-trips a percent-encoded custom id and a historical special profile exactly', () => {
    const storage = memoryStorage();
    const customUnits = 'custom:Puente%20T%2FM:t:m' as const;
    const customFavorite = createFavorite([], {
      kind: 'material',
      name: 'Acero para puente',
      materialId: 'steel-a36',
      unitsAtSave: customUnits,
    }, 'favorite:custom-units', '2026-09-03T12:00:00.000Z');
    const library = createFavorite(customFavorite, {
      kind: 'material',
      name: 'Perfil imperial',
      materialId: 'steel-a992',
      unitsAtSave: 'kip-ft',
    }, 'favorite:kip-ft', '2026-09-03T12:01:00.000Z');

    expect(writePersonalLibrary(storage, library)).toEqual({ ok: true });
    expect(JSON.parse(storage.getItem(PERSONAL_LIBRARY_STORAGE_KEY)!)).toMatchObject({
      favorites: [
        { unitsAtSave: customUnits },
        { unitsAtSave: 'kip-ft' },
      ],
    });
    expect(readPersonalLibrary(storage)).toEqual(library);
  });

  it('fails closed when persisted favorites contain a malformed custom unit id', () => {
    const storage = memoryStorage();
    const library = createFavorite([], {
      kind: 'material',
      name: 'Acero para puente',
      materialId: 'steel-a36',
      unitsAtSave: 'custom:Puente%20T%2FM:t:m',
    }, 'favorite:custom-units', '2026-09-03T12:00:00.000Z');
    expect(writePersonalLibrary(storage, library)).toEqual({ ok: true });

    const payload = JSON.parse(storage.getItem(PERSONAL_LIBRARY_STORAGE_KEY)!) as { favorites: Array<{ unitsAtSave: string }> };
    payload.favorites[0]!.unitsAtSave = 'custom:Puente%00T:t:m';
    storage.setItem(PERSONAL_LIBRARY_STORAGE_KEY, JSON.stringify(payload));

    expect(readPersonalLibrary(storage)).toEqual([]);
  });
});
