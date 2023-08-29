import { ExecutorContext } from '@nx/devkit';
import { assertBunAvailable } from '../../utils/bun-cli';
import { BundleExecutorSchema } from './schema';
import 'bun-types'

export default async function bundleExecutor(options: BundleExecutorSchema, context: ExecutorContext) {
  assertBunAvailable();
  const result =  await Bun.build({
    entrypoints: options.entrypoints,
    define: options.define,
    outdir: options.outputPath,
    external: options.external,
    format: options.format,
    minify: options.define,
    naming: options.naming,
    publicPath: options.publicPath,
    sourcemap: options.sourcemap,
    splitting: options.splitting,
    target: options.target
  })
  for (const log of result.logs) {
    console.log(log)
  }
  if (result.success) {
    const outputTextAsync = result.outputs.flatMap(res => res.text())
    const outputText = await Promise.all(outputTextAsync);
    outputText.forEach(out => console.log(out))
    return { success: true }
  } else {
    return { success: false }
  }

}
