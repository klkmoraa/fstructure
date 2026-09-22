import { describe, expect, it } from 'vitest';
import { enWorkspace } from '../../i18n/catalogs/en-workspace';
import { esWorkspace } from '../../i18n/catalogs/es-workspace';
import { parseNaturalLanguageStructuralPrompt } from '../../space3d/engine/space3dGenerative';
import { PROMPT_SUGGESTIONS } from './Space3DGenerativeModal';

/**
 * Los chips inyectan su propio texto en el parser. Si una traducción deja de
 * ser reconocible, la sugerencia genera un arquetipo distinto al que anuncia,
 * así que el contrato se prueba sobre el catálogo real y no sobre literales.
 */
describe('generator prompt suggestions', () => {
  const catalogs: ReadonlyArray<readonly [string, Record<string, string>]> = [
    ['es', esWorkspace as unknown as Record<string, string>],
    ['en', enWorkspace as unknown as Record<string, string>],
  ];

  for (const [language, catalog] of catalogs) {
    describe(language, () => {
      for (const suggestion of PROMPT_SUGGESTIONS) {
        it(`resolves "${suggestion.id}" from its localized prompt`, () => {
          const label = catalog[suggestion.labelKey];
          const prompt = catalog[suggestion.promptKey];
          expect(label, `missing label ${suggestion.labelKey}`).toBeTruthy();
          expect(prompt, `missing prompt ${suggestion.promptKey}`).toBeTruthy();

          const parsed = parseNaturalLanguageStructuralPrompt(prompt);
          expect(parsed.recognized).toBe(true);
          expect(parsed.archetype).toBe(suggestion.id);
          expect(Object.keys(parsed.params).length).toBeGreaterThan(0);
        });
      }
    });
  }
});
