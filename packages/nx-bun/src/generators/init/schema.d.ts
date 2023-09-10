export interface InitGeneratorSchema {
    unitTestRunner?: 'bun' | 'jest' | 'none';
    bunNXRuntime: boolean;
    forceBunInstall: boolean
}
