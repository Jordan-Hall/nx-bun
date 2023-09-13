export interface InitGeneratorSchema {
  unitTestRunner?: 'bun' | 'jest' | 'vitest' | 'none';
  bunNXRuntime: boolean;
  forceBunInstall: boolean;
}
