import type { BaseBun } from '../../utils/common-options'
export interface RunExecutorSchema extends BaseBun {
  main: string,
  watch: boolean,
  hot: boolean,
} // eslint-disable-line
