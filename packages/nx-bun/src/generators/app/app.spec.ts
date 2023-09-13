import { readJson, readProjectConfiguration, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { appGenerator } from './app';
import { getRootTsConfigPathInTree } from '@nx/js';

describe('Bun App Generator', () => {
  let tree: Tree;
  describe('General creation', () => {
    beforeEach(() => {
      tree = createTreeWithEmptyWorkspace();
    });

    it('should make a bun app', async () => {
      await appGenerator(tree, {
        name: 'my-app',
        applicationType: 'api',
      });
      expect(
        readJson(tree, getRootTsConfigPathInTree(tree))?.compilerOptions?.types
      ).toContain('bun-types');
      expect(readProjectConfiguration(tree, 'my-app')).toMatchSnapshot();
      expect(tree.exists('my-app/src/main.ts')).toBeTruthy();
    });

    // Generates a new application project with the given name and default options.
    it('should generate a new application project with the given name and default options', async () => {
      const tree = createTreeWithEmptyWorkspace();
      await appGenerator(tree, {
        name: 'my-app',
      });
      expect(
        readJson(tree, getRootTsConfigPathInTree(tree))?.compilerOptions?.types
      ).toContain('bun-types');
      expect(readProjectConfiguration(tree, 'my-app')).toMatchSnapshot();
      expect(tree.exists('my-app/src/main.ts')).toBeTruthy();
    });

    // Generates a new application project with the given name and specified options and tags.
    it('should generate a new application project with the given name and specified options and tags', async () => {
      const tree = createTreeWithEmptyWorkspace();
      await appGenerator(tree, {
        name: 'my-app',
        applicationType: 'api',
        tags: 'tag1, tag2',
      });
      expect(
        readJson(tree, getRootTsConfigPathInTree(tree))?.compilerOptions?.types
      ).toContain('bun-types');
      expect(readProjectConfiguration(tree, 'my-app')).toMatchSnapshot();
      expect(tree.exists('my-app/src/main.ts')).toBeTruthy();
    });

    // Generates a new application project with the given name and specified options and application type.
    it('should generate a new application project with the given name and specified options and application type', async () => {
      const tree = createTreeWithEmptyWorkspace();
      await appGenerator(tree, {
        name: 'my-app',
        applicationType: 'none',
      });
      expect(
        readJson(tree, getRootTsConfigPathInTree(tree))?.compilerOptions?.types
      ).toContain('bun-types');
      expect(readProjectConfiguration(tree, 'my-app')).toMatchSnapshot();
      expect(tree.exists('my-app/src/main.ts')).toBeTruthy();
    });

    // Generates a new application project with the given name and specified options and directory.
    it('should generate a new application project with the given name and specified options and directory', async () => {
      const tree = createTreeWithEmptyWorkspace();
      await appGenerator(tree, {
        name: 'my-app',
        directory: 'apps',
      });
      expect(
        readJson(tree, getRootTsConfigPathInTree(tree))?.compilerOptions?.types
      ).toContain('bun-types');
      expect(readProjectConfiguration(tree, 'my-app')).toMatchSnapshot();
      expect(tree.exists('apps/my-app/src/main.ts')).toBeTruthy();
    });
  });

  describe('integrated', () => {
    beforeEach(() => {
      tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    });

    it('should make an integrated bun app', async () => {
      await appGenerator(tree, {
        name: 'my-app',
        applicationType: 'none',
      });

      expect(
        readJson(tree, getRootTsConfigPathInTree(tree))?.compilerOptions?.types
      ).toContain('bun-types');
      expect(readProjectConfiguration(tree, 'my-app')).toMatchSnapshot();
      expect(tree.exists('apps/my-app/src/main.ts')).toBeTruthy();
    });
  });
});
