import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { readJson, readProjectConfiguration } from '@nx/devkit';

import { createGenerator } from './generator';
import { CreateGeneratorSchema } from './schema';
import { FsTree } from 'nx/src/generators/tree';
import { getRootTsConfigPathInTree } from '../../utils/ts-config';

describe('preset generator', () => {
  let tree: FsTree;
  const options: CreateGeneratorSchema = { name: 'elysia-test', template: 'elysia', type: 'application' };

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' }) as FsTree;
  });

  it('should run successfully', async () => {
    await createGenerator(tree, options);
    const config = readProjectConfiguration(tree, 'test');

    expect(readJson(tree, getRootTsConfigPathInTree(tree))?.compilerOptions?.types).toContain('bun-types')
    const rootPackageJson = readJson(tree, 'package.json');
    const appPackageJson = readJson(tree, 'apps/test/package.json');
    expect(appPackageJson.dependencies).toEqual({})
    expect(appPackageJson.devDependencies).toEqual({})
    expect(rootPackageJson.dependencies.elysia).toBe('latest')
    expect(rootPackageJson.dependencies['bun-types']).toBe('latest')
    expect(config).toBeDefined();
  });
});
