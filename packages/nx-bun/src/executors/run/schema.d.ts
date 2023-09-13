import type { BaseBun } from '../../utils/common-options';
export interface RunExecutorSchema extends BaseBun {
  watch: boolean;
  hot: boolean;
  buildTarget: string;
  debounce?: number;
  buildTargetOptions?: Record<string, unknown>;
}
