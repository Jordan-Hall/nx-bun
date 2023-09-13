import { ProjectNameAndRootOptions } from '@nx/devkit/src/generators/project-name-and-root-utils';
import { CreateGeneratorSchema } from './schema';

export interface NormalizedSchema extends CreateGeneratorSchema {
  projectDirectory: string;
  projectNames: ProjectNameAndRootOptions['names'];
  projectRoot: ProjectNameAndRootOptions['projectRoot'];
  projectName: ProjectNameAndRootOptions['projectName'];
  importPath?: ProjectNameAndRootOptions['importPath'];
  layout: {
    appsDir: string;
    libsDir: string;
    standaloneAsDefault: boolean;
  };
}
