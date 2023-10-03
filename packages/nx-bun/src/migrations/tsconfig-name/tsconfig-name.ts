/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Tree,
  readProjectConfiguration,
  updateProjectConfiguration,
} from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';

export default function update(host: Tree) {
  const migrateProject = (options, projectName, targetName) => {
    const projectConfig = readProjectConfiguration(host, projectName);
    projectConfig.targets[targetName].options.tsConfig =
      projectConfig.targets[targetName].options.tsconfig;
    delete projectConfig.targets[targetName].options.tsconfig;
    updateProjectConfiguration(host, projectName, projectConfig);
  };
  forEachExecutorOptions(host, '@nx-bun/nx:run', migrateProject);
  forEachExecutorOptions(host, '@nx-bun/nx:build', migrateProject);
  forEachExecutorOptions(host, '@nx-bun/nx:test', migrateProject);
}
