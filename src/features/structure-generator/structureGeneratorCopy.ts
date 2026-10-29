import { translate, type Language, type TranslationKey } from '../../i18n/catalogs';
import { curvedGeneratorCopy, type CurvedGeneratorCopyKey } from './curvedGeneratorCopy';

/**
 * Acceso a la copia de «Generar estructura».
 *
 * Las cadenas viven en el catálogo global bajo el prefijo `generator.`, igual
 * que las de la edición múltiple bajo `bulk.`: un solo origen de texto y un solo
 * motor de interpolación. Este módulo sólo antepone el prefijo, de modo que el
 * panel sigue recibiendo el idioma por props y puede renderizarse con fixtures.
 */

type StripGeneratorPrefix<Key> = Key extends `generator.${infer Rest}` ? Rest : never;

/** Las claves `generator.*` del catálogo, sin el prefijo. */
type StructureGeneratorCopyKey = StripGeneratorPrefix<TranslationKey> | CurvedGeneratorCopyKey;

type StructureGeneratorTranslate = (
  key: StructureGeneratorCopyKey,
  variables?: Record<string, string | number>,
) => string;

const translateStructureGenerator = (
  language: Language,
  key: StructureGeneratorCopyKey,
  variables?: Record<string, string | number>,
): string => {
  if (Object.prototype.hasOwnProperty.call(curvedGeneratorCopy.en, key)) {
    const text = curvedGeneratorCopy[language === 'en' ? 'en' : 'es'][key as CurvedGeneratorCopyKey];
    return text.replace(/\{(\w+)\}/g, (_, name: string) => String(variables?.[name] ?? `{${name}}`));
  }
  return translate(language, `generator.${key}` as TranslationKey, variables);
};

export const createStructureGeneratorTranslator = (language: Language): StructureGeneratorTranslate =>
  (key, variables) => translateStructureGenerator(language, key, variables);
