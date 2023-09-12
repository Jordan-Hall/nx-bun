import { readJson, readProjectConfiguration, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { appGenerator } from './app'
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
        applicationType: 'api'
      });
			expect(readJson(tree, getRootTsConfigPathInTree(tree))?.compilerOptions?.types).toContain('bun-types')
      expect(readProjectConfiguration(tree, 'my-app')).toMatchSnapshot();
      expect(tree.exists('my-app/src/main.ts')).toBeTruthy();
    });
	});

	describe('integrated', () => {
    beforeEach(() => {
      tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    });

    it('should make an integrated bun app', async () => {
      await appGenerator(tree, {
        name: 'my-app',
        applicationType:'none'  
      });
			
      expect(readJson(tree, getRootTsConfigPathInTree(tree))?.compilerOptions?.types).toContain('bun-types')
      expect(readProjectConfiguration(tree, 'my-app')).toMatchSnapshot();
      expect(tree.exists('apps/my-app/src/main.ts')).toBeTruthy();
    });
	})
})
