import type { ToolId } from '../../shared/contracts';
import type { JsonValue, UnifiedProjectBundleV1 } from '../../shared/project/unifiedProjectBundle';

type Language = 'es' | 'en';
type Presentation = { meta: string; preview: 'model2d' | 'tool' };

const object = (value: JsonValue | undefined): Record<string, JsonValue> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, JsonValue> : null;
const arrayLength = (value: JsonValue | undefined) => Array.isArray(value) ? value.length : 0;

const designElement = (value: JsonValue | undefined, language: Language) => {
  const document = object(value);
  const raw = document?.element;
  const element = raw === 'column' || raw === 'footing' ? raw : 'beam';
  const labels = language === 'es'
    ? { beam: 'Viga', column: 'Columna', footing: 'Zapata' }
    : { beam: 'Beam', column: 'Column', footing: 'Footing' };
  return labels[element];
};

const designCodeLabel = (value: JsonValue | undefined) => {
  const raw = object(value)?.code;
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
    const model = object(bundle?.space3d?.model);
    const members = arrayLength(model?.members);
    const nodes = arrayLength(model?.nodes);
    return {
      meta: language === 'es' ? `${members} barras · ${nodes} nodos` : `${members} members · ${nodes} nodes`,
      preview: 'tool',
    };
  }

  if (tool === 'fem') {
    const study = bundle?.fem.at(-1);
    const document = object(object(study)?.document);
    const nodes = arrayLength(document?.nodes);
    const elements = arrayLength(document?.elements);
    return {
      meta: language === 'es' ? `${nodes} nodos · ${elements} elementos` : `${nodes} nodes · ${elements} elements`,
      preview: 'tool',
    };
  }

  if (tool === 'design') {
    return { meta: `${designElement(bundle?.design, language)} · ${designCodeLabel(bundle?.design)}`, preview: 'tool' };
  }

  return { meta: '', preview: 'model2d' };
};
