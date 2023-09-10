type BaseLib = {
  name: string;
  directory?: string;
  unitTestRunner?: 'bun' | 'jest' | 'vitest' | 'none';
  tags?: string;
  skipFormat?: boolean;
  simpleName?: boolean;
};

type PublishableLib = BaseLib & {
  publishable: true;
  importPath: string;
};


type RegularLib = BaseLib & {
  publishable?: false;
  importPath?: string;
};

export type LibUnderhood = BaseLib & {
  publishable?: boolean;
  importPath?: string;
};

export type LibGeneratorSchema = PublishableLib  | RegularLib;
