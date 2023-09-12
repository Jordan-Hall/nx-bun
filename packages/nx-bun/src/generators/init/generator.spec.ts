import {
  readJson,
  Tree,
  updateJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import { initGenerator } from './init';
import { getRootTsConfigPathInTree } from '@nx/js';

describe('initGenerator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should always add bun-types to package.json and update tsconfig', async () => {
    await initGenerator(tree, {forceBunInstall: false, bunNXRuntime: false});


    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.devDependencies['bun-types']).toBeDefined();
    
    const tsConfig = readJson(tree, getRootTsConfigPathInTree(tree));
    expect(tsConfig.compilerOptions.types).toContain('bun-types');
  });

  it('should handle jest as unitTestRunner', async () => {
    await initGenerator(tree, { unitTestRunner: 'jest', bunNXRuntime: false, forceBunInstall: false });

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.devDependencies['@nx/jest']).toBeDefined();
  });

  it('should handle vitest as unitTestRunner', async () => {
    await initGenerator(tree, { unitTestRunner: 'vitest', bunNXRuntime: false, forceBunInstall: false });

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.devDependencies['@nx/vite']).toBeDefined();
  });
  
  it('should not add bun-types to tsconfig if it already exists', async () => {
    // Prepopulate tsconfig with bun-types
    updateJson(tree, getRootTsConfigPathInTree(tree), (json) => {
      json.compilerOptions.types = ['bun-types'];
      return json;
    });
    await initGenerator(tree, {forceBunInstall: false, bunNXRuntime: false});

    const tsConfig = readJson(tree, getRootTsConfigPathInTree(tree));
    expect(tsConfig.compilerOptions.types.filter(t => t === 'bun-types').length).toBe(1);
  });

  it('should add bun-types to tsconfig if it does not exist', async () => {
    // Prepopulate tsconfig without bun-types
    updateJson(tree, getRootTsConfigPathInTree(tree), (json) => {
      json.compilerOptions.types = [];
      return json;
    });
    await initGenerator(tree, {forceBunInstall: false, bunNXRuntime: false});

    const tsConfig = readJson(tree, getRootTsConfigPathInTree(tree));
    expect(tsConfig.compilerOptions.types).toContain('bun-types');
  });
});
