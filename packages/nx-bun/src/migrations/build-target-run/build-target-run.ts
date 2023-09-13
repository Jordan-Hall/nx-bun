import {
  Tree,
  formatFiles,
  joinPathFragments,
  readProjectConfiguration,
  updateProjectConfiguration,
} from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';
import { getRootTsConfigFileName } from '@nx/js';

export default async function update(tree: Tree) {
  const migrateProject = (options, projectName, targetName) => {
    const projectConfig = readProjectConfiguration(tree, projectName);

    const appTsConfigPath = projectConfig.root
      ? joinPathFragments(projectConfig.root, 'tsconfig.app.json')
      : joinPathFragments(projectConfig.sourceRoot, '..', 'tsconfig.app.json');
    const projectTsConfigPath = projectConfig.root
      ? joinPathFragments(projectConfig.root, 'tsconfig.json')
      : joinPathFragments(projectConfig.sourceRoot, '..', 'tsconfig.json');

    projectConfig.targets[targetName].executor = '@nx-bun/nx:run';
    delete projectConfig.targets[targetName].options.main;
    projectConfig.targets[
      targetName
    ].options.buildTarget = `${projectConfig.name}:build`;
    projectConfig.targets[targetName].options.tsconfig = tree.exists(
      appTsConfigPath
    )
      ? appTsConfigPath
      : tree.exists(projectTsConfigPath)
      ? projectTsConfigPath
      : getRootTsConfigFileName(tree);
    updateProjectConfiguration(tree, projectName, projectConfig);
  };

  forEachExecutorOptions(tree, '@nx-bun/nx:run', migrateProject);

  await formatFiles(tree);
}
