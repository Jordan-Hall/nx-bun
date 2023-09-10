import type { ProjectNameAndRootFormat } from '@nx/devkit/src/generators/project-name-and-root-utils';
export interface AppGeneratorSchema {
  name: string;
  applicationType?: AppTypes;
  directory?: string;
  projectNameAndRootFormat?: ProjectNameAndRootFormat;
  tags?: string;
  rootProject?: boolean;
}
export type AppTypes = 'api' | 'none';