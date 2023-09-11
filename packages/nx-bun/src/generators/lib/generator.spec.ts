import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree, readJson, readProjectConfiguration } from '@nx/devkit';

import { libGenerator } from './generator';
import { LibGeneratorSchema } from './schema';
import { getRootTsConfigPathInTree } from '@nx/js';

describe('lib generator', () => {
  let tree: Tree;
  const options: LibGeneratorSchema = { name: 'test' };

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should run successfully', async () => {
    await libGenerator(tree, options);
    const config = readProjectConfiguration(tree, 'test');
    expect(config).toBeDefined();
    expect(readJson(tree, getRootTsConfigPathInTree(tree))?.compilerOptions?.types).toContain('bun-types')

  });
  
});
