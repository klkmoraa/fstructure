import type { ToolId } from '../../shared/contracts';
import type { JsonValue, UnifiedProjectBundleV1 } from '../../shared/project/unifiedProjectBundle';

type Language = 'es' | 'en';
/** `space3d` y `design`: los modos 3D y Diseño de FStructure, en las ramas `space3d` y `design` del mismo proyecto. */
type Presentation = { meta: string; preview: 'model2d'; space3d?: string; design?: string };

const object = (value: JsonValue | undefined): Record<string, JsonValue> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, JsonValue> : null;
const arrayLength = (value: JsonValue | undefined) => Array.isArray(value) ? value.length : 0;

const designEntries = (value: JsonValue | undefined): Record<string, JsonValue> | null => {
  const document = object(value);
  if (document?.kind !== 'fstructure-design-workbench' || ![1, 2, 3, 4].includes(document.schemaVersion as number)) return null;
  return object(document.entries);
};

const designElement = (entries: Record<string, JsonValue>, language: Language) => {
  const raw = entries.element;
  const element = raw === 'column' || raw === 'frame' || raw === 'footing' || raw === 'section' ? raw : 'beam';
  const labels = language === 'es'
    ? { beam: 'Viga', column: 'Columna', frame: 'Estructura', footing: 'Zapata', section: 'Sección' }
    : { beam: 'Beam', column: 'Column', frame: 'Structure', footing: 'Footing', section: 'Section' };
  return labels[element];
};

const designCodeLabel = (entries: Record<string, JsonValue>) => {
  const raw = entries.code;
  if (raw === 'ntc-2023') return 'NTC-CDMX 2023';
  if (raw === 'nsr-10') return 'NSR-10';
  if (raw === 'e060') return 'E.060';
  return 'NTC-CDMX 2023';
};

/** Presentation data for recent cards must come from the selected tool branch,
 * never from an unrelated empty 2D authority model. */
export const recentProjectPresentation = (
  _tool: ToolId,
  bundle: UnifiedProjectBundleV1 | null | undefined,
  language: Language,
): Presentation => {
  // FStructure: el modelo 2D da la tarjeta; su 3D y su diseño, si existen, se suman.
  const model3d = object(bundle?.space3d?.model);
  const members3d = arrayLength(model3d?.members);
  const space3d = members3d ? (language === 'es' ? `${members3d} barras · ${arrayLength(model3d?.nodes)} nodos` : `${members3d} members · ${arrayLength(model3d?.nodes)} nodes`) : undefined;
  const entries = designEntries(bundle?.design);
  if (!entries || Object.keys(entries).length === 0) return { meta: '', preview: 'model2d', ...(space3d ? { space3d } : {}) };
  const philosophy = object(entries.section)?.philosophy;
  const basis = entries.element === 'section'
    ? philosophy === 'allowable' ? (language === 'es' ? 'Esfuerzos admisibles' : 'Allowable stress')
      : philosophy === 'limit-state' ? (language === 'es' ? 'Estados límite' : 'Limit states')
        : (language === 'es' ? 'Resistencia última' : 'Ultimate strength')
    : designCodeLabel(entries);
  return { meta: '', preview: 'model2d', ...(space3d ? { space3d } : {}), design: `${designElement(entries, language)} · ${basis}` };
};
