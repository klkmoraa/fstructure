import { space3dFromModel2d as extrudeStraight } from './model2dSpace3dLinear';
export * from './model2dSpace3dLinear';

/** Never silently replace native curves by straight chords during transfer. */
export const space3dFromModel2d: typeof extrudeStraight = (project, options) => {
  if (project.members.some(member => member.curve)) return {
    model: null,
    errors: ['El modelo contiene barras curvas nativas. La transferencia a 3D todavía no conserva su geometría y se ha detenido sin modificar ningún modelo.'],
    notes: ['Las curvas se pueden modelar y analizar en el Modelo 2D con el análisis estático lineal experimental.'],
  };
  return extrudeStraight(project, options);
};
