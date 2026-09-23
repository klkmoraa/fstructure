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
/**
 * Lo que cada sugerencia promete por escrito. Si una traducción enuncia un
 * número que el parser no sabe leer, el generador construye otra cosa: es
 * exactamente el fallo que tuvo "5 paneles" antes de que el parser conociera
 * la palabra. Por eso se fijan los valores, no sólo el arquetipo.
 */
const EXPECTED_PARAMS: Record<string, Record<string, number>> = {
  frame: { storiesY: 3, baysX: 2, baySize: 5, load: 25 },
  tower: { height: 18, load: 30 },
  dome: { radius: 8, height: 4 },
  bridge: { span: 20, bays: 5 },
  'industrial-shed': { span: 16, bays: 4 },
};

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

          for (const [name, value] of Object.entries(EXPECTED_PARAMS[suggestion.id]!)) {
            expect(parsed.params[name], `${language}/${suggestion.id}: ${name}`).toBe(value);
          }
          // Una altura que nadie escribió altera la geometría en silencio.
          expect(Object.keys(parsed.params)).toEqual(
            expect.arrayContaining(Object.keys(EXPECTED_PARAMS[suggestion.id]!)),
          );
        });
      }
    });
  }
});
