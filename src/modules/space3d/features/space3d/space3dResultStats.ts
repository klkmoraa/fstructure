/**
 * Extremos del resultado que se dibuja: los mismos números en la leyenda del
 * lienzo y en la banda de resultados.
 */
import type { Space3DAnalysisResult } from '../../space3d/model/types';
import {
  SPACE3D_COMPONENT_SYMBOL, SPACE3D_RESULT_COMPONENT, space3DResultNoiseFloor,
  type Space3DForceComponent, type Space3DResultMode,
} from '../../space3d/view/sceneModel';
import { deriveSpace3DMemberAxialAction } from '../../space3d/view/resultSemantics';
import type { TranslationKey } from '../../i18n/catalogs';

type Translate = (key: TranslationKey, variables?: Record<string, string | number>) => string;

const COMPONENT_NAME_KEYS: Record<Space3DForceComponent, TranslationKey> = {
  N: 'space3d.display.axial',
  Vy: 'space3d.display.shear2',
  Vz: 'space3d.display.shear3',
  T: 'space3d.display.torsion',
  My: 'space3d.display.moment2',
  Mz: 'space3d.display.moment3',
};

interface Space3DResultStats {
  readonly title: string;
  readonly unit: string;
  readonly min: number;
  readonly max: number;
  readonly criticalId: string;
  readonly criticalKind: 'node' | 'member';
  readonly convention: string;
  readonly gradientClass: string;
}

export const space3DResultStats = (
  resultMode: Space3DResultMode,
  analysis: Space3DAnalysisResult | null,
  t: Translate,
): Space3DResultStats | null => {
  if (!analysis || !analysis.success) return null;

  if (resultMode === 'deformed') {
    let maxDisplacement = 0;
    let maxNode = '';

    for (const res of analysis.nodeResults) {
      const displacement = Math.hypot(
        res.displacement.ux,
        res.displacement.uy,
        res.displacement.uz,
      );
      if (displacement > maxDisplacement) {
        maxDisplacement = displacement;
        maxNode = res.nodeId;
      }
    }

    return {
      title: t('space3d.legendDeformed'),
      unit: 'mm',
      min: 0,
      max: maxDisplacement * 1000,
      criticalId: maxNode,
      criticalKind: 'node' as const,
      convention: t('space3d.legendConventionDeformed'),
      gradientClass: 'space3d-legend-grad--deformed',
    };
  }

  const component = SPACE3D_RESULT_COMPONENT[resultMode];
  if (component) {
    // Extremos sobre todas las estaciones de todas las barras, sin el ruido
    // de redondeo: el diagrama y la leyenda dicen el mismo número.
    const noise = space3DResultNoiseFloor(analysis);
    let min = 0;
    let max = 0;
    let peak = 0;
    let criticalId = '';
    for (const res of analysis.memberResults) {
      const values = res.stations?.map((station) => station[component])
        ?? (component === 'N' ? [deriveSpace3DMemberAxialAction(res)] : [-res.start[component], res.end[component]]);
      for (const raw of values) {
        const value = Math.abs(raw) <= noise ? 0 : raw;
        if (value < min) min = value;
        if (value > max) max = value;
        if (Math.abs(value) > peak) { peak = Math.abs(value); criticalId = res.memberId; }
      }
    }
    const moment = component === 'T' || component === 'My' || component === 'Mz';
    return {
      title: t('space3d.legend.component', { symbol: SPACE3D_COMPONENT_SYMBOL[component], name: t(COMPONENT_NAME_KEYS[component]), unit: moment ? 'kN·m' : 'kN' }),
      unit: moment ? 'kN·m' : 'kN',
      min,
      max,
      criticalId,
      criticalKind: 'member' as const,
      convention: t(component === 'N' ? 'space3d.legendConventionAxial' : component === 'Mz' || component === 'My' ? 'space3d.legend.conventionMoment' : component === 'T' ? 'space3d.legend.conventionTorsion' : 'space3d.legend.conventionShear'),
      gradientClass: component === 'N' ? 'space3d-legend-grad--axial' : component === 'Vy' || component === 'Vz' ? 'space3d-legend-grad--shear' : 'space3d-legend-grad--moment',
    };
  }

  if (resultMode === 'reactions') {
    let maxR = 0;
    let maxNode = '';

    for (const res of analysis.nodeResults) {
      const rMag = Math.hypot(res.reaction.ux, res.reaction.uy, res.reaction.uz);
      if (rMag > maxR) {
        maxR = rMag;
        maxNode = res.nodeId;
      }
    }

    return {
      title: t('space3d.legendReactions' as TranslationKey) || 'Reacciones en Apoyos R [kN]',
      unit: 'kN',
      min: 0,
      max: maxR,
      criticalId: maxNode,
      criticalKind: 'node' as const,
      convention: t('space3d.legendConventionReactions'),
      gradientClass: 'space3d-legend-grad--reactions',
    };
  }

  return null;
};
