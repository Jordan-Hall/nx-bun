import type { ProjectNameAndRootFormat } from '@nx/devkit/src/generators/project-name-and-root-utils';
export type ProjectType = 'library' | 'application';

export interface CreateGeneratorSchema {
  name: string;
  template: string;
  type: ProjectType;
  directory?: string;
  projectNameAndRootFormat?: ProjectNameAndRootFormat;
  rootProject?: boolean;
  publishable?: boolean;
  importPath?: string;
}
