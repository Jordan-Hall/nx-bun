export interface TestExecutorSchema {
  bail?: boolean | number;
  watch?: boolean;
  preload?: string;
  timeout?: number;
  rerunEach?: number;
  smol: boolean;
  config?: string;
  bun: boolean;
  tsConfig?: string;
} // eslint-disable-line
