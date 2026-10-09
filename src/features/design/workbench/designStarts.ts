import { BEAM_DEFAULTS, DEFAULT_SPANS } from './beamModel';
import { COLUMN_DEFAULTS } from './columnModel';
import { SECTION_DEFAULTS } from './concreteStudioModel';
import { FOOTING_DEFAULTS } from './footingModel';
import { DEFAULT_BAYS, DEFAULT_STORIES, FRAME_DEFAULTS } from './frameModel';
import type { DesignElementKind } from './designReport';

export type DesignStartCategory = 'project' | 'piece' | 'exercise';

export interface DesignStart {
  readonly id: string;
  readonly category: DesignStartCategory;
  readonly element: DesignElementKind;
  readonly title: string;
  readonly description: string;
  readonly reference?: string;
  readonly source?: 'model' | 'model3d';
  readonly fields: Record<string, string>;
  readonly rows?: Record<string, string>[];
  readonly levels?: Record<string, string>[];
}

const clone = <T extends Record<string, string>>(value: T): T => ({ ...value });
const beam = (tag: string, patch: Partial<typeof BEAM_DEFAULTS> = {}, rows = DEFAULT_SPANS) => ({
  fields: { ...clone(BEAM_DEFAULTS), tag, ...patch },
  rows: rows.map((row) => ({ ...row })),
});
const frame = (tag: string, patch: Partial<typeof FRAME_DEFAULTS> = {}, bays = DEFAULT_BAYS, stories = DEFAULT_STORIES) => ({
  fields: { ...clone(FRAME_DEFAULTS), source: 'frame', tag, ...patch },
  rows: bays.map((row) => ({ ...row })), levels: stories.map((row) => ({ ...row })),
});
const start = (entry: Omit<DesignStart, 'fields' | 'rows' | 'levels'> & { fields: Record<string, string>; rows?: Record<string, string>[]; levels?: Record<string, string>[] }): DesignStart => ({
  ...entry,
  fields: { ...entry.fields },
  ...(entry.rows ? { rows: entry.rows.map((row) => ({ ...row })) } : {}),
  ...(entry.levels ? { levels: entry.levels.map((row) => ({ ...row })) } : {}),
});

const simpleBeam = beam('V simple', { selfWeight: 'no', leftEnd: 'pin', rightEnd: 'roller' }, [
  { length: '5', dead: '10', live: '0', pointDead: '0', pointLive: '0', pointAt: '2.5' },
]);
const cantileverBeam = beam('Voladizo', { selfWeight: 'no', leftEnd: 'fixed', rightEnd: 'free' }, [
  { length: '2', dead: '5', live: '0', pointDead: '0', pointLive: '0', pointAt: '1' },
]);
const pointBeam = beam('Carga puntual', { selfWeight: 'no', points: 'yes', leftEnd: 'pin', rightEnd: 'roller' }, [
  { length: '4', dead: '0', live: '0', pointDead: '10', pointLive: '0', pointAt: '2' },
]);

const footing = (tag: string, type: string) => ({ ...clone(FOOTING_DEFAULTS), tag, type });
const section = (tag: string, preset: string, patch: Partial<typeof SECTION_DEFAULTS> = {}) => ({ ...clone(SECTION_DEFAULTS), tag, preset, ...patch });

/** Catálogo inmutable: cada selección recibe copias para que los borradores no compartan referencias. */
export const DESIGN_STARTS: readonly DesignStart[] = [
  start({ id: 'project-2d', category: 'project', element: 'frame', title: 'Modelo 2D', description: 'Diseña los miembros del modelo estructural 2D del proyecto.', source: 'model', fields: { source: 'model' } }),
  start({ id: 'project-3d', category: 'project', element: 'frame', title: 'Ejes del Modelo 3D', description: 'Diseña un eje del modelo espacial 3D del proyecto.', source: 'model3d', fields: { source: 'model3d' } }),
  start({ id: 'project-house', category: 'project', element: 'frame', title: 'Pórtico de vivienda · 1 nivel', description: 'Ejemplo editable de dos claros y un nivel; las secciones, cargas y condiciones son hipótesis para iniciar, no sustituyen un modelo del proyecto.', ...frame('Vivienda 1 nivel', {}, DEFAULT_BAYS, [DEFAULT_STORIES[0]!]) }),
  start({ id: 'project-building', category: 'project', element: 'frame', title: 'Edificio · 3 niveles', description: 'Ejemplo editable de dos claros y tres niveles; las secciones, cargas y condiciones son hipótesis para iniciar, no sustituyen un modelo del proyecto.', ...frame('Edificio 3 niveles', {}, DEFAULT_BAYS, [
    DEFAULT_STORIES[0]!, DEFAULT_STORIES[1]!, { height: '3', dead: '18', live: '5', lateral: '45' },
  ]) }),

  start({ id: 'piece-beam-simple', category: 'piece', element: 'beam', title: 'Viga apoyada', description: 'Una viga con un claro, apoyos simples y cargas editables.', ...beam('Viga', { leftEnd: 'pin', rightEnd: 'roller' }, [DEFAULT_SPANS[0]!]) }),
  start({ id: 'piece-beam-continuous', category: 'piece', element: 'beam', title: 'Viga continua', description: 'Dos claros editables con continuidad sobre el apoyo interior.', ...beam('Viga continua', { leftEnd: 'pin', rightEnd: 'pin' }) }),
  start({ id: 'piece-beam-cantilever', category: 'piece', element: 'beam', title: 'Voladizo', description: 'Un claro con empotramiento y extremo libre.', ...beam('Voladizo', { leftEnd: 'fixed', rightEnd: 'free' }, [DEFAULT_SPANS[0]!]) }),
  start({ id: 'piece-beam-t', category: 'piece', element: 'beam', title: 'Viga T', description: 'Viga con losa a ambos lados; ajusta patín y claros.', ...beam('Viga T', { sectionType: 'T' }, [DEFAULT_SPANS[0]!]) }),
  start({ id: 'piece-beam-l', category: 'piece', element: 'beam', title: 'Viga L', description: 'Viga con losa a un lado; ajusta patín y claros.', ...beam('Viga L', { sectionType: 'L' }, [DEFAULT_SPANS[0]!]) }),
  start({ id: 'piece-column', category: 'piece', element: 'column', title: 'Columna rectangular', description: 'Columna con geometría, materiales y acciones editables.', fields: { ...clone(COLUMN_DEFAULTS), tag: 'Columna', shape: 'rectangular' } }),
  start({ id: 'piece-column-circular', category: 'piece', element: 'column', title: 'Columna circular', description: 'Columna circular con refuerzo longitudinal y transversal editable.', fields: { ...clone(COLUMN_DEFAULTS), tag: 'Columna circular', shape: 'circular' } }),
  start({ id: 'piece-footing', category: 'piece', element: 'footing', title: 'Zapata aislada', description: 'Cimentación aislada con captura manual de cargas y suelo.', fields: footing('Zapata', 'isolated') }),
  start({ id: 'piece-footing-strip', category: 'piece', element: 'footing', title: 'Zapata corrida', description: 'Cimentación corrida bajo muro; sus cargas se capturan manualmente.', fields: footing('Zapata corrida', 'strip') }),
  start({ id: 'piece-footing-combined', category: 'piece', element: 'footing', title: 'Zapata combinada', description: 'Cimentación de dos columnas con cargas y separación editables.', fields: footing('Combinada', 'combined') }),
  start({ id: 'piece-footing-strap', category: 'piece', element: 'footing', title: 'Zapata de lindero', description: 'Zapata con contratrabe; captura manual de las cargas.', fields: footing('Lindero', 'strap') }),
  start({ id: 'piece-footing-mat', category: 'piece', element: 'footing', title: 'Losa de cimentación', description: 'Retícula editable de columnas y cargas por posición.', fields: footing('Losa', 'mat') }),
  start({ id: 'piece-section', category: 'piece', element: 'section', title: 'Estudio de sección', description: 'Sección de concreto editable para revisar acciones y filosofía.', fields: section('Sección', 'column') }),

  start({ id: 'exercise-beam-simple', category: 'exercise', element: 'beam', title: 'Viga simplemente apoyada', description: 'Carga muerta uniforme de 10 kN/m en un claro de 5 m. Sin peso propio.', reference: 'Referencia de servicio: qL²/8 = 31.25 kN·m.', ...simpleBeam }),
  start({ id: 'exercise-beam-cantilever', category: 'exercise', element: 'beam', title: 'Voladizo con carga uniforme', description: 'Carga muerta uniforme de 5 kN/m en un voladizo de 2 m. Sin peso propio.', reference: 'Referencia de servicio: qL²/2 = 10 kN·m.', ...cantileverBeam }),
  start({ id: 'exercise-beam-point', category: 'exercise', element: 'beam', title: 'Viga con carga puntual', description: 'Carga muerta puntual de 10 kN al centro de un claro de 4 m. Sin peso propio.', reference: 'Referencia de servicio: PL/4 = 10 kN·m.', ...pointBeam }),
  start({ id: 'exercise-column', category: 'exercise', element: 'column', title: 'Ejercicio de columna', description: 'Ejemplo editable con hipótesis de columna rectangular arriostrada y acciones biaxiales; el resultado no está garantizado.', fields: { ...clone(COLUMN_DEFAULTS), tag: 'Ejercicio columna', shape: 'rectangular', braced: 'yes' } }),
  start({ id: 'exercise-footing', category: 'exercise', element: 'footing', title: 'Ejercicio de zapata', description: 'Ejemplo editable de zapata aislada con carga axial, momento y presión admisible supuestos; no promete cumplir.', fields: { ...footing('Ejercicio zapata', 'isolated'), moments: 'yes' } }),
  start({ id: 'exercise-frame', category: 'exercise', element: 'frame', title: 'Pórtico de vivienda', description: 'Ejemplo editable de dos claros y dos niveles; geometría y acciones son hipótesis de trabajo, no una verificación de proyecto.', ...frame('Pórtico vivienda') }),
];
