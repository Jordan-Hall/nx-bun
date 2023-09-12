import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { ProjectConfiguration, readJson, readProjectConfiguration } from '@nx/devkit';

import { createGenerator } from './generator';
import { CreateGeneratorSchema } from './schema';
import { FsTree } from 'nx/src/generators/tree';
import { getRootTsConfigPathInTree } from '@nx/js';
import { rmSync } from 'fs';

describe('preset generator', () => {
  let tree: FsTree;
  const options: CreateGeneratorSchema = { name: 'elysia-test', template: 'elysia', type: 'application' };
  let config: ProjectConfiguration;
  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' }) as FsTree;
  });

  afterEach(() => {
    rmSync(config.root, { force: true, recursive: true })
  })

  it('should run successfully', async () => {
    await createGenerator(tree, options);
    config = readProjectConfiguration(tree, 'elysia-test');

    expect(readJson(tree, getRootTsConfigPathInTree(tree))?.compilerOptions?.types).toContain('bun-types')
    const rootPackageJson = readJson(tree, 'package.json');
    const appPackageJson = readJson(tree, 'apps/elysia-test/package.json');
    expect(appPackageJson.dependencies).toEqual({})
    expect(appPackageJson.devDependencies).toEqual({})
    expect(rootPackageJson.dependencies.elysia).toBe('latest')
    expect(config).toBeDefined();
  });
});
