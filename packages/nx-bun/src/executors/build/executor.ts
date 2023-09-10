import { ExecutorContext } from '@nx/devkit';
import { assertBunAvailable, executeCliAsync, isBunSubprocess } from '../../utils/bun-cli';
import { BundleExecutorSchema } from './schema';
import { createAsyncIterable } from '@nx/devkit/src/utils/async-iterable';
import { parentPort } from 'worker_threads';
import { killCurrentProcess } from '../../utils/kill';

export default async function* bundleExecutor(options: BundleExecutorSchema, context: ExecutorContext) {

  await assertBunAvailable();
  if (globalThis.Bun !== undefined && !options.complie) {
    const result = await Bun.build({
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
      target: options.target,
      
    })
    for (const log of result.logs) {
      console.log(log)
    }
    if (result.success) {
      const outputTextAsync = result.outputs.flatMap(res => res.text())
      const outputText = await Promise.all(outputTextAsync);
      outputText.forEach(out => console.log(out))
      console.log(`Build completed for  ${context.projectName}`)
      return { success: true }
    } else {
      return { success: false }
    }
  } else {
    const args = createArgs(options, context);
    yield* createAsyncIterable(async ({ next, done }) => {
      const runningBun = await executeCliAsync(args, { stdio: 'pipe', stderr: 'inherit', stdin: 'pipe', stdout: 'inherit' });

      if (isBunSubprocess(runningBun)) {
        const writableStream = (type: 'stdout' | 'stderr') => {
          const textDecoder = new TextDecoder();
          return new WritableStream({
            write(chunk) {
              const text = textDecoder.decode(chunk);
              if (parentPort) {
                parentPort.postMessage({ type, message: text });
              } else {
                console.log(text);
              }
            },
            close() {
              console.log('Stream closed');
            },
            abort(err) {
              console.error('Stream aborted', err);
            }
          });
        }
        (runningBun.stdout as ReadableStream<Buffer>).pipeTo(writableStream('stdout'));
        (runningBun.stderr as ReadableStream<Buffer>).pipeTo(writableStream('stderr'));
      } else {
        const textDecoder = new TextDecoder();
        runningBun.stdout.on('data', (data) => {
          const textData = textDecoder.decode(data);
          if (parentPort) {
            parentPort.postMessage({ type: 'stdout', message: textData })
          } else {
            console.log(textData);
          }
        });
        runningBun.stderr.on('data', (data) => {
          const textData = textDecoder.decode(data);
          if (parentPort) {
            parentPort.postMessage({ type: 'stderr', message: textData })
          } else {
            console.log(textData);
          }
        });

      }

      process.on('SIGTERM', async () => {
        await killCurrentProcess(runningBun, 'SIGTERM');
        process.exit(128 + 15);
      });

      process.on('SIGINT', async () => {
        await killCurrentProcess(runningBun, 'SIGINT');
        process.exit(128 + 2);
      });

      process.on('SIGHUP', async () => {
        await killCurrentProcess(runningBun, 'SIGHUP');
        process.exit(128 + 1);
      });

      process.on('uncaughtException', async (err) => {
        console.error('Caught exception:', err);
        await killCurrentProcess(runningBun, 'SIGTERM');
        process.exit(1);
      });
      if (isBunSubprocess(runningBun)) {
        runningBun.exited.then((code) => {
          console.log(`Build completed for  ${context.projectName}`)
          next({ success: code === 0 });
        });
      } else {
        runningBun.on('exit', (code) => {
          console.log(`Build completed for  ${context.projectName}`)
          next({ success: code === 0 });
        });
      }
    })
  }
}
function createArgs(options: BundleExecutorSchema, context: ExecutorContext): string[] {
  const args: string[] = [];

    if (options.smol) {
      args.push('--smol');
    }  
  
    if (options.config) {
      args.push(`-c ${options.config}`)
    }
    
    if (options.tsconfig) {
      args.push(`--tsconfig-override ${options.tsconfig}`)
    }
  
    args.push('build')

    if (options.entrypoints) {
      args.push(`${options.entrypoints.join(' ./') }`);
    }

    if (options.external) {
      args.push(`--external=${options.external}`);
    }

    if (options.format) {
      args.push(`--format=${options.format}`);
    }

    if (options.minify) {
      args.push(`--minify`);
    }

    if (options.naming) {
      args.push(`--naming ${options.naming}`);
    }

    if (options.outputPath) {
      args.push(`--outdir=./${options.outputPath}`);
    }
    
    if (options.complie) {
      args.push('--complie')
    }
    if (options.plugins) {
      console.warn(`plugin is only support with --bun flag, and not in conjuction with --complie`)
    }

    if (options.publicPath) {
      console.warn(`publicPath is only support with --bun flag, and not in conjuction with --complie`)
    }


    return args;
}

