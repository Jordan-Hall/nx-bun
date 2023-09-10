import type { BaseBun } from '../../utils/common-options'

export interface BundleExecutorSchema extends BaseBun {
  entrypoints: string[];
  outputPath: string;
  target?: "bun" | "node" | "browser";
  format?: "esm";
  splitting?: boolean;
  plugins?: string[];
  sourcemap?: "none" | "inline" | "external";
  minify?: boolean;
  external?: string[];
  naming?: string | {
    chunk?: string;
    entry?: string;
    asset?: string;
  };
  publicPath?: string;
  define?: { [key: string]: string };
  complie?: boolean;
} // eslint-disable-line
