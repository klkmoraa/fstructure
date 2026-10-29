import { model2dDesignSource as straightSource } from './linearModel2dSource';
export * from './linearModel2dSource';

/** The straight reinforced-concrete checks do not certify curved members. */
export const model2dDesignSource: typeof straightSource = (project, analyzeCases) => {
  const source = straightSource(project, analyzeCases);
  if (!project.members.some(member => member.curve)) return source;
  return {
    ...source,
    summary: { ...source.summary, beams: 0, columns: 0, skipped: project.members.length },
    errors: [...source.errors, 'Este modelo contiene barras curvas. El diseño de concreto de vigas y columnas rectas no es una verificación de arcos y no se aplicará a este modelo.'],
    create: () => null,
  };
};
