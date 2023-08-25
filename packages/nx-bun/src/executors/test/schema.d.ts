export interface TestExecutorSchema {
  bail?: boolean | number;
  watch?: boolean;
  preload?: string;
  timeout?: number;
  rerunEach?: number;
  smol: boolean,
  config?: string,

} // eslint-disable-line
