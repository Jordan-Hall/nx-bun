import {
  updateJson,
  readNxJson,
  Tree,
  updateNxJson,
  installPackagesTask
} from '@nx/devkit';
import { initGenerator as jsInitGenerator } from '@nx/js';
import { InitGeneratorSchema } from './schema';
import { assertBunAvailable } from '../../utils/bun-cli';

export async function initGenerator(tree: Tree, options: InitGeneratorSchema) {
  await assertBunAvailable();
  if (options.bunNXRuntime) {
    updateJson(tree, 'package.json', pkg => {
      pkg.devDependencies = {...pkg.devDependencies, '@nx-bun/task-worker-runner': 'latest'}
      return pkg
    })
    addBunPluginToNxJson(tree);
  }
  await jsInitGenerator(tree, {
    skipFormat: true,
  });

  installPackagesTask(tree, false)
}

function addBunPluginToNxJson(tree: Tree) {
  const nxJson = readNxJson(tree);

  nxJson.tasksRunnerOptions.default.runner = '@nx-bun/task-worker-runner'

  updateNxJson(tree, nxJson);
}

export default initGenerator;
