import {
  ProjectConfiguration,
  TargetConfiguration,
  Tree,
  readProjectConfiguration,
  updateProjectConfiguration,
} from '@nx/devkit';
import { ConvertToBunGeneratorSchema } from './schema';
import {
  ConversionRegistry,
  getConverter,
  importAndRegisterConverters,
} from './utlis';

const baseRegistry: ConversionRegistry = {
  '@nx/js:tsc': {
    build: tscConveter,
  },
};

export async function convertToBunGenerator(
  tree: Tree,
  options: ConvertToBunGeneratorSchema
) {
  const projectConfiguration = readProjectConfiguration(tree, options.project);

  const registry = options.customConversionRegistry?.length
    ? await importAndRegisterConverters(
        baseRegistry,
        options.customConversionRegistry
      )
    : baseRegistry;

  await updateProject(tree, options, projectConfiguration, registry);
  updateProjectConfiguration(tree, options.project, projectConfiguration);
}

async function updateProject<T = any>(
  tree: Tree,
  options: ConvertToBunGeneratorSchema,
  projectConfiguration: ProjectConfiguration,
  registry: ConversionRegistry<T>
) {
  const targets = options.targets || ['build'];

  // Parallelize the converter calls.
  const conversionPromises = targets.map(async (target) => {
    const targetConfiguration = projectConfiguration.targets[target];
    if (!targetConfiguration) return;

    const converter = getConverter(
      registry,
      targetConfiguration.executor,
      target
    );
    if (!converter) return;

    // Convert and ensure the result is a promise.
    await converter(tree, options, targetConfiguration);
  });

  await Promise.all(conversionPromises);
}

export default convertToBunGenerator;
function tscConveter(
  tree: Tree,
  options: ConvertToBunGeneratorSchema,
  targetConfiguration: TargetConfiguration<any>
): void | Promise<void> {
  targetConfiguration.executor = '@nx-bun/nx:build';
  targetConfiguration.options = {
    entrypoints: [targetConfiguration.options.main],
    outputPath: targetConfiguration.options.outputPath,
    tsConfig: targetConfiguration.options.tsConfig,
    smol: false,
    bun: true,
  };
}
