import {
  updateJson,
  readNxJson,
  Tree,
  updateNxJson,
  installPackagesTask
} from '@nx/devkit';
import * as path from 'path';
import { InitGeneratorSchema } from './schema';
import { assertBunAvailable } from '../../utils/bun-cli';

export async function initGenerator(tree: Tree, options: InitGeneratorSchema) {
  assertBunAvailable();
  updateJson(tree, 'package.json', pkg => {
    pkg.devDependencies = {...pkg.devDependencies, '@nx-bun/task-worker-runner': 'latest'}
    return pkg
  })
  installPackagesTask(tree, false)
  addBunPluginToNxJson(tree);
  installPackagesTask(tree, false)
}

function addBunPluginToNxJson(tree: Tree) {
  const nxJson = readNxJson(tree);

  nxJson.tasksRunnerOptions.default.runner = '@nx-bun/task-worker-runner'

  const plugins = new Set<string>(nxJson.plugins || []);
  plugins.add('@nx-bun/nx');
  nxJson.plugins = Array.from(plugins);

  updateNxJson(tree, nxJson);
}

export default initGenerator;
