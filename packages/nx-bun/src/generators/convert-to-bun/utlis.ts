import { Tree, TargetConfiguration } from '@nx/devkit';
import { ConvertToBunGeneratorSchema } from './schema';

/**
 * Type for a converter function
 * @template T - The type parameter for the target configuration
 */
export type ConverterType<T = any> = (
  tree: Tree,
  options: ConvertToBunGeneratorSchema,
  targetConfiguration: TargetConfiguration<T>
) => void | Promise<void>;

/**
 * A type representing a mapping from target names to converter functions.
 * This corresponds to the keys in `ProjectConfiguration.targets`.
 *
 * @template T - The type parameter that `ConverterType` will use.
 */
export type SupportedConversion<T = any> = Record<string, ConverterType<T>>;

/**
 * A type representing a mapping from executor names to supported conversions.
 * This corresponds to the `executor` property in `TargetConfiguration`.
 *
 * @template T - The type parameter that `SupportedConversion` will use.
 */
export type ConversionRegistry<T = any> = Record<
  string,
  SupportedConversion<T>
>;

/** Cache for converters */
const converterCache: Map<string, ConverterType> = new Map();

/**
 * Registers a new converter in the conversion registry under the specified executor and target.
 *
 * @param registry - The current state of the conversion registry.
 * @param executor - The name of the executor, corresponding to `TargetConfiguration.executor`.
 * @param target - The name of the target, corresponding to the keys in `ProjectConfiguration.targets`.
 * @param converter - The converter function to register.
 * @template T - The type parameter that `ConverterType` will use.
 * @returns - The updated conversion registry.
 */
export const registerConverter = <T>(
  registry: ConversionRegistry<T>,
  executor: string,
  target: string,
  converter: ConverterType<T>
): void => {
  if (!registry[executor]) {
    registry[executor] = {};
  }
  registry[executor][target] = converter;
  converterCache.set(`${executor}-${target}`, converter);
};

/**
 * Gets a converter from the cache or the registry
 * @param registry - The current state of the conversion registry.
 * @param executor - The name of the executor.
 * @param target - The name of the target.
 * @template T - The type parameter.
 * @returns - The converter function if it exists, undefined otherwise.
 */
export const getConverter = <T>(
  registry: ConversionRegistry<T>,
  executor: string,
  target: string
): ConverterType<T> | undefined => {
  const key = `${executor}-${target}`;
  return converterCache.get(key) || registry[executor]?.[target];
};

/**
 * Imports and registers converters in parallel.
 * @param baseRegistry - The base conversion registry.
 * @param packages - The list of packages to import and register.
 * @returns - The updated conversion registry.
 */
export async function importAndRegisterConverters(
  baseRegistry: ConversionRegistry,
  packages: string[]
): Promise<ConversionRegistry> {
  try {
    await Promise.allSettled(
      packages.map((pkg) => loadAndRegisterConverters(pkg, baseRegistry))
    );
    return baseRegistry;
  } catch (error) {
    console.error('An error occurred:', error);
    throw error;
  }
}

/**
 * Loads and registers converters for a given package.
 * @param pkg - The package to load converters from.
 * @param registry - The conversion registry to update.
 */
async function loadAndRegisterConverters(
  pkg: string,
  registry: ConversionRegistry
): Promise<void> {
  const convertersModule = await import(pkg);
  if (typeof convertersModule !== 'function') {
    throw new Error(`convertersModule in package "${pkg}" is not a function`);
  }

  const newConverters = convertersModule();
  if (!isConversionRegistry(newConverters)) {
    throw new Error(
      `newConverters in package "${pkg}" is not of type ConversionRegistry`
    );
  }

  const executors = Object.keys(newConverters);
  for (let i = 0; i < executors.length; i++) {
    const executor = executors[i];
    const targets = Object.keys(newConverters[executor]);
    for (let j = 0; j < targets.length; j++) {
      const target = targets[j];
      registerConverter(
        registry,
        executor,
        target,
        newConverters[executor][target]
      );
    }
  }
}

/**
 * Checks if a given object is a valid ConversionRegistry.
 * @param obj - The object to check.
 * @returns - True if the object is a ConversionRegistry, false otherwise.
 */
function isConversionRegistry(obj: unknown): obj is ConversionRegistry {
  if (typeof obj !== 'object' || obj === null) return false;

  for (const executor in obj) {
    if (typeof obj[executor] !== 'object') return false;
    const converters = obj[executor];
    for (const converter in converters) {
      if (typeof converters[converter] !== 'function') return false;
    }
  }

  return true;
}
