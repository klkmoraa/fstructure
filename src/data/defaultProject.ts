import * as templates from './defaultProjectTemplates';
import type { ProjectModel } from '../types';
export * from './defaultProjectTemplates';

/** v11 adds native circular member geometry. Older readers must reject it. */
export const CURRENT_SCHEMA_VERSION = 11;
const current = (project: ProjectModel): ProjectModel => ({ ...project, schemaVersion: CURRENT_SCHEMA_VERSION });
export const createBlankProject = () => current(templates.createBlankProject());
export const createDefaultProject = () => current(templates.createDefaultProject());
export const createSingleWork = (...args: Parameters<typeof templates.createSingleWork>) => current(templates.createSingleWork(...args));
export const createConcreteFrameProject = () => current(templates.createConcreteFrameProject());
export const exampleProjects = templates.exampleProjects.map(example => ({ ...example, build: () => current(example.build()) }));
