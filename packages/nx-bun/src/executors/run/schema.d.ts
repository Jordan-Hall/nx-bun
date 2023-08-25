import type { BaseBun } from '../../utils/common-options'
export interface RunExecutorSchema extends BaseBun {
  main: string,
  watch: boolean,
} // eslint-disable-line
