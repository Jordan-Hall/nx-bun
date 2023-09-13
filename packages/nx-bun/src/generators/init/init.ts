import {
  readNxJson,
  Tree,
  updateNxJson,
  GeneratorCallback,
  ensurePackage,
  NX_VERSION,
  addDependenciesToPackageJson,
  runTasksInSerial,
  updateJson,
} from '@nx/devkit';
import {
  getRootTsConfigPathInTree,
  initGenerator as jsInitGenerator,
} from '@nx/js';
import { InitGeneratorSchema } from './schema';
import { assertBunAvailable } from '../../utils/bun-cli';

export async function initGenerator(tree: Tree, options: InitGeneratorSchema) {
  await assertBunAvailable(options.forceBunInstall);
  const tasks: GeneratorCallback[] = [];

  tasks.push(
    await jsInitGenerator(tree, {
      skipFormat: true,
    })
  );
  if (options.unitTestRunner === 'jest') {
    try {
      ensurePackage('@nx/jest', NX_VERSION);
    } catch (e) {
      tasks.push(
        addDependenciesToPackageJson(tree, {}, { '@nx/jest': NX_VERSION })
      );
    }
    const jestInitGenerator = await import('@nx/jest').then(
      (m) => m.jestInitGenerator
    );
    tasks.push(await jestInitGenerator(tree, {}));
  }

  if (options.unitTestRunner === 'vitest') {
    try {
      ensurePackage('@nx/vite', NX_VERSION);
    } catch (e) {
      tasks.push(
        addDependenciesToPackageJson(tree, {}, { '@nx/vite': NX_VERSION })
      );
    }
    const viteInitGenerator = await import('@nx/vite').then(
      (m) => m.initGenerator
    );
    tasks.push(await viteInitGenerator(tree, { uiFramework: 'none' }));
  }

  if (options.bunNXRuntime && !process.env.NX_DRY_RUN) {
    //TODO: add patch support for nx for better integration in some cases
    tasks.push(
      addDependenciesToPackageJson(
        tree,
        {},
        { '@nx-bun/task-worker-runner': 'latest' }
      )
    );
    tasks.push(addBunPluginToNxJson(tree));
  }

  tasks.push(addDependenciesToPackageJson(tree, {}, { 'bun-types': 'latest' }));
  const rootTsConfig = getRootTsConfigPathInTree(tree);
  updateJson(tree, rootTsConfig, (json) => {
    if (
      json.compilerOptions.types &&
      !json.compilerOptions.types.includes('bun-types')
    ) {
      json.compilerOptions.types.push('bun-types');
    } else if (!json.compilerOptions.types) {
      json.compilerOptions.types = ['bun-types'];
    }
    return json;
  });

  return runTasksInSerial(...tasks);
}

function addBunPluginToNxJson(tree: Tree) {
  const nxJson = readNxJson(tree);

  nxJson.tasksRunnerOptions.default.runner = '@nx-bun/task-worker-runner';

  updateNxJson(tree, nxJson);
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  return () => {};
}

export default initGenerator;
