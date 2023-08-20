import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree, readProjectConfiguration } from '@nx/devkit';

import { createGenerator } from './generator';
import { CreateGeneratorSchema } from './schema';

describe('preset generator', () => {
  let tree: Tree;
  const options: CreateGeneratorSchema = { name: 'test', template: 'aavd', type: 'application' };

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should run successfully', async () => {
    await createGenerator(tree, options);
    const config = readProjectConfiguration(tree, 'test');
    expect(config).toBeDefined();
  });
});
