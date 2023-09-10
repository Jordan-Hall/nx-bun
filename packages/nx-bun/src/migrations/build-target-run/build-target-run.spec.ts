import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree, addProjectConfiguration, readProjectConfiguration } from '@nx/devkit';

import update from './build-target-run';

describe('build-target-run migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should migrate without a app tsconfig', async () => {
    addProjectConfiguration(tree, 'myapp', {
      root: 'apps/myapp',
      sourceRoot: 'apps/myapp/src',
      projectType: 'application',
      targets: {
        foo: {
          executor: '@nx-bun/nx:run',
          defaultConfiguration: "development",
          options: {
            main: "apps/myapp/src/index.ts",
            hot: true,
            watch: true
          }
        },
      },
    });
    await update(tree);
    expect(readProjectConfiguration(tree, 'myapp')).toEqual({
      $schema: '../../node_modules/nx/schemas/project-schema.json',
      name: 'myapp',
      root: 'apps/myapp',
      sourceRoot: 'apps/myapp/src',
      projectType: 'application',
      targets: {
        foo: {
          executor: '@nx-bun/nx:run',
          defaultConfiguration: "development",
          options: {
            buildTarget: 'myapp:build',
            tsconfig: 'tsconfig.base.json',
            hot: true,
            watch: true
          },
        },
      },
    });
  });

  it('should migrate with a app tsconfig', async () => {
    addProjectConfiguration(tree, 'myapp', {
      root: 'apps/myapp',
      sourceRoot: 'apps/myapp/src',
      projectType: 'application',
      targets: {
        foo: {
          executor: '@nx-bun/nx:run',
          defaultConfiguration: "development",
          options: {
            main: "apps/myapp/src/index.ts",
            hot: true,
            watch: true
          }
        },
      },
    });
    tree.write('apps/myapp/tsconfig.app.json', '{}');
    await update(tree);
    expect(readProjectConfiguration(tree, 'myapp')).toEqual({
      $schema: '../../node_modules/nx/schemas/project-schema.json',
      name: 'myapp',
      root: 'apps/myapp',
      sourceRoot: 'apps/myapp/src',
      projectType: 'application',
      targets: {
        foo: {
          executor: '@nx-bun/nx:run',
          defaultConfiguration: "development",
          options: {
            buildTarget: 'myapp:build',
            tsconfig: 'apps/myapp/tsconfig.app.json',
            hot: true,
            watch: true
          },
        },
      },
    });
  });
});
