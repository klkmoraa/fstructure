import type { ToolId } from '../../shared/contracts';
import type { JsonValue, UnifiedProjectBundleV1 } from '../../shared/project/unifiedProjectBundle';

type Language = 'es' | 'en';
type Presentation = { meta: string; preview: 'model2d' | 'tool' };

const object = (value: JsonValue | undefined): Record<string, JsonValue> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, JsonValue> : null;
const arrayLength = (value: JsonValue | undefined) => Array.isArray(value) ? value.length : 0;

const designEntries = (value: JsonValue | undefined): Record<string, JsonValue> | null => {
  const document = object(value);
  if (document?.kind !== 'fstructure-design-workbench' || (document.schemaVersion !== 1 && document.schemaVersion !== 2)) return null;
  return object(document.entries);
};

const designElement = (entries: Record<string, JsonValue>, language: Language) => {
  const raw = entries.element;
  const element = raw === 'column' || raw === 'footing' ? raw : 'beam';
  const labels = language === 'es'
    ? { beam: 'Viga', column: 'Columna', footing: 'Zapata' }
    : { beam: 'Beam', column: 'Column', footing: 'Footing' };
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
  tool: ToolId,
  bundle: UnifiedProjectBundleV1 | null | undefined,
  language: Language,
): Presentation => {
  if (tool === 'space3d') {
    if (!bundle?.space3d) return { meta: '', preview: 'model2d' };
    const model = object(bundle.space3d.model);
    const members = arrayLength(model?.members);
    const nodes = arrayLength(model?.nodes);
    return {
      meta: language === 'es' ? `${members} barras · ${nodes} nodos` : `${members} members · ${nodes} nodes`,
      preview: 'tool',
    };
  }

  if (tool === 'fem') {
    const studies = bundle?.fem ?? [];
    for (let index = studies.length - 1; index >= 0; index -= 1) {
      const document = object(object(studies[index])?.document);
      if (document?.kind !== 'fem-document' || document.schemaVersion !== 1 || !Array.isArray(document.nodes) || !Array.isArray(document.elements)) continue;
      const nodes = document.nodes.length;
      const elements = document.elements.length;
      return {
        meta: language === 'es' ? `${nodes} nodos · ${elements} elementos` : `${nodes} nodes · ${elements} elements`,
        preview: 'tool',
      };
    }
    return { meta: '', preview: 'model2d' };
  }

  if (tool === 'design') {
    const entries = designEntries(bundle?.design);
    if (!entries || Object.keys(entries).length === 0) return { meta: '', preview: 'model2d' };
    return { meta: `${designElement(entries, language)} · ${designCodeLabel(entries)}`, preview: 'tool' };
  }

  return { meta: '', preview: 'model2d' };
};
